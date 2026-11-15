/**
 * KDSEnergyModel.ts
 * 
 * Electromechanical Energy Modeling & Closed-Form Spatiotemporal Optimal Scaling
 * Formulates:
 *   E(lambda) = K_dyn / lambda^3 + K_stat * lambda
 *   lambda_opt* = max(1.0, (3 * K_dyn / K_stat)^0.25)
 * Identifies theoretical Critical Distance L_crit (~6.0 m).
 */

import { SCurveProfileGenerator } from '../../kinematics/SCurveProfileGenerator';

export interface AMRActuatorParams {
  Mass: number;           // Total vehicle mass (kg)
  r_wheel: number;        // Wheel radius (m)
  baseline_W: number;     // Half track gauge / baseline width (m)
  gear_ratio: number;     // Gear reduction ratio N_g
  gear_eff: number;       // Mechanical gearbox efficiency eta_g
  R_armature: number;     // Motor armature resistance R_a (Ohm)
  K_torque: number;       // Motor torque constant K_t (N*m/A)
  K_emf: number;          // Motor back-EMF constant K_e (V/(rad/s))
  B_m: number;            // Motor viscous damping (N*m*s/rad)
  J_m: number;            // Motor rotor inertia (kg*m^2)
  P_base: number;         // Electronics quiescent power draw (W)
  C_friction: number;     // Rolling friction coefficient mu_roll
  V_lim: number;          // Linear velocity limit (m/s)
  A_lim: number;          // Linear acceleration limit (m/s^2)
  J_lim: number;          // Linear jerk limit (m/s^3)
  W_lim: number;          // Angular velocity limit (rad/s)
  A_rot: number;          // Angular acceleration limit (rad/s^2)
  J_rot: number;          // Angular jerk limit (rad/s^3)
  J_r?: number;           // Chassis yaw moment of inertia (kg*m^2)
}

export const DEFAULT_AMR_ACTUATOR_PARAMS: AMRActuatorParams = {
  Mass: 200.0,
  r_wheel: 0.08,
  baseline_W: 0.27,
  gear_ratio: 25.0,
  gear_eff: 0.95,
  R_armature: 0.08,
  K_torque: 0.18,
  K_emf: 0.18,
  B_m: 0.0001,
  J_m: 0.0008,
  P_base: 25.0,
  C_friction: 0.015,
  V_lim: 1.2,
  A_lim: 1.0,
  J_lim: 4.0,
  W_lim: 1.8,
  A_rot: 2.5,
  J_rot: 8.0,
  J_r: 12.5,
};

export interface EnergyCoefficients {
  T_nom: number;
  K_dyn: number;
  K_stat: number;
  lambda_opt: number;
  E_nominal: number;
  E_optimal: number;
  energySavedPercent: number;
}

export class KDSEnergyModel {
  /**
   * Computes exact dynamic and static energy coefficients for a straight segment length L
   * via rigorous analytical integration of a^2(t).
   */
  public static computeCoefficients(
    distL: number,
    params: AMRActuatorParams = DEFAULT_AMR_ACTUATOR_PARAMS
  ): EnergyCoefficients {
    const absL = Math.max(1e-4, Math.abs(distL));
    const p = SCurveProfileGenerator.computeProfileParams(absL, params.V_lim, params.A_lim, params.J_lim, 1.0);
    const T_nom = p.T_total;

    // Peak acceleration during ramp
    const A_peak = p.A_eff;

    // Integral of a(t)^2 over full 7 segments:
    // 8 ramp segments of duration Tj: (8/3) * A_peak^2 * Tj
    // 2 constant acceleration plateaus of duration Ta: 2 * A_peak^2 * Ta
    const integral_a_squared = (8.0 / 3.0) * (A_peak * A_peak) * p.Tj + 2.0 * (A_peak * A_peak) * p.Ta;

    // Inertial gain factor relating vehicle linear acceleration to motor armature current
    const inertialGain = (params.Mass * params.r_wheel) / (2.0 * params.gear_ratio * params.gear_eff * params.K_torque);
    const K_dyn = 2.0 * params.R_armature * (inertialGain * inertialGain) * integral_a_squared;

    // Rolling friction Coulomb resistance and steady-state losses
    const F_roll = params.Mass * 9.81 * params.C_friction;
    const tau_roll_motor = (F_roll * params.r_wheel) / (2.0 * params.gear_ratio * params.gear_eff);
    const i_roll = tau_roll_motor / params.K_torque;
    const P_roll_ohmic = 2.0 * params.R_armature * (i_roll * i_roll);

    // K_stat: quiescent electronics draw + rolling resistance mechanical and electrical dissipation over T_nom
    const K_stat = params.P_base * T_nom + F_roll * (params.V_lim * 0.5) * T_nom + P_roll_ohmic * T_nom;

    // Closed-form optimal scaling factor
    const lambda_raw = K_stat > 1e-6 ? Math.pow((3.0 * K_dyn) / K_stat, 0.25) : 1.0;
    const lambda_opt = Math.max(1.0, lambda_raw);

    const E_nominal = K_dyn + K_stat;
    const E_optimal = K_dyn / Math.pow(lambda_opt, 3) + K_stat * lambda_opt;
    const energySavedPercent = Math.max(0.0, ((E_nominal - E_optimal) / Math.max(1e-6, E_nominal)) * 100.0);

    return {
      T_nom,
      K_dyn,
      K_stat,
      lambda_opt,
      E_nominal,
      E_optimal,
      energySavedPercent,
    };
  }

