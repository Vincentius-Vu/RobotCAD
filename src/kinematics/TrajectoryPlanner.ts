import * as THREE from 'three';
import { RobotModel } from '../types/robot';
import {
  Waypoint,
  TrajectoryInterpolationType,
  TrajectoryPlan,
  TrajectorySample,
  TrajectoryPreset,
  TrajectoryOptions,
} from '../types/trajectory';
import { RobotKinematics } from './RobotKinematics';
import {
  DoubleTanhProfileGenerator,
  logCoshStable,
  tanhPade,
} from './DoubleTanhProfileGenerator';

export class TrajectoryPlanner {
  /**
   * Plans a complete multi-waypoint trajectory across joint or Cartesian space
   */
  public static planTrajectory(
    waypoints: Waypoint[],
    type: TrajectoryInterpolationType,
    robotModel: RobotModel,
    timeStep = 0.02,
    options?: TrajectoryOptions
  ): TrajectoryPlan {
    if (waypoints.length === 0) {
      return {
        samples: [],
        totalDuration: 0,
        timeStep,
        waypoints: [],
        interpolationType: type,
        doubleTanhMode: options?.doubleTanhMode,
        usePadeApproximation: options?.usePadeApproximation,
      };
    }

    if (waypoints.length === 1) {
      const wp = waypoints[0];
      const sample: TrajectorySample = {
        time: 0,
        jointAngles: [...wp.jointAngles],
        jointVelocities: new Array(robotModel.dof).fill(0),
        jointAccelerations: new Array(robotModel.dof).fill(0),
        tcpPosition: { ...wp.cartesianPose.position },
        tcpLinearVelocity: 0,
        segmentIndex: 0,
      };
      return {
        samples: [sample],
        totalDuration: 0,
        timeStep,
        waypoints,
        interpolationType: type,
        doubleTanhMode: options?.doubleTanhMode,
        usePadeApproximation: options?.usePadeApproximation,
      };
    }

    if (type === 'cartesian-linear') {
      return this.planCartesianLinearTrajectory(waypoints, robotModel, timeStep);
    }

    return this.planJointSpaceTrajectory(waypoints, type, robotModel, timeStep, options);
  }

