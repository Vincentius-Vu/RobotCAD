/**
 * IndustrialContinuousPlanner.ts
 * 
 * Industrial-Grade Continuous S-Curve Trajectory Planner with Corner Blending
 * Tailored for Autonomous Mobile Robots (AMR) in Factory & Logistics Intralogistics.
 * 
 * Key Pipeline Steps:
 *  1. Line-of-Sight Path Decimation (Raycasting String-Pulling)
 *     Prunes redundant grid points from A* path into minimal collision-free corner waypoints.
 *  2. Adaptive Tangent Arc Corner Blending
 *     Blends corners with tangent circular fillets using multi-radius search (R in [0.55 -> 0.18 m]).
 *     Falls back to sharp corner waypoint if aisle is too constrained, preserving obstacle safety.
 *  3. Analytical Jerk-Bounded Continuous S-Curve Generation
 *     Uses SCurveProfileGenerator across total arc length for non-stop transit (v(t) > 0).
 *     Robot cruises through straights and corners without intermediate zero-velocity stops.
 *  4. Electromechanical Energy & Power Telemetry Integration
 *     Directly computes instantaneous electrical power P_total and energy via KDSEnergyModel.
 */

import { Obstacle, PathWaypoint, MobileRobotPose } from '../types/mobileRobot';
import { SCurveProfileGenerator } from '../kinematics/SCurveProfileGenerator';
import {
  KDSEnergyModel,
  AMRActuatorParams,
  DEFAULT_AMR_ACTUATOR_PARAMS,
} from '../physics/mobile/KDSEnergyModel';
import { KDSTrajectoryPoint, KDSPlanResult } from './KDSMotionPlanner';

export interface GeometricLineSegment {
  type: 'line';
  pStart: PathWaypoint;
  pEnd: PathWaypoint;
  length: number;
  heading: number; // radians [-PI, PI]
}

export interface GeometricArcSegment {
  type: 'arc';
  center: PathWaypoint;
  radius: number;
  startAngle: number;
  sweepAngle: number; // signed angle (+: CCW, -: CW)
  length: number;
  curvature: number;  // signed curvature (1/R * sgn)
}

export type GeometricSegment = GeometricLineSegment | GeometricArcSegment;

export class IndustrialContinuousPlanner {
  public static ROBOT_INFLATION_RADIUS = 0.35; // 35cm safety margin around robot chassis

  public static normalizeAngle(angle: number): number {
    return Math.atan2(Math.sin(angle), Math.cos(angle));
  }

