import {
  DCBusParameters,
  DCBusDynamicState,
  PowerConverterParameters,
  AxisInverterState,
  PWMZoomWaveform,
} from '../../types/powerConverter';

/**
 * Power Electronic Converter & DC Bus Simulation Engine
 * Models:
 * - Shared DC link bus with capacitor differential dynamics
 * - Regenerative braking chopper and braking resistor energy dissipation
 * - Space Vector PWM (SVPWM) / SPWM modulation limits
 * - Inverter dead-time voltage drop (creating 6th harmonic distortion)
 * - MOSFET / IGBT conduction & switching losses
 * - Heatsink & junction thermal dissipation dynamics
 * - Micro-Scope PWM waveform synthesis
 */
export class PowerConverterEngine {
  /**
   * Default factory parameters for standard robot DC Bus
   */
  public static readonly DEFAULT_DC_BUS: DCBusParameters = {
    nominalVoltage: 48.0, // 48V DC bus standard for cobots and modern industrial arms
    busCapacitanceMicroFarad: 4700, // 4.7 mF low-ESR capacitor bank
    brakingResistorOhms: 4.7, // 4.7 Ohms dynamic braking resistor
    brakingActivationVoltage: 56.0, // Fires chopper when bus climbs to 56V
    brakingHysteresisVoltage: 2.5, // Deactivates when bus drops below 53.5V
    overvoltageTripThreshold: 62.0, // Hardware safety cutoff
    undervoltageTripThreshold: 36.0, // Low voltage warning
    powerSupplyCurrentLimit: 80.0, // 80A main DC power supply max peak current (3.8 kW capacity)
    enableBrakingChopper: true,
  };

  /**
   * Default factory parameters for a high-performance 3-Phase Inverter per axis
   */
  public static readonly DEFAULT_INVERTER: PowerConverterParameters = {
    type: 'three-phase-vsi',
    modulationScheme: 'svpwm',
    switchingFrequencyHz: 16000, // 16 kHz ultrasonic switching frequency
    deadTimeMicrosec: 1.2, // 1.2 us dead-time for Si/SiC MOSFETs
    switchType: 'sic-mosfet',
    onResistance: 0.025, // 25 mOhms R_ds(on)
    switchingLossCoeff: 1.8, // uJ / (A*V)
    thermalResistanceJunctionCase: 0.85, // °C/W
    thermalResistanceCaseAmbient: 2.2, // °C/W heatsink-to-ambient
    heatsinkThermalCapacitance: 15.0, // J/°C thermal mass
    ambientTemperatureC: 25.0,
  };

  /**
   * Initializes clean state for DC Bus and Inverters
   */
  public static createInitialState(dof: number, busParams = this.DEFAULT_DC_BUS): DCBusDynamicState {
    const axisStates: AxisInverterState[] = Array.from({ length: dof }, (_, idx) => ({
      axisIndex: idx,
      modulationIndex: 0,
      deadTimeVoltageDropV: 0,
      conductionLossW: 0,
      switchingLossW: 0,
      totalLossW: 0,
      heatsinkTemperatureC: 25.0,
      junctionTemperatureC: 25.0,
      efficiencyPct: 98.0,
    }));

    return {
      voltageV: busParams.nominalVoltage,
      isBrakingChopperActive: false,
      brakingCurrentA: 0,
      brakingPowerW: 0,
      netMotorPowerW: 0,
      regenerativePowerW: 0,
      supplyCurrentA: 0,
      isOvervoltageTripped: false,
      isUndervoltageTripped: false,
      axisStates,
    };
  }

