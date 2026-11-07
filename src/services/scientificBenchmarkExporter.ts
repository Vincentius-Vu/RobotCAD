import { DynamicSample } from '../types/dynamics';
import { RobotModel } from '../types/robot';
import { RobotDynamicsProfile } from './robotDynamicsProfiles';
import { DCBusParameters, PowerConverterParameters } from '../types/powerConverter';
import { ControllerStrategyRegistry } from '../physics/Controllers';
import { MotorDriveEngine } from '../physics/motors/MotorDriveEngine';

export interface ScientificBenchmarkMetadata {
  robotModel: RobotModel;
  activeProfile: RobotDynamicsProfile;
  controllerType: string;
  payloadKg: number;
  dcBusSettings: DCBusParameters;
  inverterSettings: PowerConverterParameters;
  trajectoryName?: string;
}

export class ScientificBenchmarkExporter {
  /**
   * Generates a research-grade CSV string with publication metadata, performance indices,
   * and high-resolution time-series data.
   */
  public static generateCSV(
    samples: DynamicSample[],
    meta: ScientificBenchmarkMetadata
  ): { csvContent: string; filename: string; summary: Record<string, any> } {
    const { robotModel, activeProfile, controllerType, payloadKg, dcBusSettings, inverterSettings } = meta;
    const dof = robotModel.dof;
    const n = samples.length;

    const controllerObj = ControllerStrategyRegistry.get(controllerType);
    const controllerName = controllerObj ? controllerObj.name : controllerType;

    const startTime = n > 0 ? samples[0].time : 0;
    const endTime = n > 0 ? samples[n - 1].time : 0;
    const totalDuration = Math.max(0.001, endTime - startTime);
    const avgDt = n > 1 ? totalDuration / (n - 1) : 0.002;

    // --- 1. Compute Scientific Benchmark Indices (ISE, IAE, ITAE, RMS, Energy) ---
    const isePerJoint = new Array(dof).fill(0);
    const iaePerJoint = new Array(dof).fill(0);
    const itaePerJoint = new Array(dof).fill(0);
    const maxErrorPerJoint = new Array(dof).fill(0);
    const sumSqErrorPerJoint = new Array(dof).fill(0);
    const maxTorquePerJoint = new Array(dof).fill(0);
    const sumSqTorquePerJoint = new Array(dof).fill(0);

    let totalNetEnergyJoules = 0;
    let totalRegenEnergyJoules = 0;
    let totalBrakingEnergyJoules = 0;
    let minDCBusVoltage = Infinity;
    let maxDCBusVoltage = -Infinity;
    let overvoltageTripped = false;

    for (let k = 0; k < n; k++) {
      const s = samples[k];
      const t = s.time;

      for (let j = 0; j < dof; j++) {
        const e = s.errorDeg[j] || 0;
        const absE = Math.abs(e);
        const sqE = e * e;

        isePerJoint[j] += sqE * avgDt;
        iaePerJoint[j] += absE * avgDt;
        itaePerJoint[j] += t * absE * avgDt;
        sumSqErrorPerJoint[j] += sqE;
        if (absE > maxErrorPerJoint[j]) maxErrorPerJoint[j] = absE;

        const tau = Math.abs(s.tau[j] || 0);
        sumSqTorquePerJoint[j] += tau * tau;
        if (tau > maxTorquePerJoint[j]) maxTorquePerJoint[j] = tau;
      }

      if (s.dcBusState) {
        const bus = s.dcBusState;
        if (bus.voltageV < minDCBusVoltage) minDCBusVoltage = bus.voltageV;
        if (bus.voltageV > maxDCBusVoltage) maxDCBusVoltage = bus.voltageV;
        if (bus.isOvervoltageTripped) overvoltageTripped = true;

        totalNetEnergyJoules += (bus.netMotorPowerW || 0) * avgDt;
        totalRegenEnergyJoules += (bus.regenerativePowerW || 0) * avgDt;
        totalBrakingEnergyJoules += (bus.brakingPowerW || 0) * avgDt;
      }
    }

    const rmsErrorPerJoint = sumSqErrorPerJoint.map((sum) => Math.sqrt(sum / Math.max(1, n)));
    const rmsTorquePerJoint = sumSqTorquePerJoint.map((sum) => Math.sqrt(sum / Math.max(1, n)));

    const totalISE = isePerJoint.reduce((a, b) => a + b, 0);
    const totalIAE = iaePerJoint.reduce((a, b) => a + b, 0);
    const totalITAE = itaePerJoint.reduce((a, b) => a + b, 0);

    // --- 2. Build Metadata Header (Commented with '#') ---
    const now = new Date();
    const timestampStr = now.toISOString();
    const dateFormatted = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);