  /**
   * Joint Space Interpolator supporting Cubic, Quintic, and LSPB profiles
   */
  private static planJointSpaceTrajectory(
    waypoints: Waypoint[],
    type: TrajectoryInterpolationType,
    robotModel: RobotModel,
    timeStep: number,
    options?: TrajectoryOptions
  ): TrajectoryPlan {
    const dof = robotModel.dof;
    const numSegments = waypoints.length - 1;
    const samples: TrajectorySample[] = [];

    // Calculate segment durations and internal boundary velocities
    const durations: number[] = [];
    for (let i = 0; i < numSegments; i++) {
      durations.push(Math.max(0.1, waypoints[i + 1].segmentDuration || 2.0));
    }

    // Compute boundary velocities (deg/s) using central differences
    const velocities: number[][] = [];
    for (let i = 0; i < waypoints.length; i++) {
      const v = new Array(dof).fill(0);
      if (i > 0 && i < waypoints.length - 1) {
        const dtPrev = durations[i - 1];
        const dtNext = durations[i];
        for (let j = 0; j < dof; j++) {
          const dqPrev = waypoints[i].jointAngles[j] - waypoints[i - 1].jointAngles[j];
          const dqNext = waypoints[i + 1].jointAngles[j] - waypoints[i].jointAngles[j];
          // Zero velocity if motion reverses direction (cusp/corner)
          if (dqPrev * dqNext < 0) {
            v[j] = 0;
          } else {
            v[j] = 0.5 * (dqPrev / dtPrev + dqNext / dtNext);
          }
        }
      }
      velocities.push(v);
    }

    let globalTime = 0;

    for (let seg = 0; seg < numSegments; seg++) {
      const q0 = waypoints[seg].jointAngles;
      const q1 = waypoints[seg + 1].jointAngles;
      const v0 = velocities[seg];
      const v1 = velocities[seg + 1];
      const T = durations[seg];

      const steps = Math.max(2, Math.round(T / timeStep));
      const dt = T / steps;

      for (let s = 0; s < (seg === numSegments - 1 ? steps + 1 : steps); s++) {
        const t = Math.min(T, s * dt);
        const q_t = new Array(dof).fill(0);
        const qd_t = new Array(dof).fill(0);
        const qdd_t = new Array(dof).fill(0);

        for (let j = 0; j < dof; j++) {
          if (type === 'quintic') {
            const { q, qd, qdd } = this.evalQuintic(q0[j], q1[j], v0[j], v1[j], 0, 0, t, T);
            q_t[j] = q;
            qd_t[j] = qd;
            qdd_t[j] = qdd;
          } else if (type === 'lspb') {
            const { q, qd, qdd } = this.evalLSPB(q0[j], q1[j], t, T);
            q_t[j] = q;
            qd_t[j] = qd;
            qdd_t[j] = qdd;
          } else if (type === 's-curve') {
            const { q, qd, qdd } = this.evalSCurve(q0[j], q1[j], t, T);
            q_t[j] = q;
            qd_t[j] = qd;
            qdd_t[j] = qdd;
          } else if (type === 'double-tanh') {
            const margin = options?.doubleTanhMode === 'time-optimized' ? 2.8 : 3.8;
            const usePade = options?.usePadeApproximation ?? false;
            const { q, qd, qdd } = this.evalDoubleTanh(q0[j], q1[j], t, T, margin, usePade);
            q_t[j] = q;
            qd_t[j] = qd;
            qdd_t[j] = qdd;
          } else {
            // Cubic default
            const { q, qd, qdd } = this.evalCubic(q0[j], q1[j], v0[j], v1[j], t, T);
            q_t[j] = q;
            qd_t[j] = qd;
            qdd_t[j] = qdd;
          }
        }

        // Compute TCP position via FK
        const transforms = RobotKinematics.computeForwardKinematics(robotModel.joints, q_t);
        const tcpTransform = transforms[transforms.length - 1];
        const tcpPos = new THREE.Vector3();
        tcpTransform.decompose(tcpPos, new THREE.Quaternion(), new THREE.Vector3());

        // Compute TCP speed (mm/s)
        let linearSpeed = 0;
        if (samples.length > 0) {
          const prev = samples[samples.length - 1];
          const dist = Math.hypot(
            tcpPos.x - prev.tcpPosition.x,
            tcpPos.y - prev.tcpPosition.y,
            tcpPos.z - prev.tcpPosition.z
          );
          const dtActual = (globalTime + t) - prev.time;
          if (dtActual > 1e-4) {
            linearSpeed = dist / dtActual;
          }
        }

        samples.push({
          time: Number((globalTime + t).toFixed(3)),
          jointAngles: q_t,
          jointVelocities: qd_t,
          jointAccelerations: qdd_t,
          tcpPosition: { x: tcpPos.x, y: tcpPos.y, z: tcpPos.z },
          tcpLinearVelocity: linearSpeed,
          segmentIndex: seg,
        });
      }

      globalTime += T;
    }

    return {
      samples,
      totalDuration: Number(globalTime.toFixed(3)),
      timeStep,
      waypoints,
      interpolationType: type,
      doubleTanhMode: options?.doubleTanhMode,
      usePadeApproximation: options?.usePadeApproximation,
    };
  }