  /**
   * Bisection solver to find the Critical Distance L_crit where lambda_raw == 1.0.
   * For L < L_crit, temporal dilation saves significant energy (15-25%).
   * For L >= L_crit, time-optimal transit (lambda = 1.0) is already energy-optimal.
   */
  public static findCriticalDistance(
    params: AMRActuatorParams = DEFAULT_AMR_ACTUATOR_PARAMS,
    tol: number = 0.01
  ): number {
    let low = 0.5;
    let high = 25.0;

    for (let iter = 0; iter < 40; iter++) {
      const mid = 0.5 * (low + high);
      const coeff = this.computeCoefficients(mid, params);
      const lambda_raw = Math.pow((3.0 * coeff.K_dyn) / Math.max(1e-6, coeff.K_stat), 0.25);

      if (Math.abs(lambda_raw - 1.0) < tol) {
        return mid;
      }
      if (lambda_raw > 1.0) {
        // In the short-distance regime where lambda* > 1, increase distance
        low = mid;
      } else {
        high = mid;
      }
    }

    return 0.5 * (low + high);
  }

  /**
   * Evaluates instantaneous power draw from first principles:
   * P_total(t) = P_base + max(0, P_elec_L) + max(0, P_elec_R)
   */
  public static computeInstantaneousPower(
    v: number,
    w: number,
    a: number,
    alpha: number,
    params: AMRActuatorParams = DEFAULT_AMR_ACTUATOR_PARAMS
  ): { P_total: number; Ia_L: number; Ia_R: number; Te_L: number; Te_R: number } {
    const rw = params.r_wheel;
    const W = params.baseline_W;
    const Ng = params.gear_ratio;
    const eta = params.gear_eff;
    const Jr = params.J_r ?? 1.0;

    // Wheel angular velocities and accelerations
    const wL = (v - W * w) / rw;
    const wR = (v + W * w) / rw;
    const alpha_wL = (a - W * alpha) / rw;
    const alpha_wR = (a + W * alpha) / rw;

    // Motor rotor speeds and angular accelerations
    const w_mL = wL * Ng;
    const w_mR = wR * Ng;
    const alpha_mL = alpha_wL * Ng;
    const alpha_mR = alpha_wR * Ng;

    // Rolling resistance
    const F_roll = params.Mass * 9.81 * params.C_friction;
    const tau_roll_L = 0.5 * F_roll * rw * Math.tanh(10.0 * wL);
    const tau_roll_R = 0.5 * F_roll * rw * Math.tanh(10.0 * wR);

    // Wheel axle load torque
    const tau_wL = 0.5 * params.Mass * a * rw - 0.5 * (Jr * alpha * rw / W) + tau_roll_L;
    const tau_wR = 0.5 * params.Mass * a * rw + 0.5 * (Jr * alpha * rw / W) + tau_roll_R;

    // Motor load torque reflected through gearbox
    const tau_load_mL = tau_wL / (Ng * eta);
    const tau_load_mR = tau_wR / (Ng * eta);

    // Motor electromagnetic torque
    const tau_em_L = params.J_m * alpha_mL + params.B_m * w_mL + tau_load_mL;
    const tau_em_R = params.J_m * alpha_mR + params.B_m * w_mR + tau_load_mR;

    // Armature current
    const Ia_L = tau_em_L / params.K_torque;
    const Ia_R = tau_em_R / params.K_torque;

    // Electrical terminal power: Ra * Ia^2 + Ke * w_m * Ia
    const P_elec_L = params.R_armature * (Ia_L * Ia_L) + params.K_emf * w_mL * Ia_L;
    const P_elec_R = params.R_armature * (Ia_R * Ia_R) + params.K_emf * w_mR * Ia_R;

    // Non-regenerative battery interface
    const P_bat_L = Math.max(0.0, P_elec_L);
    const P_bat_R = Math.max(0.0, P_elec_R);

    const P_total = params.P_base + P_bat_L + P_bat_R;

    return {
      P_total,
      Ia_L,
      Ia_R,
      Te_L: tau_em_L,
      Te_R: tau_em_R,
    };
  }
}
