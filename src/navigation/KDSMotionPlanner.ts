/**
 * KDSMotionPlanner.ts
 * 
 * Context-Aware Kinematic Decomposition Strategy (KDS) & Jerk-Bounded Trajectory Planner
 * 
 * Key Features:
 *  1. Waypoint (orientation relaxed) vs Target (exact docking pose & dwell time)
 *  2. Bidirectional motion selection with +/- 5.0 deg (0.087 rad) Hysteresis Guard
 *  3. 3-Phase Decomposition: Rot1 -> Trans -> Rot2 with Zero-Jerk Handover
 *  4. Spatiotemporal Dilation Scaling (lambda_opt*) for Energy Minimization
 *  5. Active Kinematic Feasibility Guard for Schedule Deadline Enforcement
 *  6. SOTA Benchmarking (Trapezoidal RTR, Quintic Spline, Proposed KDS S-Curve)
 */

import { SCurveProfileGenerator } from '../kinematics/SCurveProfileGenerator';
import {
  TrajectoryAlgorithm,
  TrajectoryProfileGenerators,
} from '../kinematics/TrajectoryProfileGenerators';
import {
  KDSEnergyModel,
  AMRActuatorParams,
  DEFAULT_AMR_ACTUATOR_PARAMS,
} from '../physics/mobile/KDSEnergyModel';

export type KDSNodeType = 'Waypoint' | 'Target';

export interface KDSNode {
  id: number;
  name?: string;
  type: KDSNodeType;
  x: number;
  y: number;
  theta: number;        // heading in radians [-PI, PI]
  t_arrival?: number;   // arrival deadline in seconds (0 = unconstrained)
  t_dwell?: number;     // dwell duration at docking target (seconds)
}

export type KDSPhaseType = 'idle' | 'rot1' | 'trans' | 'rot2' | 'dwell';

export interface KDSTrajectoryPoint {
  t: number;
  x: number;
  y: number;
  theta: number;
  v: number;
  w: number;
  a: number;
  alpha: number;
  jerk: number;
  phase: KDSPhaseType;
  isBackward: boolean;
  segmentIndex: number;
  P_total: number;
  energyAccumJ: number;
}

export interface KDSPlanResult {
  algorithm: TrajectoryAlgorithm;
  points: KDSTrajectoryPoint[];
  totalTime: number;
  totalEnergyJ: number;
  peakJerk: number;
  peakAccel: number;
  isFeasible: boolean;
  effectiveLambda: number;
  energySavedPercent: number;
  segmentEnergies: number[];
}

export interface SOTAComparisonMetric {
  name: string;
  durationSec: number;
  totalEnergyJ: number;
  peakJerkMps3: number;
  peakAccelMps2: number;
  aisleContainmentMm: number; // Max lateral corridor deviation
  isFeasible: boolean;
  color: string;
}

export interface SOTABenchmarkSummary {
  trapezoidal: SOTAComparisonMetric;
  cubicSpline: SOTAComparisonMetric;
  quinticSpline: SOTAComparisonMetric;
  proposedKDS: SOTAComparisonMetric;
  energySavedVsTrapezoidPercent: number;
  energySavedVsCubicPercent: number;
  energySavedVsSplinePercent: number;
  vibrationReductionPercent: number;
}

export class KDSMotionPlanner {
  public static normalizeAngle(angle: number): number {
    return Math.atan2(Math.sin(angle), Math.cos(angle));
  }

  /**
   * Solves KDS decomposition for a single leg:
   * Selects Forward or Backward driving direction, and breaks the motion into [dTh1, distSigned, dTh2].
   * Hysteresis band (default 5.0 deg = 0.087 rad) prevents high-frequency chattering near PI/2.
   */
  public static solveKDS(
    currX: number,
    currY: number,
    currTheta: number,
    nextNode: KDSNode,
    enableBidirectional: boolean = true,
    prevIsBackward: boolean = false,
    hysteresisBandRad: number = (5.0 * Math.PI) / 180.0
  ): { phases: [number, number, number]; isBackward: boolean } {
    const dx = nextNode.x - currX;
    const dy = nextNode.y - currY;
    const distGeom = Math.sqrt(dx * dx + dy * dy);
    const pathAngle = Math.atan2(dy, dx);

    const deltaThFwd = this.normalizeAngle(pathAngle - currTheta);

    // Hysteresis switching threshold around PI/2
    const switchThreshold = prevIsBackward
      ? Math.PI / 2.0 - hysteresisBandRad
      : Math.PI / 2.0 + hysteresisBandRad;

    let isBackward = false;
    let motionHeading = pathAngle;
    let distSigned = distGeom;

    if (enableBidirectional && Math.abs(deltaThFwd) > switchThreshold) {
      isBackward = true;
      motionHeading = this.normalizeAngle(pathAngle - Math.PI);
      distSigned = -distGeom;
    }

    // Phase 1: Initial alignment rotation
    const dTh1 = this.normalizeAngle(motionHeading - currTheta);

    // Phase 3: Terminal rotation
    // For intermediate Waypoints, orientation is relaxed (no terminal rotation)
    // Terminal rotation dTh2 is applied ONLY at precision docking Target nodes
    let dTh2 = 0.0;
    if (nextNode.type === 'Target') {
      dTh2 = this.normalizeAngle(nextNode.theta - motionHeading);
    }

    return {
      phases: [dTh1, distSigned, dTh2],
      isBackward,
    };
  }