  /**
   * Cartesian Linear Path with SLERP for Orientations
   */
  private static planCartesianLinearTrajectory(
    waypoints: Waypoint[],
    robotModel: RobotModel,
    timeStep: number
  ): TrajectoryPlan {
    const dof = robotModel.dof;
    const numSegments = waypoints.length - 1;
    const samples: TrajectorySample[] = [];

    let globalTime = 0;
    let seedJoints = [...waypoints[0].jointAngles];

    for (let seg = 0; seg < numSegments; seg++) {
      const wp0 = waypoints[seg];
      const wp1 = waypoints[seg + 1];
      const T = Math.max(0.1, wp1.segmentDuration || 2.0);

      const p0 = new THREE.Vector3(
        wp0.cartesianPose.position.x,
        wp0.cartesianPose.position.y,
        wp0.cartesianPose.position.z
      );
      const p1 = new THREE.Vector3(
        wp1.cartesianPose.position.x,
        wp1.cartesianPose.position.y,
        wp1.cartesianPose.position.z
      );

      const q0 = new THREE.Quaternion().setFromRotationMatrix(wp0.cartesianPose.matrix);
      const q1 = new THREE.Quaternion().setFromRotationMatrix(wp1.cartesianPose.matrix);

      const steps = Math.max(2, Math.round(T / timeStep));
      const dt = T / steps;

      for (let s = 0; s < (seg === numSegments - 1 ? steps + 1 : steps); s++) {
        const t = Math.min(T, s * dt);
        const tau = t / T;

        // Smooth 5th-order polynomial timing parameter s(tau): 10*tau^3 - 15*tau^4 + 6*tau^5
        const s_tau = 10 * Math.pow(tau, 3) - 15 * Math.pow(tau, 4) + 6 * Math.pow(tau, 5);
        const s_dot = (30 * Math.pow(tau, 2) - 60 * Math.pow(tau, 3) + 30 * Math.pow(tau, 4)) / T;

        // Linear interpolation of position
        const interpPos = new THREE.Vector3().lerpVectors(p0, p1, s_tau);

        // SLERP of quaternion orientation
        const interpQuat = q0.clone().slerp(q1, s_tau);

        // Construct 4x4 target transformation matrix
        const targetMatrix = new THREE.Matrix4().compose(
          interpPos,
          interpQuat,
          new THREE.Vector3(1, 1, 1)
        );

        // Solve IK seeded from previous configuration for smooth continuity
        const solvedJoints = RobotKinematics.solveNumericalIK(
          robotModel.joints,
          seedJoints,
          targetMatrix,
          30,
          0.05
        );

        const currentJoints = solvedJoints ? solvedJoints : [...seedJoints];
        seedJoints = [...currentJoints];

        // Numerical finite difference for joint velocities and accelerations
        const qd = new Array(dof).fill(0);
        const qdd = new Array(dof).fill(0);
        if (samples.length > 0) {
          const prev = samples[samples.length - 1];
          const dtActual = (globalTime + t) - prev.time;
          if (dtActual > 1e-4) {
            for (let j = 0; j < dof; j++) {
              qd[j] = (currentJoints[j] - prev.jointAngles[j]) / dtActual;
              qdd[j] = (qd[j] - prev.jointVelocities[j]) / dtActual;
            }
          }
        }

        const linearDist = p0.distanceTo(p1);
        const linearSpeed = linearDist * Math.abs(s_dot);

        samples.push({
          time: Number((globalTime + t).toFixed(3)),
          jointAngles: currentJoints,
          jointVelocities: qd,
          jointAccelerations: qdd,
          tcpPosition: { x: interpPos.x, y: interpPos.y, z: interpPos.z },
          tcpLinearVelocity: linearSpeed,
          segmentIndex: seg,
        });
      }

      globalTime += T;
    }

    return {
      samples,
      totalDuration: Number(globalTime.toFixed(3)),
      timeStep,
      waypoints,
      interpolationType: 'cartesian-linear',
    };
  }

  /**
   * Evaluates Cubic Polynomial: q(t) = a0 + a1*t + a2*t^2 + a3*t^3
   */
  private static evalCubic(
    q0: number,
    q1: number,
    v0: number,
    v1: number,
    t: number,
    T: number
  ) {
    const dq = q1 - q0;
    const a0 = q0;
    const a1 = v0;
    const a2 = (3 * dq) / Math.pow(T, 2) - (2 * v0 + v1) / T;
    const a3 = (-2 * dq) / Math.pow(T, 3) + (v0 + v1) / Math.pow(T, 2);

    const q = a0 + a1 * t + a2 * Math.pow(t, 2) + a3 * Math.pow(t, 3);
    const qd = a1 + 2 * a2 * t + 3 * a3 * Math.pow(t, 2);
    const qdd = 2 * a2 + 6 * a3 * t;

    return { q, qd, qdd };
  }

  /**
   * Evaluates Quintic Polynomial: q(t) = c0 + c1*t + c2*t^2 + c3*t^3 + c4*t^4 + c5*t^5
   */
  private static evalQuintic(
    q0: number,
    q1: number,
    v0: number,
    v1: number,
    a0: number,
    a1: number,
    t: number,
    T: number
  ) {
    const dq = q1 - q0;
    const T2 = Math.pow(T, 2);
    const T3 = Math.pow(T, 3);
    const T4 = Math.pow(T, 4);
    const T5 = Math.pow(T, 5);

    const c0 = q0;
    const c1 = v0;
    const c2 = 0.5 * a0;
    const c3 = (20 * dq - (8 * v1 + 12 * v0) * T - (3 * a0 - a1) * T2) / (2 * T3);
    const c4 = (30 * -dq + (14 * v1 + 16 * v0) * T + (3 * a0 - 2 * a1) * T2) / (2 * T4);
    const c5 = (12 * dq - 6 * (v1 + v0) * T - (a1 - a0) * T2) / (2 * T5);

    const q =
      c0 +
      c1 * t +
      c2 * Math.pow(t, 2) +
      c3 * Math.pow(t, 3) +
      c4 * Math.pow(t, 4) +
      c5 * Math.pow(t, 5);
    const qd =
      c1 +
      2 * c2 * t +
      3 * c3 * Math.pow(t, 2) +
      4 * c4 * Math.pow(t, 3) +
      5 * c5 * Math.pow(t, 4);
    const qdd =
      2 * c2 +
      6 * c3 * t +
      12 * c4 * Math.pow(t, 2) +
      20 * c5 * Math.pow(t, 3);

    return { q, qd, qdd };
  }

