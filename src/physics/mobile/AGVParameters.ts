/**
 * AGV Multi-Physics Digital Twin Parameters
 * Platform: Dual-PMSM Differential Drive Mobile Robot (DDWMR) with Dual Casters
 * 
 * Supports two distinct scientific research profiles:
 *  1. KDS_AMR_PARAMETERS: Heavy-Duty AMR for KDS S-Curve Energy Optimization
 *     (Matching Table 1 in KDS_Multi_Physics/manuscript/main.tex)
 *  2. BENCHMARK_AGV_PARAMETERS: Quad-Platform Numerical Consistency & Execution Benchmark
 *     (Matching Table 1 in Paper_TriLanguage_ActaMechanica and SSoT v2.1.0)
 */

export interface AGVParameters {
  // 1. Platform & Chassis
  M: number;                 // Total vehicle mass [kg]
  Iz: number;                // Yaw moment of inertia [kg*m^2]
  rw: number;                // Active drive wheel radius [m]
  L: number;                 // Active drive track gauge (wheelbase width) [m]
  b: number;                 // Half track gauge [m]
  g: number;                 // Gravitational acceleration [m/s^2]
  hcg: number;               // Center of gravity height [m]
  C_rr: number;              // Drive wheel rolling resistance coefficient [-]
  B_yaw: number;             // Chassis rotational damping about Zb [N*m*s/rad]

  // 4-Point Normal Load distribution
  K_z_drive: number;         // Contact stiffness per active drive wheel [N/m]
  K_z_caster: number;        // Contact stiffness per swivel caster wheel [N/m]
  Fz_drive_static: number;   // Static normal force per drive wheel [N]
  Fz_caster_static: number;  // Static normal force per caster [N]

  // 2. Wheel & Powertrain Gearing
  G: number;                 // Gearbox reduction ratio [-]
  eta_g: number;             // Gearbox transmission mechanical efficiency [-]
  Iw_wheel: number;          // Wheel rim inertia [kg*m^2]
  Jm: number;                // Motor rotor inertia [kg*m^2]
  Bm: number;                // Motor rotor viscous damping [N*m*s/rad]
  Iw_eff: number;            // Total effective wheel inertia reflected (Iw + G^2 * Jm) [kg*m^2]
  Bw_eff: number;            // Effective bearing viscous friction (Bw + G^2 * Bm) [N*m*s/rad]
  T_max: number;             // Maximum motor rated torque [N*m]

  // 3. Dual IPMSM Motor (Per motor)
  p: number;                 // Pole pairs [-]
  Rs: number;                // Stator phase resistance [Ohm]
  Ld: number;                // d-axis inductance [H]
  Lq: number;                // q-axis inductance [H]
  lambda_m: number;          // Permanent magnet flux linkage (psi_m) [Wb]

  // 4. Power Inverter & DC-Link Bus
  f_sw: number;              // PWM switching frequency [Hz]
  t_dead: number;            // Inverter dead-time insertion [s]
  delta_dt: number;          // Normalized dead-time duty ratio [-]
  Rds_on: number;            // MOSFET ON-state resistance [Ohm]
  Vsd: number;               // Freewheeling body diode forward drop [V]
  V_batt: number;            // Battery nominal voltage (Vdc) [V]
  V_max: number;             // SVPWM circular inscribed voltage limit [V]
  I_max: number;             // Continuous inverter thermal current limit [A]
  R_batt: number;            // Battery internal resistance [Ohm]
  C_bulk: number;            // Bulk electrolytic DC-link capacitor [F]

  // 5. Dynamic Tire Relaxation Length & Pacejka Magic Formula
  sigma_x: number;           // Longitudinal tire relaxation length [m]
  C_s: number;               // Longitudinal slip shear stiffness [N]
  eps_v: number;             // Standstill slip velocity smoothing parameter [m/s]
  B_pac: number;             // Pacejka stiffness factor
  C_pac: number;             // Pacejka shape factor
  D_pac: number;             // Pacejka peak friction factor (mu_peak)
  E_pac: number;             // Pacejka curvature factor
  vxlow: number;             // Low-velocity regularization threshold [m/s]

  // 6. Dual Swivel Casters (Front & Rear, 2nd-Order Dynamic)
  b_trail: number;           // Geometric kingpin trail offset [m]
  Lc_F: number;              // Distance from chassis center to front kingpin [m]
  Lc_R: number;              // Distance from chassis center to rear kingpin [m]
  R_c: number;               // Caster wheel radius [m]
  r_cont: number;            // Equivalent contact patch scrub radius [m]
  I_fork: number;            // Swivel fork + wheel inertia about kingpin [kg*m^2]
  C_alpha: number;           // Caster tire cornering stiffness [N/rad]
  C_swivel: number;          // Swivel kingpin bearing viscous damping [N*m*s/rad]
  mu_roll_c: number;         // Caster wheel rolling friction coefficient [-]
  mu_scrub: number;          // Contact patch Coulomb scrub friction coefficient [-]
  v_eps_lat: number;         // Caster slip angle regularization velocity [m/s]
  omega_eps: number;         // Caster scrub torque smoothing angular velocity [rad/s]

