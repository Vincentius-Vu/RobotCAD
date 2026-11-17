/**
 * TrajectoryProfileGenerators.ts
 * 
 * Comprehensive Benchmark Suite of Multi-Order Trajectory Generation Algorithms:
 *  1. Trapezoidal Velocity Profile (1st-Order / C0 velocity, discontinuous step acceleration)
 *  2. Cubic Polynomial Spline (2nd-Order / C1 velocity, continuous linear acceleration)
 *  3. Quintic Polynomial Spline (3rd-Order / C2 velocity & acceleration, smooth jerk)
 *  4. Jerk-Bounded 7-Segment S-Curve (Zero-Jerk Handover with Spatiotemporal Scaling lambda*)
 * 
 * Provides unified interface MotionProfile for arbitrary trajectory evaluation.
 */

import { SCurveProfileGenerator } from './SCurveProfileGenerator';
import { DoubleTanhProfileGenerator } from './DoubleTanhProfileGenerator';

export type TrajectoryAlgorithm = 'kds_scurve' | 'quintic' | 'cubic' | 'trapezoidal' | 'double_tanh';

export interface MotionProfileState {
  s: number;  // Displacement (m or rad)
  v: number;  // Velocity (m/s or rad/s)
  a: number;  // Acceleration (m/s^2 or rad/s^2)
  j: number;  // Jerk (m/s^3 or rad/s^3)
}

export interface MotionProfile {
  algorithm: TrajectoryAlgorithm;
  T_total: number;
  s_sgn: number;
  peakVelocity: number;
  peakAcceleration: number;
  peakJerk: number;
  evaluate: (t: number) => MotionProfileState;
}

export class TrajectoryProfileGenerators {
  /**
   * 1. Traditional Trapezoidal Velocity Profile
   * Piecewise constant acceleration with discontinuous step changes (infinite theoretical jerk).
   */
  public static createTrapezoidalProfile(
    dist: number,
    V_max: number,
    A_max: number
  ): MotionProfile {
    const s_sgn = dist >= 0 ? 1.0 : -1.0;
    const L = Math.abs(dist);

    if (L < 1e-7) {
      return {
        algorithm: 'trapezoidal',
        T_total: 0,
        s_sgn: 1.0,
        peakVelocity: 0,
        peakAcceleration: 0,
        peakJerk: 0,
        evaluate: () => ({ s: 0, v: 0, a: 0, j: 0 }),
      };
    }

    const tAcc = V_max / A_max;
    const dAcc = 0.5 * A_max * tAcc * tAcc;

    let t_a = 0.0;
    let t_v = 0.0;
    let V_peak = V_max;

    if (2.0 * dAcc > L) {
      // Triangular profile (does not reach V_max)
      t_a = Math.sqrt(L / A_max);
      t_v = 0.0;
      V_peak = A_max * t_a;
    } else {
      // Full trapezoidal profile with constant-velocity plateau
      t_a = tAcc;
      t_v = (L - 2.0 * dAcc) / V_max;
      V_peak = V_max;
    }

    const T_total = 2.0 * t_a + t_v;
    const peakJerkNumeric = A_max / 0.005; // Numerical impulse jerk at step boundary

    const evaluate = (t: number): MotionProfileState => {
      const tClamped = Math.max(0.0, Math.min(t, T_total));

      let s_mag = 0.0;
      let v_mag = 0.0;
      let a_mag = 0.0;
      let j_mag = 0.0;

      if (tClamped < t_a) {
        // Acceleration phase
        a_mag = A_max;
        v_mag = A_max * tClamped;
        s_mag = 0.5 * A_max * tClamped * tClamped;
        j_mag = tClamped < 0.01 ? peakJerkNumeric : 0.0;
      } else if (tClamped < t_a + t_v) {
        // Cruising phase
        a_mag = 0.0;
        v_mag = V_peak;
        s_mag = 0.5 * A_max * t_a * t_a + V_peak * (tClamped - t_a);
        j_mag = 0.0;
      } else {
        // Deceleration phase
        const dtDec = tClamped - (t_a + t_v);
        a_mag = -A_max;
        v_mag = Math.max(0.0, V_peak - A_max * dtDec);
        s_mag = L - 0.5 * A_max * (T_total - tClamped) * (T_total - tClamped);
        j_mag = Math.abs(tClamped - (t_a + t_v)) < 0.01 ? -peakJerkNumeric : 0.0;
      }

      return {
        s: s_sgn * s_mag,
        v: s_sgn * v_mag,
        a: s_sgn * a_mag,
        j: s_sgn * j_mag,
      };
    };

    return {
      algorithm: 'trapezoidal',
      T_total,
      s_sgn,
      peakVelocity: V_peak,
      peakAcceleration: A_max,
      peakJerk: peakJerkNumeric,
      evaluate,
    };
  }

