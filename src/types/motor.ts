/**
 * Electromechanical Actuator & Motor Drive Modeling Types
 * Supports Ideal Servos, Brushed DC, Brushless DC (BLDC),
 * Permanent Magnet Synchronous Motors (PMSM / FOC), and Induction Motors (IM / RFOC).
 */

export type MotorType = 'ideal' | 'dc' | 'bldc' | 'pmsm' | 'im';

export interface MotorDriveParameters {
  type: MotorType;
  name: string;
  ratedVoltage: number; // Bus / supply voltage V_dc (V)
  ratedCurrent: number; // Continuous rated current (A_rms)
  peakCurrent: number; // Peak instantaneous current limit (A)
  ratedTorque: number; // Continuous rated torque at motor shaft (N.m)
  peakTorque: number; // Peak rated torque at motor shaft (N.m)
  maxRpm: number; // Maximum mechanical rotor speed (RPM)
  torqueConstant: number; // Kt (N.m / A)
  backEmfConstant: number; // Ke (V / (rad/s))
  armatureResistance: number; // Ra / Rs stator phase resistance (Ohms)
  armatureInductance: number; // La / Lq phase inductance (H)
  rotorInertia: number; // Jm rotor inertia (kg.m^2)
  rotorDamping: number; // Bm rotor viscous damping (N.m.s/rad)
  gearRatio: number; // N gearbox transmission ratio (e.g. 100 for Harmonic Drive)
  gearEfficiency: number; // eta transmission efficiency (0.70 - 0.95)
  polePairs: number; // p number of magnetic pole pairs (e.g. 4 for 8-pole PMSM)

  // BLDC specific:
  torqueRipplePct?: number; // Commutation torque ripple percentage (e.g. 8%)

  // IM (Induction Motor) specific:
  rotorResistance?: number; // Rr rotor resistance (Ohms)
  rotorInductance?: number; // Lr rotor self-inductance (H)
  mutualInductance?: number; // Lm magnetizing / mutual inductance (H)
}

export interface MotorDynamicState {
  currentA: number; // Actual motor current i_a or i_q (A)
  idCurrentA?: number; // Direct-axis current i_d for FOC (A)
  iqIntegratorA?: number; // Integrator state for q-axis PI controller (A*s)
  idIntegratorA?: number; // Integrator state for d-axis PI controller (A*s)
  iqRefDelayedA?: number; // Delayed current command (DSP sampling latency) (A)
  thetaElecRad?: number; // Rotor electrical position (rad)
  voltageV: number; // Stator / armature terminal voltage (V)
  rotorSpeedRpm: number; // Mechanical rotor speed (RPM)
  motorTorqueNm: number; // Electromagnetic torque tau_m at motor shaft (N.m)
  jointTorqueNm: number; // Output torque at robot link after gearbox and efficiency (N.m)
  powerElectricalW: number; // Electrical input power P_elec (W)
  powerMechanicalW: number; // Mechanical output power P_mech (W)
  copperLossW: number; // Joule heating loss I^2 * R (W)
  rotorFluxWb?: number; // Rotor magnetic flux psi_r (Wb)
  slipRpm?: number; // Asynchronous slip speed (RPM for IM)
  isCurrentSaturated: boolean; // True if motor current reached peak current limit
  isVoltageSaturated: boolean; // True if back-EMF or voltage request reached V_bus
}

export interface MotorPreset {
  id: string;
  name: string;
  type: MotorType;
  manufacturer: string;
  description: string;
  params: MotorDriveParameters;
}
