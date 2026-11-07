import { AGVParameters, DEFAULT_AGV_PARAMETERS } from './AGVParameters';
import {
  IPMSMFieldOrientedController,
  PlanarCrossCoupledController,
} from './AGVMotorController';

export interface InverterBridgeResult {
  van: number;
  vbn: number;
  vcn: number;
  Idc: number;
}

export interface AGVState {
  // Time
  time: number;

  // Platform Velocities & Pose
  vx: number;        // Chassis forward velocity [m/s]
  vy: number;        // Chassis lateral velocity [m/s]
  wz: number;        // Chassis yaw rate [rad/s]
  X: number;         // Global X position [m]
  Y: number;         // Global Y position [m]
  psi: number;       // Heading angle [rad]

  // Dual PMSM Electrical
  id_L: number;      // Left d-axis current [A]
  iq_L: number;      // Left q-axis current [A]
  id_R: number;      // Right d-axis current [A]
  iq_R: number;      // Right q-axis current [A]
  phi_m_L: number;   // Left motor rotor angle [rad]
  phi_m_R: number;   // Right motor rotor angle [rad]
  Te_L: number;      // Left electromagnetic torque [N*m]
  Te_R: number;      // Right electromagnetic torque [N*m]

  // DC-Link & Power
  Vdc: number;       // DC bus capacitor voltage [V]
  Ibatt: number;     // Battery output current [A]
  Idc_L: number;     // Left inverter DC current [A]
  Idc_R: number;     // Right inverter DC current [A]

  // Wheels & Terramechanics (SSoT Dynamic Relaxation Length)
  omega_wL: number;  // Left wheel angular velocity [rad/s]
  omega_wR: number;  // Right wheel angular velocity [rad/s]
  vL: number;        // Left wheel linear surface velocity [m/s]
  vR: number;        // Right wheel linear surface velocity [m/s]
  slip_L: number;    // Left wheel slip ratio [-]
  slip_R: number;    // Right wheel slip ratio [-]
  Fz_L: number;      // Left wheel normal load [N]
  Fz_R: number;      // Right wheel normal load [N]
  Fx_L: number;      // Left wheel Pacejka tractive force [N]
  Fx_R: number;      // Right wheel Pacejka tractive force [N]
  F_roll_drive: number; // Active drive wheels rolling resistance [N]

  // Dual Swivel Casters (SSoT 2nd-Order Dynamic)
  psi_cF: number;    // Front caster swivel angle [rad]
  omega_cF: number;  // Front caster swivel rate [rad/s]
  psi_cR: number;    // Rear caster swivel angle [rad]
  omega_cR: number;  // Rear caster swivel rate [rad/s]
  Fz_cF: number;     // Front caster dynamic normal load [N]
  Fz_cR: number;     // Rear caster dynamic normal load [N]
  M_z_cast: number;  // Net caster yaw disturbance moment on chassis [N*m]

  // 3D Chassis Dynamics (Attitude)
  ax: number;        // Longitudinal acceleration [m/s^2]
  ay: number;        // Lateral acceleration [m/s^2]
  pitchDeg: number;  // Chassis dynamic pitch angle [deg]
  rollDeg: number;   // Chassis dynamic roll angle [deg]

  // 3-Phase currents for oscilloscope
  ia_L: number;
  ib_L: number;
  ic_L: number;
  ia_R: number;
  ib_R: number;
  ic_R: number;

  // Advanced Powertrain Controllers (SSoT Sections 3.7 & 3.8)
  id_ref_L: number;
  iq_ref_L: number;
  id_ref_R: number;
  iq_ref_R: number;
  vd_cmd_L: number;
  vq_cmd_L: number;
  vd_cmd_R: number;
  vq_cmd_R: number;
  Vmag_L: number;
  Vmag_R: number;
  S_fw_L: number;
  S_fw_R: number;
  id_fw_L: number;
  id_fw_R: number;
  epsilon_ccc: number;
  u_sync: number;
  Te_cmd_L: number;
  Te_cmd_R: number;
}

export interface AGVLogEntry {
  time: number;
  vx: number;
  vy: number;
  wz: number;
  X: number;
  Y: number;
  psi: number;
  omega_wL: number;
  omega_wR: number;
  vL: number;
  vR: number;
  Fz_L: number;
  Fz_R: number;
  Fx_L: number;
  Fx_R: number;
  Te_L: number;
  Te_R: number;
  Vdc: number;
  slip_L: number;
  slip_R: number;
  id_L: number;
  iq_L: number;
  id_R: number;
  iq_R: number;
  psi_cF: number;
  psi_cR: number;
  omega_cF?: number;
  omega_cR?: number;
  Fz_cF?: number;
  Fz_cR?: number;
  id_ref_L?: number;
  iq_ref_L?: number;
  id_ref_R?: number;
  iq_ref_R?: number;
  S_fw_L?: number;
  S_fw_R?: number;
  Vmag_L?: number;
  Vmag_R?: number;
  epsilon_ccc?: number;
  u_sync?: number;
}

export class AGVDigitalTwinEngine {
  private p: AGVParameters;
  private state: AGVState;
  private foc_L: IPMSMFieldOrientedController;
  private foc_R: IPMSMFieldOrientedController;
  private ccc: PlanarCrossCoupledController;

  constructor(params: Partial<AGVParameters> = {}) {
    this.p = { ...DEFAULT_AGV_PARAMETERS, ...params };
    this.foc_L = new IPMSMFieldOrientedController(this.p);
    this.foc_R = new IPMSMFieldOrientedController(this.p);
    this.ccc = new PlanarCrossCoupledController(this.p);
    this.state = this.createInitialState();
  }

  public setParameters(params: Partial<AGVParameters>): void {
    this.p = { ...this.p, ...params };
    this.foc_L = new IPMSMFieldOrientedController(this.p);
    this.foc_R = new IPMSMFieldOrientedController(this.p);
    this.ccc = new PlanarCrossCoupledController(this.p);
  }

  public getParameters(): AGVParameters {
    return { ...this.p };
  }

  public getState(): AGVState {
    return { ...this.state };
  }

  public resetState(pose: { x?: number; y?: number; psi?: number } = {}): void {
    this.state = this.createInitialState();
    this.foc_L.reset();
    this.foc_R.reset();
    this.ccc.reset();
    if (pose.x !== undefined) this.state.X = pose.x;
    if (pose.y !== undefined) this.state.Y = pose.y;
    if (pose.psi !== undefined) this.state.psi = pose.psi;
  }

  private createInitialState(): AGVState {
    return {
      time: 0,
      vx: 0,
      vy: 0,
      wz: 0,
      X: 0,
      Y: 0,
      psi: 0,
      id_L: 0,
      iq_L: 0,
      id_R: 0,
      iq_R: 0,
      phi_m_L: 0,
      phi_m_R: 0,
      Te_L: 0,
      Te_R: 0,
      Vdc: this.p.V_batt,
      Ibatt: 0,
      Idc_L: 0,
      Idc_R: 0,
      omega_wL: 0,
      omega_wR: 0,
      vL: 0,
      vR: 0,
      slip_L: 0,
      slip_R: 0,
      Fz_L: this.p.Fz_drive_static,
      Fz_R: this.p.Fz_drive_static,
      Fx_L: 0,
      Fx_R: 0,
      F_roll_drive: 0,
      psi_cF: 0,
      omega_cF: 0,
      psi_cR: 0,
      omega_cR: 0,
      Fz_cF: this.p.Fz_caster_static,
      Fz_cR: this.p.Fz_caster_static,
      M_z_cast: 0,
      ax: 0,
      ay: 0,
      pitchDeg: 0,
      rollDeg: 0,
      ia_L: 0,
      ib_L: 0,
      ic_L: 0,
      ia_R: 0,
      ib_R: 0,
      ic_R: 0,
      id_ref_L: 0,
      iq_ref_L: 0,
      id_ref_R: 0,
      iq_ref_R: 0,
      vd_cmd_L: 0,
      vq_cmd_L: 0,
      vd_cmd_R: 0,
      vq_cmd_R: 0,
      Vmag_L: 0,
      Vmag_R: 0,
      S_fw_L: 0,
      S_fw_R: 0,
      id_fw_L: 0,
      id_fw_R: 0,
      epsilon_ccc: 0,
      u_sync: 0,
      Te_cmd_L: 0,
      Te_cmd_R: 0,
    };
  }