  /**
   * Computes minimum kinematic execution time for a decomposed leg
   */
  public static computeMinimumTime(
    distTrans: number,
    dth1: number,
    dth2: number,
    params: AMRActuatorParams = DEFAULT_AMR_ACTUATOR_PARAMS
  ): number {
    const pRot1 = SCurveProfileGenerator.computeProfileParams(
      dth1,
      params.W_lim,
      params.A_rot,
      params.J_rot,
      1.0
    );
    const pTrans = SCurveProfileGenerator.computeProfileParams(
      distTrans,
      params.V_lim,
      params.A_lim,
      params.J_lim,
      1.0
    );
    const pRot2 = SCurveProfileGenerator.computeProfileParams(
      dth2,
      params.W_lim,
      params.A_rot,
      params.J_rot,
      1.0
    );

    return pRot1.T_total + pTrans.T_total + pRot2.T_total;
  }

  /**
   * Plans unified jerk-bounded spatiotemporal trajectory across a sequence of KDS nodes.
   * Supports multiple trajectory generation algorithms: 'kds_scurve' | 'quintic' | 'cubic' | 'trapezoidal'.
   */
  public static planTrajectory(
    nodes: KDSNode[],
    useOptimalScaling: boolean = true,
    params: AMRActuatorParams = DEFAULT_AMR_ACTUATOR_PARAMS,
    dt: number = 0.005,
    enableBidirectional: boolean = true,
    algorithm: TrajectoryAlgorithm = 'kds_scurve'
  ): KDSPlanResult {
    if (!nodes || nodes.length < 2) {
      return {
        algorithm,
        points: [],
        totalTime: 0,
        totalEnergyJ: 0,
        peakJerk: 0,
        peakAccel: 0,
        isFeasible: true,
        effectiveLambda: 1.0,
        energySavedPercent: 0,
        segmentEnergies: [],
      };
    }

    const points: KDSTrajectoryPoint[] = [];
    let currClock = 0.0;
    let currPose = { x: nodes[0].x, y: nodes[0].y, theta: nodes[0].theta };
    let prevIsBackward = false;
    let allFeasible = true;
    let accumEnergy = 0.0;
    let maxJerkObserved = 0.0;
    let maxAccelObserved = 0.0;
    let totalNominalEnergy = 0.0;
    let avgLambda = 1.0;
    const segmentEnergies: number[] = [];

    // Push initial standstill point
    points.push({
      t: currClock,
      x: currPose.x,
      y: currPose.y,
      theta: currPose.theta,
      v: 0,
      w: 0,
      a: 0,
      alpha: 0,
      jerk: 0,
      phase: 'idle',
      isBackward: false,
      segmentIndex: 0,
      P_total: params.P_base,
      energyAccumJ: 0,
    });

    for (let i = 0; i < nodes.length - 1; i++) {
      const currNode = nodes[i];
      const nextNode = { ...nodes[i + 1] };

      // 1. Waypoint Context Heading Relaxation:
      // If next node is a Waypoint, align heading with line-of-sight vector
      if (nextNode.type === 'Waypoint') {
        const dx = nextNode.x - currPose.x;
        const dy = nextNode.y - currPose.y;
        nextNode.theta = this.normalizeAngle(Math.atan2(dy, dx));
      }

      // 2. Dwell phase execution at Target
      const effDwell = currNode.type === 'Target' ? currNode.t_dwell ?? 0.0 : 0.0;
      if (effDwell > 1e-4) {
        const dwellSteps = Math.floor(effDwell / dt);
        for (let s = 0; s < dwellSteps; s++) {
          currClock += dt;
          accumEnergy += params.P_base * dt;
          points.push({
            t: currClock,
            x: currPose.x,
            y: currPose.y,
            theta: currPose.theta,
            v: 0,
            w: 0,
            a: 0,
            alpha: 0,
            jerk: 0,
            phase: 'dwell',
            isBackward: false,
            segmentIndex: i,
            P_total: params.P_base,
            energyAccumJ: accumEnergy,
          });
        }
      }

      // 3. KDS Decomposition with Hysteresis Guard
      const kds = this.solveKDS(
        currPose.x,
        currPose.y,
        currPose.theta,
        nextNode,
        enableBidirectional,
        prevIsBackward
      );
      prevIsBackward = kds.isBackward;

      const [dTh1, distTrans, dTh2] = kds.phases;
      const T_min = this.computeMinimumTime(distTrans, dTh1, dTh2, params);

      // 4. Optimal Scaling & Kinematic Feasibility Guard
      const tDepart = currClock;
      let lambdaScale = 1.0;

      if (useOptimalScaling) {
        const coeff = KDSEnergyModel.computeCoefficients(distTrans, params);
        lambdaScale = coeff.lambda_opt;
      }

      // Feasibility Guard: check arrival deadline
      if (nextNode.t_arrival !== undefined && nextNode.t_arrival > 0.0) {
        const budget = nextNode.t_arrival - tDepart;
        if (budget < T_min - 1e-4) {
          // Infeasible deadline: clamp lambda to 1.0 and delay arrival
          allFeasible = false;
          lambdaScale = 1.0;
          nextNode.t_arrival = tDepart + T_min;
        } else {
          // Adapt lambda to fulfill scheduled budget if desired
          const lambdaBudget = budget / T_min;
          lambdaScale = Math.min(lambdaScale, lambdaBudget);
        }
      }

      avgLambda = (avgLambda * i + lambdaScale) / (i + 1);

      // 5. Compute motion profile parameters for all 3 phases based on selected algorithm
      const pRot1 = TrajectoryProfileGenerators.createProfile(
        algorithm,
        dTh1,
        params.W_lim,
        params.A_rot,
        params.J_rot,
        lambdaScale
      );
      const pTrans = TrajectoryProfileGenerators.createProfile(
        algorithm,
        distTrans,
        params.V_lim,
        params.A_lim,
        params.J_lim,
        lambdaScale
      );
      const pRot2 = TrajectoryProfileGenerators.createProfile(
        algorithm,
        dTh2,
        params.W_lim,
        params.A_rot,
        params.J_rot,
        lambdaScale
      );

      const segmentStartEnergy = accumEnergy;

      // Phase 1: Rot1
      let tPhase = dt;
      while (tPhase <= pRot1.T_total + 1e-6) {
        const tc = Math.min(tPhase, pRot1.T_total);
        const evalState = pRot1.evaluate(tc);
        currClock += dt;
        const currentHeading = this.normalizeAngle(currPose.theta + evalState.s);

        const power = KDSEnergyModel.computeInstantaneousPower(
          0.0,
          evalState.v,
          0.0,
          evalState.a,
          params
        );
        accumEnergy += power.P_total * dt;
        maxJerkObserved = Math.max(maxJerkObserved, Math.abs(evalState.j));
        maxAccelObserved = Math.max(maxAccelObserved, Math.abs(evalState.a));

        points.push({
          t: currClock,
          x: currPose.x,
          y: currPose.y,
          theta: currentHeading,
          v: 0.0,
          w: evalState.v,
          a: 0.0,
          alpha: evalState.a,
          jerk: evalState.j,
          phase: 'rot1',
          isBackward: kds.isBackward,
          segmentIndex: i,
          P_total: power.P_total,
          energyAccumJ: accumEnergy,
        });

        if (tc >= pRot1.T_total) break;
        tPhase += dt;
      }
      currPose.theta = this.normalizeAngle(currPose.theta + dTh1);

      // Phase 2: Translation
      const moveDirection = currPose.theta;
      const startX = currPose.x;
      const startY = currPose.y;
      tPhase = dt;

      while (tPhase <= pTrans.T_total + 1e-6) {
        const tc = Math.min(tPhase, pTrans.T_total);
        const evalState = pTrans.evaluate(tc);
        currClock += dt;
        const nx = startX + evalState.s * Math.cos(moveDirection);
        const ny = startY + evalState.s * Math.sin(moveDirection);

        const power = KDSEnergyModel.computeInstantaneousPower(
          evalState.v,
          0.0,
          evalState.a,
          0.0,
          params
        );
        accumEnergy += power.P_total * dt;
        maxJerkObserved = Math.max(maxJerkObserved, Math.abs(evalState.j));
        maxAccelObserved = Math.max(maxAccelObserved, Math.abs(evalState.a));

        points.push({
          t: currClock,
          x: nx,
          y: ny,
          theta: currPose.theta,
          v: evalState.v,
          w: 0.0,
          a: evalState.a,
          alpha: 0.0,
          jerk: evalState.j,
          phase: 'trans',
          isBackward: kds.isBackward,
          segmentIndex: i,
          P_total: power.P_total,
          energyAccumJ: accumEnergy,
        });

        if (tc >= pTrans.T_total) break;
        tPhase += dt;
      }
      currPose.x = nextNode.x;
      currPose.y = nextNode.y;

      // Phase 3: Rot2 (Target only)
      tPhase = dt;
      while (tPhase <= pRot2.T_total + 1e-6) {
        const tc = Math.min(tPhase, pRot2.T_total);
        const evalState = pRot2.evaluate(tc);
        currClock += dt;
        const currentHeading = this.normalizeAngle(currPose.theta + evalState.s);

        const power = KDSEnergyModel.computeInstantaneousPower(
          0.0,
          evalState.v,
          0.0,
          evalState.a,
          params
        );
        accumEnergy += power.P_total * dt;
        maxJerkObserved = Math.max(maxJerkObserved, Math.abs(evalState.j));
        maxAccelObserved = Math.max(maxAccelObserved, Math.abs(evalState.a));

        points.push({
          t: currClock,
          x: currPose.x,
          y: currPose.y,
          theta: currentHeading,
          v: 0.0,
          w: evalState.v,
          a: 0.0,
          alpha: evalState.a,
          jerk: evalState.j,
          phase: 'rot2',
          isBackward: kds.isBackward,
          segmentIndex: i,
          P_total: power.P_total,
          energyAccumJ: accumEnergy,
        });

        if (tc >= pRot2.T_total) break;
        tPhase += dt;
      }
      currPose.theta = this.normalizeAngle(currPose.theta + dTh2);

      const segmentEnergy = accumEnergy - segmentStartEnergy;
      segmentEnergies.push(segmentEnergy);

      // Estimate nominal energy for comparison
      const coeffNom = KDSEnergyModel.computeCoefficients(distTrans, params);
      totalNominalEnergy += coeffNom.E_nominal;
    }

    const energySavedPercent = totalNominalEnergy > 1e-4
      ? Math.max(0.0, ((totalNominalEnergy - accumEnergy) / totalNominalEnergy) * 100.0)
      : 0.0;

    return {
      algorithm,
      points,
      totalTime: currClock,
      totalEnergyJ: accumEnergy,
      peakJerk: maxJerkObserved,
      peakAccel: maxAccelObserved,
      isFeasible: allFeasible,
      effectiveLambda: avgLambda,
      energySavedPercent,
      segmentEnergies,
    };
  }