  /**
   * Evaluates Linear Segment with Parabolic Blends (LSPB)
   */
  private static evalLSPB(q0: number, q1: number, t: number, T: number) {
    const dq = q1 - q0;
    const tb = 0.25 * T; // Blend time at 25% of duration
    const V = dq / (T - tb); // Constant cruise velocity
    const alpha = V / tb; // Acceleration during blend phases

    let q: number;
    let qd: number;
    let qdd: number;

    if (t <= tb) {
      // Acceleration phase
      q = q0 + 0.5 * alpha * Math.pow(t, 2);
      qd = alpha * t;
      qdd = alpha;
    } else if (t <= T - tb) {
      // Linear cruise phase
      q = q0 - 0.5 * V * tb + V * t;
      qd = V;
      qdd = 0;
    } else {
      // Deceleration phase
      const dtEnd = T - t;
      q = q1 - 0.5 * alpha * Math.pow(dtEnd, 2);
      qd = alpha * dtEnd;
      qdd = -alpha;
    }

    return { q, qd, qdd };
  }

  /**
   * Evaluates Jerk-Bounded 7-Segment Double S-Curve Profile
   * Ensures C^2 position continuity, C^1 velocity continuity, and smooth Zero-Jerk handover at boundaries.
   * Partitions motion into 7 canonical phases:
   *   Phase 1: Jerk ramp-up (+J)
   *   Phase 2: Constant acceleration plateau (a = Amax)
   *   Phase 3: Jerk ramp-down (-J) reaching peak cruise velocity
   *   Phase 4: Constant velocity cruising (a = 0, j = 0)
   *   Phase 5: Jerk ramp-down into deceleration (-J)
   *   Phase 6: Constant deceleration plateau (a = -Amax)
   *   Phase 7: Jerk ramp-up to rest (+J, a -> 0, v -> 0)
   */
  private static evalSCurve(q0: number, q1: number, t: number, T: number) {
    const dq = q1 - q0;
    if (Math.abs(dq) < 1e-9 || T <= 1e-6) {
      return { q: q0, qd: 0, qdd: 0 };
    }

    const tClamped = Math.max(0, Math.min(t, T));

    // Canonical time partitioning (30% accel, 40% cruise, 30% decel)
    const Tj = 0.1 * T; // Jerk ramp duration
    const Ta = 0.1 * T; // Constant acceleration plateau duration
    const Tacc = 2 * Tj + Ta; // Total acceleration phase duration (0.3 * T)
    const Tv = T - 2 * Tacc; // Constant velocity plateau duration (0.4 * T)

    // Derived kinematic peaks complying with total displacement dq over duration T
    const Vmax = dq / (T - Tacc);
    const Amax = Vmax / (Tj + Ta);
    const Jmax = Amax / Tj;

    let s = 0;
    let v = 0;
    let a = 0;

    if (tClamped <= Tacc) {
      // ACCELERATION REGION (Phases 1, 2, 3)
      if (tClamped <= Tj) {
        // Phase 1: Jerk ramp-up (+J)
        a = Jmax * tClamped;
        v = 0.5 * Jmax * Math.pow(tClamped, 2);
        s = (1 / 6) * Jmax * Math.pow(tClamped, 3);
      } else if (tClamped <= Tj + Ta) {
        // Phase 2: Constant acceleration plateau
        const dt = tClamped - Tj;
        const v1 = 0.5 * Jmax * Math.pow(Tj, 2);
        const s1 = (1 / 6) * Jmax * Math.pow(Tj, 3);
        a = Amax;
        v = v1 + Amax * dt;
        s = s1 + v1 * dt + 0.5 * Amax * Math.pow(dt, 2);
      } else {
        // Phase 3: Jerk ramp-down (-J) to cruise speed
        const dt = tClamped - (Tj + Ta);
        const v2 = 0.5 * Jmax * Math.pow(Tj, 2) + Amax * Ta;
        const s2 =
          (1 / 6) * Jmax * Math.pow(Tj, 3) +
          (0.5 * Jmax * Math.pow(Tj, 2)) * Ta +
          0.5 * Amax * Math.pow(Ta, 2);
        a = Amax - Jmax * dt;
        v = v2 + Amax * dt - 0.5 * Jmax * Math.pow(dt, 2);
        s =
          s2 +
          v2 * dt +
          0.5 * Amax * Math.pow(dt, 2) -
          (1 / 6) * Jmax * Math.pow(dt, 3);
      }
    } else if (tClamped <= Tacc + Tv) {
      // CRUISING REGION (Phase 4: a = 0, v = Vmax)
      const dt = tClamped - Tacc;
      const sAcc = 0.5 * Vmax * Tacc;
      a = 0;
      v = Vmax;
      s = sAcc + Vmax * dt;
    } else {
      // DECELERATION REGION (Phases 5, 6, 7) - Symmetric backward integration from endpoint T
      const dtEnd = T - tClamped;
      let sDec = 0;
      let vDec = 0;
      let aDec = 0;

      if (dtEnd <= Tj) {
        // Phase 7 backward: Jerk ramp (+J to arrest motion)
        aDec = Jmax * dtEnd;
        vDec = 0.5 * Jmax * Math.pow(dtEnd, 2);
        sDec = (1 / 6) * Jmax * Math.pow(dtEnd, 3);
      } else if (dtEnd <= Tj + Ta) {
        // Phase 6 backward: Constant deceleration plateau
        const dt = dtEnd - Tj;
        const v1 = 0.5 * Jmax * Math.pow(Tj, 2);
        const s1 = (1 / 6) * Jmax * Math.pow(Tj, 3);
        aDec = Amax;
        vDec = v1 + Amax * dt;
        sDec = s1 + v1 * dt + 0.5 * Amax * Math.pow(dt, 2);
      } else {
        // Phase 5 backward: Jerk ramp-down into decel (-J)
        const dt = dtEnd - (Tj + Ta);
        const v2 = 0.5 * Jmax * Math.pow(Tj, 2) + Amax * Ta;
        const s2 =
          (1 / 6) * Jmax * Math.pow(Tj, 3) +
          (0.5 * Jmax * Math.pow(Tj, 2)) * Ta +
          0.5 * Amax * Math.pow(Ta, 2);
        aDec = Amax - Jmax * dt;
        vDec = v2 + Amax * dt - 0.5 * Jmax * Math.pow(dt, 2);
        sDec =
          s2 +
          v2 * dt +
          0.5 * Amax * Math.pow(dt, 2) -
          (1 / 6) * Jmax * Math.pow(dt, 3);
      }

      s = dq - sDec;
      v = vDec;
      a = -aDec;
    }

    return {
      q: q0 + s,
      qd: v,
      qdd: a,
    };
  }