  /**
   * Sub-microsecond Half-Bridge Inverter Solver
   * Perfectly matches agv_digital_twin.hpp solve_inverter_bridge
   */
  public static solveInverterBridge(
    va_ref: number, vb_ref: number, vc_ref: number,
    carrier: number, delta_dt: number, Vdc: number,
    Rds: number, Vsd: number, id: number, iq: number, th_e: number
  ): InverterBridgeResult {
    const TWO_PI_OVER_3 = (2.0 * Math.PI) / 3.0;
    const cos_0 = Math.cos(th_e);
    const sin_0 = Math.sin(th_e);
    const cos_m = Math.cos(th_e - TWO_PI_OVER_3);
    const sin_m = Math.sin(th_e - TWO_PI_OVER_3);
    const cos_p = Math.cos(th_e + TWO_PI_OVER_3);
    const sin_p = Math.sin(th_e + TWO_PI_OVER_3);

    const ia = id * cos_0 - iq * sin_0;
    const ib = id * cos_m - iq * sin_m;
    const ic = id * cos_p - iq * sin_p;

    let gAH = 0.0, vaN = 0.0;
    if (va_ref > (carrier + delta_dt)) {
      gAH = 1.0; vaN = Vdc - ia * Rds;
    } else if (va_ref < (carrier - delta_dt)) {
      gAH = 0.0; vaN = 0.0 - ia * Rds;
    } else {
      gAH = 0.0;
      vaN = (ia > 0.0) ? -Vsd : (Vdc + Vsd);
    }

    let gBH = 0.0, vbN = 0.0;
    if (vb_ref > (carrier + delta_dt)) {
      gBH = 1.0; vbN = Vdc - ib * Rds;
    } else if (vb_ref < (carrier - delta_dt)) {
      gBH = 0.0; vbN = 0.0 - ib * Rds;
    } else {
      gBH = 0.0;
      vbN = (ib > 0.0) ? -Vsd : (Vdc + Vsd);
    }

    let gCH = 0.0, vcN = 0.0;
    if (vc_ref > (carrier + delta_dt)) {
      gCH = 1.0; vcN = Vdc - ic * Rds;
    } else if (vc_ref < (carrier - delta_dt)) {
      gCH = 0.0; vcN = 0.0 - ic * Rds;
    } else {
      gCH = 0.0;
      vcN = (ic > 0.0) ? -Vsd : (Vdc + Vsd);
    }

    const vnN = (vaN + vbN + vcN) / 3.0;
    const van = vaN - vnN;
    const vbn = vbN - vnN;
    const vcn = vcN - vnN;

    const Idc = gAH * Math.max(0.0, ia) +
                gBH * Math.max(0.0, ib) +
                gCH * Math.max(0.0, ic);

    return { van, vbn, vcn, Idc };
  }

