import {
  MotorDriveParameters,
  MotorDynamicState,
  MotorPreset,
} from '../../types/motor';

/**
 * Electromechanical Actuator & Motor Drive Engine
 * Simulates real actuator dynamics including:
 * 1. Ideal Servos (Direct torque with torque limit)
 * 2. Brushed DC (Armature inductance, back-EMF, voltage/current saturation)
 * 3. Brushless DC (BLDC with 6-step trapezoidal commutation & torque ripple)
 * 4. Permanent Magnet Synchronous Motor (PMSM with Field-Oriented Control i_d=0)
 * 5. Squirrel-Cage Induction Motor (IM with Rotor-Flux-Oriented Control RFOC)
 *
 * Also accounts for:
 * - Gearbox reduction ratio N & transmission efficiency eta
 * - Rotor inertia Jm reflected to joint (N^2 * Jm)
 * - Rotor viscous damping Bm
 * - Stator copper heating losses (I^2 * R) & power consumption
 */
export class MotorDriveEngine {
  /**
   * Pre-defined industry standard motor presets
   */
  public static readonly MOTOR_PRESETS: Record<string, MotorPreset> = {
    // 1. Ideal Actuator (Baseline)
    ideal: {
      id: 'ideal',
      name: 'Lý tưởng (Direct Torque Drive)',
      type: 'ideal',
      manufacturer: 'Generic Ideal',
      description: 'Mô hình servo lý tưởng hóa: phản ứng tức thời, không trễ dòng điện, không bão hòa điện áp.',
      params: {
        type: 'ideal',
        name: 'Ideal Servo',
        ratedVoltage: 48,
        ratedCurrent: 20,
        peakCurrent: 50,
        ratedTorque: 5.0,
        peakTorque: 15.0,
        maxRpm: 6000,
        torqueConstant: 0.1,
        backEmfConstant: 0.1,
        armatureResistance: 0.05,
        armatureInductance: 0.0001,
        rotorInertia: 0.00005,
        rotorDamping: 0.00001,
        gearRatio: 100,
        gearEfficiency: 0.95,
        polePairs: 4,
      },
    },

    // 2. Maxon RE 50 DC Servo (Brushed DC)
    maxon_dc_re50: {
      id: 'maxon_dc_re50',
      name: 'Maxon RE 50 (DC Chổi than + Harmonic Drive)',
      type: 'dc',
      manufacturer: 'Maxon Motor',
      description: 'Động cơ DC chổi than chính xác cao, rô-to không rãnh (coreless) triệt tiêu lực cogging, ghép hộp số Harmonic 100:1.',
      params: {
        type: 'dc',
        name: 'Maxon RE 50 200W',
        ratedVoltage: 48,
        ratedCurrent: 4.8,
        peakCurrent: 14.5,
        ratedTorque: 0.42,
        peakTorque: 1.25,
        maxRpm: 5500,
        torqueConstant: 0.088, // N.m / A
        backEmfConstant: 0.088, // V / (rad/s)
        armatureResistance: 0.58, // Ohms
        armatureInductance: 0.00035, // 0.35 mH
        rotorInertia: 0.00016, // kg.m^2
        rotorDamping: 0.00004,
        gearRatio: 100,
        gearEfficiency: 0.82,
        polePairs: 1,
      },
    },

    // 3. Maxon EC-i 52 BLDC
    maxon_bldc_eci52: {
      id: 'maxon_bldc_eci52',
      name: 'Maxon EC-i 52 (BLDC Chuyển mạch 6-bước)',
      type: 'bldc',
      manufacturer: 'Maxon Motor',
      description: 'Động cơ không chổi than BLDC đa cực, chuyển mạch biến tần 6 bước với gợn sóng mô-men (torque ripple) 8%.',
      params: {
        type: 'bldc',
        name: 'Maxon EC-i 52 180W',
        ratedVoltage: 48,
        ratedCurrent: 5.2,
        peakCurrent: 18.0,
        ratedTorque: 0.45,
        peakTorque: 1.40,
        maxRpm: 6000,
        torqueConstant: 0.078,
        backEmfConstant: 0.078,
        armatureResistance: 0.32,
        armatureInductance: 0.00028,
        rotorInertia: 0.00014,
        rotorDamping: 0.00003,
        gearRatio: 100,
        gearEfficiency: 0.86,
        polePairs: 4,
        torqueRipplePct: 8.0,
      },
    },

    // 4. RoboDrive ILM 70x18 PMSM (Modern Cobot Gold Standard)
    robodrive_pmsm_ilm70: {
      id: 'robodrive_pmsm_ilm70',
      name: 'RoboDrive ILM 70 (PMSM FOC Điều khiển Vector)',
      type: 'pmsm',
      manufacturer: 'RoboDrive (TQ Systems)',
      description: 'Động cơ đồng bộ nam châm vĩnh cửu không vỏ (frameless), điều khiển vector tựa từ thông FOC (id=0), chuẩn mực cho Cobot & Robot công nghiệp.',
      params: {
        type: 'pmsm',
        name: 'RoboDrive ILM 70x18 Kit',
        ratedVoltage: 48,
        ratedCurrent: 8.5,
        peakCurrent: 25.0,
        ratedTorque: 1.15,
        peakTorque: 3.20,
        maxRpm: 4500,
        torqueConstant: 0.135,
        backEmfConstant: 0.135,
        armatureResistance: 0.19,
        armatureInductance: 0.00022,
        rotorInertia: 0.00028,
        rotorDamping: 0.00005,
        gearRatio: 100,
        gearEfficiency: 0.89,
        polePairs: 7,
      },
    },

    // 5. Siemens SIMOTICS 1LE1 Induction Motor (IM / RFOC)
    siemens_im_1le1: {
      id: 'siemens_im_1le1',
      name: 'Siemens SIMOTICS 1LE1 (IM Động cơ Dị bộ RFOC)',
      type: 'im',
      manufacturer: 'Siemens',
      description: 'Động cơ dị bộ lồng sóc 3 pha điều khiển tựa từ thông rotor (RFOC), đặc trưng bởi dòng tạo từ thông isd và độ trượt rotor (slip).',
      params: {
        type: 'im',
        name: 'Siemens 1LE1 0.75kW',
        ratedVoltage: 230,
        ratedCurrent: 3.2,
        peakCurrent: 9.5,
        ratedTorque: 2.5,
        peakTorque: 6.8,
        maxRpm: 3000,
        torqueConstant: 0.42,
        backEmfConstant: 0.42,
        armatureResistance: 1.6,
        armatureInductance: 0.038,
        rotorInertia: 0.0018,
        rotorDamping: 0.00012,
        gearRatio: 50,
        gearEfficiency: 0.82,
        polePairs: 2,
        rotorResistance: 1.4,
        rotorInductance: 0.042,
        mutualInductance: 0.036,
      },
    },
  };

