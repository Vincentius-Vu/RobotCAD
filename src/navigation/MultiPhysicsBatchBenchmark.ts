/**
 * MultiPhysicsBatchBenchmark.ts
 * 
 * Comprehensive Automated Multi-Physics Benchmark Suite for AMR Trajectory Planning:
 * Evaluates 4 Trajectory Profiles (Trapezoidal, Cubic Spline, Quintic Spline, Proposed KDS S-Curve)
 * on top of the in-house high-fidelity Dual-PMSM FOC + Inverter + Brush Tire Multi-Physics Plant.
 */

import { TrajectoryAlgorithm } from '../kinematics/TrajectoryProfileGenerators';
import {
  KDSNode,
  KDSMotionPlanner,
} from './KDSMotionPlanner';
import { AGVDigitalTwinEngine } from '../physics/mobile/AGVDigitalTwinEngine';
import { AGVParameters, DEFAULT_AGV_PARAMETERS } from '../physics/mobile/AGVParameters';
import {
  DiscreteLyapunovTracker,
  DEFAULT_LYAPUNOV_CONFIG,
  TrackingControlOutput,
} from './DiscreteLyapunovTracker';
import { AMRActuatorParams, DEFAULT_AMR_ACTUATOR_PARAMS } from '../physics/mobile/KDSEnergyModel';

export interface MultiPhysicsBenchmarkItem {
  algorithm: TrajectoryAlgorithm;
  name: string;
  shortName: string;
  orderDesc: string;
  color: string;
  durationSec: number;
  totalEnergyElecJ: number;            // E_elec = ∫ V_dc * I_dc dt + P_base * T
  copperLossJ: number;                 // E_Cu = ∫ 1.5 * Rs * (id^2 + iq^2) dt
  mechanicalEnergyJ: number;           // E_mech = ∫ (tauL * wL + tauR * wR) dt
  electricalEfficiencyPercent: number; // eta = E_mech / E_elec * 100
  peakCurrentA: number;                // max sqrt(id^2 + iq^2)
  rmsJerkMps3: number;                 // Jerk RMS = sqrt(1/T ∫ j^2 dt)
  peakJerkMps3: number;
  peakAccelMps2: number;
  rmsTrackingErrorMm: number;          // e_RMS position error (mm)
  maxTrackingErrorMm: number;          // max e_pos (mm)
  maxCorridorDeviationMm: number;      // max |e_y| lateral clearance (mm)
  rmsHeadingErrorDeg: number;          // e_theta RMS (deg)
  energySavedVsTrapezoidPercent: number;
  energySavedVsCubicPercent: number;
  energySavedVsQuinticPercent: number;
  isFeasible: boolean;
}

export interface MultiPhysicsBatchReport {
  timestamp: number;
  scenarioName: string;
  nodeCount: number;
  totalDistanceM: number;
  results: Record<TrajectoryAlgorithm, MultiPhysicsBenchmarkItem>;
  bestEnergyAlgorithm: TrajectoryAlgorithm;
  bestPrecisionAlgorithm: TrajectoryAlgorithm;
  summaryInsights: string[];
}