  /**
   * Real-time Interactive Simulation Step with FOC / MTPA / Field-Weakening / CCC Controllers
   * Fully coordinates dual PMSMs with optimal MTPA, Schmitt-trigger field-weakening,
   * and planar cross-coupled Lyapunov contouring synchronization (SSoT Sections 3.7 & 3.8).
   * 
   * @param dt_frame Frame delta time [s] (e.g. 1/60 ~ 0.0166s)
   * @param v_ref Desired chassis longitudinal velocity [m/s]
   * @param w_ref Desired chassis yaw rate [rad/s]
   * @param subSteps Number of integration steps per frame (default: 60)
   */
  public stepWithFOCAndCCC(
    dt_frame: number,
    v_ref: number,
    w_ref: number,
    subSteps = 60
  ): AGVState {
    const p = this.p;
    const s = this.state;
    const dt = dt_frame / subSteps;
    const TWO_PI_OVER_3 = (2.0 * Math.PI) / 3.0;

    // 1. Planar Cross-Coupled Controller (Outer Coordination Loop)
    const ccc_res = this.ccc.step(dt_frame, v_ref, w_ref, s.omega_wL, s.omega_wR);
    s.epsilon_ccc = ccc_res.epsilon;
    s.u_sync = ccc_res.u_sync;
    s.Te_cmd_L = ccc_res.Te_L_cmd;
    s.Te_cmd_R = ccc_res.Te_R_cmd;

    const prev_vx = s.vx;

    // 2. High-Frequency Multi-Physics Sub-stepping
    for (let step = 0; step < subSteps; ++step) {
      const tk = s.time;
      const Vdc_safe = Math.max(10.0, s.Vdc);

      // FOC Inner Current Loop (evaluated with anti-windup decoupling)
      const foc_L_res = this.foc_L.step(dt, s.Te_cmd_L, s.id_L, s.iq_L, s.omega_wL, Vdc_safe);
      const foc_R_res = this.foc_R.step(dt, s.Te_cmd_R, s.id_R, s.iq_R, s.omega_wR, Vdc_safe);

      // Log FOC state
      s.id_ref_L = foc_L_res.id_ref;
      s.iq_ref_L = foc_L_res.iq_ref;
      s.vd_cmd_L = foc_L_res.vd_cmd;
      s.vq_cmd_L = foc_L_res.vq_cmd;
      s.Vmag_L = foc_L_res.Vmag;
      s.S_fw_L = foc_L_res.S_fw;
      s.id_fw_L = foc_L_res.id_fw;

      s.id_ref_R = foc_R_res.id_ref;
      s.iq_ref_R = foc_R_res.iq_ref;
      s.vd_cmd_R = foc_R_res.vd_cmd;
      s.vq_cmd_R = foc_R_res.vq_cmd;
      s.Vmag_R = foc_R_res.Vmag;
      s.S_fw_R = foc_R_res.S_fw;
      s.id_fw_R = foc_R_res.id_fw;

      // SPWM Carrier
      const tau = tk * p.f_sw;
      const carrier = 2.0 * Math.abs(2.0 * (tau - Math.floor(tau + 0.5))) - 1.0;

      // Left Inverter: Inverse Park (dq -> alpha-beta) & Inverse Clarke (alpha-beta -> abc)
      const th_eL = p.p * s.phi_m_L;
      const cos_eL = Math.cos(th_eL);
      const sin_eL = Math.sin(th_eL);
      const valpha_L = foc_L_res.vd_cmd * cos_eL - foc_L_res.vq_cmd * sin_eL;
      const vbeta_L = foc_L_res.vd_cmd * sin_eL + foc_L_res.vq_cmd * cos_eL;

      const va_L = valpha_L;
      const vb_L = -0.5 * valpha_L + 0.86602540378 * vbeta_L;
      const vc_L = -0.5 * valpha_L - 0.86602540378 * vbeta_L;

      const v_norm_factor = 2.0 / (Math.sqrt(3.0) * Vdc_safe);
      const va_ref_L = Math.max(-0.98, Math.min(0.98, va_L * v_norm_factor));
      const vb_ref_L = Math.max(-0.98, Math.min(0.98, vb_L * v_norm_factor));
      const vc_ref_L = Math.max(-0.98, Math.min(0.98, vc_L * v_norm_factor));

      const inv_L = AGVDigitalTwinEngine.solveInverterBridge(
        va_ref_L, vb_ref_L, vc_ref_L,
        carrier, p.delta_dt, Vdc_safe,
        p.Rds_on, p.Vsd, s.id_L, s.iq_L, th_eL
      );

      // Right Inverter
      const th_eR = p.p * s.phi_m_R;
      const cos_eR = Math.cos(th_eR);
      const sin_eR = Math.sin(th_eR);
      const valpha_R = foc_R_res.vd_cmd * cos_eR - foc_R_res.vq_cmd * sin_eR;
      const vbeta_R = foc_R_res.vd_cmd * sin_eR + foc_R_res.vq_cmd * cos_eR;

      const va_R = valpha_R;
      const vb_R = -0.5 * valpha_R + 0.86602540378 * vbeta_R;
      const vc_R = -0.5 * valpha_R - 0.86602540378 * vbeta_R;

      const va_ref_R = Math.max(-0.98, Math.min(0.98, va_R * v_norm_factor));
      const vb_ref_R = Math.max(-0.98, Math.min(0.98, vb_R * v_norm_factor));
      const vc_ref_R = Math.max(-0.98, Math.min(0.98, vc_R * v_norm_factor));

      const inv_R = AGVDigitalTwinEngine.solveInverterBridge(
        va_ref_R, vb_ref_R, vc_ref_R,
        carrier, p.delta_dt, Vdc_safe,
        p.Rds_on, p.Vsd, s.id_R, s.iq_R, th_eR
      );

      // Terminal dq voltages from inverter bridge
      const cos_L = Math.cos(th_eL), sin_L = Math.sin(th_eL);
      const cos_L_m = Math.cos(th_eL - TWO_PI_OVER_3), sin_L_m = Math.sin(th_eL - TWO_PI_OVER_3);
      const cos_L_p = Math.cos(th_eL + TWO_PI_OVER_3), sin_L_p = Math.sin(th_eL + TWO_PI_OVER_3);
      const vd_L = (2.0 / 3.0) * (cos_L * inv_L.van + cos_L_m * inv_L.vbn + cos_L_p * inv_L.vcn);
      const vq_L = (2.0 / 3.0) * (-sin_L * inv_L.van - sin_L_m * inv_L.vbn - sin_L_p * inv_L.vcn);

      const cos_R = Math.cos(th_eR), sin_R = Math.sin(th_eR);
      const cos_R_m = Math.cos(th_eR - TWO_PI_OVER_3), sin_R_m = Math.sin(th_eR - TWO_PI_OVER_3);
      const cos_R_p = Math.cos(th_eR + TWO_PI_OVER_3), sin_R_p = Math.sin(th_eR + TWO_PI_OVER_3);
      const vd_R = (2.0 / 3.0) * (cos_R * inv_R.van + cos_R_m * inv_R.vbn + cos_R_p * inv_R.vcn);
      const vq_R = (2.0 / 3.0) * (-sin_R * inv_R.van - sin_R_m * inv_R.vbn - sin_R_p * inv_R.vcn);

      const we_L = p.p * p.G * s.omega_wL;
      const we_R = p.p * p.G * s.omega_wR;

      const did_L = (vd_L - p.Rs * s.id_L + we_L * p.Lq * s.iq_L) / p.Ld;
      const diq_L = (vq_L - p.Rs * s.iq_L - we_L * p.Ld * s.id_L - we_L * p.lambda_m) / p.Lq;
      const did_R = (vd_R - p.Rs * s.id_R + we_R * p.Lq * s.iq_R) / p.Ld;
      const diq_R = (vq_R - p.Rs * s.iq_R - we_R * p.Ld * s.id_R - we_R * p.lambda_m) / p.Lq;

      s.id_L += dt * did_L;
      s.iq_L += dt * diq_L;
      s.id_R += dt * did_R;
      s.iq_R += dt * diq_R;

      s.Te_L = 1.5 * p.p * (p.lambda_m * s.iq_L + (p.Ld - p.Lq) * s.id_L * s.iq_L);
      s.Te_R = 1.5 * p.p * (p.lambda_m * s.iq_R + (p.Ld - p.Lq) * s.id_R * s.iq_R);

      // DC-Link Capacitor ODE & Bleeder
      s.Ibatt = (p.V_batt - Vdc_safe) / p.R_batt;
      s.Idc_L = inv_L.Idc;
      s.Idc_R = inv_R.Idc;
      const dVdc = (s.Ibatt - (inv_L.Idc + inv_R.Idc)) / p.C_bulk;
      s.Vdc = Vdc_safe + dt * dVdc;

      // Dynamic 4-Point Normal Load Transfer
      const a_lat = s.vx * s.wz;
      const dFz_lat = (p.M * a_lat * p.hcg) / (2.0 * p.b);
      const dFz_long = (p.M * s.ax * p.hcg) / (2.0 * p.Lc_F);

      s.Fz_L = Math.max(5.0, p.Fz_drive_static - dFz_lat);
      s.Fz_R = Math.max(5.0, p.Fz_drive_static + dFz_lat);
      s.Fz_cF = Math.max(5.0, p.Fz_caster_static - dFz_long);
      s.Fz_cR = Math.max(5.0, p.Fz_caster_static + dFz_long);

      // Dynamic Tire Relaxation Length & Regularized Pacejka
      const vw_L = s.vx - p.b * s.wz;
      const vw_R = s.vx + p.b * s.wz;

      const denom_L = Math.sqrt(vw_L * vw_L + p.eps_v * p.eps_v);
      const denom_R = Math.sqrt(vw_R * vw_R + p.eps_v * p.eps_v);
      s.slip_L = (p.rw * s.omega_wL - vw_L) / denom_L;
      s.slip_R = (p.rw * s.omega_wR - vw_R) / denom_R;

      const slip_vel_L = p.rw * s.omega_wL - vw_L;
      const slip_vel_R = p.rw * s.omega_wR - vw_R;
      const abs_vw_L = Math.abs(vw_L);
      const abs_vw_R = Math.abs(vw_R);

      const Fx_dyn_L = (p.sigma_x * s.Fx_L + dt * p.C_s * slip_vel_L) / (p.sigma_x + dt * abs_vw_L);
      const Fx_dyn_R = (p.sigma_x * s.Fx_R + dt * p.C_s * slip_vel_R) / (p.sigma_x + dt * abs_vw_R);

      const mu_L = p.D_pac * Math.sin(p.C_pac * Math.atan(
        p.B_pac * s.slip_L - p.E_pac * (p.B_pac * s.slip_L - Math.atan(p.B_pac * s.slip_L))
      ));
      const mu_R = p.D_pac * Math.sin(p.C_pac * Math.atan(
        p.B_pac * s.slip_R - p.E_pac * (p.B_pac * s.slip_R - Math.atan(p.B_pac * s.slip_R))
      ));

      const Fx_max_L = Math.abs(mu_L) * s.Fz_L;
      const Fx_max_R = Math.abs(mu_R) * s.Fz_R;

      s.Fx_L = Math.sign(Fx_dyn_L) * Math.min(Math.abs(Fx_dyn_L), Fx_max_L);
      s.Fx_R = Math.sign(Fx_dyn_R) * Math.min(Math.abs(Fx_dyn_R), Fx_max_R);

      // Wheel Rotational ODEs
      const Taxle_L = p.G * p.eta_g * s.Te_L;
      const Taxle_R = p.G * p.eta_g * s.Te_R;

      const domega_wL = (Taxle_L - p.rw * s.Fx_L - p.Bw_eff * s.omega_wL) / p.Iw_eff;
      const domega_wR = (Taxle_R - p.rw * s.Fx_R - p.Bw_eff * s.omega_wR) / p.Iw_eff;

      s.omega_wL += dt * domega_wL;
      s.omega_wR += dt * domega_wR;

      s.phi_m_L += dt * (p.G * s.omega_wL);
      s.phi_m_R += dt * (p.G * s.omega_wR);

      // 2nd-Order Dynamic Swivel Casters
      const vKx_F = s.vx;
      const vKy_F = s.vy + p.Lc_F * s.wz;
      const vWx_F = vKx_F + p.b_trail * s.omega_cF * Math.sin(s.psi_cF);
      const vWy_F = vKy_F - p.b_trail * s.omega_cF * Math.cos(s.psi_cF);
      const vpar_F = vWx_F * Math.cos(s.psi_cF) + vWy_F * Math.sin(s.psi_cF);
      const vperp_F = -vWx_F * Math.sin(s.psi_cF) + vWy_F * Math.cos(s.psi_cF);
      const alpha_F = Math.atan2(vperp_F, Math.max(Math.abs(vpar_F), p.v_eps_lat));
      const Flat_F = Math.sign(-p.C_alpha * alpha_F) * Math.min(p.C_alpha * Math.abs(alpha_F), p.mu_scrub * s.Fz_cF);
      const Froll_cF = p.mu_roll_c * s.Fz_cF * Math.tanh(vpar_F / p.v_eps_lat);
      const M_align_F = -p.b_trail * Flat_F;
      const M_damp_F = p.C_swivel * s.omega_cF;
      const M_scrub_F = p.mu_scrub * s.Fz_cF * p.r_cont * Math.tanh(s.omega_cF / p.omega_eps);
      const domega_cF = (M_align_F - M_damp_F - M_scrub_F) / p.I_fork;

      const vKx_R = s.vx;
      const vKy_R = s.vy - p.Lc_R * s.wz;
      const vWx_R = vKx_R + p.b_trail * s.omega_cR * Math.sin(s.psi_cR);
      const vWy_R = vKy_R - p.b_trail * s.omega_cR * Math.cos(s.psi_cR);
      const vpar_R = vWx_R * Math.cos(s.psi_cR) + vWy_R * Math.sin(s.psi_cR);
      const vperp_R = -vWx_R * Math.sin(s.psi_cR) + vWy_R * Math.cos(s.psi_cR);
      const alpha_R = Math.atan2(vperp_R, Math.max(Math.abs(vpar_R), p.v_eps_lat));
      const Flat_R = Math.sign(-p.C_alpha * alpha_R) * Math.min(p.C_alpha * Math.abs(alpha_R), p.mu_scrub * s.Fz_cR);
      const Froll_cR = p.mu_roll_c * s.Fz_cR * Math.tanh(vpar_R / p.v_eps_lat);
      const M_align_R = -p.b_trail * Flat_R;
      const M_damp_R = p.C_swivel * s.omega_cR;
      const M_scrub_R = p.mu_scrub * s.Fz_cR * p.r_cont * Math.tanh(s.omega_cR / p.omega_eps);
      const domega_cR = (M_align_R - M_damp_R - M_scrub_R) / p.I_fork;

      s.omega_cF += dt * domega_cF;
      s.omega_cR += dt * domega_cR;
      s.psi_cF += dt * s.omega_cF;
      s.psi_cR += dt * s.omega_cR;

      const Fx_cF_B = -Froll_cF * Math.cos(s.psi_cF) - Flat_F * Math.sin(s.psi_cF);
      const Fy_cF_B = -Froll_cF * Math.sin(s.psi_cF) + Flat_F * Math.cos(s.psi_cF);
      const Fx_cR_B = -Froll_cR * Math.cos(s.psi_cR) - Flat_R * Math.sin(s.psi_cR);
      const Fy_cR_B = -Froll_cR * Math.sin(s.psi_cR) + Flat_R * Math.cos(s.psi_cR);

      s.M_z_cast = p.Lc_F * Fy_cF_B - p.Lc_R * Fy_cR_B;

      // Coupled Chassis Equations of Motion
      s.F_roll_drive = p.C_rr * (s.Fz_L + s.Fz_R) * Math.tanh(s.vx / 0.05);
      const dvx = (s.Fx_L + s.Fx_R + Fx_cF_B + Fx_cR_B - s.F_roll_drive) / p.M;
      const dwz = (p.b * (s.Fx_R - s.Fx_L) + s.M_z_cast - p.B_yaw * s.wz) / p.Iz;

      s.vx += dt * dvx;
      s.wz += dt * dwz;

      s.psi += dt * s.wz;
      s.X += dt * s.vx * Math.cos(s.psi);
      s.Y += dt * s.vx * Math.sin(s.psi);

      s.time += dt;
    }

    // Secondary derived values for visualization & telemetry
    s.vL = p.rw * s.omega_wL;
    s.vR = p.rw * s.omega_wR;
    s.ax = (s.vx - prev_vx) / dt_frame;
    s.ay = s.vx * s.wz;
    s.pitchDeg = ((-s.ax / p.g) * (180.0 / Math.PI)) * 0.15;
    s.rollDeg = ((s.ay / p.g) * (180.0 / Math.PI)) * 0.12;

    const th_eL_end = p.p * s.phi_m_L;
    s.ia_L = s.id_L * Math.cos(th_eL_end) - s.iq_L * Math.sin(th_eL_end);
    s.ib_L = s.id_L * Math.cos(th_eL_end - TWO_PI_OVER_3) - s.iq_L * Math.sin(th_eL_end - TWO_PI_OVER_3);
    s.ic_L = s.id_L * Math.cos(th_eL_end + TWO_PI_OVER_3) - s.iq_L * Math.sin(th_eL_end + TWO_PI_OVER_3);

    const th_eR_end = p.p * s.phi_m_R;
    s.ia_R = s.id_R * Math.cos(th_eR_end) - s.iq_R * Math.sin(th_eR_end);
    s.ib_R = s.id_R * Math.cos(th_eR_end - TWO_PI_OVER_3) - s.iq_R * Math.sin(th_eR_end - TWO_PI_OVER_3);
    s.ic_R = s.id_R * Math.cos(th_eR_end + TWO_PI_OVER_3) - s.iq_R * Math.sin(th_eR_end + TWO_PI_OVER_3);

    return this.getState();
  }