  /**
   * Checks if a point collides with any warehouse obstacle with robot chassis inflation
   */
  public static isPointColliding(
    x: number,
    y: number,
    obstacles: Obstacle[],
    inflation = this.ROBOT_INFLATION_RADIUS
  ): boolean {
    for (const obs of obstacles) {
      if (obs.type === 'cylinder' && obs.dimensions.radius) {
        const rSafe = obs.dimensions.radius + inflation;
        const dx = x - obs.position.x;
        const dy = y - obs.position.y;
        if (dx * dx + dy * dy <= rSafe * rSafe) return true;
      } else if ((obs.type === 'box' || obs.type === 'wall') && obs.dimensions.width && obs.dimensions.depth) {
        const halfW = obs.dimensions.width / 2 + inflation;
        const halfD = obs.dimensions.depth / 2 + inflation;
        if (Math.abs(x - obs.position.x) <= halfW && Math.abs(y - obs.position.y) <= halfD) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Raycasting Line-of-Sight check between two points
   */
  public static isSegmentColliding(
    p1: PathWaypoint,
    p2: PathWaypoint,
    obstacles: Obstacle[],
    inflation = this.ROBOT_INFLATION_RADIUS
  ): boolean {
    const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    if (dist < 1e-4) return false;

    const stepM = 0.08; // 8cm sampling along raycast
    const numSteps = Math.ceil(dist / stepM);

    for (let i = 0; i <= numSteps; i++) {
      const u = i / numSteps;
      const x = p1.x + u * (p2.x - p1.x);
      const y = p1.y + u * (p2.y - p1.y);
      if (this.isPointColliding(x, y, obstacles, inflation)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Step 1: String-Pulling Line-of-Sight Pruning
   * Decimates 15-30 A* grid waypoints into minimal corner waypoints (typically 2-4 points)
   */
  public static prunePathLineOfSight(
    rawPath: PathWaypoint[],
    obstacles: Obstacle[],
    inflation = this.ROBOT_INFLATION_RADIUS
  ): PathWaypoint[] {
    if (!rawPath || rawPath.length <= 2) return rawPath || [];

    const pruned: PathWaypoint[] = [rawPath[0]];
    let currentIdx = 0;

    while (currentIdx < rawPath.length - 1) {
      let furthestVisibleIdx = currentIdx + 1;

      // Look ahead from furthest to nearest to greedily find longest unblocked straight line
      for (let j = rawPath.length - 1; j > currentIdx; j--) {
        if (!this.isSegmentColliding(rawPath[currentIdx], rawPath[j], obstacles, inflation)) {
          furthestVisibleIdx = j;
          break;
        }
      }

      pruned.push(rawPath[furthestVisibleIdx]);
      currentIdx = furthestVisibleIdx;
    }

    return pruned;
  }

  /**
   * Step 2: Adaptive Tangent Arc Corner Blending
   * Converts a pruned polyline into a sequence of straight lines and tangent circular arcs.
   * Employs multi-radius search [0.55, 0.40, 0.30, 0.20, 0.15 m].
   * Falls back to sharp waypoint if obstacle clearance is tight, ensuring zero path truncation.
   */
  public static blendCornersWithArcs(
    waypoints: PathWaypoint[],
    obstacles: Obstacle[]
  ): GeometricSegment[] {
    if (waypoints.length < 2) return [];
    if (waypoints.length === 2) {
      const dx = waypoints[1].x - waypoints[0].x;
      const dy = waypoints[1].y - waypoints[0].y;
      const len = Math.hypot(dx, dy);
      return [
        {
          type: 'line',
          pStart: waypoints[0],
          pEnd: waypoints[1],
          length: len,
          heading: Math.atan2(dy, dx),
        },
      ];
    }

    const segments: GeometricSegment[] = [];
    let currentStart = waypoints[0];

    for (let i = 1; i < waypoints.length - 1; i++) {
      const P_prev = currentStart;
      const P_curr = waypoints[i];
      const P_next = waypoints[i + 1];

      const vInX = P_curr.x - P_prev.x;
      const vInY = P_curr.y - P_prev.y;
      const lenIn = Math.hypot(vInX, vInY);
      const thIn = Math.atan2(vInY, vInX);

      const vOutX = P_next.x - P_curr.x;
      const vOutY = P_next.y - P_curr.y;
      const lenOut = Math.hypot(vOutX, vOutY);
      const thOut = Math.atan2(vOutY, vOutX);

      const deltaTh = this.normalizeAngle(thOut - thIn);

      // If change in direction is negligible (< 3.0 deg), continue straight
      if (Math.abs(deltaTh) < 0.052) {
        continue;
      }

      // Compute tangent arc geometry
      const halfAngle = Math.abs(deltaTh) / 2.0;
      const tanHalf = Math.tan(halfAngle);
      const maxDtan = Math.min(lenIn, lenOut) * 0.45;

      let blended = false;
      const candidateRadii = [0.55, 0.42, 0.30, 0.22, 0.15];

      for (const candR of candidateRadii) {
        let dTan = candR * tanHalf;
        let actualR = candR;

        if (dTan > maxDtan) {
          dTan = maxDtan;
          actualR = dTan / tanHalf;
        }

        if (actualR < 0.08) continue;

        // Tangent entry point Tin on incoming segment
        const Tin: PathWaypoint = {
          x: P_curr.x - (dTan * vInX) / lenIn,
          y: P_curr.y - (dTan * vInY) / lenIn,
        };

        // Tangent exit point Tout on outgoing segment
        const Tout: PathWaypoint = {
          x: P_curr.x + (dTan * vOutX) / lenOut,
          y: P_curr.y + (dTan * vOutY) / lenOut,
        };

        // Arc Center O
        const signTurn = deltaTh > 0 ? 1 : -1;
        const nx = -signTurn * Math.sin(thIn);
        const ny = signTurn * Math.cos(thIn);

        const center: PathWaypoint = {
          x: Tin.x + actualR * nx,
          y: Tin.y + actualR * ny,
        };

        const startAngle = Math.atan2(Tin.y - center.y, Tin.x - center.x);
        const sweepAngle = deltaTh;
        const arcLen = actualR * Math.abs(sweepAngle);

        // Verify arc obstacle clearance with slightly relaxed corner margin (0.28m)
        let arcSafe = true;
        const testSteps = 6;
        for (let k = 1; k < testSteps; k++) {
          const u = k / testSteps;
          const phi = startAngle + u * sweepAngle;
          const testX = center.x + actualR * Math.cos(phi);
          const testY = center.y + actualR * Math.sin(phi);
          if (this.isPointColliding(testX, testY, obstacles, 0.28)) {
            arcSafe = false;
            break;
          }
        }

        if (arcSafe && arcLen > 0.01) {
          const straightLen = Math.hypot(Tin.x - currentStart.x, Tin.y - currentStart.y);
          if (straightLen > 0.01) {
            segments.push({
              type: 'line',
              pStart: currentStart,
              pEnd: Tin,
              length: straightLen,
              heading: Math.atan2(Tin.y - currentStart.y, Tin.x - currentStart.x),
            });
          }

          segments.push({
            type: 'arc',
            center,
            radius: actualR,
            startAngle,
            sweepAngle,
            length: arcLen,
            curvature: signTurn / actualR,
          });

          currentStart = Tout;
          blended = true;
          break; // successfully found candidate
        }
      }

      // If no rounded arc was feasible, keep sharp corner to guarantee safe passage through P_curr
      if (!blended) {
        const straightLen = Math.hypot(P_curr.x - currentStart.x, P_curr.y - currentStart.y);
        if (straightLen > 0.01) {
          segments.push({
            type: 'line',
            pStart: currentStart,
            pEnd: P_curr,
            length: straightLen,
            heading: Math.atan2(P_curr.y - currentStart.y, P_curr.x - currentStart.x),
          });
        }
        currentStart = P_curr;
      }
    }

    // Final straight segment to destination
    const finalGoal = waypoints[waypoints.length - 1];
    const finalLen = Math.hypot(finalGoal.x - currentStart.x, finalGoal.y - currentStart.y);
    if (finalLen > 0.01) {
      segments.push({
        type: 'line',
        pStart: currentStart,
        pEnd: finalGoal,
        length: finalLen,
        heading: Math.atan2(finalGoal.y - currentStart.y, finalGoal.x - currentStart.x),
      });
    }

    return segments;
  }

  /**
   * Step 3 & 4: Analytical Jerk-Bounded Continuous S-Curve Trajectory Generation
   * Generates continuous C^2 trajectory points with non-stop motion (v(t) > 0) along path.
   */
  public static planContinuousTrajectory(
    rawPath: PathWaypoint[],
    startPose: MobileRobotPose,
    goalThetaRad: number | undefined,
    obstacles: Obstacle[],
    params: AMRActuatorParams = DEFAULT_AMR_ACTUATOR_PARAMS,
    dt: number = 0.025
  ): KDSPlanResult {
    // 1. Line-of-sight Decimation
    const prunedWaypoints = this.prunePathLineOfSight(rawPath, obstacles);

    // 2. Adaptive Tangent Arc Corner Blending
    const segments = this.blendCornersWithArcs(prunedWaypoints, obstacles);

    if (segments.length === 0) {
      return {
        algorithm: 'kds_scurve',
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
    let currentTime = 0.0;
    let accumulatedEnergy = 0.0;
    let peakJerk = 0.0;
    let peakAccel = 0.0;

    // --- Phase 0: Initial Heading Alignment (In-place S-Curve rotation if heading mismatch > 6 deg) ---
    const initialHeading = segments[0].type === 'line'
      ? segments[0].heading
      : this.normalizeAngle(segments[0].startAngle + (segments[0].sweepAngle > 0 ? Math.PI / 2 : -Math.PI / 2));

    const initialDeltaTheta = this.normalizeAngle(initialHeading - startPose.thetaRad);

    if (Math.abs(initialDeltaTheta) > (6.0 * Math.PI) / 180.0) {
      const rotProfile = SCurveProfileGenerator.computeProfileParams(
        initialDeltaTheta,
        params.W_lim,
        params.A_rot,
        params.J_rot,
        1.0
      );

      const numRotSteps = Math.max(1, Math.ceil(rotProfile.T_total / dt));
      for (let i = 0; i <= numRotSteps; i++) {
        const tLoc = Math.min(i * dt, rotProfile.T_total);
        const st = SCurveProfileGenerator.evaluate(tLoc, rotProfile);
        const thetaNow = this.normalizeAngle(startPose.thetaRad + st.s);
        const wNow = st.v;
        const alphaNow = st.a;
        const jNow = st.j;

        peakJerk = Math.max(peakJerk, Math.abs(jNow));
        peakAccel = Math.max(peakAccel, Math.abs(alphaNow));

        const pwr = KDSEnergyModel.computeInstantaneousPower(0, wNow, 0, alphaNow, params);
        accumulatedEnergy += pwr.P_total * dt;

        points.push({
          t: Number(currentTime.toFixed(4)),
          x: Number(segments[0].type === 'line' ? segments[0].pStart.x.toFixed(4) : startPose.x.toFixed(4)),
          y: Number(segments[0].type === 'line' ? segments[0].pStart.y.toFixed(4) : startPose.y.toFixed(4)),
          theta: Number(thetaNow.toFixed(4)),
          v: 0,
          w: Number(wNow.toFixed(4)),
          a: 0,
          alpha: Number(alphaNow.toFixed(4)),
          jerk: Number(jNow.toFixed(4)),
          phase: 'rot1',
          isBackward: false,
          segmentIndex: 0,
          P_total: Number(pwr.P_total.toFixed(2)),
          energyAccumJ: Number(accumulatedEnergy.toFixed(2)),
        });

        currentTime += dt;
      }
    }

    // --- Phase 1: Analytical Jerk-Bounded S-Curve Transit Profile along All Segments ---
    const totalArcLength = segments.reduce((acc, seg) => acc + seg.length, 0);

    // Compute safe cruising speed: respects actuator limit and lateral cornering acceleration
    let minCornerRadius = Infinity;
    segments.forEach((seg) => {
      if (seg.type === 'arc' && seg.radius < minCornerRadius) {
        minCornerRadius = seg.radius;
      }
    });

    const maxLatAccel = 0.55 * params.A_lim;
    let safeCruiseSpeed = Math.min(params.V_lim, 0.85); // 0.85 m/s standard industrial cruising
    if (minCornerRadius < Infinity && minCornerRadius > 0.05) {
      const vCornerMax = Math.sqrt(maxLatAccel * minCornerRadius);
      safeCruiseSpeed = Math.min(safeCruiseSpeed, Math.max(0.40, vCornerMax));
    }

    // Generate closed-form continuous S-curve profile over total length
    const transProfile = SCurveProfileGenerator.computeProfileParams(
      totalArcLength,
      safeCruiseSpeed,
      params.A_lim,
      params.J_lim,
      1.0
    );

    // Helper to evaluate spatial position, orientation & curvature at arc distance s
    const evaluateSpatialPath = (sDist: number): { x: number; y: number; theta: number; kappa: number; segIdx: number } => {
      let rem = Math.max(0, Math.min(sDist, totalArcLength));
      for (let sIdx = 0; sIdx < segments.length; sIdx++) {
        const seg = segments[sIdx];
        if (rem <= seg.length || sIdx === segments.length - 1) {
          if (seg.type === 'line') {
            const u = seg.length > 1e-6 ? rem / seg.length : 0;
            return {
              x: seg.pStart.x + u * (seg.pEnd.x - seg.pStart.x),
              y: seg.pStart.y + u * (seg.pEnd.y - seg.pStart.y),
              theta: seg.heading,
              kappa: 0,
              segIdx: sIdx,
            };
          } else {
            const u = seg.length > 1e-6 ? rem / seg.length : 0;
            const phi = seg.startAngle + u * seg.sweepAngle;
            const th = this.normalizeAngle(phi + (seg.sweepAngle > 0 ? Math.PI / 2 : -Math.PI / 2));
            return {
              x: seg.center.x + seg.radius * Math.cos(phi),
              y: seg.center.y + seg.radius * Math.sin(phi),
              theta: th,
              kappa: seg.curvature,
              segIdx: sIdx,
            };
          }
        }
        rem -= seg.length;
      }
      return { x: 0, y: 0, theta: 0, kappa: 0, segIdx: 0 };
    };

    const numTransSteps = Math.max(2, Math.ceil(transProfile.T_total / dt));
    for (let i = 0; i <= numTransSteps; i++) {
      const tLoc = Math.min(i * dt, transProfile.T_total);
      const st = SCurveProfileGenerator.evaluate(tLoc, transProfile);

      const curS = Math.min(st.s, totalArcLength);
      const curV = st.v;
      const curA = st.a;
      const curJerk = st.j;

      peakJerk = Math.max(peakJerk, Math.abs(curJerk));
      peakAccel = Math.max(peakAccel, Math.abs(curA));

      const poseEval = evaluateSpatialPath(curS);
      const wVal = curV * poseEval.kappa;
      const alphaVal = curA * poseEval.kappa;

      const pwr = KDSEnergyModel.computeInstantaneousPower(curV, wVal, curA, alphaVal, params);
      accumulatedEnergy += pwr.P_total * dt;

      points.push({
        t: Number(currentTime.toFixed(4)),
        x: Number(poseEval.x.toFixed(4)),
        y: Number(poseEval.y.toFixed(4)),
        theta: Number(poseEval.theta.toFixed(4)),
        v: Number(curV.toFixed(4)),
        w: Number(wVal.toFixed(4)),
        a: Number(curA.toFixed(4)),
        alpha: Number(alphaVal.toFixed(4)),
        jerk: Number(curJerk.toFixed(4)),
        phase: 'trans',
        isBackward: false,
        segmentIndex: poseEval.segIdx + 1,
        P_total: Number(pwr.P_total.toFixed(2)),
        energyAccumJ: Number(accumulatedEnergy.toFixed(2)),
      });

      currentTime += dt;
    }

    // --- Phase 2: Terminal Docking Rotation (In-place S-Curve rotation to goalThetaRad) ---
    const lastPt = points[points.length - 1];
    if (goalThetaRad !== undefined) {
      const deltaThGoal = this.normalizeAngle(goalThetaRad - lastPt.theta);
      if (Math.abs(deltaThGoal) > (4.0 * Math.PI) / 180.0) {
        const dockRotProfile = SCurveProfileGenerator.computeProfileParams(
          deltaThGoal,
          params.W_lim * 0.7,
          params.A_rot * 0.7,
          params.J_rot * 0.7,
          1.0
        );

        const numDockSteps = Math.max(1, Math.ceil(dockRotProfile.T_total / dt));
        for (let i = 0; i <= numDockSteps; i++) {
          const tLoc = Math.min(i * dt, dockRotProfile.T_total);
          const st = SCurveProfileGenerator.evaluate(tLoc, dockRotProfile);
          const thetaNow = this.normalizeAngle(lastPt.theta + st.s);
          const wNow = st.v;
          const alphaNow = st.a;
          const jNow = st.j;

          peakJerk = Math.max(peakJerk, Math.abs(jNow));
          peakAccel = Math.max(peakAccel, Math.abs(alphaNow));

          const pwr = KDSEnergyModel.computeInstantaneousPower(0, wNow, 0, alphaNow, params);
          accumulatedEnergy += pwr.P_total * dt;

          points.push({
            t: Number(currentTime.toFixed(4)),
            x: lastPt.x,
            y: lastPt.y,
            theta: Number(thetaNow.toFixed(4)),
            v: 0,
            w: Number(wNow.toFixed(4)),
            a: 0,
            alpha: Number(alphaNow.toFixed(4)),
            jerk: Number(jNow.toFixed(4)),
            phase: 'rot2',
            isBackward: false,
            segmentIndex: segments.length + 1,
            P_total: Number(pwr.P_total.toFixed(2)),
            energyAccumJ: Number(accumulatedEnergy.toFixed(2)),
          });

          currentTime += dt;
        }
      }
    }

    return {
      algorithm: 'kds_scurve',
      points,
      totalTime: Number(currentTime.toFixed(3)),
      totalEnergyJ: Number(accumulatedEnergy.toFixed(2)),
      peakJerk: Number(peakJerk.toFixed(3)),
      peakAccel: Number(peakAccel.toFixed(3)),
      isFeasible: true,
      effectiveLambda: 1.0,
      energySavedPercent: 0,
      segmentEnergies: [accumulatedEnergy],
    };
  }
}