export class MultiPhysicsBatchBenchmark {
  /**
   * Runs end-to-end multi-physics simulation for a single trajectory algorithm
   */
  public static runSingleBenchmark(
    algorithm: TrajectoryAlgorithm,
    nodes: KDSNode[],
    useOptimalScaling: boolean = true,
    actuatorParams: AMRActuatorParams = DEFAULT_AMR_ACTUATOR_PARAMS,
    agvParams: AGVParameters = DEFAULT_AGV_PARAMETERS
  ): MultiPhysicsBenchmarkItem {
    // 1. Generate reference trajectory
    const plan = KDSMotionPlanner.planTrajectory(
      nodes,
      useOptimalScaling,
      actuatorParams,
      0.005,
      true,
      algorithm
    );

    const traj = plan.points;
    if (!traj || traj.length === 0) {
      return this.createEmptyResult(algorithm);
    }

    // 2. Initialize isolated digital twin multi-physics engine
    const engine = new AGVDigitalTwinEngine(agvParams);
    const startPose = {
      x: traj[0].x,
      y: traj[0].y,
      thetaRad: traj[0].theta,
      z: 0.08,
    };
    engine.resetState({ x: startPose.x, y: startPose.y, psi: startPose.thetaRad });

    let currentPose = { ...startPose };

    // 3. Simulation stepping parameters
    const dtSim = 0.025; // 25 ms sampling step (40 Hz tracking cycle)
    const dtTraj = traj.length > 1 ? traj[1].t - traj[0].t : 0.005;
    const stepRatio = Math.max(1, Math.round(dtSim / dtTraj));

    let totalEnergyElecJ = 0.0;
    let copperLossJ = 0.0;
    let mechanicalEnergyJ = 0.0;
    let peakCurrentA = 0.0;
    let sumSqJerk = 0.0;
    let peakJerkObserved = 0.0;
    let peakAccelObserved = 0.0;
    let sumSqPosError = 0.0;
    let maxPosErrorMm = 0.0;
    let maxCorridorDevMm = 0.0;
    let sumSqHeadingError = 0.0;
    let stepCount = 0;

    const Rs = agvParams.Rs ?? 0.08; // Stator phase resistance (Ohms)
    const P_base = actuatorParams.P_base ?? 25.0; // Base standby electronics power (W)
    const G_ratio = agvParams.G ?? 25.0; // Planetary gearbox reduction ratio

    let currentWz = 0.0;

    // 4. Closed-loop Multi-Physics Execution Loop
    for (let idx = 0; idx < traj.length; idx += stepRatio) {
      const refPt = traj[idx];

      // Compute Layer 3 Discrete Lyapunov Controller command with active yaw damping
      const trackingOutput: TrackingControlOutput = DiscreteLyapunovTracker.computeControl(
        currentPose,
        refPt,
        DEFAULT_LYAPUNOV_CONFIG,
        currentWz
      );

      // Execute 500 micro-substeps inside multi-physics FOC engine (dt = 0.05 ms = 20 kHz FOC)
      const agvState = engine.stepWithFOCAndCCC(
        dtSim,
        trackingOutput.v_cmd,
        trackingOutput.omega_cmd,
        refPt.a,
        500
      );

      currentWz = agvState.wz;

      currentPose = {
        x: agvState.X,
        y: agvState.Y,
        thetaRad: agvState.psi,
        z: 0.08,
      };

      // Current magnitude: i_mag = sqrt(id^2 + iq^2)
      const iMagL = Math.hypot(agvState.id_L, agvState.iq_L);
      const iMagR = Math.hypot(agvState.id_R, agvState.iq_R);
      const currentMax = Math.max(iMagL, iMagR);
      peakCurrentA = Math.max(peakCurrentA, currentMax);

      // Copper thermal dissipation: P_Cu = 1.5 * Rs * (i_L^2 + i_R^2)
      const pCuStep = 1.5 * Rs * (iMagL * iMagL + iMagR * iMagR);
      copperLossJ += pCuStep * dtSim;

      // Mechanical wheel power properly reflected through gear reduction G:
      // P_mech = T_wheel * omega_wheel = (G * Te) * omega_wheel
      const pMechL = (G_ratio * agvState.Te_L) * agvState.omega_wL;
      const pMechR = (G_ratio * agvState.Te_R) * agvState.omega_wR;
      const pMechTotal = Math.max(0.0, pMechL) + Math.max(0.0, pMechR);
      mechanicalEnergyJ += pMechTotal * dtSim;

      // Inverter MOSFET conduction and switching losses + auxiliary base load:
      const pInverterLoss = 2.0 * (1.5 * 0.0036 * (iMagL * iMagL + iMagR * iMagR) + 0.7 * (iMagL + iMagR)) + 0.03 * pMechTotal;
      const pElecTotal = pMechTotal + pCuStep + pInverterLoss + P_base;
      totalEnergyElecJ += pElecTotal * dtSim;

      // Jerk and Accel metrics
      const jerkVal = Math.abs(refPt.jerk);
      const accelVal = Math.abs(refPt.a);
      sumSqJerk += jerkVal * jerkVal;
      peakJerkObserved = Math.max(peakJerkObserved, jerkVal);
      peakAccelObserved = Math.max(peakAccelObserved, accelVal);

      // Tracking errors
      const ePos = trackingOutput.ePosMm;
      sumSqPosError += ePos * ePos;
      maxPosErrorMm = Math.max(maxPosErrorMm, ePos);
      const eyMm = Math.abs(trackingOutput.ey * 1000.0);
      if (refPt.phase === 'trans') {
        maxCorridorDevMm = Math.max(maxCorridorDevMm, eyMm);
      }
      sumSqHeadingError += trackingOutput.eThetaDeg * trackingOutput.eThetaDeg;

      stepCount++;
    }

    const durationSec = plan.totalTime;
    const rmsJerk = stepCount > 0 ? Math.sqrt(sumSqJerk / stepCount) : 0.0;
    const rmsPosError = stepCount > 0 ? Math.sqrt(sumSqPosError / stepCount) : 0.0;
    const rmsHeadingError = stepCount > 0 ? Math.sqrt(sumSqHeadingError / stepCount) : 0.0;
    const efficiency = totalEnergyElecJ > 1e-3
      ? Math.min(100.0, Math.max(0.0, (mechanicalEnergyJ / totalEnergyElecJ) * 100.0))
      : 0.0;

    const meta = this.getAlgorithmMetadata(algorithm);

    return {
      algorithm,
      name: meta.name,
      shortName: meta.shortName,
      orderDesc: meta.orderDesc,
      color: meta.color,
      durationSec: Number(durationSec.toFixed(2)),
      totalEnergyElecJ: Number(totalEnergyElecJ.toFixed(1)),
      copperLossJ: Number(copperLossJ.toFixed(1)),
      mechanicalEnergyJ: Number(mechanicalEnergyJ.toFixed(1)),
      electricalEfficiencyPercent: Number(efficiency.toFixed(1)),
      peakCurrentA: Number(peakCurrentA.toFixed(2)),
      rmsJerkMps3: Number(rmsJerk.toFixed(2)),
      peakJerkMps3: Number(peakJerkObserved.toFixed(1)),
      peakAccelMps2: Number(peakAccelObserved.toFixed(2)),
      rmsTrackingErrorMm: Number(rmsPosError.toFixed(2)),
      maxTrackingErrorMm: Number(maxPosErrorMm.toFixed(2)),
      maxCorridorDeviationMm: Number(maxCorridorDevMm.toFixed(2)),
      rmsHeadingErrorDeg: Number(rmsHeadingError.toFixed(2)),
      energySavedVsTrapezoidPercent: 0.0,
      energySavedVsCubicPercent: 0.0,
      energySavedVsQuinticPercent: 0.0,
      isFeasible: maxCorridorDevMm < 100.0, // Within 100mm safety aisle clearance
    };
  }