  /**
   * Initializes a default clean state for a motor
   */
  public static createInitialState(): MotorDynamicState {
    return {
      currentA: 0,
      idCurrentA: 0,
      iqIntegratorA: 0,
      idIntegratorA: 0,
      iqRefDelayedA: 0,
      thetaElecRad: 0,
      voltageV: 0,
      rotorSpeedRpm: 0,
      motorTorqueNm: 0,
      jointTorqueNm: 0,
      powerElectricalW: 0,
      powerMechanicalW: 0,
      copperLossW: 0,
      rotorFluxWb: 0.1,
      slipRpm: 0,
      isCurrentSaturated: false,
      isVoltageSaturated: false,
    };
  }

  /**
   * Calculates the reflected inertia matrix diagonal contribution for a given joint:
   * J_reflected = N^2 * J_m
   */
  public static computeReflectedInertia(params: MotorDriveParameters): number {
    const N = Math.max(1, params.gearRatio);
    return N * N * params.rotorInertia;
  }

  /**
   * Main step function: Integrates electrical dynamics, models electromagnetic torque,
   * enforces voltage & current limits, and computes output torque delivered to the link.
   *
   * @param params Motor specifications and gear ratio
   * @param prevState Previous internal state (current, flux, etc.)
   * @param tauJointCmd Commanded joint torque from motion controller (N.m)
   * @param qJointRad Current joint angle (rad)
   * @param qdJointRad Current joint angular velocity (rad/s)
   * @param dt Integration step size (s)
   */
  public static stepMotor(
    params: MotorDriveParameters,
    prevState: MotorDynamicState,
    tauJointCmd: number,
    qJointRad: number,
    qdJointRad: number,
    dt: number
  ): { nextState: MotorDynamicState; tauJointActual: number } {
    const N = Math.max(1, params.gearRatio);
    const eta = Math.max(0.1, Math.min(1.0, params.gearEfficiency));

    // Rotor mechanical velocity & RPM
    const omegaRotor = N * qdJointRad; // rad/s
    const rpmRotor = (omegaRotor * 60) / (2 * Math.PI);

    // Damping loss at motor shaft
    const tauDampingMotor = params.rotorDamping * omegaRotor;

    // Desired electromagnetic torque at motor shaft to satisfy commanded link torque
    const tauMotorDesired = tauJointCmd / (N * eta) + tauDampingMotor;

    switch (params.type) {
      case 'ideal':
        return this.stepIdealMotor(params, prevState, tauMotorDesired, omegaRotor, rpmRotor, N, eta);

      case 'dc':
        return this.stepDCMotor(params, prevState, tauMotorDesired, omegaRotor, rpmRotor, N, eta, dt);

      case 'bldc':
        return this.stepBLDCMotor(params, prevState, tauMotorDesired, qJointRad, omegaRotor, rpmRotor, N, eta, dt);

      case 'pmsm':
        return this.stepPMSMMotor(params, prevState, tauMotorDesired, qJointRad, omegaRotor, rpmRotor, N, eta, dt);

      case 'im':
        return this.stepInductionMotor(params, prevState, tauMotorDesired, omegaRotor, rpmRotor, N, eta, dt);

      default:
        return this.stepIdealMotor(params, prevState, tauMotorDesired, omegaRotor, rpmRotor, N, eta);
    }
  }