  /**
   * Main multi-axis converter simulation step
   * Computes inverter voltage synthesis, dead-time drop, losses, and integrates shared DC bus capacitor.
   *
   * @param busParams DC bus capacitor and braking resistor specs
   * @param prevState Previous DC bus and inverter state
   * @param axisMotorPowers Array of electrical powers P_elec (W) for each joint motor
   * @param axisMotorCurrents Array of motor phase currents I_rms (A) for each joint
   * @param axisVoltageRequests Array of requested voltage amplitudes V_cmd (V) for each joint
   * @param dt Integration time step (s)
   */
  public static stepConverter(
    busParams: DCBusParameters,
    inverterParams: PowerConverterParameters,
    prevState: DCBusDynamicState,
    axisMotorPowers: number[],
    axisMotorCurrents: number[],
    axisVoltageRequests: number[],
    dt: number
  ): {
    nextState: DCBusDynamicState;
    synthesizedVoltages: number[];
  } {
    const dof = axisMotorPowers.length;
    let netMotorPowerW = 0;
    let regenerativePowerW = 0;
    let totalInverterLossW = 0;

    const synthesizedVoltages = new Array(dof).fill(0);
    const updatedAxisStates: AxisInverterState[] = [];

    const C_bus = Math.max(1e-4, busParams.busCapacitanceMicroFarad * 1e-6); // Farads
    const currentVdc = Math.max(10.0, prevState.voltageV);

    // Maximum synthesizable fundamental line-to-neutral voltage
    // For Space Vector PWM (SVPWM): V_max = V_dc / sqrt(3) ~= 0.577 * V_dc
    // For Sinusoidal PWM (SPWM): V_max = V_dc / 2.0 = 0.5 * V_dc
    const vMaxSVPWM = currentVdc / Math.sqrt(3);
    const vMaxSPWM = currentVdc * 0.5;
    const vMax = inverterParams.modulationScheme === 'svpwm' ? vMaxSVPWM : vMaxSPWM;

    const Tsw = 1.0 / Math.max(1000, inverterParams.switchingFrequencyHz);
    const tDead = Math.max(0, inverterParams.deadTimeMicrosec * 1e-6);

    // 1. Process each axis inverter
    for (let i = 0; i < dof; i++) {
      const pElec = axisMotorPowers[i] || 0;
      const iRms = Math.abs(axisMotorCurrents[i] || 0);
      const vReq = Math.abs(axisVoltageRequests[i] || 0);

      netMotorPowerW += pElec;
      if (pElec < 0) {
        regenerativePowerW += Math.abs(pElec);
      }

      // Modulation Index m
      const m = Math.min(1.15, vReq / Math.max(1.0, vMax));

      // Dead-time voltage distortion: Delta_V = (t_dead / T_sw) * V_dc * sgn(i)
      const deadTimeDrop = (tDead / Tsw) * currentVdc;

      // Actual synthesized voltage after inverter saturation and dead-time drop
      const vSynthesized = Math.max(0, Math.min(vMax, vReq - deadTimeDrop));
      synthesizedVoltages[i] = vSynthesized;

      // Inverter Losses:
      // Conduction Loss: 3 phases * (R_on * I_rms^2 + V_on * I_rms / sqrt(2))
      const pCond = 3 * (inverterParams.onResistance * iRms * iRms + 0.4 * iRms);

      // Switching Loss: 6 switches * f_sw * k_sw * V_dc * I_rms
      const pSw = 6 * inverterParams.switchingFrequencyHz * (inverterParams.switchingLossCoeff * 1e-6) * currentVdc * iRms;

      const pTotalLoss = pCond + pSw;
      totalInverterLossW += pTotalLoss;

      // Thermal Junction Integration
      const prevAxis = prevState.axisStates[i] || {
        heatsinkTemperatureC: inverterParams.ambientTemperatureC,
        junctionTemperatureC: inverterParams.ambientTemperatureC,
      };

      // Heatsink temperature derivative: dTh/dt = (Ploss - (Th - Tamb)/Rth_ca) / Cth
      const dThDt =
        (pTotalLoss - (prevAxis.heatsinkTemperatureC - inverterParams.ambientTemperatureC) / inverterParams.thermalResistanceCaseAmbient) /
        Math.max(1.0, inverterParams.heatsinkThermalCapacitance);

      const nextTh = Math.max(inverterParams.ambientTemperatureC, prevAxis.heatsinkTemperatureC + dt * dThDt);
      // Junction temp: Tj = Th + Ploss * Rth_jc
      const nextTj = nextTh + pTotalLoss * inverterParams.thermalResistanceJunctionCase;

      const efficiency = pElec > 0 ? Math.max(80, Math.min(99.5, (pElec / (pElec + pTotalLoss)) * 100)) : 98.0;

      updatedAxisStates.push({
        axisIndex: i,
        modulationIndex: m,
        deadTimeVoltageDropV: deadTimeDrop,
        conductionLossW: pCond,
        switchingLossW: pSw,
        totalLossW: pTotalLoss,
        heatsinkTemperatureC: nextTh,
        junctionTemperatureC: nextTj,
        efficiencyPct: efficiency,
      });
    }

    // 2. Shared DC Bus Capacitor Dynamics:
    // Net inverter power drawn from or pumped into DC bus:
    const netDCBusPowerW = netMotorPowerW + totalInverterLossW;

    // Equivalent inverter current on DC bus: I_inv = P_net / V_dc
    const inverterBusCurrentA = netDCBusPowerW / currentVdc;

    // Front-end Switched-Mode Power Supply (SMPS) or Unidirectional Diode Rectifier:
    // Has a finite closed-loop regulation response time (tau_ps ~ 8 ms) and internal droop impedance (R_ps ~ 0.08 Ohms).
    // It can ONLY deliver positive current (unidirectional power supply).
    const tauPS = 0.008; // 8 ms power supply loop response
    const rPS = 0.06; // 60 mOhms internal regulation droop impedance

    // Desired power supply current: load current + voltage restoration current
    const vError = busParams.nominalVoltage - currentVdc;
    const targetSupplyCurrentA = Math.max(
      0,
      Math.min(busParams.powerSupplyCurrentLimit, Math.max(0, inverterBusCurrentA) + vError / rPS)
    );

    const prevSupplyCurrentA = prevState.supplyCurrentA || 0;
    const alphaSupply = 1.0 - Math.exp(-dt / tauPS);
    const supplyCurrentA = prevSupplyCurrentA + alphaSupply * (targetSupplyCurrentA - prevSupplyCurrentA);

    // Dynamic Braking Chopper Logic:
    let isBrakingChopperActive = prevState.isBrakingChopperActive;
    if (busParams.enableBrakingChopper) {
      if (currentVdc >= busParams.brakingActivationVoltage) {
        isBrakingChopperActive = true;
      } else if (currentVdc <= busParams.brakingActivationVoltage - busParams.brakingHysteresisVoltage) {
        isBrakingChopperActive = false;
      }
    } else {
      isBrakingChopperActive = false;
    }

    const rBrake = Math.max(0.5, busParams.brakingResistorOhms);
    const brakingCurrentA = isBrakingChopperActive ? currentVdc / rBrake : 0;
    const brakingPowerW = brakingCurrentA * currentVdc;

    // Capacitor differential current:
    // I_c = I_supply - I_inverter - I_brake
    const iCap = supplyCurrentA - inverterBusCurrentA - brakingCurrentA;

    // Differential equation for DC bus voltage: dV_dc / dt = I_c / C_bus
    const dVdcDt = iCap / C_bus;
    let nextVdc = currentVdc + dt * dVdcDt;

    // Capacitor Bank ESR (Equivalent Series Resistance) transient ripple:
    const rESR = 0.015; // 15 mOhms
    const vESRDrop = iCap * rESR;
    nextVdc += vESRDrop * 0.15; // Transient ESR ripple

    // Physical bounds: DC link cannot reverse polarity (unidirectional rectifier/SMPS)
    // Minimum clamped at 24V (brownout/undervoltage shutdown floor), max at overvoltage safety cutoff
    nextVdc = Math.max(24.0, Math.min(busParams.overvoltageTripThreshold + 4.0, nextVdc));

    const isOvervoltageTripped = nextVdc >= busParams.overvoltageTripThreshold;
    const isUndervoltageTripped = nextVdc <= busParams.undervoltageTripThreshold;

    return {
      nextState: {
        voltageV: nextVdc,
        isBrakingChopperActive,
        brakingCurrentA,
        brakingPowerW,
        netMotorPowerW,
        regenerativePowerW,
        supplyCurrentA,
        isOvervoltageTripped,
        isUndervoltageTripped,
        axisStates: updatedAxisStates,
      },
      synthesizedVoltages,
    };
  }