  /**
   * Evaluates Proposed Unified Double-Tanh (UDT) Profile
   * Infinitely differentiable C^inf smooth trajectory with intrinsic bounds, exact boundary mollification,
   * and support for both Ultra-Smooth (Mc=3.8) and Time-Optimized TODT (Mc=2.8) modes.
   */
  private static evalDoubleTanh(
    q0: number,
    q1: number,
    t: number,
    T: number,
    margin: number = 3.8,
    usePade: boolean = false
  ) {
    const dq = q1 - q0;
    if (Math.abs(dq) < 1e-9 || T <= 1e-6) {
      return { q: q0, qd: 0, qdd: 0 };
    }
    const tClamped = Math.max(0, Math.min(t, T));

    // Dynamic morphology synthesis: T = 2 * Mc * sig + dtCruise.
    // For balanced acceleration/cruise partition (dtCruise ~ 0.5 T):
    // 2 * margin * sig = 0.5 * T => sig = (0.5 * T) / (2 * margin)
    const sig = (0.5 * T) / (2.0 * margin);
    const t1 = margin * sig;
    const t2 = T - t1;

    const th = (u: number) => (usePade ? tanhPade(u) : Math.tanh(u));

    const u1_0 = -t1 / sig;
    const u2_0 = -t2 / sig;
    const v0_raw = 0.5 * (th(u1_0) - th(u2_0));
    const s0_raw = 0.5 * sig * (logCoshStable(u1_0) - logCoshStable(u2_0));
    const a0_raw = (0.5 / sig) * ((1.0 - Math.pow(th(u1_0), 2)) - (1.0 - Math.pow(th(u2_0), 2)));

    const u1_T = (T - t1) / sig;
    const u2_T = (T - t2) / sig;
    const sT_raw = 0.5 * sig * (logCoshStable(u1_T) - logCoshStable(u2_T));

    const area_unit = (sT_raw - s0_raw) - v0_raw * T;
    const scale = dq / area_unit;

    const u1 = (tClamped - t1) / sig;
    const u2 = (tClamped - t2) / sig;
    const t_u1 = th(u1);
    const t_u2 = th(u2);
    const s2_u1 = 1.0 - t_u1 * t_u1;
    const s2_u2 = 1.0 - t_u2 * t_u2;

    const v = scale * (0.5 * (t_u1 - t_u2) - v0_raw);
    const a = scale * ((0.5 / sig) * (s2_u1 - s2_u2) - a0_raw * (1.0 - 2.0 * tClamped / T));
    const s = q0 + scale * (0.5 * sig * (logCoshStable(u1) - logCoshStable(u2)) - s0_raw - v0_raw * tClamped);

    return { q: s, qd: v, qdd: a };
  }