  /**
   * SOTA Benchmark Suite:
   * Compares 4 Motion Planning Algorithms across the exact same mission:
   * 1. Baseline 1: Trapezoidal Profile (1st-Order / C0 velocity, discontinuous step acceleration)
   * 2. Baseline 2: Cubic Polynomial Spline (2nd-Order / C1 velocity, linear acceleration, constant piecewise jerk)
   * 3. Baseline 3: Quintic Polynomial Spline (3rd-Order / C2 velocity & accel, smooth jerk)
   * 4. Proposed:   Energy-Optimal KDS S-Curve (7-Segment Zero-Jerk Handover + Spatiotemporal Scaling lambda_opt*)
   */
  public static runSOTAComparison(
    nodes: KDSNode[],
    params: AMRActuatorParams = DEFAULT_AMR_ACTUATOR_PARAMS,
    dt: number = 0.01
  ): SOTABenchmarkSummary {
    // 1. Proposed KDS S-Curve Plan with optimal lambda
    const kdsOptimal = this.planTrajectory(nodes, true, params, dt, true, 'kds_scurve');

    // 2. Traditional Trapezoidal RTR Plan
    const trapPlan = this.planTrajectory(nodes, false, params, dt, true, 'trapezoidal');

    // 3. Cubic Polynomial Spline Plan
    const cubicPlan = this.planTrajectory(nodes, false, params, dt, true, 'cubic');

    // 4. Quintic Polynomial Spline Plan
    const quinticPlan = this.planTrajectory(nodes, false, params, dt, true, 'quintic');

    const trapezoidMetric: SOTAComparisonMetric = {
      name: 'Trapezoidal RTR (1st-Order / C⁰)',
      durationSec: Number(trapPlan.totalTime.toFixed(2)),
      totalEnergyJ: Number(trapPlan.totalEnergyJ.toFixed(1)),
      peakJerkMps3: Number(trapPlan.peakJerk.toFixed(1)),
      peakAccelMps2: Number(trapPlan.peakAccel.toFixed(2)),
      aisleContainmentMm: 0.0, // In-place rotation keeps path straight on aisle
      isFeasible: trapPlan.isFeasible,
      color: '#ef4444', // Red
    };

    const cubicMetric: SOTAComparisonMetric = {
      name: 'Cubic Spline (2nd-Order / C¹)',
      durationSec: Number(cubicPlan.totalTime.toFixed(2)),
      totalEnergyJ: Number(cubicPlan.totalEnergyJ.toFixed(1)),
      peakJerkMps3: Number(cubicPlan.peakJerk.toFixed(1)),
      peakAccelMps2: Number(cubicPlan.peakAccel.toFixed(2)),
      aisleContainmentMm: 0.0,
      isFeasible: cubicPlan.isFeasible,
      color: '#38bdf8', // Sky blue
    };

    const quinticMetric: SOTAComparisonMetric = {
      name: 'Quintic Spline (3rd-Order / C²)',
      durationSec: Number(quinticPlan.totalTime.toFixed(2)),
      totalEnergyJ: Number(quinticPlan.totalEnergyJ.toFixed(1)),
      peakJerkMps3: Number(quinticPlan.peakJerk.toFixed(1)),
      peakAccelMps2: Number(quinticPlan.peakAccel.toFixed(2)),
      aisleContainmentMm: 0.0,
      isFeasible: quinticPlan.isFeasible,
      color: '#f59e0b', // Amber
    };

    const proposedMetric: SOTAComparisonMetric = {
      name: 'Proposed KDS S-Curve (Zero-Jerk & λ*)',
      durationSec: Number(kdsOptimal.totalTime.toFixed(2)),
      totalEnergyJ: Number(kdsOptimal.totalEnergyJ.toFixed(1)),
      peakJerkMps3: Number(kdsOptimal.peakJerk.toFixed(2)),
      peakAccelMps2: Number(kdsOptimal.peakAccel.toFixed(2)),
      aisleContainmentMm: 0.0, // Strict straight-line aisle alignment
      isFeasible: kdsOptimal.isFeasible,
      color: '#10b981', // Green
    };

    const energySavedVsTrapezoid = trapPlan.totalEnergyJ > 1e-4
      ? ((trapPlan.totalEnergyJ - kdsOptimal.totalEnergyJ) / trapPlan.totalEnergyJ) * 100.0
      : 0.0;
    const energySavedVsCubic = cubicPlan.totalEnergyJ > 1e-4
      ? ((cubicPlan.totalEnergyJ - kdsOptimal.totalEnergyJ) / cubicPlan.totalEnergyJ) * 100.0
      : 0.0;
    const energySavedVsSpline = quinticPlan.totalEnergyJ > 1e-4
      ? ((quinticPlan.totalEnergyJ - kdsOptimal.totalEnergyJ) / quinticPlan.totalEnergyJ) * 100.0
      : 0.0;
    const vibrationReduction = trapPlan.peakJerk > 1e-4
      ? ((trapPlan.peakJerk - kdsOptimal.peakJerk) / trapPlan.peakJerk) * 100.0
      : 0.0;

    return {
      trapezoidal: trapezoidMetric,
      cubicSpline: cubicMetric,
      quinticSpline: quinticMetric,
      proposedKDS: proposedMetric,
      energySavedVsTrapezoidPercent: Number(energySavedVsTrapezoid.toFixed(1)),
      energySavedVsCubicPercent: Number(energySavedVsCubic.toFixed(1)),
      energySavedVsSplinePercent: Number(energySavedVsSpline.toFixed(1)),
      vibrationReductionPercent: Number(vibrationReduction.toFixed(1)),
    };
  }
}
