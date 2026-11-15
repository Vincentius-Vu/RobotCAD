/**
 * SCurveProfileGenerator.ts
 * 
 * Jerk-Bounded 7-Segment S-Curve Trajectory Generation
 * Enforces C^2 continuity and Zero-Jerk handover at phase boundaries.
 * Supports spatiotemporal dilation scaling lambda >= 1.0.
 */

export interface SCurveProfileParams {
  Tj: number;     // Jerk ramp duration (s)
  Ta: number;     // Constant acceleration plateau duration (s)
  Tv: number;     // Constant velocity plateau duration (s)
  T_total: number;// Total segment duration (s)
  V_eff: number;  // Effective velocity limit (m/s or rad/s)
  A_eff: number;  // Effective acceleration limit (m/s^2 or rad/s^2)
  J_eff: number;  // Effective jerk limit (m/s^3 or rad/s^3)
  s_sgn: number;  // Direction sign (+1 or -1)
}

export interface SCurveState {
  s: number;  // Displacement (m or rad)
  v: number;  // Velocity (m/s or rad/s)
  a: number;  // Acceleration (m/s^2 or rad/s^2)
  j: number;  // Jerk (m/s^3 or rad/s^3)
}

export class SCurveProfileGenerator {
  /**
   * Computes 7-segment S-curve profile parameters with spatiotemporal scaling lambda >= 1.0.
   * Handles both Case 1 (triangular acceleration, V_eff < A_eff^2 / J_eff)
   * and Case 2 (trapezoidal acceleration with constant-acceleration plateau).
   */
  public static computeProfileParams(
    dist: number,
    V_max: number,
    A_max: number,
    J_max: number,
    scalingLambda: number = 1.0
  ): SCurveProfileParams {
    const s_sgn = dist >= 0 ? 1.0 : -1.0;
    const abs_dist = Math.abs(dist);

    if (abs_dist < 1e-7) {
      return {
        Tj: 0,
        Ta: 0,
        Tv: 0,
        T_total: 0,
        V_eff: 0,
        A_eff: 0,
        J_eff: 0,
        s_sgn: 1.0,
      };
    }

    const lambda_val = Math.max(1.0, scalingLambda);
    const V_e = V_max / lambda_val;
    const A_e = A_max / (lambda_val * lambda_val);
    const J_e = J_max / (lambda_val * lambda_val * lambda_val);

    let Tj = 0.0;
    let Ta = 0.0;
    let Tv = 0.0;

    const V_a = (A_e * A_e) / J_e;

    if (V_e < V_a) {
      // Case 1: Triangular acceleration profile
      const A_peak = Math.sqrt(J_e * V_e);
      const D_th = 2.0 * V_e * (A_peak / J_e);

      if (abs_dist >= D_th) {
        Tj = A_peak / J_e;
        Ta = 0.0;
        Tv = (abs_dist - D_th) / V_e;
      } else {
        Tj = Math.cbrt(abs_dist / (2.0 * J_e));
        Ta = 0.0;
        Tv = 0.0;
      }
    } else {
      // Case 2: Full acceleration plateau reached
      Tj = A_e / J_e;
      Ta = V_e / A_e - Tj;
      const D_th = V_e * (2.0 * Tj + Ta);

      if (abs_dist >= D_th) {
        Tv = (abs_dist - D_th) / V_e;
      } else {
        const D_min_A = 2.0 * A_e * (Tj * Tj);
        if (abs_dist > D_min_A) {
          const delta = Math.pow(3.0 * A_e * Tj, 2) - 4.0 * A_e * (2.0 * A_e * (Tj * Tj) - abs_dist);
          Ta = (-3.0 * A_e * Tj + Math.sqrt(Math.max(0.0, delta))) / (2.0 * A_e);
          Tv = 0.0;
        } else {
          Tj = Math.cbrt(abs_dist / (2.0 * J_e));
          Ta = 0.0;
          Tv = 0.0;
        }
      }
    }

    const T_total = 4.0 * Tj + 2.0 * Ta + Tv;
    return {
      Tj,
      Ta,
      Tv,
      T_total,
      V_eff: V_e,
      A_eff: A_e,
      J_eff: J_e,
      s_sgn,
    };
  }

  /**
   * Evaluates S-curve displacement, velocity, acceleration, and jerk at time t.
   */
  public static evaluate(t: number, p: SCurveProfileParams): SCurveState {
    if (p.T_total <= 1e-9) {
      return { s: 0, v: 0, a: 0, j: 0 };
    }

    const t_eval = Math.max(0.0, Math.min(t, p.T_total));
    const j_val = p.J_eff;

    const t1 = p.Tj;
    const t2 = t1 + p.Ta;
    const t3 = t2 + p.Tj;
    const t4 = t3 + p.Tv;
    const t5 = t4 + p.Tj;
    const t6 = t5 + p.Ta;

    const integ = (
      t_loc: number,
      s0: number,
      v0: number,
      a0: number,
      j_apply: number
    ): { s: number; v: number; a: number } => {
      const a_out = a0 + j_apply * t_loc;
      const v_out = v0 + a0 * t_loc + 0.5 * j_apply * (t_loc * t_loc);
      const s_out = s0 + v0 * t_loc + 0.5 * a0 * (t_loc * t_loc) + (1.0 / 6.0) * j_apply * (t_loc * t_loc * t_loc);
      return { s: s_out, v: v_out, a: a_out };
    };

    // Calculate states at phase boundaries
    const p1 = integ(t1, 0, 0, 0, j_val);
    const p2 = integ(p.Ta, p1.s, p1.v, p1.a, 0);
    const p3 = integ(p.Tj, p2.s, p2.v, p2.a, -j_val);
    const p4 = integ(p.Tv, p3.s, p3.v, p3.a, 0);
    const p5 = integ(p.Tj, p4.s, p4.v, p4.a, -j_val);
    const p6 = integ(p.Ta, p5.s, p5.v, p5.a, 0);

    let s = 0.0;
    let v = 0.0;
    let a = 0.0;
    let curr_j = 0.0;

    if (t_eval <= t1) {
      const res = integ(t_eval, 0, 0, 0, j_val);
      s = res.s; v = res.v; a = res.a;
      curr_j = j_val;
    } else if (t_eval <= t2) {
      const res = integ(t_eval - t1, p1.s, p1.v, p1.a, 0);
      s = res.s; v = res.v; a = res.a;
      curr_j = 0.0;
    } else if (t_eval <= t3) {
      const res = integ(t_eval - t2, p2.s, p2.v, p2.a, -j_val);
      s = res.s; v = res.v; a = res.a;
      curr_j = -j_val;
    } else if (t_eval <= t4) {
      const res = integ(t_eval - t3, p3.s, p3.v, p3.a, 0);
      s = res.s; v = res.v; a = res.a;
      curr_j = 0.0;
    } else if (t_eval <= t5) {
      const res = integ(t_eval - t4, p4.s, p4.v, p4.a, -j_val);
      s = res.s; v = res.v; a = res.a;
      curr_j = -j_val;
    } else if (t_eval <= t6) {
      const res = integ(t_eval - t5, p5.s, p5.v, p5.a, 0);
      s = res.s; v = res.v; a = res.a;
      curr_j = 0.0;
    } else {
      const res = integ(t_eval - t6, p6.s, p6.v, p6.a, j_val);
      s = res.s; v = res.v; a = res.a;
      curr_j = j_val;
    }

    return {
      s: s * p.s_sgn,
      v: v * p.s_sgn,
      a: a * p.s_sgn,
      j: curr_j * p.s_sgn,
    };
  }
}
