/**
 * DiscreteLyapunovTracker.ts
 * 
 * Layer 3 Discrete-Time Nonlinear Lyapunov Pose-Tracking Controller
 * Based on Kanayama & Jiang-Nijmeijer nonholonomic kinematic tracking framework.
 * 
 * Guarantees Input-to-State Practical Stability (ISpS) and Uniform Ultimate
 * Boundedness (UUB) under discrete-time Zero-Order Hold (ZOH) sampling latency
 * (Ts = 50 ms / 20 Hz) and tire micro-slip disturbances.
 * 
 * Error Dynamics in Robot-Fixed Frame:
 *   [e_x]     [ cos(th)   sin(th)  0 ] [ x_r - x ]
 *   [e_y]   = [-sin(th)   cos(th)  0 ] [ y_r - y ]
 *   [e_th]    [   0         0      1 ] [ th_r - th ]
 * 
 * Control Lyapunov Function (CLF):
 *   V(e) = 0.5 * (e_x^2 + e_y^2) + (1 / gamma) * (1 - cos(e_th))
 * 
 * Nonlinear Kinematic Control Law:
 *   v_c(t)     = v_r(t) * cos(e_th) + k1 * e_x
 *   omega_c(t) = omega_r(t) + k2 * v_r(t) * e_y + k3 * e_th
 * 
 * Adaptive Pole-Placement Gain Scheduling:
 *   omega_n = sqrt(omega_r^2 + gamma * v_r^2)
 *   k1 = 2 * zeta * omega_n,   k2 = gamma,   k3 = k1
 */

import { MobileRobotPose, KDSTrajectoryPoint } from '../types/mobileRobot';
import { MobileRobotKinematics } from '../kinematics/MobileRobotKinematics';

export interface LyapunovTrackerConfig {
  gamma: number;            // Lyapunov gain parameter (default: 2.5)
  zeta: number;             // Damping ratio for pole placement (default: 0.8)
  k1Min: number;            // Minimum gain floor for k1 (default: 1.2)
  k3Min: number;            // Minimum gain floor for k3 (default: 1.5)
  samplingPeriodTs: number; // ZOH sampling period (s, default: 0.05 s = 20 Hz)
  maxLinearSpeed: number;   // Linear actuator limit (m/s)
  maxAngularSpeed: number;  // Angular actuator limit (rad/s)
  dockingToleranceM: number;// Docking precision radius (m, default: 0.015 m)
}

export const DEFAULT_LYAPUNOV_CONFIG: LyapunovTrackerConfig = {
  gamma: 2.5,
  zeta: 0.8,
  k1Min: 1.2,
  k3Min: 1.5,
  samplingPeriodTs: 0.05,
  maxLinearSpeed: 1.2,
  maxAngularSpeed: 2.5,
  dockingToleranceM: 0.015,
};

export interface TrackingControlOutput {
  v_cmd: number;        // Commanded linear velocity (m/s)
  omega_cmd: number;    // Commanded angular velocity (rad/s)
  ex: number;           // Longitudinal error in robot body frame (m)
  ey: number;           // Lateral error in robot body frame (m)
  eThetaRad: number;    // Heading error (rad)
  eThetaDeg: number;    // Heading error (deg)
  ePosM: number;        // Euclidean position error (m)
  ePosMm: number;       // Euclidean position error (mm)
  lyapunovV: number;    // Instantaneous Lyapunov function value
  isDwell: boolean;     // Whether robot is in dwell/docking invariant state
}