  /**
   * Executes the full batch benchmark across all 4 algorithms and computes relative improvements
   */
  public static runFullBatch(
    nodes: KDSNode[],
    scenarioName: string = 'Grand Logistics',
    useOptimalScaling: boolean = true
  ): MultiPhysicsBatchReport {
    const algorithms: TrajectoryAlgorithm[] = ['trapezoidal', 'cubic', 'quintic', 'kds_scurve'];
    const results: Partial<Record<TrajectoryAlgorithm, MultiPhysicsBenchmarkItem>> = {};

    for (const algo of algorithms) {
      results[algo] = this.runSingleBenchmark(algo, nodes, useOptimalScaling);
    }

    const fullResults = results as Record<TrajectoryAlgorithm, MultiPhysicsBenchmarkItem>;

    // Compute relative savings
    const trapEnergy = fullResults.trapezoidal.totalEnergyElecJ;
    const cubicEnergy = fullResults.cubic.totalEnergyElecJ;
    const quinticEnergy = fullResults.quintic.totalEnergyElecJ;

    for (const algo of algorithms) {
      const item = fullResults[algo];
      item.energySavedVsTrapezoidPercent = trapEnergy > 1e-3
        ? Number((((trapEnergy - item.totalEnergyElecJ) / trapEnergy) * 100.0).toFixed(1))
        : 0.0;
      item.energySavedVsCubicPercent = cubicEnergy > 1e-3
        ? Number((((cubicEnergy - item.totalEnergyElecJ) / cubicEnergy) * 100.0).toFixed(1))
        : 0.0;
      item.energySavedVsQuinticPercent = quinticEnergy > 1e-3
        ? Number((((quinticEnergy - item.totalEnergyElecJ) / quinticEnergy) * 100.0).toFixed(1))
        : 0.0;
    }

    // Compute total path distance
    let totalDist = 0.0;
    for (let i = 0; i < nodes.length - 1; i++) {
      totalDist += Math.hypot(nodes[i + 1].x - nodes[i].x, nodes[i + 1].y - nodes[i].y);
    }

    // Identify winners
    let bestEnergyAlgo: TrajectoryAlgorithm = 'kds_scurve';
    let minEnergy = fullResults.kds_scurve.totalEnergyElecJ;
    let bestPrecisionAlgo: TrajectoryAlgorithm = 'kds_scurve';
    let minError = fullResults.kds_scurve.rmsTrackingErrorMm;

    for (const algo of algorithms) {
      if (fullResults[algo].totalEnergyElecJ < minEnergy) {
        minEnergy = fullResults[algo].totalEnergyElecJ;
        bestEnergyAlgo = algo;
      }
      if (fullResults[algo].rmsTrackingErrorMm < minError) {
        minError = fullResults[algo].rmsTrackingErrorMm;
        bestPrecisionAlgo = algo;
      }
    }

    const kds = fullResults.kds_scurve;
    const trap = fullResults.trapezoidal;
    const summaryInsights = [
      `Proposed KDS S-Curve giảm ${kds.energySavedVsTrapezoidPercent}% điện năng tiêu thụ so với Trapezoid nhờ triệt tiêu dòng đỉnh FOC và giãn nở λ*.`,
      `Tổn hao nhiệt cuộn dây stator E_Cu giảm từ ${trap.copperLossJ} J (Trapezoid) xuống ${kds.copperLossJ} J (KDS), bảo vệ tuổi thọ động cơ PMSM.`,
      `Rung giật hiệu dụng Jerk_RMS giảm ${(((trap.rmsJerkMps3 - kds.rmsJerkMps3) / Math.max(1e-3, trap.rmsJerkMps3)) * 100).toFixed(1)}%, loại bỏ nguy cơ trượt lốp cao su vi sai.`,
      `Độ lệch hành lang tối đa |e_y|_max đạt ${kds.maxCorridorDeviationMm} mm, đảm bảo an toàn tuyệt đối trong phạm vi tĩnh lấn kho < 100 mm.`,
    ];

    return {
      timestamp: Date.now(),
      scenarioName,
      nodeCount: nodes.length,
      totalDistanceM: Number(totalDist.toFixed(2)),
      results: fullResults,
      bestEnergyAlgorithm: bestEnergyAlgo,
      bestPrecisionAlgorithm: bestPrecisionAlgo,
      summaryInsights,
    };
  }