  /**
   * Spatio-Temporal Multi-DOF Trajectory Duration Auto-Synchronizer
   * Evaluates joint angular deltas across all waypoints and automatically synthesizes
   * optimal transit durations T_sync for each segment based on robot limits.
   */
  public static computeAutoSyncDurations(
    waypoints: Waypoint[],
    robotModel: RobotModel,
    margin: number = 3.8
  ): number[] {
    const numSegments = waypoints.length - 1;
    if (numSegments <= 0) return [];
    const dof = robotModel.dof;
    const synchronizedDurations: number[] = [];

    // Realistic joint velocity, acceleration, and jerk limits (deg/s, deg/s^2, deg/s^3)
    const vMaxDefault = 120.0; // deg/s
    const aMaxDefault = 200.0; // deg/s^2
    const jMaxDefault = 500.0; // deg/s^3

    for (let seg = 0; seg < numSegments; seg++) {
      const q0 = waypoints[seg].jointAngles;
      const q1 = waypoints[seg + 1].jointAngles;
      const dqList: number[] = [];
      const vMaxList: number[] = [];
      const aMaxList: number[] = [];
      const jMaxList: number[] = [];

      for (let j = 0; j < dof; j++) {
        dqList.push(q1[j] - q0[j]);
        // Scale limits: wrist joints can move faster, shoulder/base joints heavier
        const scale = j < 3 ? 0.8 : 1.25;
        vMaxList.push(vMaxDefault * scale);
        aMaxList.push(aMaxDefault * scale);
        jMaxList.push(jMaxDefault * scale);
      }

      const syncResult = DoubleTanhProfileGenerator.computeMultiDOFSynchronized(
        dqList,
        vMaxList,
        aMaxList,
        jMaxList,
        margin
      );

      // Clamp between 0.5s and 10.0s for safe industrial visualization
      const segT = Number(Math.max(0.5, Math.min(10.0, syncResult.tSync)).toFixed(2));
      synchronizedDurations.push(segT);
    }

    return synchronizedDurations;
  }

