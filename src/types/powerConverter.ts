/**
 * Power Electronic Converter & Inverter Types
 * Models:
 * - 3-Phase 2-Level Voltage Source Inverter (2L-VSI) with Space Vector PWM (SVPWM) / SPWM
 * - 4-Quadrant H-Bridge DC Chopper
 * - Common Shared DC Bus with Capacitance Dynamics & Regenerative Braking Chopper
 * - Semiconductor Conduction & Switching Losses and Thermal Junction Models
 */

export type ConverterType = 'three-phase-vsi' | 'h-bridge-chopper' | 'ideal-voltage-source';
export type ModulationScheme = 'svpwm' | 'spwm' | 'third-harmonic-pwm';

export interface PowerConverterParameters {
  type: ConverterType;
  modulationScheme: ModulationScheme;
  switchingFrequencyHz: number; // e.g. 16,000 Hz (16 kHz)
  deadTimeMicrosec: number; // e.g. 1.2 us
  switchType: 'mosfet' | 'igbt' | 'sic-mosfet';
  onResistance: number; // R_ds(on) in Ohms or V_ce(sat) in Volts
  switchingLossCoeff: number; // Microjoules per Ampere-Volt (uJ / (A*V))
  thermalResistanceJunctionCase: number; // R_th,jc (°C/W)
  thermalResistanceCaseAmbient: number; // R_th,ca (°C/W)
  heatsinkThermalCapacitance: number; // C_th (J/°C)
  ambientTemperatureC: number; // e.g. 25°C
}

export interface DCBusParameters {
  nominalVoltage: number; // e.g. 48V (or 300V / 560V)
  busCapacitanceMicroFarad: number; // e.g. 4700 uF
  brakingResistorOhms: number; // R_brake (e.g. 4.7 Ohms)
  brakingActivationVoltage: number; // e.g. 56V on a 48V bus
  brakingHysteresisVoltage: number; // e.g. 2V (stops at 54V)
  overvoltageTripThreshold: number; // e.g. 62V
  undervoltageTripThreshold: number; // e.g. 36V
  powerSupplyCurrentLimit: number; // e.g. 40A continuous
  enableBrakingChopper: boolean;
}

export interface AxisInverterState {
  axisIndex: number;
  modulationIndex: number; // m in [0, 1.15]
  deadTimeVoltageDropV: number;
  conductionLossW: number;
  switchingLossW: number;
  totalLossW: number;
  heatsinkTemperatureC: number;
  junctionTemperatureC: number;
  efficiencyPct: number;
}

export interface DCBusDynamicState {
  voltageV: number; // Live V_dc(t)
  isBrakingChopperActive: boolean;
  brakingCurrentA: number;
  brakingPowerW: number;
  netMotorPowerW: number; // Sum of electrical power across all joints
  regenerativePowerW: number;
  supplyCurrentA: number;
  isOvervoltageTripped: boolean;
  isUndervoltageTripped: boolean;
  axisStates: AxisInverterState[];
}

export interface PWMZoomWaveform {
  timeMicrosec: number[];
  carrierTriangle: number[];
  refWaveA: number[];
  refWaveB: number[];
  refWaveC: number[];
  pwmGateA: number[];
  pwmGateB: number[];
  pwmGateC: number[];
  phaseVoltageA: number[];
}
