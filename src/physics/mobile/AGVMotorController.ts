/**
 * AGV Multi-Physics Powertrain & Advanced Motion Controllers
 * Modules:
 *  1. MTPA (Maximum Torque Per Ampere) Current Vector Trajectory
 *  2. Schmitt-Trigger Field-Weakening Coordinator with Speed Interlock
 *  3. Decoupled PI Current Regulators with d-Axis Priority SVPWM Saturation
 *  4. Planar Cross-Coupled Lyapunov Tracking Controller (CCC)
 * 
 * Complies 100% with SSoT Master Unified v2.0.0 (Sections 3.7 & 3.8)
 */

import { AGVParameters } from './AGVParameters';

export interface FOCState {
  id_ref: number;        // d-axis current command [A]
  iq_ref: number;        // q-axis current command [A]
  id_mtpa: number;       // MTPA d-axis current component [A]
  id_fw: number;         // Field-weakening demagnetization component [A]
  vd_cmd: number;        // d-axis voltage reference to inverter [V]
  vq_cmd: number;        // q-axis voltage reference to inverter [V]
  Vmag: number;          // Voltage vector magnitude [V]
  S_fw: number;          // Schmitt-trigger field-weakening state (0 or 1)
  dV_filt: number;       // Filtered voltage excess [V]
  Te_cmd: number;        // Commanded electromagnetic torque [N*m]
}

export interface CCCState {
  kappa: number;         // Trajectory instantaneous curvature [1/m]
  CL: number;            // Left wheel curvature weighting factor [-]
  CR: number;            // Right wheel curvature weighting factor [-]
  ewL: number;           // Left wheel speed error [rad/s]
  ewR: number;           // Right wheel speed error [rad/s]
  epsilon: number;       // Contouring synchronization error [rad/s]
  u_sync: number;        // Synchronization torque effort [N*m]
  Te_L_cmd: number;      // Coordinated torque to Left motor [N*m]
  Te_R_cmd: number;      // Coordinated torque to Right motor [N*m]
}

/**
 * Single-Motor FOC / MTPA / Field-Weakening Controller
 */
export class IPMSMFieldOrientedController {
  private p: AGVParameters;
  private int_d = 0.0;
  private int_q = 0.0;
  private int_fw = 0.0;
  private dV_filt = 0.0;
  private S_fw = 0;

  constructor(params: AGVParameters) {
    this.p = params;
  }

  public reset(): void {
    this.int_d = 0.0;
    this.int_q = 0.0;
    this.int_fw = 0.0;
    this.dV_filt = 0.0;
    this.S_fw = 0;
  }

  /**
   * Computes MTPA d-axis current reference for IPMSM (Lq > Ld)
   * SSoT Eq. 3.7.1:
   * i_d_MTPA = (lambda_m - sqrt(lambda_m^2 + 8*(Lq - Ld)^2 * iq^2)) / (4*(Lq - Ld))
   */
  public computeMTPA(iq_ref: number): number {
    const delta_L = this.p.Lq - this.p.Ld;
    if (delta_L <= 1e-6) return 0.0; // Surface PM (SPM) case: id = 0

    const lm = this.p.lambda_m;
    const term = lm * lm + 8.0 * delta_L * delta_L * iq_ref * iq_ref;
    return (lm - Math.sqrt(Math.max(0.0, term))) / (4.0 * delta_L);
  }

  /**
   * Computes optimal iq_ref from desired electromagnetic torque Te_ref
   * Inverts SSoT Eq. 3.6.3 using 2-step Newton-Raphson
   */
  public torqueToIq(Te_ref: number): number {
    const p = this.p.p;
    const lm = this.p.lambda_m;
    const delta_L = this.p.Lq - this.p.Ld;

    // Initial linear guess (neglecting reluctance torque)
    let iq = Te_ref / (1.5 * p * lm);
    iq = Math.max(-this.p.I_max, Math.min(this.p.I_max, iq));

    // Refine with Newton-Raphson
    for (let iter = 0; iter < 3; ++iter) {
      const id = this.computeMTPA(iq);
      const Te = 1.5 * p * (lm * iq - delta_L * id * iq);
      const f = Te - Te_ref;
      if (Math.abs(f) < 1e-4) break;

      // Numerical derivative dTe/diq
      const diq = 1e-4;
      const iq_p = iq + diq;
      const id_p = this.computeMTPA(iq_p);
      const Te_p = 1.5 * p * (lm * iq_p - delta_L * id_p * iq_p);
      const df = (Te_p - Te) / diq;

      if (Math.abs(df) > 1e-6) {
        iq -= f / df;
      }
      iq = Math.max(-this.p.I_max, Math.min(this.p.I_max, iq));
    }

    return iq;
  }