  /**
   * Standard Industrial & Collaborative Trajectory Presets
   * Tailored for robot kinematics limits, DOF, and safe operational envelopes
   */
  public static getPresets(robotId?: string): TrajectoryPreset[] {
    const idLower = (robotId || '').toLowerCase();

    // 1. Franka Emika Panda (7-DOF Compliant Cobot)
    if (idLower.includes('franka') || idLower.includes('panda')) {
      return [
        {
          id: 'panda-pick-and-place',
          name: 'Panda 7-DOF Pick & Place',
          description: 'Smooth 7-DOF transfer cycle complying strictly with Franka joint range limits',
          interpolationType: 'quintic',
          waypoints: [
            { name: 'Standby / Home', jointAngles: [0.0, -45.0, 0.0, -135.0, 0.0, 90.0, 45.0], segmentDuration: 1.5 },
            { name: 'Approach Bin A', jointAngles: [-30.0, -25.0, 15.0, -115.0, -10.0, 95.0, 30.0], segmentDuration: 2.0 },
            { name: 'Grasp Object', jointAngles: [-30.0, -10.0, 15.0, -95.0, -10.0, 105.0, 30.0], segmentDuration: 1.2 },
            { name: 'Retract High', jointAngles: [0.0, -50.0, 0.0, -145.0, 0.0, 85.0, 45.0], segmentDuration: 1.8 },
            { name: 'Place Bin B', jointAngles: [35.0, -20.0, -15.0, -110.0, 15.0, 100.0, 50.0], segmentDuration: 2.2 },
            { name: 'Return Home', jointAngles: [0.0, -45.0, 0.0, -135.0, 0.0, 90.0, 45.0], segmentDuration: 2.0 },
          ],
        },
        {
          id: 'panda-compliant-sweep',
          name: 'Panda 7-DOF Articulation Sweep',
          description: 'Dexterous redundant kinematic motion testing all 7 joints smoothly',
          interpolationType: 'lspb',
          waypoints: [
            { name: 'Standby / Home', jointAngles: [0.0, -45.0, 0.0, -135.0, 0.0, 90.0, 45.0], segmentDuration: 1.5 },
            { name: 'Reach Forward', jointAngles: [0.0, -15.0, 0.0, -100.0, 0.0, 110.0, 45.0], segmentDuration: 2.0 },
            { name: 'Pan Left 60°', jointAngles: [-60.0, -30.0, 20.0, -120.0, -20.0, 95.0, 30.0], segmentDuration: 2.5 },
            { name: 'Pan Right 60°', jointAngles: [60.0, -30.0, -20.0, -120.0, 20.0, 95.0, 60.0], segmentDuration: 3.0 },
            { name: 'Overhead Ready', jointAngles: [0.0, -60.0, 0.0, -150.0, 0.0, 70.0, 45.0], segmentDuration: 2.5 },
            { name: 'Return Home', jointAngles: [0.0, -45.0, 0.0, -135.0, 0.0, 90.0, 45.0], segmentDuration: 2.0 },
          ],
        },
        {
          id: 'panda-inspection-loop',
          name: 'Panda 7-DOF Precision Inspection',
          description: 'Multi-axis continuous orientation loop for automated quality inspection',
          interpolationType: 'quintic',
          waypoints: [
            { name: 'Start Inspection', jointAngles: [-20.0, -35.0, 10.0, -125.0, -10.0, 90.0, 35.0], segmentDuration: 1.8 },
            { name: 'Inspect Angle 1', jointAngles: [-20.0, -20.0, 25.0, -105.0, -15.0, 100.0, 20.0], segmentDuration: 2.0 },
            { name: 'Inspect Angle 2', jointAngles: [20.0, -20.0, -25.0, -105.0, 15.0, 100.0, 70.0], segmentDuration: 2.0 },
            { name: 'Inspect Angle 3', jointAngles: [20.0, -35.0, -10.0, -125.0, 10.0, 90.0, 55.0], segmentDuration: 2.0 },
            { name: 'Close Loop', jointAngles: [-20.0, -35.0, 10.0, -125.0, -10.0, 90.0, 35.0], segmentDuration: 2.0 },
          ],
        },
      ];
    }

    // 2. Universal Robots UR5 (6-DOF Modern Cobot)
    if (idLower.includes('ur5')) {
      return [
        {
          id: 'ur5-pick-and-place',
          name: 'UR5 Pick & Place Cycle',
          description: 'Optimized 6-DOF transfer trajectory for collaborative assembly workcells',
          interpolationType: 'quintic',
          waypoints: [
            { name: 'Standby / Home', jointAngles: [0.0, -30.0, 60.0, -30.0, 90.0, 0.0], segmentDuration: 1.5 },
            { name: 'Approach Bin A', jointAngles: [-40.0, -15.0, 75.0, -60.0, 90.0, -40.0], segmentDuration: 2.0 },
            { name: 'Grasp Object', jointAngles: [-40.0, -5.0, 85.0, -80.0, 90.0, -40.0], segmentDuration: 1.2 },
            { name: 'Retract High', jointAngles: [0.0, -45.0, 50.0, -5.0, 90.0, 0.0], segmentDuration: 1.8 },
            { name: 'Place Bin B', jointAngles: [45.0, -10.0, 80.0, -70.0, 90.0, 45.0], segmentDuration: 2.2 },
            { name: 'Return Home', jointAngles: [0.0, -30.0, 60.0, -30.0, 90.0, 0.0], segmentDuration: 2.0 },
          ],
        },
        {
          id: 'ur5-articulation-sweep',
          name: 'UR5 6-DOF Articulation Sweep',
          description: 'Broad workspace verification testing shoulder, elbow, and wrist kinematics',
          interpolationType: 'lspb',
          waypoints: [
            { name: 'Standby / Home', jointAngles: [0.0, -30.0, 60.0, -30.0, 90.0, 0.0], segmentDuration: 1.5 },
            { name: 'Reach Forward', jointAngles: [0.0, 10.0, 45.0, -55.0, 90.0, 0.0], segmentDuration: 2.0 },
            { name: 'Pan Left 90°', jointAngles: [-90.0, -20.0, 70.0, -50.0, 90.0, -90.0], segmentDuration: 2.5 },
            { name: 'Pan Right 90°', jointAngles: [90.0, -20.0, 70.0, -50.0, 90.0, 90.0], segmentDuration: 3.0 },
            { name: 'Overhead Ready', jointAngles: [0.0, -60.0, 30.0, 30.0, 90.0, 0.0], segmentDuration: 2.5 },
            { name: 'Return Home', jointAngles: [0.0, -30.0, 60.0, -30.0, 90.0, 0.0], segmentDuration: 2.0 },
          ],
        },
        {
          id: 'ur5-inspection-square',
          name: 'UR5 Inspection Path',
          description: 'Square planar surface inspection pattern',
          interpolationType: 'quintic',
          waypoints: [
            { name: 'Corner 1', jointAngles: [-20.0, -20.0, 65.0, -45.0, 90.0, -20.0], segmentDuration: 1.8 },
            { name: 'Corner 2', jointAngles: [-20.0, -5.0, 80.0, -75.0, 90.0, -20.0], segmentDuration: 2.0 },
            { name: 'Corner 3', jointAngles: [20.0, -5.0, 80.0, -75.0, 90.0, 20.0], segmentDuration: 2.0 },
            { name: 'Corner 4', jointAngles: [20.0, -20.0, 65.0, -45.0, 90.0, 20.0], segmentDuration: 2.0 },
            { name: 'Close Loop', jointAngles: [-20.0, -20.0, 65.0, -45.0, 90.0, -20.0], segmentDuration: 2.0 },
          ],
        },
      ];
    }

    // 3. Generic 6-DOF Industrial Manipulators (Puma 560, ABB, FANUC, KUKA)
    return [
      {
        id: 'pick-and-place',
        name: 'Pick & Place Cycle',
        description: 'Standard 4-point industrial sorting and transfer trajectory',
        interpolationType: 'quintic',
        waypoints: [
          { name: 'Standby / Home', jointAngles: [0, 30, -45, 0, 30, 0], segmentDuration: 1.5 },
          { name: 'Approach Bin A', jointAngles: [-35, 45, -30, -20, 40, 10], segmentDuration: 2.0 },
          { name: 'Grasp Object', jointAngles: [-35, 55, -20, -20, 50, 10], segmentDuration: 1.2 },
          { name: 'Retract High', jointAngles: [0, 25, -60, 0, 35, 0], segmentDuration: 1.8 },
          { name: 'Place Bin B', jointAngles: [45, 50, -25, 20, 45, -15], segmentDuration: 2.2 },
          { name: 'Return Home', jointAngles: [0, 30, -45, 0, 30, 0], segmentDuration: 2.0 },
        ],
      },
      {
        id: 'cartesian-square',
        name: 'Cartesian Square CNC Inspection',
        description: 'Straight line segments tracing a planar square in Cartesian space',
        interpolationType: 'cartesian-linear',
        waypoints: [
          { name: 'Corner 1 (Bottom-Left)', jointAngles: [-15, 35, -40, 0, 45, -15], segmentDuration: 1.8 },
          { name: 'Corner 2 (Top-Left)', jointAngles: [-15, 20, -55, 0, 35, -15], segmentDuration: 2.0 },
          { name: 'Corner 3 (Top-Right)', jointAngles: [15, 20, -55, 0, 35, 15], segmentDuration: 2.0 },
          { name: 'Corner 4 (Bottom-Right)', jointAngles: [15, 35, -40, 0, 45, 15], segmentDuration: 2.0 },
          { name: 'Close Loop (Corner 1)', jointAngles: [-15, 35, -40, 0, 45, -15], segmentDuration: 2.0 },
        ],
      },
      {
        id: 'full-range-sweep',
        name: '6-DOF Articulation Sweep',
        description: 'Smooth sweep across all major joint ranges testing kinematics limits',
        interpolationType: 'lspb',
        waypoints: [
          { name: 'Neutral Zero', jointAngles: [0, 0, 0, 0, 0, 0], segmentDuration: 1.5 },
          { name: 'Reach Forward', jointAngles: [0, 60, -30, 0, 60, 0], segmentDuration: 2.0 },
          { name: 'Pan Left 90°', jointAngles: [-90, 45, -45, 30, 45, 30], segmentDuration: 2.5 },
          { name: 'Pan Right 90°', jointAngles: [90, 45, -45, -30, 45, -30], segmentDuration: 3.0 },
          { name: 'Overhead High', jointAngles: [0, -20, -90, 0, -20, 0], segmentDuration: 2.5 },
          { name: 'Return Neutral', jointAngles: [0, 0, 0, 0, 0, 0], segmentDuration: 2.0 },
        ],
      },
    ];
  }
}