  // 7. FOC, MTPA, Field-Weakening & CCC Controllers (SSoT Sections 3.7 & 3.8)
  f_bw: number;              // Current loop closed-loop bandwidth [Hz]
  K_pd: number;              // Current d-axis proportional gain (Ld * omega_ci) [V/A]
  K_pq: number;              // Current q-axis proportional gain (Lq * omega_ci) [V/A]
  K_id: number;              // Current d-axis integral gain (Rs * omega_ci) [V/(A*s)]
  K_iq: number;              // Current q-axis integral gain (Rs * omega_ci) [V/(A*s)]
  V_fw_on: number;           // Field-weakening activation threshold (0.95 * V_max) [V]
  V_fw_off: number;          // Field-weakening deactivation threshold (0.90 * V_max) [V]
  omega_e_base: number;      // Nominal electrical base speed (V_fw_on / lambda_m) [rad/s]
  tau_fw: number;            // Field-weakening lag filter time constant [s]
  K_fw: number;              // Voltage-feedback demagnetization gain [A/(V*s)]
  K_p_sync: number;          // CCC proportional synchronization gain [N*m/(rad/s)]
  K_i_sync: number;          // CCC integral synchronization gain [N*m/rad]
  K_sync: number;            // Adaptive contouring authority boost factor [-]
}

/**
 * Profile 1: Heavy-Duty AMR for KDS S-Curve Energy Optimization
 * Matching Table 1 in KDS_Multi_Physics/manuscript/main.tex verbatim:
 * - M = 200 kg, L = 0.54 m, rw = 0.08 m, Iz = 12.5 kg*m^2
 * - Dual PMSM: p = 2, Rs = 0.080 Ohm, Ld = 0.20 mH, Lq = 0.25 mH, lambda_m = 0.015 Wb
 * - Control: Kp_i = 1.5 V/A, Ki_i = 180 V/(A*s), Kp_v = 1.2, Ki_v = 8.0
 */
export const KDS_AMR_PARAMETERS: AGVParameters = {
  // 1. Platform & Chassis
  M: 200.0,
  Iz: 12.5,
  rw: 0.08,
  L: 0.54,
  b: 0.27,
  g: 9.81,
  hcg: 0.15,
  C_rr: 0.015,
  B_yaw: 8.5,

  // 4-Point Normal Load (Static equilibrium: 981N drive wheel, 490.5N caster)
  K_z_drive: 200.0e3,
  K_z_caster: 100.0e3,
  Fz_drive_static: 981.0,
  Fz_caster_static: 490.5,

  // 2. Wheel & Powertrain (G=25.0, eta=0.95, Jw=0.015, Jm=0.0008)
  G: 25.0,
  eta_g: 0.95,
  Iw_wheel: 0.015,
  Jm: 0.0008,
  Bm: 0.0001,
  Iw_eff: 0.015 + 25.0 * 25.0 * 0.0008, // 0.515 kg*m^2
  Bw_eff: 0.001 + 25.0 * 25.0 * 0.0001, // 0.0635 N*m*s/rad
  T_max: 8.0,

  // 3. Dual IPMSM (p=2, lambda_m=0.015 Wb, Kt=0.18 N*m/A, Rs=0.08 Ohm)
  p: 2,
  Rs: 0.08,
  Ld: 0.20e-3,
  Lq: 0.25e-3,
  lambda_m: 0.015,

  // 4. Inverter & DC-Link (Vbatt=48V, Vmax=27.71V, Itrip=45A)
  f_sw: 20000.0,
  t_dead: 350e-9,
  delta_dt: 2.0 * 20000.0 * 350e-9, // 0.014
  Rds_on: 3.6e-3,
  Vsd: 0.70,
  V_batt: 48.0,
  V_max: 27.71, // 48 / sqrt(3)
  I_max: 45.0,  // Overcurrent trip threshold
  R_batt: 0.05,
  C_bulk: 2200e-6,

  // 5. Dynamic Tire Relaxation Length & Pacejka (sigma_relax=0.05m, Cs=18000 N/rad, mu=0.85)
  sigma_x: 0.050,
  C_s: 18.0e3,
  eps_v: 0.050,
  B_pac: 10.0,
  C_pac: 1.65,
  D_pac: 0.85,
  E_pac: 0.97,
  vxlow: 0.050,

  // 6. Dual Casters (2nd-order dynamic, b_trail=30mm, Rc=50mm, Ifork=0.005)
  b_trail: 0.030,
  Lc_F: 0.42,
  Lc_R: 0.42,
  R_c: 0.050,
  r_cont: 0.015,
  I_fork: 0.005,
  C_alpha: 800.0,
  C_swivel: 0.050,
  mu_roll_c: 0.025,
  mu_scrub: 0.30,
  v_eps_lat: 0.020,
  omega_eps: 0.010,

  // 7. FOC, MTPA, Field-Weakening & CCC Controllers
  f_bw: 500.0,
  K_pd: 1.5,
  K_pq: 1.5,
  K_id: 180.0,
  K_iq: 180.0,
  V_fw_on: 26.33,
  V_fw_off: 24.94,
  omega_e_base: 526.6,
  tau_fw: 0.003,
  K_fw: 32.0,
  K_p_sync: 1.2,
  K_i_sync: 4.0,
  K_sync: 1.0,
};