  /**
   * Real-time Interactive Simulation Step
   * Runs inside the 60 FPS viewport loop with sub-stepping for numerical stability
   * @param dt_frame Frame delta time [s] (e.g. 1/60 = 0.0166s)
   * @param vq_cmd_L Command q-axis voltage to left motor [V]
   * @param vq_cmd_R Command q-axis voltage to right motor [V]
   * @param subSteps Number of integration steps per frame (default: 80 ~ 160)
   */
  public stepRealTime(
    dt_frame: number,
    vq_cmd_L: number,
    vq_cmd_R: number,
    subSteps = 100
  ): AGVState {
    const dt = dt_frame / subSteps;
    const p = this.p;
    const s = this.state;
    const TWO_PI_OVER_3 = (2.0 * Math.PI) / 3.0;

    let prev_vx = s.vx;

    for (let step = 0; step < subSteps; ++step) {
      const tk = s.time;
      const Vdc_safe = Math.max(10.0, s.Vdc);

      // 1. SPWM Carrier & Bridge Solvers
      const tau = tk * p.f_sw;
      const carrier = 2.0 * Math.abs(2.0 * (tau - Math.floor(tau + 0.5))) - 1.0;

      // Left Inverter
      const th_eL = p.p * s.phi_m_L;
      const ma_L = Math.min(0.95, (2.0 * vq_cmd_L) / (Math.sqrt(3.0) * Vdc_safe));
      const va_ref_L = -ma_L * Math.sin(th_eL);
      const vb_ref_L = -ma_L * Math.sin(th_eL - TWO_PI_OVER_3);
      const vc_ref_L = -ma_L * Math.sin(th_eL + TWO_PI_OVER_3);

      const inv_L = AGVDigitalTwinEngine.solveInverterBridge(
        va_ref_L, vb_ref_L, vc_ref_L,
        carrier, p.delta_dt, Vdc_safe,
        p.Rds_on, p.Vsd, s.id_L, s.iq_L, th_eL
      );

      // Right Inverter
      const th_eR = p.p * s.phi_m_R;
      const ma_R = Math.min(0.95, (2.0 * vq_cmd_R) / (Math.sqrt(3.0) * Vdc_safe));
      const va_ref_R = -ma_R * Math.sin(th_eR);
      const vb_ref_R = -ma_R * Math.sin(th_eR - TWO_PI_OVER_3);
      const vc_ref_R = -ma_R * Math.sin(th_eR + TWO_PI_OVER_3);

      const inv_R = AGVDigitalTwinEngine.solveInverterBridge(
        va_ref_R, vb_ref_R, vc_ref_R,
        carrier, p.delta_dt, Vdc_safe,
        p.Rds_on, p.Vsd, s.id_R, s.iq_R, th_eR
      );

      // 2. PMSM Stator d-q Voltages & Current ODEs
      const cos_L = Math.cos(th_eL), sin_L = Math.sin(th_eL);
      const cos_L_m = Math.cos(th_eL - TWO_PI_OVER_3), sin_L_m = Math.sin(th_eL - TWO_PI_OVER_3);
      const cos_L_p = Math.cos(th_eL + TWO_PI_OVER_3), sin_L_p = Math.sin(th_eL + TWO_PI_OVER_3);
      const vd_L = (2.0 / 3.0) * (cos_L * inv_L.van + cos_L_m * inv_L.vbn + cos_L_p * inv_L.vcn);
      const vq_L = (2.0 / 3.0) * (-sin_L * inv_L.van - sin_L_m * inv_L.vbn - sin_L_p * inv_L.vcn);

      const cos_R = Math.cos(th_eR), sin_R = Math.sin(th_eR);
      const cos_R_m = Math.cos(th_eR - TWO_PI_OVER_3), sin_R_m = Math.sin(th_eR - TWO_PI_OVER_3);
      const cos_R_p = Math.cos(th_eR + TWO_PI_OVER_3), sin_R_p = Math.sin(th_eR + TWO_PI_OVER_3);
      const vd_R = (2.0 / 3.0) * (cos_R * inv_R.van + cos_R_m * inv_R.vbn + cos_R_p * inv_R.vcn);
      const vq_R = (2.0 / 3.0) * (-sin_R * inv_R.van - sin_R_m * inv_R.vbn - sin_R_p * inv_R.vcn);

      const we_L = p.p * p.G * s.omega_wL;
      const we_R = p.p * p.G * s.omega_wR;

      const did_L = (vd_L - p.Rs * s.id_L + we_L * p.Lq * s.iq_L) / p.Ld;
      const diq_L = (vq_L - p.Rs * s.iq_L - we_L * p.Ld * s.id_L - we_L * p.lambda_m) / p.Lq;
      const did_R = (vd_R - p.Rs * s.id_R + we_R * p.Lq * s.iq_R) / p.Ld;
      const diq_R = (vq_R - p.Rs * s.iq_R - we_R * p.Ld * s.id_R - we_R * p.lambda_m) / p.Lq;

      s.id_L += dt * did_L;
      s.iq_L += dt * diq_L;
      s.id_R += dt * did_R;
      s.iq_R += dt * diq_R;

      s.Te_L = 1.5 * p.p * (p.lambda_m * s.iq_L + (p.Ld - p.Lq) * s.id_L * s.iq_L);
      s.Te_R = 1.5 * p.p * (p.lambda_m * s.iq_R + (p.Ld - p.Lq) * s.id_R * s.iq_R);

      // 3. DC-Link Capacitor ODE & Bleeder
      s.Ibatt = (p.V_batt - Vdc_safe) / p.R_batt;
      s.Idc_L = inv_L.Idc;
      s.Idc_R = inv_R.Idc;
      const dVdc = (s.Ibatt - (inv_L.Idc + inv_R.Idc)) / p.C_bulk;
      s.Vdc = Vdc_safe + dt * dVdc;

      // 4. Dynamic 4-Point Normal Load Transfer (SSoT Section 3.2)
      const a_lat = s.vx * s.wz;
      const dFz_lat = (p.M * a_lat * p.hcg) / (2.0 * p.b);
      const dFz_long = (p.M * s.ax * p.hcg) / (2.0 * p.Lc_F);

      s.Fz_L = Math.max(5.0, p.Fz_drive_static - dFz_lat);
      s.Fz_R = Math.max(5.0, p.Fz_drive_static + dFz_lat);
      s.Fz_cF = Math.max(5.0, p.Fz_caster_static - dFz_long);
      s.Fz_cR = Math.max(5.0, p.Fz_caster_static + dFz_long);

      // 5. Dynamic Tire Relaxation Length & Regularized Pacejka (SSoT Section 3.3)
      const vw_L = s.vx - p.b * s.wz;
      const vw_R = s.vx + p.b * s.wz;

      // Regularized slip ratio (singularity-free across vw -> 0)
      const denom_L = Math.sqrt(vw_L * vw_L + p.eps_v * p.eps_v);
      const denom_R = Math.sqrt(vw_R * vw_R + p.eps_v * p.eps_v);
      s.slip_L = (p.rw * s.omega_wL - vw_L) / denom_L;
      s.slip_R = (p.rw * s.omega_wR - vw_R) / denom_R;

      // First-order dynamic tire relaxation ODE: sigma_x * dFx/dt + |vw|*Fx = C_s * (rw*omega - vw)
      // Unconditionally stable update: Fx^{k+1} = (sigma_x * Fx^k + dt * C_s * (rw*omega - vw)) / (sigma_x + dt * |vw|)
      const slip_vel_L = p.rw * s.omega_wL - vw_L;
      const slip_vel_R = p.rw * s.omega_wR - vw_R;
      const abs_vw_L = Math.abs(vw_L);
      const abs_vw_R = Math.abs(vw_R);

      const Fx_dyn_L = (p.sigma_x * s.Fx_L + dt * p.C_s * slip_vel_L) / (p.sigma_x + dt * abs_vw_L);
      const Fx_dyn_R = (p.sigma_x * s.Fx_R + dt * p.C_s * slip_vel_R) / (p.sigma_x + dt * abs_vw_R);

      // Pacejka Magic Formula friction envelope
      const mu_L = p.D_pac * Math.sin(p.C_pac * Math.atan(
        p.B_pac * s.slip_L - p.E_pac * (p.B_pac * s.slip_L - Math.atan(p.B_pac * s.slip_L))
      ));
      const mu_R = p.D_pac * Math.sin(p.C_pac * Math.atan(
        p.B_pac * s.slip_R - p.E_pac * (p.B_pac * s.slip_R - Math.atan(p.B_pac * s.slip_R))
      ));

      // Physical saturation clamping by dynamic normal load
      const Fx_max_L = Math.abs(mu_L) * s.Fz_L;
      const Fx_max_R = Math.abs(mu_R) * s.Fz_R;

      s.Fx_L = Math.sign(Fx_dyn_L) * Math.min(Math.abs(Fx_dyn_L), Fx_max_L);
      s.Fx_R = Math.sign(Fx_dyn_R) * Math.min(Math.abs(Fx_dyn_R), Fx_max_R);

      // 6. Wheel Rotational ODEs (SSoT Section 3.5)
      const Taxle_L = p.G * p.eta_g * s.Te_L;
      const Taxle_R = p.G * p.eta_g * s.Te_R;

      const domega_wL = (Taxle_L - p.rw * s.Fx_L - p.Bw_eff * s.omega_wL) / p.Iw_eff;
      const domega_wR = (Taxle_R - p.rw * s.Fx_R - p.Bw_eff * s.omega_wR) / p.Iw_eff;

      s.omega_wL += dt * domega_wL;
      s.omega_wR += dt * domega_wR;

      s.phi_m_L += dt * (p.G * s.omega_wL);
      s.phi_m_R += dt * (p.G * s.omega_wR);

      // 7. 2nd-Order Dynamic Swivel Casters (SSoT Section 3.4)
      // Front Caster (k = F, Lc = +Lc_F)
      const vKx_F = s.vx;
      const vKy_F = s.vy + p.Lc_F * s.wz;
      const vWx_F = vKx_F + p.b_trail * s.omega_cF * Math.sin(s.psi_cF);
      const vWy_F = vKy_F - p.b_trail * s.omega_cF * Math.cos(s.psi_cF);
      const vpar_F = vWx_F * Math.cos(s.psi_cF) + vWy_F * Math.sin(s.psi_cF);
      const vperp_F = -vWx_F * Math.sin(s.psi_cF) + vWy_F * Math.cos(s.psi_cF);
      const alpha_F = Math.atan2(vperp_F, Math.max(Math.abs(vpar_F), p.v_eps_lat));
      const Flat_F = Math.sign(-p.C_alpha * alpha_F) * Math.min(p.C_alpha * Math.abs(alpha_F), p.mu_scrub * s.Fz_cF);
      const Froll_cF = p.mu_roll_c * s.Fz_cF * Math.tanh(vpar_F / p.v_eps_lat);
      const M_align_F = -p.b_trail * Flat_F;
      const M_damp_F = p.C_swivel * s.omega_cF;
      const M_scrub_F = p.mu_scrub * s.Fz_cF * p.r_cont * Math.tanh(s.omega_cF / p.omega_eps);
      const domega_cF = (M_align_F - M_damp_F - M_scrub_F) / p.I_fork;

      // Rear Caster (k = R, Lc = -Lc_R)
      const vKx_R = s.vx;
      const vKy_R = s.vy - p.Lc_R * s.wz;
      const vWx_R = vKx_R + p.b_trail * s.omega_cR * Math.sin(s.psi_cR);
      const vWy_R = vKy_R - p.b_trail * s.omega_cR * Math.cos(s.psi_cR);
      const vpar_R = vWx_R * Math.cos(s.psi_cR) + vWy_R * Math.sin(s.psi_cR);
      const vperp_R = -vWx_R * Math.sin(s.psi_cR) + vWy_R * Math.cos(s.psi_cR);
      const alpha_R = Math.atan2(vperp_R, Math.max(Math.abs(vpar_R), p.v_eps_lat));
      const Flat_R = Math.sign(-p.C_alpha * alpha_R) * Math.min(p.C_alpha * Math.abs(alpha_R), p.mu_scrub * s.Fz_cR);
      const Froll_cR = p.mu_roll_c * s.Fz_cR * Math.tanh(vpar_R / p.v_eps_lat);
      const M_align_R = -p.b_trail * Flat_R;
      const M_damp_R = p.C_swivel * s.omega_cR;
      const M_scrub_R = p.mu_scrub * s.Fz_cR * p.r_cont * Math.tanh(s.omega_cR / p.omega_eps);
      const domega_cR = (M_align_R - M_damp_R - M_scrub_R) / p.I_fork;

      s.omega_cF += dt * domega_cF;
      s.omega_cR += dt * domega_cR;
      s.psi_cF += dt * s.omega_cF;
      s.psi_cR += dt * s.omega_cR;

      // Forces transmitted from casters to chassis in Body Frame
      const Fx_cF_B = -Froll_cF * Math.cos(s.psi_cF) - Flat_F * Math.sin(s.psi_cF);
      const Fy_cF_B = -Froll_cF * Math.sin(s.psi_cF) + Flat_F * Math.cos(s.psi_cF);
      const Fx_cR_B = -Froll_cR * Math.cos(s.psi_cR) - Flat_R * Math.sin(s.psi_cR);
      const Fy_cR_B = -Froll_cR * Math.sin(s.psi_cR) + Flat_R * Math.cos(s.psi_cR);

      s.M_z_cast = p.Lc_F * Fy_cF_B - p.Lc_R * Fy_cR_B;

      // 8. Coupled Chassis Equations of Motion (SSoT Section 3.5)
      s.F_roll_drive = p.C_rr * (s.Fz_L + s.Fz_R) * Math.tanh(s.vx / 0.05);
      const dvx = (s.Fx_L + s.Fx_R + Fx_cF_B + Fx_cR_B - s.F_roll_drive) / p.M;
      const dwz = (p.b * (s.Fx_R - s.Fx_L) + s.M_z_cast - p.B_yaw * s.wz) / p.Iz;

      s.vx += dt * dvx;
      s.wz += dt * dwz;

      s.psi += dt * s.wz;
      s.X += dt * s.vx * Math.cos(s.psi);
      s.Y += dt * s.vx * Math.sin(s.psi);

      s.time += dt;
    }

    // Secondary derived values for visualization & telemetry
    s.vL = p.rw * s.omega_wL;
    s.vR = p.rw * s.omega_wR;
    s.ax = (s.vx - prev_vx) / dt_frame;
    s.ay = s.vx * s.wz;

    // Pitch & Roll in degrees (derived from inertial load transfer)
    // Positive ax pitches up (acceleration squat/dive)
    const L_wb = p.Lc_F + p.Lc_R;
    s.pitchDeg = ((-s.ax * p.hcg) / (p.g * L_wb)) * (180 / Math.PI);
    s.rollDeg = ((s.ay * p.hcg) / (p.g * p.L)) * (180 / Math.PI);

    // Instantaneous phase currents (Clarke-Park inverse)
    const th_eL = p.p * s.phi_m_L;
    const th_eR = p.p * s.phi_m_R;
    s.ia_L = s.id_L * Math.cos(th_eL) - s.iq_L * Math.sin(th_eL);
    s.ib_L = s.id_L * Math.cos(th_eL - TWO_PI_OVER_3) - s.iq_L * Math.sin(th_eL - TWO_PI_OVER_3);
    s.ic_L = s.id_L * Math.cos(th_eL + TWO_PI_OVER_3) - s.iq_L * Math.sin(th_eL + TWO_PI_OVER_3);

    s.ia_R = s.id_R * Math.cos(th_eR) - s.iq_R * Math.sin(th_eR);
    s.ib_R = s.id_R * Math.cos(th_eR - TWO_PI_OVER_3) - s.iq_R * Math.sin(th_eR - TWO_PI_OVER_3);
    s.ic_R = s.id_R * Math.cos(th_eR + TWO_PI_OVER_3) - s.iq_R * Math.sin(th_eR + TWO_PI_OVER_3);

    return { ...s };
  }