    const lines: string[] = [];
    lines.push('# ==============================================================================');
    lines.push('# ROBOTICS DYNAMICS & CONTROL: SCIENTIFIC EXPERIMENT & BENCHMARK REPORT');
    lines.push('# Generated for academic publications, comparative evaluations, and peer review');
    lines.push('# Compatible with: Python (pandas.read_csv(..., comment="#")), MATLAB (readtable), Excel');
    lines.push('# ==============================================================================');
    lines.push(`# Experiment Timestamp : ${timestampStr}`);
    lines.push(`# Robot Manipulator    : ${robotModel.name} (${robotModel.id}) - ${robotModel.manufacturer || 'CAE'}`);
    lines.push(`# Degrees of Freedom   : ${dof} DOF`);
    lines.push(`# Total Robot Weight   : ${robotModel.totalWeightKg} kg`);
    lines.push(`# End-Effector Payload : ${payloadKg.toFixed(2)} kg`);
    lines.push(`# Maximum Reach        : ${robotModel.reachMm} mm`);
    lines.push(`# Total Run Duration   : ${totalDuration.toFixed(4)} s (${n} recorded sample points)`);
    lines.push(`# Effective Frequency  : ${(n / totalDuration).toFixed(1)} Hz (Nominal loop: 500 Hz / RK4)`);
    lines.push('# ------------------------------------------------------------------------------');
    lines.push(`# Motion Controller    : ${controllerName} (ID: ${controllerType})`);
    lines.push(`# Trajectory Profile   : ${meta.trajectoryName || 'Active Trajectory'}`);
    lines.push('# ------------------------------------------------------------------------------');
    lines.push('# ACTUATOR & MOTOR DRIVE SPECIFICATIONS (PER JOINT):');
    for (let j = 0; j < dof; j++) {
      const jCfg = activeProfile.joints[j];
      const mParam = jCfg?.motorParams;
      lines.push(
        `#  - Joint ${j + 1} (${jCfg?.name || `J${j + 1}`}): Type=${mParam?.type.toUpperCase() || 'PMSM'}, GearRatio N=${mParam?.gearRatio || 100}:1, Efficiency η=${((mParam?.gearEfficiency || 0.85) * 100).toFixed(0)}%, Rotor Jm=${mParam?.rotorInertia || 0.0001} kg·m², Reflected J_refl=${(MotorDriveEngine.computeReflectedInertia(mParam || ({} as any))).toFixed(4)} kg·m², Kt=${mParam?.torqueConstant || 0.1} N·m/A, Ke=${mParam?.backEmfConstant || 0.1} V/rad/s, Ra=${mParam?.armatureResistance || 0.5} Ω, I_peak=${mParam?.peakCurrent || 20} A`
      );
    }
    lines.push('# ------------------------------------------------------------------------------');
    lines.push('# POWER ELECTRONICS & SHARED DC BUS SPECIFICATIONS:');
    lines.push(`#  - Nominal Bus Voltage : ${dcBusSettings.nominalVoltage} V`);
    lines.push(`#  - Bus Capacitance     : ${dcBusSettings.busCapacitanceMicroFarad} µF`);
    lines.push(`#  - Braking Chopper     : ${dcBusSettings.enableBrakingChopper ? `ENABLED (R_brake = ${dcBusSettings.brakingResistorOhms} Ω, V_trip = ${dcBusSettings.brakingActivationVoltage} V)` : 'DISABLED'}`);
    lines.push(`#  - PWM Modulation      : ${inverterSettings.modulationScheme.toUpperCase()}`);
    lines.push(`#  - Switching Frequency : ${inverterSettings.switchingFrequencyHz} Hz (${(inverterSettings.switchingFrequencyHz / 1000).toFixed(1)} kHz)`);
    lines.push(`#  - Dead-Time           : ${inverterSettings.deadTimeMicrosec} µs`);
    lines.push(`#  - Switch Technology   : ${inverterSettings.switchType.toUpperCase()}`);
    lines.push('# ==============================================================================');
    lines.push('# SCIENTIFIC BENCHMARK SUMMARY METRICS (FOR PAPER TABLES):');
    lines.push(`#  - Total ISE (Integral Square Error)      : ${totalISE.toFixed(6)} deg²·s`);
    lines.push(`#  - Total IAE (Integral Absolute Error)    : ${totalIAE.toFixed(6)} deg·s`);
    lines.push(`#  - Total ITAE (Time-weighted Error)       : ${totalITAE.toFixed(6)} deg·s²`);
    for (let j = 0; j < dof; j++) {
      lines.push(
        `#  - Joint ${j + 1}: RMS Error = ${rmsErrorPerJoint[j].toFixed(4)} deg | Max Error = ${maxErrorPerJoint[j].toFixed(4)} deg | Max Torque = ${maxTorquePerJoint[j].toFixed(2)} N·m | RMS Torque = ${rmsTorquePerJoint[j].toFixed(2)} N·m`
      );
    }
    lines.push(`#  - Total Net Electrical Energy            : ${totalNetEnergyJoules.toFixed(2)} Joules (${(totalNetEnergyJoules / 3600).toFixed(4)} Wh)`);
    lines.push(`#  - Total Regenerated Energy               : ${totalRegenEnergyJoules.toFixed(2)} Joules`);
    lines.push(`#  - Braking Resistor Dissipated Energy     : ${totalBrakingEnergyJoules.toFixed(2)} Joules`);
    lines.push(`#  - DC Bus Voltage Swing                   : [${minDCBusVoltage === Infinity ? dcBusSettings.nominalVoltage : minDCBusVoltage.toFixed(1)} V  -->  ${maxDCBusVoltage === -Infinity ? dcBusSettings.nominalVoltage : maxDCBusVoltage.toFixed(1)} V]`);
    lines.push(`#  - Hardware Overvoltage Shutdown Tripped  : ${overvoltageTripped ? 'YES (OVERVOLTAGE TRIP DETECTED!)' : 'NO (STABLE)'}`);
    lines.push('# ==============================================================================');