  /**
   * 1. Ideal Motor: Direct torque transfer with instantaneous current and peak clipping
   */
  private static stepIdealMotor(
    params: MotorDriveParameters,
    _prev: MotorDynamicState,
    tauMotorDesired: number,
    omegaRotor: number,
    rpmRotor: number,
    N: number,
    eta: number
  ): { nextState: MotorDynamicState; tauJointActual: number } {
    const peakMotorTorque = Math.max(params.peakTorque, params.peakCurrent * params.torqueConstant);
    const isCurrentSaturated = Math.abs(tauMotorDesired) > peakMotorTorque;
    const tauMotor = Math.max(-peakMotorTorque, Math.min(peakMotorTorque, tauMotorDesired));

    const currentA = tauMotor / params.torqueConstant;
    const backEmf = params.backEmfConstant * omegaRotor;
    const voltageV = backEmf + params.armatureResistance * currentA;
    const isVoltageSaturated = Math.abs(voltageV) > params.ratedVoltage;

    // Transmitted torque to joint link
    const tauShaft = tauMotor - params.rotorDamping * omegaRotor;
    const tauJointActual = tauShaft * N * eta;

    const powerElectricalW = voltageV * currentA;
    const powerMechanicalW = tauShaft * omegaRotor;
    const copperLossW = currentA * currentA * params.armatureResistance;

    return {
      nextState: {
        currentA,
        voltageV,
        rotorSpeedRpm: rpmRotor,
        motorTorqueNm: tauMotor,
        jointTorqueNm: tauJointActual,
        powerElectricalW,
        powerMechanicalW,
        copperLossW,
        isCurrentSaturated,
        isVoltageSaturated,
      },
      tauJointActual,
    };
  }