  /**
   * Official 5.5s S-Curve Dynamic Maneuver Benchmark Runner (5,500,000 steps at dt = 1 µs)
   * 5-Phase Profile: Accel -> Aggressive Left -> Counter Right -> Regen Brake -> Stop
   */
  public simulateSCurveBenchmark(
    t_stop = 5.5,
    dt = 1.0e-6,
    dt_log = 1.0e-3
  ): AGVLogEntry[] {
    const vq_scurve_L = (t: number): number => {
      if (t < 2.0) return 36.0;
      if (t < 3.2) return 16.0;
      if (t < 4.4) return 36.0;
      if (t < 5.2) return -25.0;
      return 0.0;
    };
    const vq_scurve_R = (t: number): number => {
      if (t < 2.0) return 36.0;
      if (t < 3.2) return 36.0;
      if (t < 4.4) return 16.0;
      if (t < 5.2) return -25.0;
      return 0.0;
    };
    return this.simulateScientificBenchmark(t_stop, dt, vq_scurve_L, vq_scurve_R, dt_log);
  }

  /**
   * Deterministic Scientific Benchmark Runner
   * Runs the exact 1.0 µs integration loop for t_stop, matching agv_digital_twin.hpp
   * Used for CSV cross-validation with C++, Python, and MATLAB
   */
  public simulateScientificBenchmark(
    t_stop = 1.0,
    dt = 1.0e-6,
    vq_cmd_L: (t: number) => number = () => 15.0,
    vq_cmd_R: (t: number) => number = () => 15.0,
    dt_log = 1.0e-3
  ): AGVLogEntry[] {
    const p = this.p;
    const decim = Math.max(1, Math.round(dt_log / dt));
    const total_steps = Math.round(t_stop / dt);
    const n_log = Math.floor(total_steps / decim) + 1;
    const TWO_PI_OVER_3 = (2.0 * Math.PI) / 3.0;

    const log: AGVLogEntry[] = [];

    // State variables
    let Vdc_k = p.V_batt;
    let id_L_k = 0.0, iq_L_k = 0.0;
    let id_R_k = 0.0, iq_R_k = 0.0;
    let phi_m_L_k = 0.0, phi_m_R_k = 0.0;
    let omega_wL_k = 0.0, omega_wR_k = 0.0;
    let vx_k = 0.0, vy_k = 0.0, wz_k = 0.0;
    let X_k = 0.0, Y_k = 0.0, psi_k = 0.0;
    let psi_cF_k = 0.0, psi_cR_k = 0.0;
    let omega_cF_k = 0.0, omega_cR_k = 0.0;
    let Fz_cF_k = p.Fz_caster_static, Fz_cR_k = p.Fz_caster_static;
    let ax_k = 0.0;

    let Fz_L_k = p.Fz_drive_static;
    let Fz_R_k = p.Fz_drive_static;
    let Fx_L_k = 0.0, Fx_R_k = 0.0;
    let Te_L_k = 0.0, Te_R_k = 0.0;
    let slip_L_k = 0.0, slip_R_k = 0.0;

    // Initial log at t = 0
    log.push({
      time: 0.0, vx: vx_k, vy: vy_k, wz: wz_k, X: X_k, Y: Y_k, psi: psi_k,
      omega_wL: omega_wL_k, omega_wR: omega_wR_k,
      vL: p.rw * omega_wL_k, vR: p.rw * omega_wR_k,
      Fz_L: Fz_L_k, Fz_R: Fz_R_k, Fx_L: Fx_L_k, Fx_R: Fx_R_k,
      Te_L: Te_L_k, Te_R: Te_R_k, Vdc: Vdc_k,
      slip_L: slip_L_k, slip_R: slip_R_k,
      id_L: id_L_k, iq_L: iq_L_k, id_R: id_R_k, iq_R: iq_R_k,
      psi_cF: psi_cF_k, psi_cR: psi_cR_k,
      omega_cF: omega_cF_k, omega_cR: omega_cR_k,
      Fz_cF: Fz_cF_k, Fz_cR: Fz_cR_k,
    });

    for (let k = 1; k <= total_steps; ++k) {
      const tk = (k - 1) * dt;
      const vq_L_now = vq_cmd_L(tk);
      const vq_R_now = vq_cmd_R(tk);

      const Vdc_safe = Math.max(10.0, Vdc_k);

      // 1. SPWM Carrier & Bridge Solvers
      const tau = tk * p.f_sw;
      const carrier = 2.0 * Math.abs(2.0 * (tau - Math.floor(tau + 0.5))) - 1.0;

      // Left Inverter
      const th_eL = p.p * phi_m_L_k;
      const ma_L = Math.min(0.95, (2.0 * vq_L_now) / (Math.sqrt(3.0) * Vdc_safe));
      const va_ref_L = -ma_L * Math.sin(th_eL);
      const vb_ref_L = -ma_L * Math.sin(th_eL - TWO_PI_OVER_3);
      const vc_ref_L = -ma_L * Math.sin(th_eL + TWO_PI_OVER_3);

      const inv_L = AGVDigitalTwinEngine.solveInverterBridge(
        va_ref_L, vb_ref_L, vc_ref_L,
        carrier, p.delta_dt, Vdc_safe,
        p.Rds_on, p.Vsd, id_L_k, iq_L_k, th_eL
      );

      // Right Inverter
      const th_eR = p.p * phi_m_R_k;
      const ma_R = Math.min(0.95, (2.0 * vq_R_now) / (Math.sqrt(3.0) * Vdc_safe));
      const va_ref_R = -ma_R * Math.sin(th_eR);
      const vb_ref_R = -ma_R * Math.sin(th_eR - TWO_PI_OVER_3);
      const vc_ref_R = -ma_R * Math.sin(th_eR + TWO_PI_OVER_3);

      const inv_R = AGVDigitalTwinEngine.solveInverterBridge(
        va_ref_R, vb_ref_R, vc_ref_R,
        carrier, p.delta_dt, Vdc_safe,
        p.Rds_on, p.Vsd, id_R_k, iq_R_k, th_eR
      );

      // 2. PMSM Stator d-q Voltages & Current ODEs
      const cos_L = Math.cos(th_eL), sin_L = Math.sin(th_eL);
      const cos_L_m = Math.cos(th_eL - TWO_PI_OVER_3), sin_L_m = Math.sin(th_eL - TWO_PI_OVER_3);
      const cos_L_p = Math.cos(th_eL + TWO_PI_OVER_3), sin_L_p = Math.sin(th_eL + TWO_PI_OVER_3);
      const vd_L = (2.0 / 3.0) * (cos_L * inv_L.van + cos_L_m * inv_L.vbn + cos_L_p * inv_L.vcn);
      const vq_L = (2.0 / 3.0) * (-sin_L * inv_L.van - sin_L_m * inv_L.vbn - sin_L_p * inv_L.vcn);

      const cos_R = Math.cos(th_eR), sin_R = Math.sin(th_eR);
      const cos_R_m = Math.cos(th_eR - TWO_PI_OVER_3), sin_R_m = Math.sin(th_eR - TWO_PI_OVER_3);
      const cos_R_p = Math.cos(th_eR + TWO_PI_OVER_3), sin_R_p = Math.sin(th_eR + TWO_PI_OVER_3);
      const vd_R = (2.0 / 3.0) * (cos_R * inv_R.van + cos_R_m * inv_R.vbn + cos_R_p * inv_R.vcn);
      const vq_R = (2.0 / 3.0) * (-sin_R * inv_R.van - sin_R_m * inv_R.vbn - sin_R_p * inv_R.vcn);

      const we_L = p.p * p.G * omega_wL_k;
      const we_R = p.p * p.G * omega_wR_k;

      const did_L = (vd_L - p.Rs * id_L_k + we_L * p.Lq * iq_L_k) / p.Ld;
      const diq_L = (vq_L - p.Rs * iq_L_k - we_L * p.Ld * id_L_k - we_L * p.lambda_m) / p.Lq;
      const did_R = (vd_R - p.Rs * id_R_k + we_R * p.Lq * iq_R_k) / p.Ld;
      const diq_R = (vq_R - p.Rs * iq_R_k - we_R * p.Ld * id_R_k - we_R * p.lambda_m) / p.Lq;

      id_L_k += dt * did_L;
      iq_L_k += dt * diq_L;
      id_R_k += dt * did_R;
      iq_R_k += dt * diq_R;

      Te_L_k = 1.5 * p.p * (p.lambda_m * iq_L_k + (p.Ld - p.Lq) * id_L_k * iq_L_k);
      Te_R_k = 1.5 * p.p * (p.lambda_m * iq_R_k + (p.Ld - p.Lq) * id_R_k * iq_R_k);

      // 3. DC-Link Capacitor ODE
      const I_batt = (p.V_batt - Vdc_safe) / p.R_batt;
      const dVdc = (I_batt - (inv_L.Idc + inv_R.Idc)) / p.C_bulk;
      Vdc_k = Vdc_safe + dt * dVdc;

      // 4. Dynamic 4-Point Normal Load Transfer (SSoT Section 3.2)
      const a_lat = vx_k * wz_k;
      const dFz_lat = (p.M * a_lat * p.hcg) / (2.0 * p.b);
      const dFz_long = (p.M * ax_k * p.hcg) / (2.0 * p.Lc_F);

      Fz_L_k = Math.max(5.0, p.Fz_drive_static - dFz_lat);
      Fz_R_k = Math.max(5.0, p.Fz_drive_static + dFz_lat);
      Fz_cF_k = Math.max(5.0, p.Fz_caster_static - dFz_long);
      Fz_cR_k = Math.max(5.0, p.Fz_caster_static + dFz_long);

      // 5. Dynamic Tire Relaxation Length & Regularized Pacejka (SSoT Section 3.3)
      const vw_L = vx_k - p.b * wz_k;
      const vw_R = vx_k + p.b * wz_k;

      const denom_L = Math.sqrt(vw_L * vw_L + p.eps_v * p.eps_v);
      const denom_R = Math.sqrt(vw_R * vw_R + p.eps_v * p.eps_v);
      slip_L_k = (p.rw * omega_wL_k - vw_L) / denom_L;
      slip_R_k = (p.rw * omega_wR_k - vw_R) / denom_R;

      const slip_vel_L = p.rw * omega_wL_k - vw_L;
      const slip_vel_R = p.rw * omega_wR_k - vw_R;
      const abs_vw_L = Math.abs(vw_L);
      const abs_vw_R = Math.abs(vw_R);

      const Fx_dyn_L = (p.sigma_x * Fx_L_k + dt * p.C_s * slip_vel_L) / (p.sigma_x + dt * abs_vw_L);
      const Fx_dyn_R = (p.sigma_x * Fx_R_k + dt * p.C_s * slip_vel_R) / (p.sigma_x + dt * abs_vw_R);

      const mu_L = p.D_pac * Math.sin(p.C_pac * Math.atan(
        p.B_pac * slip_L_k - p.E_pac * (p.B_pac * slip_L_k - Math.atan(p.B_pac * slip_L_k))
      ));
      const mu_R = p.D_pac * Math.sin(p.C_pac * Math.atan(
        p.B_pac * slip_R_k - p.E_pac * (p.B_pac * slip_R_k - Math.atan(p.B_pac * slip_R_k))
      ));

      const Fx_max_L = Math.abs(mu_L) * Fz_L_k;
      const Fx_max_R = Math.abs(mu_R) * Fz_R_k;

      Fx_L_k = Math.sign(Fx_dyn_L) * Math.min(Math.abs(Fx_dyn_L), Fx_max_L);
      Fx_R_k = Math.sign(Fx_dyn_R) * Math.min(Math.abs(Fx_dyn_R), Fx_max_R);

      // 6. Wheel Rotational ODEs (SSoT Section 3.5)
      const Taxle_L = p.G * p.eta_g * Te_L_k;
      const Taxle_R = p.G * p.eta_g * Te_R_k;

      const domega_wL = (Taxle_L - p.rw * Fx_L_k - p.Bw_eff * omega_wL_k) / p.Iw_eff;
      const domega_wR = (Taxle_R - p.rw * Fx_R_k - p.Bw_eff * omega_wR_k) / p.Iw_eff;

      omega_wL_k += dt * domega_wL;
      omega_wR_k += dt * domega_wR;

      phi_m_L_k += dt * (p.G * omega_wL_k);
      phi_m_R_k += dt * (p.G * omega_wR_k);

      // 7. 2nd-Order Dynamic Swivel Casters (SSoT Section 3.4)
      const vKx_F = vx_k;
      const vKy_F = vy_k + p.Lc_F * wz_k;
      const vWx_F = vKx_F + p.b_trail * omega_cF_k * Math.sin(psi_cF_k);
      const vWy_F = vKy_F - p.b_trail * omega_cF_k * Math.cos(psi_cF_k);
      const vpar_F = vWx_F * Math.cos(psi_cF_k) + vWy_F * Math.sin(psi_cF_k);
      const vperp_F = -vWx_F * Math.sin(psi_cF_k) + vWy_F * Math.cos(psi_cF_k);
      const alpha_F = Math.atan2(vperp_F, Math.max(Math.abs(vpar_F), p.v_eps_lat));
      const Flat_F = Math.sign(-p.C_alpha * alpha_F) * Math.min(p.C_alpha * Math.abs(alpha_F), p.mu_scrub * Fz_cF_k);
      const Froll_cF = p.mu_roll_c * Fz_cF_k * Math.tanh(vpar_F / p.v_eps_lat);
      const M_align_F = -p.b_trail * Flat_F;
      const M_damp_F = p.C_swivel * omega_cF_k;
      const M_scrub_F = p.mu_scrub * Fz_cF_k * p.r_cont * Math.tanh(omega_cF_k / p.omega_eps);
      const domega_cF = (M_align_F - M_damp_F - M_scrub_F) / p.I_fork;

      const vKx_R = vx_k;
      const vKy_R = vy_k - p.Lc_R * wz_k;
      const vWx_R = vKx_R + p.b_trail * omega_cR_k * Math.sin(psi_cR_k);
      const vWy_R = vKy_R - p.b_trail * omega_cR_k * Math.cos(psi_cR_k);
      const vpar_R = vWx_R * Math.cos(psi_cR_k) + vWy_R * Math.sin(psi_cR_k);
      const vperp_R = -vWx_R * Math.sin(psi_cR_k) + vWy_R * Math.cos(psi_cR_k);
      const alpha_R = Math.atan2(vperp_R, Math.max(Math.abs(vpar_R), p.v_eps_lat));
      const Flat_R = Math.sign(-p.C_alpha * alpha_R) * Math.min(p.C_alpha * Math.abs(alpha_R), p.mu_scrub * Fz_cR_k);
      const Froll_cR = p.mu_roll_c * Fz_cR_k * Math.tanh(vpar_R / p.v_eps_lat);
      const M_align_R = -p.b_trail * Flat_R;
      const M_damp_R = p.C_swivel * omega_cR_k;
      const M_scrub_R = p.mu_scrub * Fz_cR_k * p.r_cont * Math.tanh(omega_cR_k / p.omega_eps);
      const domega_cR = (M_align_R - M_damp_R - M_scrub_R) / p.I_fork;

      omega_cF_k += dt * domega_cF;
      omega_cR_k += dt * domega_cR;
      psi_cF_k += dt * omega_cF_k;
      psi_cR_k += dt * omega_cR_k;

      const Fx_cF_B = -Froll_cF * Math.cos(psi_cF_k) - Flat_F * Math.sin(psi_cF_k);
      const Fy_cF_B = -Froll_cF * Math.sin(psi_cF_k) + Flat_F * Math.cos(psi_cF_k);
      const Fx_cR_B = -Froll_cR * Math.cos(psi_cR_k) - Flat_R * Math.sin(psi_cR_k);
      const Fy_cR_B = -Froll_cR * Math.sin(psi_cR_k) + Flat_R * Math.cos(psi_cR_k);

      const M_z_cast = p.Lc_F * Fy_cF_B - p.Lc_R * Fy_cR_B;

      // 8. Coupled Chassis Equations of Motion (SSoT Section 3.5)
      const F_roll_drive = p.C_rr * (Fz_L_k + Fz_R_k) * Math.tanh(vx_k / 0.05);
      const dvx = (Fx_L_k + Fx_R_k + Fx_cF_B + Fx_cR_B - F_roll_drive) / p.M;
      const dwz = (p.b * (Fx_R_k - Fx_L_k) + M_z_cast - p.B_yaw * wz_k) / p.Iz;

      ax_k = dvx;
      vx_k += dt * dvx;
      wz_k += dt * dwz;

      psi_k += dt * wz_k;
      X_k += dt * vx_k * Math.cos(psi_k);
      Y_k += dt * vx_k * Math.sin(psi_k);

      // 9. Decimated Logging
      if (k % decim === 0 && log.length < n_log) {
        log.push({
          time: tk + dt,
          vx: vx_k, vy: vy_k, wz: wz_k, X: X_k, Y: Y_k, psi: psi_k,
          omega_wL: omega_wL_k, omega_wR: omega_wR_k,
          vL: p.rw * omega_wL_k, vR: p.rw * omega_wR_k,
          Fz_L: Fz_L_k, Fz_R: Fz_R_k, Fx_L: Fx_L_k, Fx_R: Fx_R_k,
          Te_L: Te_L_k, Te_R: Te_R_k, Vdc: Vdc_k,
          slip_L: slip_L_k, slip_R: slip_R_k,
          id_L: id_L_k, iq_L: iq_L_k, id_R: id_R_k, iq_R: iq_R_k,
          psi_cF: psi_cF_k, psi_cR: psi_cR_k,
          omega_cF: omega_cF_k, omega_cR: omega_cR_k,
          Fz_cF: Fz_cF_k, Fz_cR: Fz_cR_k,
        });
      }
    }

    return log;
  }