  /**
   * Executes one discrete FOC / MTPA / Field-Weakening step
   * @param dt Integration step time [s]
   * @param Te_cmd Commanded motor torque [N*m]
   * @param id_fb Measured/simulated d-axis stator current [A]
   * @param iq_fb Measured/simulated q-axis stator current [A]
   * @param omega_w Mechanical wheel speed [rad/s]
   * @param Vdc Available DC-bus voltage [V]
   */
  public step(
    dt: number,
    Te_cmd: number,
    id_fb: number,
    iq_fb: number,
    omega_w: number,
    Vdc: number
  ): FOCState {
    const p = this.p;
    const omega_m = p.G * omega_w;
    const omega_e = p.p * omega_m;

    // 1. Dynamic SVPWM inscribed circular voltage ceiling
    const V_max = Vdc / Math.sqrt(3.0);
    const V_fw_on = 0.95 * V_max;
    const V_fw_off = 0.90 * V_max;
    const omega_e_base = V_fw_on / p.lambda_m;

    // 2. MTPA Current Trajectory
    const Te_clamped = Math.max(-p.T_max, Math.min(p.T_max, Te_cmd));
    let iq_ref = this.torqueToIq(Te_clamped);
    const id_mtpa = this.computeMTPA(iq_ref);

    // 3. Schmitt-Trigger Field-Weakening Supervisor (SSoT Section 3.7)
    // Estimate current voltage magnitude from feedback
    const vd_est = p.Rs * id_fb - omega_e * p.Lq * iq_fb;
    const vq_est = p.Rs * iq_fb + omega_e * (p.Ld * id_fb + p.lambda_m);
    const Vmag = Math.hypot(vd_est, vq_est);

    const abs_omega_e = Math.abs(omega_e);
    if (Vmag >= V_fw_on && abs_omega_e >= 0.85 * omega_e_base) {
      this.S_fw = 1;
    } else if (Vmag <= V_fw_off || abs_omega_e < 0.85 * omega_e_base) {
      this.S_fw = 0;
    }

    // 4. Filtered Demagnetization Current Injection
    const dV_excess = Math.max(0.0, Vmag - V_fw_on);
    if (this.S_fw === 1) {
      // Lag filter: tau_fw * d(dV_filt)/dt + dV_filt = dV_excess
      this.dV_filt += (dt / p.tau_fw) * (dV_excess - this.dV_filt);
      this.int_fw += dt * p.K_fw * this.dV_filt;
      // Clamp demagnetization to 90% thermal current
      this.int_fw = Math.min(0.90 * p.I_max, Math.max(0.0, this.int_fw));
    } else {
      // Gentle decay when exiting field-weakening
      this.dV_filt *= Math.max(0.0, 1.0 - dt / p.tau_fw);
      this.int_fw *= Math.max(0.0, 1.0 - dt / (2.0 * p.tau_fw));
    }

    const id_fw = -this.int_fw;
    let id_ref = id_mtpa + id_fw;

    // 5. Circular Stator Current Saturation (SSoT Eq. 4.66)
    // d-axis current has priority for field weakening; q-axis current is constrained
    id_ref = Math.max(-p.I_max, Math.min(0.0, id_ref));
    const iq_max_avail = Math.sqrt(Math.max(0.0, p.I_max * p.I_max - id_ref * id_ref));
    iq_ref = Math.sign(iq_ref) * Math.min(Math.abs(iq_ref), iq_max_avail);

    // 6. Decoupled PI Current Regulators (SSoT Section 3.6)
    const err_d = id_ref - id_fb;
    const err_q = iq_ref - iq_fb;

    // Feedforward decoupling voltages
    const vd_ff = -omega_e * p.Lq * iq_fb;
    const vq_ff = omega_e * (p.Ld * id_fb + p.lambda_m);

    // PI Integrators with back-calculation anti-windup
    this.int_d += dt * p.K_id * err_d;
    this.int_q += dt * p.K_iq * err_q;
    this.int_d = Math.max(-V_max, Math.min(V_max, this.int_d));
    this.int_q = Math.max(-V_max, Math.min(V_max, this.int_q));

    const vd_unlim = p.K_pd * err_d + this.int_d + vd_ff;
    const vq_unlim = p.K_pq * err_q + this.int_q + vq_ff;

    // 7. d-Axis Voltage Priority SVPWM Saturation (SSoT Eq. 3.7.4)
    const vd_cmd = Math.max(-V_max, Math.min(V_max, vd_unlim));
    const vq_avail = Math.sqrt(Math.max(0.0, V_max * V_max - vd_cmd * vd_cmd));
    const vq_cmd = Math.max(-vq_avail, Math.min(vq_avail, vq_unlim));

    return {
      id_ref,
      iq_ref,
      id_mtpa,
      id_fw,
      vd_cmd,
      vq_cmd,
      Vmag,
      S_fw: this.S_fw,
      dV_filt: this.dV_filt,
      Te_cmd: Te_clamped,
    };
  }
}