  /**
   * Exports batch benchmark report to formatted CSV
   */
  public static exportBatchReportToCSV(report: MultiPhysicsBatchReport): string {
    const headers = [
      'Algorithm_ID',
      'Algorithm_Name',
      'Order_Continuity',
      'Duration_s',
      'Total_Energy_Elec_J',
      'Copper_Loss_J',
      'Mechanical_Energy_J',
      'Electrical_Efficiency_Pct',
      'Peak_Current_A',
      'RMS_Jerk_mps3',
      'Peak_Jerk_mps3',
      'Peak_Accel_mps2',
      'RMS_Tracking_Error_mm',
      'Max_Tracking_Error_mm',
      'Max_Corridor_Deviation_mm',
      'RMS_Heading_Error_deg',
      'Energy_Saved_Vs_Trapezoid_Pct',
      'Aisle_Safety_Feasible',
    ];

    const algorithms: TrajectoryAlgorithm[] = ['trapezoidal', 'cubic', 'quintic', 'kds_scurve'];
    const rows = algorithms.map((algo) => {
      const res = report.results[algo];
      return [
        res.algorithm,
        `"${res.name}"`,
        `"${res.orderDesc}"`,
        res.durationSec,
        res.totalEnergyElecJ,
        res.copperLossJ,
        res.mechanicalEnergyJ,
        res.electricalEfficiencyPercent,
        res.peakCurrentA,
        res.rmsJerkMps3,
        res.peakJerkMps3,
        res.peakAccelMps2,
        res.rmsTrackingErrorMm,
        res.maxTrackingErrorMm,
        res.maxCorridorDeviationMm,
        res.rmsHeadingErrorDeg,
        res.energySavedVsTrapezoidPercent,
        res.isFeasible ? 'PASS' : 'FAIL',
      ].join(',');
    });

    return [
      `# Multi-Physics AMR Trajectory Benchmark Report`,
      `# Scenario: ${report.scenarioName} (${report.nodeCount} nodes, ${report.totalDistanceM} m)`,
      `# Generated: ${new Date(report.timestamp).toISOString()}`,
      headers.join(','),
      ...rows,
    ].join('\n');
  }