/**
 * Profile 2: Quad-Platform Numerical Benchmark AGV
 * Matching Table 1 in Paper_TriLanguage_ActaMechanica/manuscript/latex/manuscript.tex
 * and SSoT v2.1.0:
 * - M = 200 kg, L = 0.50 m, rw = 0.10 m, Iz = 22.67 kg*m^2
 * - Dual PMSM: p = 4, Rs = 0.30 Ohm, Ld = 1.5 mH, Lq = 2.5 mH, lambda_m = 0.050 Wb
 * - Inverter: C_bulk = 1410 uF, I_max = 35.0 A
 * - Tire: B = 27.0, C = 1.65, D = 1.0, E = 0.97, vxlow = 0.10 m/s
 * - Control: K_pd = 4.712 V/A, K_pq = 7.854 V/A, K_id = K_iq = 942.5 V/(A*s), K_sync = 8.0
 */
export const BENCHMARK_AGV_PARAMETERS: AGVParameters = {
  // 1. Platform & Chassis
  M: 200.0,
  Iz: 22.67,
  rw: 0.10,
  L: 0.50,
  b: 0.25,
  g: 9.81,
  hcg: 0.15,
  C_rr: 0.010,
  B_yaw: 0.80,

  // 4-Point Normal Load (Static equilibrium: 654.0 N drive wheel, 327.0 N caster)
  K_z_drive: 200.0e3,
  K_z_caster: 100.0e3,
  Fz_drive_static: 654.0,
  Fz_caster_static: 327.0,

  // 2. Wheel & Powertrain (G=25.0, eta=1.0, Iw_wheel=0.005, Jm=0.5e-4, Iw_eff=0.03625)
  G: 25.0,
  eta_g: 1.0,
  Iw_wheel: 0.005,
  Jm: 0.5e-4,
  Bm: 0.0001,
  Iw_eff: 0.005 + 25.0 * 25.0 * 0.5e-4, // 0.03625 kg*m^2
  Bw_eff: 0.001,
  T_max: 10.5,

  // 3. Dual IPMSM (p=4, Rs=0.30 Ohm, Ld=1.5 mH, Lq=2.5 mH, lambda_m=0.050 Wb)
  p: 4,
  Rs: 0.30,
  Ld: 1.5e-3,
  Lq: 2.5e-3,
  lambda_m: 0.050,

  // 4. Inverter & DC-Link (Vbatt=48V, Vmax=27.71V, f_sw=20kHz, t_dead=350ns, C_bulk=1410uF)
  f_sw: 20000.0,
  t_dead: 350e-9,
  delta_dt: 2.0 * 20000.0 * 350e-9, // 0.014
  Rds_on: 3.6e-3,
  Vsd: 0.70,
  V_batt: 48.0,
  V_max: 27.71, // 48 / sqrt(3)
  I_max: 35.0,
  R_batt: 0.05,
  C_bulk: 1410e-6,

  // 5. Dynamic Tire Relaxation Length & Pacejka (B=27.0, C=1.65, D=1.0, E=0.97)
  sigma_x: 0.030,
  C_s: 15.0e3,
  eps_v: 0.050,
  B_pac: 27.0,
  C_pac: 1.65,
  D_pac: 1.0,
  E_pac: 0.97,
  vxlow: 0.10,

  // 6. Dual Casters (2nd-order dynamic, b_trail=30mm, Lc=0.42m, Rc=50mm, Ifork=0.005, C_alpha=800)
  b_trail: 0.030,
  Lc_F: 0.42,
  Lc_R: 0.42,
  R_c: 0.050,
  r_cont: 0.015,
  I_fork: 0.005,
  C_alpha: 800.0,
  C_swivel: 0.050,
  mu_roll_c: 0.025,
  mu_scrub: 0.30,
  v_eps_lat: 0.020,
  omega_eps: 0.010,

  // 7. FOC, MTPA, Field-Weakening & CCC Controllers (SSoT Section 2)
  f_bw: 500.0,
  K_pd: 4.712, // Ld * omega_ci = 1.5e-3 * 3141.6
  K_pq: 7.854, // Lq * omega_ci = 2.5e-3 * 3141.6
  K_id: 942.5, // Rs * omega_ci = 0.30 * 3141.6
  K_iq: 942.5, // Rs * omega_ci = 0.30 * 3141.6
  V_fw_on: 26.33,
  V_fw_off: 24.94,
  omega_e_base: 526.6,
  tau_fw: 0.003,
  K_fw: 32.0,
  K_p_sync: 8.0,
  K_i_sync: 80.0,
  K_sync: 1.80,
};

// Default AGV Parameters assigned to KDS AMR Profile (guarantees 100% backward compatibility)
export const DEFAULT_AGV_PARAMETERS: AGVParameters = KDS_AMR_PARAMETERS;