  /**
   * Generates high-resolution PWM carrier and switching gate waveforms (Micro-Scope Zoom)
   * Simulates 2 switching carrier cycles (e.g. 125 us at 16 kHz) for pedagogical inspection.
   */
  public static generatePWMZoomWaveforms(
    modulationIndex: number = 0.8,
    switchingFreqHz: number = 16000,
    _deadTimeUs: number = 1.2,
    busVoltageV: number = 48.0
  ): PWMZoomWaveform {
    const periodUs = 1e6 / switchingFreqHz; // Carrier period in us (e.g. 62.5 us at 16kHz)
    const numPeriods = 2;
    const totalTimeUs = periodUs * numPeriods;
    const numSamples = 250;

    const timeMicrosec: number[] = [];
    const carrierTriangle: number[] = [];
    const refWaveA: number[] = [];
    const refWaveB: number[] = [];
    const refWaveC: number[] = [];
    const pwmGateA: number[] = [];
    const pwmGateB: number[] = [];
    const pwmGateC: number[] = [];
    const phaseVoltageA: number[] = [];

    // 3-phase modulation references with Space Vector 3rd-harmonic injection
    const m = Math.max(0.1, Math.min(1.15, modulationIndex));
    const ma = m * Math.cos(0.2); // Phase A instantaneous ref
    const mb = m * Math.cos(0.2 - (2 * Math.PI) / 3); // Phase B
    const mc = m * Math.cos(0.2 + (2 * Math.PI) / 3); // Phase C

    // SVPWM Min-Max center injection: v_offset = -0.5 * (max + min)
    const vOffset = -0.5 * (Math.max(ma, mb, mc) + Math.min(ma, mb, mc));
    const vRefA = ma + vOffset;
    const vRefB = mb + vOffset;
    const vRefC = mc + vOffset;

    for (let i = 0; i <= numSamples; i++) {
      const t = (i / numSamples) * totalTimeUs;
      timeMicrosec.push(t);

      // Triangular carrier wave in [-1, +1]
      const tInPeriod = t % periodUs;
      const normalizedT = tInPeriod / periodUs;
      let tri = 0;
      if (normalizedT < 0.5) {
        tri = -1.0 + 4.0 * normalizedT; // Up slope: -1 to +1
      } else {
        tri = 1.0 - 4.0 * (normalizedT - 0.5); // Down slope: +1 to -1
      }
      carrierTriangle.push(tri);

      refWaveA.push(vRefA);
      refWaveB.push(vRefB);
      refWaveC.push(vRefC);

      // PWM Gate Logic: Gate HIGH when reference > carrier
      const gateA = vRefA > tri ? 1 : 0;
      const gateB = vRefB > tri ? 1 : 0;
      const gateC = vRefC > tri ? 1 : 0;

      pwmGateA.push(gateA);
      pwmGateB.push(gateB);
      pwmGateC.push(gateC);

      // Inverter Pole Voltage: V_A0 = (gateA - 0.5) * V_dc
      phaseVoltageA.push((gateA - 0.5) * busVoltageV);
    }

    return {
      timeMicrosec,
      carrierTriangle,
      refWaveA,
      refWaveB,
      refWaveC,
      pwmGateA,
      pwmGateB,
      pwmGateC,
      phaseVoltageA,
    };
  }
}