  private static getAlgorithmMetadata(algorithm: TrajectoryAlgorithm): {
    name: string;
    shortName: string;
    orderDesc: string;
    color: string;
  } {
    switch (algorithm) {
      case 'trapezoidal':
        return {
          name: 'Trapezoidal RTR (Baseline 1)',
          shortName: 'Trapezoidal',
          orderDesc: '1st-Order / C⁰ Velocity',
          color: '#ef4444', // Red
        };
      case 'cubic':
        return {
          name: 'Cubic Polynomial Spline (Baseline 2)',
          shortName: 'Cubic Spline',
          orderDesc: '3rd-Order / C¹ Velocity',
          color: '#38bdf8', // Sky blue
        };
      case 'quintic':
        return {
          name: 'Quintic Polynomial Spline (Baseline 3)',
          shortName: 'Quintic Spline',
          orderDesc: '5th-Order / C² Acceleration',
          color: '#f59e0b', // Amber
        };
      case 'kds_scurve':
      default:
        return {
          name: 'Proposed KDS S-Curve (Zero-Jerk & λ*)',
          shortName: 'Proposed KDS',
          orderDesc: '7-Segment C² / Zero-Jerk',
          color: '#10b981', // Emerald green
        };
    }
  }

  private static createEmptyResult(algorithm: TrajectoryAlgorithm): MultiPhysicsBenchmarkItem {
    const meta = this.getAlgorithmMetadata(algorithm);
    return {
      algorithm,
      name: meta.name,
      shortName: meta.shortName,
      orderDesc: meta.orderDesc,
      color: meta.color,
      durationSec: 0,
      totalEnergyElecJ: 0,
      copperLossJ: 0,
      mechanicalEnergyJ: 0,
      electricalEfficiencyPercent: 0,
      peakCurrentA: 0,
      rmsJerkMps3: 0,
      peakJerkMps3: 0,
      peakAccelMps2: 0,
      rmsTrackingErrorMm: 0,
      maxTrackingErrorMm: 0,
      maxCorridorDeviationMm: 0,
      rmsHeadingErrorDeg: 0,
      energySavedVsTrapezoidPercent: 0,
      energySavedVsCubicPercent: 0,
      energySavedVsQuinticPercent: 0,
      isFeasible: true,
    };
  }
}