  /**
   * 2. Cubic Polynomial Spline
   * s(tau) = L * (3*tau^2 - 2*tau^3)
   * Continuous linear acceleration profile with constant segment jerk.
   */
  public static createCubicProfile(
    dist: number,
    V_max: number,
    A_max: number
  ): MotionProfile {
    const s_sgn = dist >= 0 ? 1.0 : -1.0;
    const L = Math.abs(dist);

    if (L < 1e-7) {
      return {
        algorithm: 'cubic',
        T_total: 0,
        s_sgn: 1.0,
        peakVelocity: 0,
        peakAcceleration: 0,
        peakJerk: 0,
        evaluate: () => ({ s: 0, v: 0, a: 0, j: 0 }),
      };
    }

    // Constraints:
    // max v = 1.5 * L / T <= V_max  => T >= 1.5 * L / V_max
    // max a = 6 * L / T^2 <= A_max   => T >= sqrt(6 * L / A_max)
    const T_vel = (1.5 * L) / V_max;
    const T_acc = Math.sqrt((6.0 * L) / A_max);
    const T_total = Math.max(0.05, Math.max(T_vel, T_acc));

    const peakVel = (1.5 * L) / T_total;
    const peakAcc = (6.0 * L) / (T_total * T_total);
    const constJerk = (12.0 * L) / (T_total * T_total * T_total);

    const evaluate = (t: number): MotionProfileState => {
      const tClamped = Math.max(0.0, Math.min(t, T_total));
      const tau = tClamped / T_total;

      const s_mag = L * (3.0 * tau * tau - 2.0 * tau * tau * tau);
      const v_mag = (L / T_total) * (6.0 * tau - 6.0 * tau * tau);
      const a_mag = (L / (T_total * T_total)) * (6.0 - 12.0 * tau);
      const j_mag = -(12.0 * L) / (T_total * T_total * T_total);

      return {
        s: s_sgn * s_mag,
        v: s_sgn * v_mag,
        a: s_sgn * a_mag,
        j: s_sgn * j_mag,
      };
    };

    return {
      algorithm: 'cubic',
      T_total,
      s_sgn,
      peakVelocity: peakVel,
      peakAcceleration: peakAcc,
      peakJerk: constJerk,
      evaluate,
    };
  }

  /**
   * 3. Quintic Polynomial Spline
   * s(tau) = L * (10*tau^3 - 15*tau^4 + 6*tau^5)
   * Enforces zero velocity and zero acceleration at both boundary endpoints (C2 continuity).
   */
  public static createQuinticProfile(
    dist: number,
    V_max: number,
    A_max: number,
    J_max: number
  ): MotionProfile {
    const s_sgn = dist >= 0 ? 1.0 : -1.0;
    const L = Math.abs(dist);

    if (L < 1e-7) {
      return {
        algorithm: 'quintic',
        T_total: 0,
        s_sgn: 1.0,
        peakVelocity: 0,
        peakAcceleration: 0,
        peakJerk: 0,
        evaluate: () => ({ s: 0, v: 0, a: 0, j: 0 }),
      };
    }

    // Constraints:
    // max v = (15/8) * L / T = 1.875 * L / T <= V_max   => T >= 1.875 * L / V_max
    // max a = (10 / sqrt(3)) * L / T^2 = 5.7735 * L / T^2 <= A_max => T >= sqrt(5.7735 * L / A_max)
    // max j = 60 * L / T^3 <= J_max                    => T >= (60 * L / J_max)^(1/3)
    const T_vel = (1.875 * L) / V_max;
    const T_acc = Math.sqrt((5.7735 * L) / A_max);
    const T_jerk = Math.cbrt((60.0 * L) / J_max);
    const T_total = Math.max(0.05, Math.max(T_vel, Math.max(T_acc, T_jerk)));

    const peakVel = (1.875 * L) / T_total;
    const peakAcc = (5.7735 * L) / (T_total * T_total);
    const peakJerk = (60.0 * L) / (T_total * T_total * T_total);

    const evaluate = (t: number): MotionProfileState => {
      const tClamped = Math.max(0.0, Math.min(t, T_total));
      const tau = tClamped / T_total;
      const tau2 = tau * tau;
      const tau3 = tau2 * tau;
      const tau4 = tau3 * tau;
      const tau5 = tau4 * tau;

      const s_mag = L * (10.0 * tau3 - 15.0 * tau4 + 6.0 * tau5);
      const v_mag = (L / T_total) * (30.0 * tau2 - 60.0 * tau3 + 30.0 * tau4);
      const a_mag = (L / (T_total * T_total)) * (60.0 * tau - 180.0 * tau2 + 120.0 * tau3);
      const j_mag = (L / (T_total * T_total * T_total)) * (60.0 - 360.0 * tau + 360.0 * tau2);

      return {
        s: s_sgn * s_mag,
        v: s_sgn * v_mag,
        a: s_sgn * a_mag,
        j: s_sgn * j_mag,
      };
    };

    return {
      algorithm: 'quintic',
      T_total,
      s_sgn,
      peakVelocity: peakVel,
      peakAcceleration: peakAcc,
      peakJerk,
      evaluate,
    };
  }