    // --- 3. Build CSV Column Headers ---
    const headers: string[] = ['time_s'];

    for (let j = 1; j <= dof; j++) {
      headers.push(
        `q_des_${j}_deg`,
        `q_act_${j}_deg`,
        `error_${j}_deg`,
        `qd_des_${j}_degs`,
        `qd_act_${j}_degs`,
        `errordot_${j}_degs`,
        `sliding_surf_${j}`,
        `tau_act_${j}_Nm`,
        `tau_grav_${j}_Nm`,
        `tau_inert_${j}_Nm`,
        `tau_coriolis_${j}_Nm`,
        `motor_current_${j}_A`,
        `motor_voltage_${j}_V`,
        `motor_rpm_${j}`,
        `motor_power_${j}_W`,
        `motor_copper_loss_${j}_W`,
        `inv_total_loss_${j}_W`,
        `inv_junction_temp_${j}_C`
      );
    }

    headers.push(
      'dc_bus_voltage_V',
      'braking_chopper_active',
      'braking_power_W',
      'net_system_power_W',
      'kinetic_energy_J',
      'potential_energy_J',
      'total_energy_J'
    );

    lines.push(headers.join(','));

    // --- 4. Append Time-Series Sample Data Rows ---
    for (let k = 0; k < n; k++) {
      const s = samples[k];
      const row: (string | number)[] = [s.time.toFixed(5)];

      for (let j = 0; j < dof; j++) {
        const qDes = (s.qDesiredDeg[j] || 0).toFixed(4);
        const qAct = (s.qDeg[j] || 0).toFixed(4);
        const err = (s.errorDeg[j] || 0).toFixed(4);
        const qdDes = (s.qDesiredDeg[j] !== undefined && s.qdDeg[j] !== undefined ? s.qdDeg[j] + (s.errorDotDeg?.[j] || 0) : 0).toFixed(4);
        const qdAct = (s.qdDeg[j] || 0).toFixed(4);
        const errDot = (s.errorDotDeg?.[j] || 0).toFixed(4);
        const sSurf = (s.slidingSurface?.[j] || 0).toFixed(5);
        const tau = (s.tau[j] || 0).toFixed(4);
        const tauG = (s.tauGravity[j] || 0).toFixed(4);
        const tauM = (s.tauInertia[j] || 0).toFixed(4);
        const tauC = (s.tauCoriolis[j] || 0).toFixed(4);

        const mState = s.motorStates?.[j];
        const mCurr = (mState?.currentA || 0).toFixed(3);
        const mVolt = (mState?.voltageV || 0).toFixed(2);
        const mRpm = (mState?.rotorSpeedRpm || 0).toFixed(1);
        const mPwr = (mState?.powerElectricalW || 0).toFixed(2);
        const mLoss = (mState?.copperLossW || 0).toFixed(2);

        const invAxis = s.dcBusState?.axisStates?.[j];
        const invLoss = (invAxis?.totalLossW || 0).toFixed(2);
        const invTj = (invAxis?.junctionTemperatureC || 25).toFixed(1);

        row.push(
          qDes,
          qAct,
          err,
          qdDes,
          qdAct,
          errDot,
          sSurf,
          tau,
          tauG,
          tauM,
          tauC,
          mCurr,
          mVolt,
          mRpm,
          mPwr,
          mLoss,
          invLoss,
          invTj
        );
      }

      const bus = s.dcBusState;
      row.push(
        (bus?.voltageV || dcBusSettings.nominalVoltage).toFixed(2),
        bus?.isBrakingChopperActive ? 1 : 0,
        (bus?.brakingPowerW || 0).toFixed(2),
        (bus?.netMotorPowerW || 0).toFixed(2),
        (s.kineticEnergy || 0).toFixed(4),
        (s.potentialEnergy || 0).toFixed(4),
        (s.totalEnergy || 0).toFixed(4)
      );

      lines.push(row.join(','));
    }

    const csvContent = lines.join('\n');
    const primaryMotorType = activeProfile.joints[0]?.motorParams?.type || 'pmsm';
    const filename = `robotics_benchmark_${robotModel.id}_${controllerType}_${primaryMotorType}_${dateFormatted}.csv`;

    return {
      csvContent,
      filename,
      summary: {
        totalISE,
        totalIAE,
        totalITAE,
        rmsErrorPerJoint,
        maxErrorPerJoint,
        maxTorquePerJoint,
        totalNetEnergyJoules,
        totalRegenEnergyJoules,
        totalBrakingEnergyJoules,
        minDCBusVoltage,
        maxDCBusVoltage,
        overvoltageTripped,
        sampleCount: n,
        totalDuration,
      },
    };
  }

  /**
   * Triggers a browser file download for the scientific benchmark CSV
   */
  public static triggerDownload(csvContent: string, filename: string): void {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
