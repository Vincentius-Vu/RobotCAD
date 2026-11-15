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
  private static LOOKAHEAD_MIN = 0.40; // 40 cm minimum lookahead
  private static GOAL_POS_TOLERANCE = 0.18; // 18 cm arrival threshold
  private static GOAL_HEADING_TOLERANCE_RAD = 0.04; // ~2.3 deg final orientation precision
  private static ROTATE_TRIGGER_RAD = 0.35; // ~20 deg (trigger in-place rotation during transit)
  private static ROTATE_FINISH_RAD = 0.05; // ~2.8 deg (exit in-place rotation: must rotate ALL THE WAY)

  // Navigation state machine
  private static isAligningInPlace: boolean = false;
  private static isAtGoalLatched: boolean = false;
  private static currentPathRef: PathWaypoint[] | null = null;

  public static resetState(): void {
    this.isAligningInPlace = false;
    this.isAtGoalLatched = false;
    this.currentPathRef = null;
  }

  /**
   * Computes forward and steering/angular commands using Pure Pursuit algorithm,
   * enhanced with:
   * 1. Hysteresis-governed In-Place Rotation: when heading error > 20°, robot halts
   *    and spins on the spot until heading is FULLY aligned (<= 2.8°) before
   *    transitioning to forward translation ("xoay hết hướng rồi mới tịnh tiến").
   * 2. Mandatory in-place alignment phase at the start of any new path or mission segment.
   * 3. Latched Goal Arrival with high-precision in-place heading alignment at destination.
   * 4. Smooth cos^2(alpha) attenuation during path tracking.
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
      this.resetState();
      return {
        velocity: { v: 0, vY: 0, omega: 0, steerAngleRad: 0 },
        nextWaypointIndex: 0,
        lookaheadPoint: null,
        crossTrackErrorM: 0,
        isGoalReached: true,
      };
    }

    // Detect path change (new segment or new mission target)
    if (this.currentPathRef !== path) {
      this.currentPathRef = path;
      this.isAligningInPlace = true; // Always start a new path segment by aligning heading in place
      this.isAtGoalLatched = false;
    }

    const finalGoal = path[path.length - 1];
    const distToFinal = Math.hypot(finalGoal.x - currentPose.x, finalGoal.y - currentPose.y);

    // 1. Goal Arrival & Final Orientation Alignment (Latched)
    if (distToFinal <= this.GOAL_POS_TOLERANCE || this.isAtGoalLatched) {
      this.isAtGoalLatched = true;

      if (targetHeadingRad !== undefined) {
        const headingErr = MobileRobotKinematics.normalizeAngle(targetHeadingRad - currentPose.thetaRad);
        if (Math.abs(headingErr) > this.GOAL_HEADING_TOLERANCE_RAD) {
          const rotSpeed =
            Math.sign(headingErr) *
            Math.min(specs.maxAngularSpeedRadps, Math.max(0.35, Math.abs(headingErr) * 2.5));
          return {
            velocity: { v: 0, vY: 0, omega: Number(rotSpeed.toFixed(3)), steerAngleRad: 0 },
            nextWaypointIndex: path.length - 1,
            lookaheadPoint: finalGoal,
            crossTrackErrorM: 0,
            isGoalReached: false,
          };
        }
      }

      // Reached goal position and orientation
      this.isAtGoalLatched = false;
      this.isAligningInPlace = false;
      this.currentPathRef = null;
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
    const crossTrackError = actualLookaheadDist * Math.sin(alpha);

    // 4. IN-PLACE HEADING ALIGNMENT PHASE (Hysteresis)
    // If heading error exceeds trigger threshold, enter in-place rotation
    if (Math.abs(alpha) > this.ROTATE_TRIGGER_RAD) {
      this.isAligningInPlace = true;
    }

    // Once in in-place rotation, robot MUST rotate ALL THE WAY until error <= 2.8° (0.05 rad)
    // before allowing any forward translation
    if (this.isAligningInPlace) {
      if (Math.abs(alpha) <= this.ROTATE_FINISH_RAD) {
        // Completely aligned! Transition cleanly to translation phase
        this.isAligningInPlace = false;
      } else {
        // Enforce STRICT ZERO forward velocity during rotation phase
        const rotSpeed =
          Math.sign(alpha) *
          Math.min(specs.maxAngularSpeedRadps, Math.max(0.35, Math.abs(alpha) * 2.5));
        return {
          velocity: { v: 0, vY: 0, omega: Number(rotSpeed.toFixed(3)), steerAngleRad: 0 },
          nextWaypointIndex: targetIdx,
          lookaheadPoint,
          crossTrackErrorM: Number(Math.abs(crossTrackError).toFixed(3)),
          isGoalReached: false,
        };
      }
    }

    // 5. TRANSLATION & PURE PURSUIT TRACKING (active only when heading is fully aligned)
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