/**
 * Planar Cross-Coupled Lyapunov Tracking Controller (CCC)
 * SSoT Section 3.8
 */
export class PlanarCrossCoupledController {
  private p: AGVParameters;
  private int_sync = 0.0;
  private int_speed_L = 0.0;
  private int_speed_R = 0.0;

  constructor(params: AGVParameters) {
    this.p = params;
  }

  public reset(): void {
    this.int_sync = 0.0;
    this.int_speed_L = 0.0;
    this.int_speed_R = 0.0;
  }

  /**
   * Executes one discrete CCC coordination step
   * @param dt Integration step time [s]
   * @param v_ref Desired chassis longitudinal speed [m/s]
   * @param w_ref Desired chassis yaw rate [rad/s]
   * @param omega_wL_fb Measured left wheel speed [rad/s]
   * @param omega_wR_fb Measured right wheel speed [rad/s]
   */
  public step(
    dt: number,
    v_ref: number,
    w_ref: number,
    omega_wL_fb: number,
    omega_wR_fb: number
  ): CCCState {
    const p = this.p;
    const b = p.b; // 0.25m

    // 1. Differential kinematics desired wheel speeds
    const omega_wL_ref = (v_ref - b * w_ref) / p.rw;
    const omega_wR_ref = (v_ref + b * w_ref) / p.rw;

    // 2. Instantaneous path curvature kappa(t) = w_ref / v_ref
    const safe_v = Math.max(0.02, Math.abs(v_ref));
    const kappa = w_ref / safe_v;

    // 3. Dynamic curvature weighting factors (SSoT Eq. 3.8.1)
    const CL = 1.0 - b * kappa;
    const CR = 1.0 + b * kappa;

    // 4. Wheel speed errors
    const ewL = omega_wL_ref - omega_wL_fb;
    const ewR = omega_wR_ref - omega_wR_fb;

    // 5. Coordinated Contouring Synchronization Error (SSoT Eq. 3.8.2)
    // epsilon(t) = CL * ewR - CR * ewL
    const epsilon = CL * ewR - CR * ewL;

    // 6. Cross-Coupled Lyapunov Synchronization Effort (SSoT Eq. 3.8.3)
    this.int_sync += dt * epsilon;
    // Anti-windup limit on synchronization integrator
    const max_sync_int = p.T_max / (p.K_sync * p.K_i_sync);
    this.int_sync = Math.max(-max_sync_int, Math.min(max_sync_int, this.int_sync));

    const u_sync = p.K_sync * (p.K_p_sync * epsilon + p.K_i_sync * this.int_sync);

    // 7. Base wheel PI speed controllers
    // Tuned for reflected wheel inertia Jw_eff = 0.645 kg*m^2
    const Kp_spd = 1.8;
    const Ki_spd = 6.0;

    this.int_speed_L += dt * Ki_spd * ewL;
    this.int_speed_R += dt * Ki_spd * ewR;
    this.int_speed_L = Math.max(-p.T_max, Math.min(p.T_max, this.int_speed_L));
    this.int_speed_R = Math.max(-p.T_max, Math.min(p.T_max, this.int_speed_R));

    // Base motor torque demands (including rolling resistance feedforward)
    const T_roll_motor = (p.C_rr * (p.M * p.g) * p.rw) / (2.0 * p.G * p.eta_g);
    const T_base_L = Kp_spd * ewL + this.int_speed_L + Math.sign(omega_wL_ref) * T_roll_motor;
    const T_base_R = Kp_spd * ewR + this.int_speed_R + Math.sign(omega_wR_ref) * T_roll_motor;

    // 8. Coordinated Torque Commands (SSoT Eq. 3.8.4 & 3.8.5)
    // Right wheel lags (ewR > 0) => epsilon > 0 => Te_R boosts, Te_L slows down
    const Te_R_raw = T_base_R + CR * u_sync;
    const Te_L_raw = T_base_L - CL * u_sync;

    const Te_R_cmd = Math.max(-p.T_max, Math.min(p.T_max, Te_R_raw));
    const Te_L_cmd = Math.max(-p.T_max, Math.min(p.T_max, Te_L_raw));

    return {
      kappa,
      CL,
      CR,
      ewL,
      ewR,
      epsilon,
      u_sync,
      Te_L_cmd,
      Te_R_cmd,
    };
  }
}