  /**
   * 2. Brushed DC Motor
   * Closed-loop inner current control with back-EMF, voltage saturation, and electrical time-lag.
   */
  private static stepDCMotor(
    params: MotorDriveParameters,
    prev: MotorDynamicState,
    tauMotorDesired: number,
    omegaRotor: number,
    rpmRotor: number,
    N: number,
    eta: number,
    dt: number
  ): { nextState: MotorDynamicState; tauJointActual: number } {
    // 1. Back-EMF: e = Ke * omega_m
    const backEmf = params.backEmfConstant * omegaRotor;

    // 2. Commanded current from desired torque
    const iDesired = Math.max(
      -params.peakCurrent,
      Math.min(params.peakCurrent, tauMotorDesired / params.torqueConstant)
    );

    // 3. Voltage demand: v = backEmf + R * iDesired
    const vCmd = backEmf + params.armatureResistance * iDesired;
    const isVoltageSaturated = Math.abs(vCmd) > params.ratedVoltage;
    const vActual = Math.max(-params.ratedVoltage, Math.min(params.ratedVoltage, vCmd));

    // 4. Closed-loop electrical tracking dynamics (inner current loop bandwidth ~ 1500 rad/s)
    const tauElec = Math.max(0.0005, params.armatureInductance / (params.armatureResistance + 10.0));
    const alphaTrack = 1.0 - Math.exp(-dt / tauElec);

    // Limit steady-state current under voltage saturation
    let iTarget = iDesired;
    if (isVoltageSaturated) {
      const vAvailable = Math.max(0, params.ratedVoltage - Math.abs(backEmf));
      const iMaxVoltage = vAvailable / Math.max(0.05, params.armatureResistance);
      iTarget = Math.sign(iDesired) * Math.min(Math.abs(iDesired), iMaxVoltage);
    }

    let iNext = prev.currentA + alphaTrack * (iTarget - prev.currentA);
    const isCurrentSaturated = Math.abs(iNext) >= params.peakCurrent;
    iNext = Math.max(-params.peakCurrent, Math.min(params.peakCurrent, iNext));

    // 5. Developed electromagnetic torque: tau_m = Kt * i_a
    const tauMotor = params.torqueConstant * iNext;

    // 6. Output torque to link after rotor friction and gear transmission
    const tauShaft = tauMotor - params.rotorDamping * omegaRotor;
    const tauJointActual = tauShaft * N * eta;

    const powerElectricalW = vActual * iNext;
    const powerMechanicalW = tauShaft * omegaRotor;
    const copperLossW = iNext * iNext * params.armatureResistance;

    return {
      nextState: {
        currentA: iNext,
        voltageV: vActual,
        rotorSpeedRpm: rpmRotor,
        motorTorqueNm: tauMotor,
        jointTorqueNm: tauJointActual,
        powerElectricalW,
        powerMechanicalW,
        copperLossW,
        isCurrentSaturated,
        isVoltageSaturated,
      },
      tauJointActual,
    };
  }

  /**
   * 3. Brushless DC Motor (BLDC)
   * 6-step trapezoidal electronic commutation with high-frequency commutation torque ripple
   */
  private static stepBLDCMotor(
    params: MotorDriveParameters,
    prev: MotorDynamicState,
    tauMotorDesired: number,
    qJointRad: number,
    omegaRotor: number,
    rpmRotor: number,
    N: number,
    eta: number,
    dt: number
  ): { nextState: MotorDynamicState; tauJointActual: number } {
    const p = params.polePairs || 4;
    const thetaElec = (p * N * qJointRad) % (2 * Math.PI);

    // Trapezoidal back-EMF amplitude
    const backEmf = params.backEmfConstant * omegaRotor;

    const iDesired = Math.max(
      -params.peakCurrent,
      Math.min(params.peakCurrent, tauMotorDesired / params.torqueConstant)
    );

    const vCmd = backEmf + params.armatureResistance * iDesired;
    const isVoltageSaturated = Math.abs(vCmd) > params.ratedVoltage;
    const vActual = Math.max(-params.ratedVoltage, Math.min(params.ratedVoltage, vCmd));

    // Closed-loop electrical tracking dynamics (bandwidth ~ 1500 rad/s)
    const tauElec = Math.max(0.0005, params.armatureInductance / (params.armatureResistance + 10.0));
    const alphaTrack = 1.0 - Math.exp(-dt / tauElec);

    let iTarget = iDesired;
    if (isVoltageSaturated) {
      const vAvailable = Math.max(0, params.ratedVoltage - Math.abs(backEmf));
      const iMaxVoltage = vAvailable / Math.max(0.05, params.armatureResistance);
      iTarget = Math.sign(iDesired) * Math.min(Math.abs(iDesired), iMaxVoltage);
    }

    let iNext = prev.currentA + alphaTrack * (iTarget - prev.currentA);
    const isCurrentSaturated = Math.abs(iNext) >= params.peakCurrent;
    iNext = Math.max(-params.peakCurrent, Math.min(params.peakCurrent, iNext));

    // 6-step trapezoidal commutation torque ripple: ~6 pulses per electrical revolution
    const ripplePct = (params.torqueRipplePct ?? 8.0) / 100.0;
    const rippleFactor = 1.0 - ripplePct * Math.abs(Math.sin(6 * thetaElec));

    const tauMotor = params.torqueConstant * iNext * rippleFactor;
    const tauShaft = tauMotor - params.rotorDamping * omegaRotor;
    const tauJointActual = tauShaft * N * eta;

    const powerElectricalW = vActual * iNext;
    const powerMechanicalW = tauShaft * omegaRotor;
    const copperLossW = iNext * iNext * params.armatureResistance;

    return {
      nextState: {
        currentA: iNext,
        voltageV: vActual,
        rotorSpeedRpm: rpmRotor,
        motorTorqueNm: tauMotor,
        jointTorqueNm: tauJointActual,
        powerElectricalW,
        powerMechanicalW,
        copperLossW,
        isCurrentSaturated,
        isVoltageSaturated,
      },
      tauJointActual,
    };
  }

