import { MobileRobotPose, MobileRobotSpecs, MobileRobotVelocity, PathWaypoint } from '../types/mobileRobot';
import { MobileRobotKinematics } from '../kinematics/MobileRobotKinematics';

export interface FollowerResult {
  velocity: MobileRobotVelocity;
  nextWaypointIndex: number;
  lookaheadPoint: PathWaypoint | null;
  crossTrackErrorM: number;
  isGoalReached: boolean;
}

export class TrajectoryFollower {
  private static LOOKAHEAD_MIN = 0.35; // 35 cm minimum lookahead
  private static GOAL_POS_TOLERANCE = 0.15; // 15 cm arrival threshold
  private static GOAL_HEADING_TOLERANCE_RAD = 0.05; // ~2.8 deg final heading tolerance
  private static IN_PLACE_ROTATION_THRESHOLD_RAD = 0.785; // 45 deg - threshold for in-place spin alignment

  /**
   * Computes forward and steering/angular commands using Pure Pursuit algorithm,
   * enhanced with:
   * 1. Immediate in-place heading alignment when error > 45° (prevents wide runaway turning loops)
   * 2. Smooth heading-attenuated forward speed scaling when aligned
   * 3. Robust orthogonal projection to prevent waypoint jumping
   * 4. Precise final position and orientation alignment at goal
   */
  public static computePurePursuit(
    currentPose: MobileRobotPose,
    path: PathWaypoint[],
    currentWaypointIndex: number,
    specs: MobileRobotSpecs,
    targetSpeedMps: number = 0.8,
    targetHeadingRad?: number
  ): FollowerResult {
    if (!path || path.length === 0) {
      return {
        velocity: { v: 0, vY: 0, omega: 0, steerAngleRad: 0 },
        nextWaypointIndex: 0,
        lookaheadPoint: null,
        crossTrackErrorM: 0,
        isGoalReached: true,
      };
    }

    const finalGoal = path[path.length - 1];
    const distToFinal = Math.hypot(finalGoal.x - currentPose.x, finalGoal.y - currentPose.y);

    // 1. Goal Arrival & Final Orientation Alignment
    if (distToFinal <= this.GOAL_POS_TOLERANCE) {
      if (targetHeadingRad !== undefined) {
        const headingErr = MobileRobotKinematics.normalizeAngle(targetHeadingRad - currentPose.thetaRad);
        if (Math.abs(headingErr) > this.GOAL_HEADING_TOLERANCE_RAD) {
          const rotSpeed =
            Math.sign(headingErr) *
            Math.min(specs.maxAngularSpeedRadps, Math.max(0.4, Math.abs(headingErr) * 2.2));
          return {
            velocity: { v: 0, vY: 0, omega: Number(rotSpeed.toFixed(3)), steerAngleRad: 0 },
            nextWaypointIndex: path.length - 1,
            lookaheadPoint: finalGoal,
            crossTrackErrorM: 0,
            isGoalReached: false,
          };
        }
      }

      return {
        velocity: { v: 0, vY: 0, omega: 0, steerAngleRad: 0 },
        nextWaypointIndex: path.length - 1,
        lookaheadPoint: finalGoal,
        crossTrackErrorM: 0,
        isGoalReached: true,
      };
    }

    // 2. Find closest point on path (searching within a reasonable forward window)
    let closestIdx = currentWaypointIndex;
    let minD = Infinity;
    const searchStart = Math.max(0, currentWaypointIndex - 5);
    const searchEnd = Math.min(path.length, currentWaypointIndex + 80);

    for (let i = searchStart; i < searchEnd; i++) {
      const d = Math.hypot(path[i].x - currentPose.x, path[i].y - currentPose.y);
      if (d < minD) {
        minD = d;
        closestIdx = i;
      }
    }

    // Dynamic lookahead distance based on target speed
    const lookaheadDist = Math.max(this.LOOKAHEAD_MIN, targetSpeedMps * 0.65);

    // 3. Find lookahead point searching forward from closestIdx
    let targetIdx = closestIdx;
    let lookaheadPoint: PathWaypoint = path[path.length - 1];

    for (let i = closestIdx; i < path.length; i++) {
      const d = Math.hypot(path[i].x - currentPose.x, path[i].y - currentPose.y);
      if (d >= lookaheadDist) {
        lookaheadPoint = path[i];
        targetIdx = i;
        break;
      }
    }

    // Vector to lookahead point
    const dx = lookaheadPoint.x - currentPose.x;
    const dy = lookaheadPoint.y - currentPose.y;
    const actualLookaheadDist = Math.max(0.1, Math.hypot(dx, dy));

    // Target angle in world coordinates
    const targetAngle = Math.atan2(dy, dx);

    // Alpha: angle between vehicle heading and vector to lookahead point
    const alpha = MobileRobotKinematics.normalizeAngle(targetAngle - currentPose.thetaRad);

    // Approximate cross-track error to lookahead segment
    const crossTrackError = actualLookaheadDist * Math.sin(alpha);

    // 4. IN-PLACE ROTATION MODE
    // If heading error is large (> 45 deg), DO NOT drive forward!
    // Enforce pure in-place differential spin to pivot towards the path.
    if (Math.abs(alpha) > this.IN_PLACE_ROTATION_THRESHOLD_RAD) {
      const rotSpeed =
        Math.sign(alpha) *
        Math.min(specs.maxAngularSpeedRadps, Math.max(0.45, Math.abs(alpha) * 2.2));
      return {
        velocity: { v: 0, vY: 0, omega: Number(rotSpeed.toFixed(3)), steerAngleRad: 0 },
        nextWaypointIndex: targetIdx,
        lookaheadPoint,
        crossTrackErrorM: Number(Math.abs(crossTrackError).toFixed(3)),
        isGoalReached: false,
      };
    }

    // 5. PURE PURSUIT TRACKING (when |alpha| <= 45 deg)
    const curvature = (2 * Math.sin(alpha)) / actualLookaheadDist;

    // Smooth speed scaling:
    // - cos^2(alpha) gently attenuates forward velocity during curved tracking
    // - distanceFactor tapers speed when decelerating towards final destination
    const speedFactor = Math.pow(Math.cos(alpha), 2);
    const distanceFactor = Math.min(1.0, Math.max(0.25, distToFinal / 0.8));
    const desiredV = Math.min(specs.maxLinearSpeedMps, targetSpeedMps) * speedFactor * distanceFactor;

    let desiredOmega = desiredV * curvature;
    desiredOmega = Math.max(-specs.maxAngularSpeedRadps, Math.min(specs.maxAngularSpeedRadps, desiredOmega));

    return {
      velocity: {
        v: Number(desiredV.toFixed(3)),
        vY: 0,
        omega: Number(desiredOmega.toFixed(3)),
        steerAngleRad: Number(Math.atan(specs.wheelBaseM * curvature).toFixed(3)),
      },
      nextWaypointIndex: targetIdx,
      lookaheadPoint,
      crossTrackErrorM: Number(Math.abs(crossTrackError).toFixed(3)),
      isGoalReached: false,
    };
  }
}