  /**
   * 4. Proposed Jerk-Bounded 7-Segment S-Curve Profile
   * Employs analytical S-curve equations with zero-jerk boundary transitions and lambda* scaling.
   */
  public static createSCurveProfile(
    dist: number,
    V_max: number,
    A_max: number,
    J_max: number,
    scalingLambda: number = 1.0
  ): MotionProfile {
    const s_sgn = dist >= 0 ? 1.0 : -1.0;
    const L = Math.abs(dist);

    if (L < 1e-7) {
      return {
        algorithm: 'kds_scurve',
        T_total: 0,
        s_sgn: 1.0,
        peakVelocity: 0,
        peakAcceleration: 0,
        peakJerk: 0,
        evaluate: () => ({ s: 0, v: 0, a: 0, j: 0 }),
      };
    }

    const p = SCurveProfileGenerator.computeProfileParams(L, V_max, A_max, J_max, scalingLambda);

    const evaluate = (t: number): MotionProfileState => {
      const st = SCurveProfileGenerator.evaluate(t, p);
      return {
        s: s_sgn * st.s,
        v: s_sgn * st.v,
        a: s_sgn * st.a,
        j: s_sgn * st.j,
      };
    };

    return {
      algorithm: 'kds_scurve',
      T_total: p.T_total,
      s_sgn,
      peakVelocity: p.V_eff,
      peakAcceleration: p.A_eff,
      peakJerk: p.J_eff,
      evaluate,
    };
  }

  /**
   * 5. Proposed Infinitely Differentiable Double-Tanh Profile (UDT)
   * Smooth C^inf profile with intrinsic saturation and zero residual vibration.
   */
  public static createDoubleTanhProfile(
    dist: number,
    V_max: number,
    A_max: number,
    J_max: number,
    sigma?: number
  ): MotionProfile {
    const p = DoubleTanhProfileGenerator.computeProfileParams(dist, V_max, A_max, J_max, sigma);
    const s_sgn = dist >= 0 ? 1 : -1;

    const evaluate = (t: number): MotionProfileState => {
      const state = DoubleTanhProfileGenerator.evaluate(t, p);
      return {
        s: s_sgn * state.s,
        v: s_sgn * state.v,
        a: s_sgn * state.a,
        j: s_sgn * state.j,
      };
    };

    return {
      algorithm: 'double_tanh',
      T_total: p.tTotal,
      s_sgn,
      peakVelocity: p.vCruise,
      peakAcceleration: p.peakAcceleration,
      peakJerk: p.peakJerk,
      evaluate,
    };
  }

  /**
   * Universal Factory: Creates specified motion profile by algorithm name
   */
  public static createProfile(
    algorithm: TrajectoryAlgorithm,
    dist: number,
    V_max: number,
    A_max: number,
    J_max: number,
    scalingLambda: number = 1.0
  ): MotionProfile {
    switch (algorithm) {
      case 'trapezoidal':
        return this.createTrapezoidalProfile(dist, V_max, A_max);
      case 'cubic':
        return this.createCubicProfile(dist, V_max, A_max);
      case 'quintic':
        return this.createQuinticProfile(dist, V_max, A_max, J_max);
      case 'double_tanh':
        return this.createDoubleTanhProfile(dist, V_max, A_max, J_max);
      case 'kds_scurve':
      default:
        return this.createSCurveProfile(dist, V_max, A_max, J_max, scalingLambda);
    }
  }
}