  /**
   * Generates CSV format for cross-validation benchmark
   */
  public static exportToCSV(log: AGVLogEntry[]): string {
    const headers = [
      'time', 'vx', 'vy', 'wz', 'X', 'Y', 'psi',
      'omega_wL', 'omega_wR', 'vL', 'vR',
      'Fz_L', 'Fz_R', 'Fx_L', 'Fx_R',
      'Te_L', 'Te_R', 'Vdc',
      'slip_L', 'slip_R',
      'id_L', 'iq_L', 'id_R', 'iq_R',
      'psi_cF', 'psi_cR',
      'omega_cF', 'omega_cR', 'Fz_cF', 'Fz_cR',
    ];

    const rows = log.map((entry) => [
      entry.time.toFixed(6),
      entry.vx.toFixed(8),
      entry.vy.toFixed(8),
      entry.wz.toFixed(8),
      entry.X.toFixed(8),
      entry.Y.toFixed(8),
      entry.psi.toFixed(8),
      entry.omega_wL.toFixed(8),
      entry.omega_wR.toFixed(8),
      entry.vL.toFixed(8),
      entry.vR.toFixed(8),
      entry.Fz_L.toFixed(6),
      entry.Fz_R.toFixed(6),
      entry.Fx_L.toFixed(6),
      entry.Fx_R.toFixed(6),
      entry.Te_L.toFixed(6),
      entry.Te_R.toFixed(6),
      entry.Vdc.toFixed(6),
      entry.slip_L.toFixed(8),
      entry.slip_R.toFixed(8),
      entry.id_L.toFixed(6),
      entry.iq_L.toFixed(6),
      entry.id_R.toFixed(6),
      entry.iq_R.toFixed(6),
      entry.psi_cF.toFixed(8),
      entry.psi_cR.toFixed(8),
      (entry.omega_cF ?? 0).toFixed(8),
      (entry.omega_cR ?? 0).toFixed(8),
      (entry.Fz_cF ?? 0).toFixed(6),
      (entry.Fz_cR ?? 0).toFixed(6),
    ].join(','));

    return [headers.join(','), ...rows].join('\n');
  }
}