  /**
   * 4. Permanent Magnet Synchronous Motor (PMSM)
   * Multi-Rate Field-Oriented Control (FOC) in rotating d-q reference frame with:
   * - Multi-rate sub-stepping (10 kHz equivalent digital loop)
   * - Discrete PI current controllers for d and q axes with Anti-Windup
   * - Digital sampling & calculation delay (1-step ADC latency)
   * - Decoupling feedforward with parameter mismatch transients
   * - Inverter Dead-Time harmonic distortion (6*omega_e ripple on v_q, v_d)
   * - Space Vector PWM (SVPWM) voltage circle limiter (V_max = V_dc / sqrt(3))
   * - Physical stator RL circuit integration
   */
  private static stepPMSMMotor(
    params: MotorDriveParameters,
    prev: MotorDynamicState,
    tauMotorDesired: number,
    _qJointRad: number,
    omegaRotor: number,
    rpmRotor: number,
    N: number,
    eta: number,
    dt: number
  ): { nextState: MotorDynamicState; tauJointActual: number } {
    const p = params.polePairs || 6;
    const omegaElec = p * omegaRotor; // rad/s electrical speed
    const Vdc = Math.max(10.0, params.ratedVoltage);
    const vMax = Vdc / Math.sqrt(3); // SVPWM linear modulation limit

    // In FOC, i_q produces electromagnetic torque, i_d is kept at 0 (or negative for flux weakening)
    const iqDesired = Math.max(
      -params.peakCurrent,
      Math.min(params.peakCurrent, tauMotorDesired / params.torqueConstant)
    );

    // Flux weakening at speeds above base speed
    const baseOmegaElec = (Vdc * 0.9) / Math.max(1e-4, params.backEmfConstant);
    let idDesired = 0;
    if (Math.abs(omegaElec) > baseOmegaElec) {
      idDesired = -Math.min(
        params.peakCurrent * 0.4,
        ((Math.abs(omegaElec) - baseOmegaElec) / baseOmegaElec) * params.ratedCurrent
      );
    }

    const Ld = Math.max(1e-5, params.armatureInductance);
    const Lq = Math.max(1e-5, params.armatureInductance);
    const Rs = Math.max(0.01, params.armatureResistance);
    const lambdaPM = params.backEmfConstant / p; // Magnet flux linkage (Wb)

    // Current controller tuning (Bandwidth omega_bw = 2*pi*800 rad/s)
    const omegaBW = 2.0 * Math.PI * 800.0;
    const Kp_q = omegaBW * Lq;
    const Ki_q = omegaBW * Rs;
    const Kp_d = omegaBW * Ld;
    const Ki_d = omegaBW * Rs;

    // Sub-stepping for multi-rate digital FOC loop (10 sub-steps -> dt_sub = 0.0002 s = 5 kHz inner loop)
    const numSubSteps = 10;
    const dtSub = dt / numSubSteps;

    // Digital filter & preview: Smooths discrete latency without introducing destabilizing phase lag
    const iqRefSampled = prev.iqRefDelayedA !== undefined ? 0.6 * iqDesired + 0.4 * prev.iqRefDelayedA : iqDesired;
    const idRefSampled = idDesired;

    let curIq = prev.currentA;
    let curId = prev.idCurrentA || 0;
    let integQ = prev.iqIntegratorA || 0;
    let integD = prev.idIntegratorA || 0;
    let thetaElec = prev.thetaElecRad || 0;

    let lastVd = 0;
    let lastVq = 0;
    let isVoltageSaturated = false;
    let isCurrentSaturated = false;

    // Dead-time voltage distortion parameters (t_dead = 1.2 us, f_sw = 16 kHz)
    const tDead = 1.2e-6;
    const Tsw = 1.0 / 16000.0;
    const vDeadMag = (4.0 / Math.PI) * (tDead / Tsw) * Vdc;

    for (let sub = 0; sub < numSubSteps; sub++) {
      thetaElec += omegaElec * dtSub;

      // 1. Errors
      const errQ = iqRefSampled - curIq;
      const errD = idRefSampled - curId;

      // 2. PI Integrators with Anti-Windup
      if (!isVoltageSaturated) {
        integQ += errQ * dtSub;
        integD += errD * dtSub;
      }
      const integLimit = vMax;
      integQ = Math.max(-integLimit / Ki_q, Math.min(integLimit / Ki_q, integQ));
      integD = Math.max(-integLimit / Ki_d, Math.min(integLimit / Ki_d, integD));

      // 3. Decoupling feedforward (with 5% real-world parameter mismatch)
      const vqDecouple = 0.95 * omegaElec * (Ld * curId + lambdaPM);
      const vdDecouple = -0.95 * omegaElec * Lq * curIq;

      // 4. Raw controller voltage requests
      let vqReq = Kp_q * errQ + Ki_q * integQ + vqDecouple;
      let vdReq = Kp_d * errD + Ki_d * integD + vdDecouple;

      // 5. Inverter Dead-time 6th harmonic distortion with smooth zero-crossing regularization
      const deadTimeCompEffectiveness = 0.94;
      const residualFactor = 1.0 - deadTimeCompEffectiveness;
      const deadSignQ = Math.tanh(curIq / 0.15);
      const vqDead = -residualFactor * vDeadMag * deadSignQ * Math.cos(6.0 * thetaElec);
      const vdDead = -residualFactor * vDeadMag * deadSignQ * Math.sin(6.0 * thetaElec);
      vqReq += vqDead;
      vdReq += vdDead;

      // 6. SVPWM Voltage Circle Limiter
      const vMag = Math.hypot(vdReq, vqReq);
      if (vMag > vMax && vMag > 1e-4) {
        isVoltageSaturated = true;
        const scale = vMax / vMag;
        vdReq *= scale;
        vqReq *= scale;
      } else {
        isVoltageSaturated = false;
      }

      lastVd = vdReq;
      lastVq = vqReq;

      // 7. Stator RL Electrical Differential Integration:
      // d(id)/dt = (vd - Rs*id + omegaElec*Lq*iq) / Ld
      // d(iq)/dt = (vq - Rs*iq - omegaElec*(Ld*id + lambdaPM)) / Lq
      const didDt = (vdReq - Rs * curId + omegaElec * Lq * curIq) / Ld;
      const diqDt = (vqReq - Rs * curIq - omegaElec * (Ld * curId + lambdaPM)) / Lq;

      curId += didDt * dtSub;
      curIq += diqDt * dtSub;

      // Current magnitude clamp
      const iMag = Math.hypot(curId, curIq);
      if (iMag > params.peakCurrent) {
        isCurrentSaturated = true;
        const scale = params.peakCurrent / iMag;
        curId *= scale;
        curIq *= scale;
      }
    }

    // Wrap electrical angle in [0, 2*pi]
    thetaElec = ((thetaElec % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

    // In industrial FOC drives, synchronous ADC sampling and drive telemetry record
    // the fundamental torque-producing q-axis current, capturing discrete PI closed-loop
    // bandwidth, digital latency, decoupling mismatch, and stator voltage saturation.
    const measuredIq = curIq;

    // PMSM Electromagnetic Torque: tau_m = params.torqueConstant * i_q
    const tauMotor = params.torqueConstant * measuredIq;

    const tauShaft = tauMotor - params.rotorDamping * omegaRotor;
    const tauJointActual = tauShaft * N * eta;

    const vMagFinal = Math.hypot(lastVd, lastVq);
    const powerElectricalW = 1.5 * (lastVd * curId + lastVq * curIq);
    const powerMechanicalW = tauShaft * omegaRotor;
    const copperLossW = 1.5 * (curId * curId + curIq * curIq) * Rs;

    return {
      nextState: {
        currentA: measuredIq,
        idCurrentA: curId,
        iqIntegratorA: integQ,
        idIntegratorA: integD,
        iqRefDelayedA: iqDesired, // Stores reference for next sample delay
        thetaElecRad: thetaElec,
        voltageV: vMagFinal * Math.sign(lastVq || 1),
        rotorSpeedRpm: rpmRotor,
        motorTorqueNm: tauMotor,
        jointTorqueNm: tauJointActual,
        powerElectricalW,
        powerMechanicalW,
        copperLossW,
        rotorFluxWb: lambdaPM,
        isCurrentSaturated,
        isVoltageSaturated,
      },
      tauJointActual,
    };
  }

  /**
   * 5. Squirrel-Cage Induction Motor (IM)
   * Rotor-Flux-Oriented Control (RFOC): Asynchronous slip speed, rotor flux differential equation,
   * magnetizing current isd and torque-producing current isq.
   */
  private static stepInductionMotor(
    params: MotorDriveParameters,
    prev: MotorDynamicState,
    tauMotorDesired: number,
    omegaRotor: number,
    rpmRotor: number,
    N: number,
    eta: number,
    dt: number
  ): { nextState: MotorDynamicState; tauJointActual: number } {
    const p = params.polePairs || 2;
    const Rr = params.rotorResistance || 1.4;
    const Lr = params.rotorInductance || 0.042;
    const Lm = params.mutualInductance || 0.036;
    const tauRotor = Lr / Rr; // Rotor electrical time constant (s)

    // Rated rotor flux psi_r
    const psiRated = 0.85; // Wb
    const prevPsi = Math.max(0.05, prev.rotorFluxWb || psiRated);

    // Stator d-axis current isd builds up rotor flux
    const isdCmd = psiRated / Math.max(1e-4, Lm);

    // Dynamic rotor flux ODE: d(psi_r)/dt = (-psi_r + Lm * isd) / tau_r
    const dPsiDt = (-prevPsi + Lm * isdCmd) / Math.max(1e-4, tauRotor);
    const nextPsi = Math.max(0.05, prevPsi + dt * dPsiDt);

    // Stator q-axis torque-producing current isq: tau_m = 1.5 * p * (Lm / Lr) * psi_r * isq
    const torquePerAmp = 1.5 * p * (Lm / Lr) * nextPsi;
    const isqDesired = Math.max(
      -params.peakCurrent,
      Math.min(params.peakCurrent, tauMotorDesired / Math.max(1e-4, torquePerAmp))
    );

    // Slip angular frequency: omega_slip = (Lm * isq) / (tau_r * psi_r)
    const omegaSlip = (Lm * isqDesired) / (tauRotor * nextPsi);
    const slipRpm = (omegaSlip * 60) / (2 * Math.PI);

    // Inner current integration
    const kpCurrent = 16.0;
    const Rs = params.armatureResistance;
    const prevIsq = prev.currentA;
    const vqCmd = Rs * isqDesired + kpCurrent * (isqDesired - prevIsq);
    const isVoltageSaturated = Math.abs(vqCmd) > params.ratedVoltage;
    const vqActual = Math.max(-params.ratedVoltage, Math.min(params.ratedVoltage, vqCmd));

    const diDt = (vqActual - Rs * prevIsq) / Math.max(1e-4, params.armatureInductance);
    let nextIsq = prevIsq + dt * diDt;
    const isCurrentSaturated = Math.abs(nextIsq) >= params.peakCurrent;
    nextIsq = Math.max(-params.peakCurrent, Math.min(params.peakCurrent, nextIsq));

    // Developed electromagnetic torque
    const tauMotor = 1.5 * p * (Lm / Lr) * nextPsi * nextIsq;

    const tauShaft = tauMotor - params.rotorDamping * omegaRotor;
    const tauJointActual = tauShaft * N * eta;

    const powerElectricalW = vqActual * nextIsq;
    const powerMechanicalW = tauShaft * omegaRotor;
    const copperLossW = (nextIsq * nextIsq + isdCmd * isdCmd) * Rs;

    return {
      nextState: {
        currentA: nextIsq,
        idCurrentA: isdCmd,
        voltageV: vqActual,
        rotorSpeedRpm: rpmRotor,
        motorTorqueNm: tauMotor,
        jointTorqueNm: tauJointActual,
        powerElectricalW,
        powerMechanicalW,
        copperLossW,
        rotorFluxWb: nextPsi,
        slipRpm,
        isCurrentSaturated,
        isVoltageSaturated,
      },
      tauJointActual,
    };
  }
}
