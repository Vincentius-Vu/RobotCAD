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
  private static LOOKAHEAD_MIN = 0.45; // 45 cm
  private static GOAL_TOLERANCE = 0.15; // 15 cm

  /**
   * Computes forward and steering commands using Pure Pursuit algorithm,
   * with automatic in-place orientation alignment at the final goal.
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

    if (distToFinal <= this.GOAL_TOLERANCE) {
      // In-place rotation to target heading if specified
      if (targetHeadingRad !== undefined) {
        const headingErr = MobileRobotKinematics.normalizeAngle(targetHeadingRad - currentPose.thetaRad);
        if (Math.abs(headingErr) > 0.05) {
          const rotSpeed =
            Math.sign(headingErr) *
            Math.min(specs.maxAngularSpeedRadps * 0.7, Math.max(0.25, Math.abs(headingErr) * 1.5));
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

    // Dynamic lookahead distance based on current speed
    const lookaheadDist = Math.max(this.LOOKAHEAD_MIN, targetSpeedMps * 0.7);

    // Find the next lookahead point along the path
    let targetIdx = currentWaypointIndex;
    let lookaheadPoint: PathWaypoint = path[path.length - 1];

    for (let i = currentWaypointIndex; i < path.length; i++) {
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
    const actualLookaheadDist = Math.hypot(dx, dy);

    // Angle to target in world coordinates
    const targetAngle = Math.atan2(dy, dx);

    // Alpha: angle between vehicle heading and line to lookahead point
    const alpha = MobileRobotKinematics.normalizeAngle(targetAngle - currentPose.thetaRad);

    // Curvature kappa = 2 * sin(alpha) / Ld
    const curvature = (2 * Math.sin(alpha)) / Math.max(0.1, actualLookaheadDist);

    // Speed planning: slow down during sharp turns or approaching goal
    const speedFactor = Math.max(0.25, Math.cos(alpha));
    const distanceFactor = Math.min(1.0, distToFinal / 1.0);
    const desiredV = Math.min(specs.maxLinearSpeedMps, targetSpeedMps) * speedFactor * distanceFactor;

    // Angular velocity omega = v * curvature
    let desiredOmega = desiredV * curvature;
    desiredOmega = Math.max(-specs.maxAngularSpeedRadps, Math.min(specs.maxAngularSpeedRadps, desiredOmega));

    // Approximate cross-track error to nearest path segment
    const crossTrackError = actualLookaheadDist * Math.sin(alpha);

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