export class DiscreteLyapunovTracker {
  /**
   * Evaluates closed-loop tracking control command and error coordinates
   */
  public static computeControl(
    currentPose: MobileRobotPose,
    refPoint: KDSTrajectoryPoint,
    config: LyapunovTrackerConfig = DEFAULT_LYAPUNOV_CONFIG,
    measuredWz?: number
  ): TrackingControlOutput {
    const dx = refPoint.x - currentPose.x;
    const dy = refPoint.y - currentPose.y;
    const th = currentPose.thetaRad;

    // 1. Transform world tracking error into robot-fixed body coordinates
    const cosTh = Math.cos(th);
    const sinTh = Math.sin(th);

    const ex = cosTh * dx + sinTh * dy;
    const ey = -sinTh * dx + cosTh * dy;
    const eTheta = MobileRobotKinematics.normalizeAngle(refPoint.theta - th);

    const ePosM = Math.hypot(ex, ey);
    const ePosMm = ePosM * 1000.0;
    const eThetaDeg = (eTheta * 180.0) / Math.PI;

    // 2. Control Lyapunov Function (CLF)
    const lyapunovV = 0.5 * (ex * ex + ey * ey) + (1.0 / config.gamma) * (1.0 - Math.cos(eTheta));

    // 3. Check for Stationary Dwell and Docking Phase
    // During zero-velocity dwell phases (vr = wr = 0), Brockett's obstruction prevents
    // continuous asymptotic stabilization to a point. Clamping commands to 0 prevents chattering.
    const isZeroRef = Math.abs(refPoint.v) < 1e-4 && Math.abs(refPoint.w) < 1e-4;
    const isDwell = refPoint.phase === 'dwell' || (isZeroRef && ePosM <= config.dockingToleranceM);

    if (isDwell) {
      return {
        v_cmd: 0.0,
        omega_cmd: 0.0,
        ex,
        ey,
        eThetaRad: eTheta,
        eThetaDeg,
        ePosM,
        ePosMm,
        lyapunovV,
        isDwell: true,
      };
    }

    // 4. In-Place Rotation vs Planar Tracking Regime Detection
    const vr = refPoint.v;
    const wr = refPoint.w;
    const isInPlaceRotation = Math.abs(vr) < 0.06;

    let v_cmd: number;
    let omega_cmd: number;

    if (isInPlaceRotation) {
      // In-place rotation (v_r ≈ 0): Tire lateral cornering damping vanishes.
      // High heading gain k3 acting on second-order yaw inertia (Iz = 12.5 kg*m^2)
      // causes massive phase lag and overshoot (>50°).
      // Solution: Soft heading proportional gain (k3_rot = 0.8) + active yaw rate derivative damping (kd_yaw = 0.35)
      // with bounded trim authority (±0.35 rad/s) preserving the feedforward S-curve profile.
      const k3_rot = 0.8;
      const kd_yaw = 0.35;
      const wz_fb = measuredWz ?? wr;
      const trim_raw = k3_rot * eTheta - kd_yaw * (wz_fb - wr);
      const max_trim = 0.35;
      const trim = Math.max(-max_trim, Math.min(max_trim, trim_raw));

      v_cmd = 0.0;
      omega_cmd = wr + trim;
    } else {
      // Continuous Pole-Placement Adaptive Gain Scheduling for Driving (vr > 0)
      const omegaN = Math.sqrt(wr * wr + config.gamma * vr * vr);
      const k1 = Math.max(config.k1Min, 2.0 * config.zeta * omegaN);
      const k2 = config.gamma;
      const k3 = Math.max(config.k3Min, 2.0 * config.zeta * omegaN);

      // Nonlinear Kinematic Control Law
      v_cmd = vr * Math.cos(eTheta) + k1 * ex;
      omega_cmd = wr + k2 * vr * ey + k3 * eTheta;
    }

    // 5. Actuator Saturation Clamping
    v_cmd = Math.max(-config.maxLinearSpeed, Math.min(config.maxLinearSpeed, v_cmd));
    omega_cmd = Math.max(-config.maxAngularSpeed, Math.min(config.maxAngularSpeed, omega_cmd));

    return {
      v_cmd,
      omega_cmd,
      ex,
      ey,
      eThetaRad: eTheta,
      eThetaDeg,
      ePosM,
      ePosMm,
      lyapunovV,
      isDwell: false,
    };
  }

  /**
   * Interpolates reference trajectory state at continuous time t
   */
  public static sampleReference(
    trajectory: KDSTrajectoryPoint[],
    t: number
  ): KDSTrajectoryPoint {
    if (!trajectory || trajectory.length === 0) {
      return {
        t,
        x: 0,
        y: 0,
        theta: 0,
        v: 0,
        w: 0,
        a: 0,
        alpha: 0,
        jerk: 0,
        phase: 'idle',
        isBackward: false,
        segmentIndex: 0,
        P_total: 10.0,
        energyAccumJ: 0,
      };
    }

    if (t <= trajectory[0].t) return trajectory[0];
    if (t >= trajectory[trajectory.length - 1].t) return trajectory[trajectory.length - 1];

    // Binary search for interval
    let low = 0;
    let high = trajectory.length - 1;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (trajectory[mid].t <= t) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    const idx0 = Math.max(0, high);
    const idx1 = Math.min(trajectory.length - 1, idx0 + 1);

    if (idx0 === idx1) return trajectory[idx0];

    const p0 = trajectory[idx0];
    const p1 = trajectory[idx1];
    const dt = Math.max(1e-6, p1.t - p0.t);
    const frac = (t - p0.t) / dt;

    // Angle interpolation with wrap-around
    const dTheta = MobileRobotKinematics.normalizeAngle(p1.theta - p0.theta);
    const interpTheta = MobileRobotKinematics.normalizeAngle(p0.theta + frac * dTheta);

    return {
      t,
      x: p0.x + frac * (p1.x - p0.x),
      y: p0.y + frac * (p1.y - p0.y),
      theta: interpTheta,
      v: p0.v + frac * (p1.v - p0.v),
      w: p0.w + frac * (p1.w - p0.w),
      a: p0.a + frac * (p1.a - p0.a),
      alpha: p0.alpha + frac * (p1.alpha - p0.alpha),
      jerk: p0.jerk + frac * (p1.jerk - p0.jerk),
      phase: frac > 0.5 ? p1.phase : p0.phase,
      isBackward: p0.isBackward,
      segmentIndex: p0.segmentIndex,
      P_total: p0.P_total + frac * (p1.P_total - p0.P_total),
      energyAccumJ: p0.energyAccumJ + frac * (p1.energyAccumJ - p0.energyAccumJ),
    };
  }
}
