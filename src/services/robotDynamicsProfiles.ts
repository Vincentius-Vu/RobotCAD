import { ControllerType, InertialParameters } from '../types/dynamics';
import { RobotModel } from '../types/robot';
import { MotorDriveParameters } from '../types/motor';
import { MotorDriveEngine } from '../physics/motors/MotorDriveEngine';

export interface JointMotorConfig {
  jointIndex: number;
  name: string;
  maxTorque: number; // N.m peak motor rated torque
  viscousFriction: number; // N.m.s/rad
  coulombFriction: number; // N.m
  kp: number; // Proportional gain
  kd: number; // Derivative gain
  motorParams?: MotorDriveParameters; // Electromechanical actuator & motor drive parameters
}

export interface RobotDynamicsProfile {
  robotId: string;
  robotName: string;
  manufacturer: string;
  controllerType: ControllerType;
  defaultPayloadKg: number;
  timeStep: number;
  joints: JointMotorConfig[];
  isCustomTuned?: boolean;
  lastUpdated?: string;
}

const STORAGE_PREFIX = 'robotics_dynamics_profile_';

/**
 * Pre-tuned benchmark dynamics & motor control parameters tailored per robot model.
 * Accounts for link masses, motor gearboxes, and inertial cross-coupling.
 */
export const FACTORY_DYNAMICS_PROFILES: Record<string, Omit<RobotDynamicsProfile, 'isCustomTuned' | 'lastUpdated'>> = {
  // 00. Franka Emika Panda (18.0 kg, 7-DOF Redundant Research Cobot)
  FrankaEmikaPanda: {
    robotId: 'FrankaEmikaPanda',
    robotName: 'Franka Emika Panda',
    manufacturer: 'Franka Emika',
    controllerType: 'computed-torque',
    defaultPayloadKg: 3.0,
    timeStep: 0.002,
    joints: [
      {
        jointIndex: 1,
        name: 'J1 - Base Pan',
        maxTorque: 87.0,
        viscousFriction: 0.001,
        coulombFriction: 0.15,
        kp: 180,
        kd: 28,
        motorParams: {
          type: 'pmsm',
          name: 'TQ RoboDrive ILM 70 Frameless PMSM',
          ratedVoltage: 48,
          ratedCurrent: 8.0,
          peakCurrent: 20.0,
          ratedTorque: 0.87,
          peakTorque: 2.2,
          maxRpm: 4000,
          torqueConstant: 0.125,
          backEmfConstant: 0.125,
          armatureResistance: 0.32,
          armatureInductance: 0.00028,
          rotorInertia: 0.00002,
          rotorDamping: 0.00002,
          gearRatio: 100.0,
          gearEfficiency: 0.95,
          polePairs: 7,
        },
      },
      {
        jointIndex: 2,
        name: 'J2 - Shoulder Pitch',
        maxTorque: 87.0,
        viscousFriction: 0.001,
        coulombFriction: 0.15,
        kp: 180,
        kd: 28,
        motorParams: {
          type: 'pmsm',
          name: 'TQ RoboDrive ILM 70 Frameless PMSM',
          ratedVoltage: 48,
          ratedCurrent: 8.0,
          peakCurrent: 20.0,
          ratedTorque: 0.87,
          peakTorque: 2.2,
          maxRpm: 4000,
          torqueConstant: 0.125,
          backEmfConstant: 0.125,
          armatureResistance: 0.32,
          armatureInductance: 0.00028,
          rotorInertia: 0.00002,
          rotorDamping: 0.00002,
          gearRatio: 100.0,
          gearEfficiency: 0.95,
          polePairs: 7,
        },
      },
      {
        jointIndex: 3,
        name: 'J3 - Upper Arm Roll',
        maxTorque: 87.0,
        viscousFriction: 0.001,
        coulombFriction: 0.12,
        kp: 160,
        kd: 25,
        motorParams: {
          type: 'pmsm',
          name: 'TQ RoboDrive ILM 70 Frameless PMSM',
          ratedVoltage: 48,
          ratedCurrent: 8.0,
          peakCurrent: 20.0,
          ratedTorque: 0.87,
          peakTorque: 2.2,
          maxRpm: 4000,
          torqueConstant: 0.125,
          backEmfConstant: 0.125,
          armatureResistance: 0.32,
          armatureInductance: 0.00028,
          rotorInertia: 0.00002,
          rotorDamping: 0.00002,
          gearRatio: 100.0,
          gearEfficiency: 0.95,
          polePairs: 7,
        },
      },
      {
        jointIndex: 4,
        name: 'J4 - Elbow Pitch',
        maxTorque: 87.0,
        viscousFriction: 0.001,
        coulombFriction: 0.12,
        kp: 160,
        kd: 25,
        motorParams: {
          type: 'pmsm',
          name: 'TQ RoboDrive ILM 70 Frameless PMSM',
          ratedVoltage: 48,
          ratedCurrent: 8.0,
          peakCurrent: 20.0,
          ratedTorque: 0.87,
          peakTorque: 2.2,
          maxRpm: 4000,
          torqueConstant: 0.125,
          backEmfConstant: 0.125,
          armatureResistance: 0.32,
          armatureInductance: 0.00028,
          rotorInertia: 0.00002,
          rotorDamping: 0.00002,
          gearRatio: 100.0,
          gearEfficiency: 0.95,
          polePairs: 7,
        },
      },
      {
        jointIndex: 5,
        name: 'J5 - Forearm Roll',
        maxTorque: 12.0,
        viscousFriction: 0.0005,
        coulombFriction: 0.08,
        kp: 140,
        kd: 22,
        motorParams: {
          type: 'pmsm',
          name: 'TQ RoboDrive ILM 50 Compact PMSM',
          ratedVoltage: 48,
          ratedCurrent: 3.2,
          peakCurrent: 7.5,
          ratedTorque: 0.12,
          peakTorque: 0.35,
          maxRpm: 5500,
          torqueConstant: 0.085,
          backEmfConstant: 0.085,
          armatureResistance: 0.55,
          armatureInductance: 0.00018,
          rotorInertia: 0.000005,
          rotorDamping: 0.00001,
          gearRatio: 100.0,
          gearEfficiency: 0.94,
          polePairs: 7,
        },
      },
      {
        jointIndex: 6,
        name: 'J6 - Wrist Pitch',
        maxTorque: 12.0,
        viscousFriction: 0.0005,
        coulombFriction: 0.08,
        kp: 140,
        kd: 22,
        motorParams: {
          type: 'pmsm',
          name: 'TQ RoboDrive ILM 50 Compact PMSM',
          ratedVoltage: 48,
          ratedCurrent: 3.2,
          peakCurrent: 7.5,
          ratedTorque: 0.12,
          peakTorque: 0.35,
          maxRpm: 5500,
          torqueConstant: 0.085,
          backEmfConstant: 0.085,
          armatureResistance: 0.55,
          armatureInductance: 0.00018,
          rotorInertia: 0.000005,
          rotorDamping: 0.00001,
          gearRatio: 100.0,
          gearEfficiency: 0.94,
          polePairs: 7,
        },
      },
      {
        jointIndex: 7,
        name: 'J7 - Flange Roll',
        maxTorque: 12.0,
        viscousFriction: 0.0004,
        coulombFriction: 0.06,
        kp: 120,
        kd: 18,
        motorParams: {
          type: 'pmsm',
          name: 'TQ RoboDrive ILM 50 Compact PMSM',
          ratedVoltage: 48,
          ratedCurrent: 3.2,
          peakCurrent: 7.5,
          ratedTorque: 0.12,
          peakTorque: 0.35,
          maxRpm: 5500,
          torqueConstant: 0.085,
          backEmfConstant: 0.085,
          armatureResistance: 0.55,
          armatureInductance: 0.00018,
          rotorInertia: 0.000005,
          rotorDamping: 0.00001,
          gearRatio: 100.0,
          gearEfficiency: 0.94,
          polePairs: 7,
        },
      },
    ],
  },
  // 0. Universal Robots UR5 (20.6 kg, 6-DOF, Modern Collaborative Robot Benchmark)
  UR5: {
    robotId: 'UR5',
    robotName: 'UR5',
    manufacturer: 'Universal Robots',
    controllerType: 'computed-torque',
    defaultPayloadKg: 5.0,
    timeStep: 0.002,
    joints: [
      {
        jointIndex: 1,
        name: 'J1 - Base Pan',
        maxTorque: 150.0,
        viscousFriction: 0.0012,
        coulombFriction: 0.20,
        kp: 180,
        kd: 28,
        motorParams: {
          type: 'pmsm',
          name: 'UR5 Size 3 Joint Motor (Harmonic Drive FHA-25C)',
          ratedVoltage: 48,
          ratedCurrent: 8.5,
          peakCurrent: 22.0,
          ratedTorque: 1.25,
          peakTorque: 3.5,
          maxRpm: 3600,
          torqueConstant: 0.147,
          backEmfConstant: 0.147,
          armatureResistance: 0.28,
          armatureInductance: 0.00030,
          rotorInertia: 0.000025,
          rotorDamping: 0.00002,
          gearRatio: 101.0,
          gearEfficiency: 0.94,
          polePairs: 7,
        },
      },
      {
        jointIndex: 2,
        name: 'J2 - Shoulder Lift',
        maxTorque: 150.0,
        viscousFriction: 0.0012,
        coulombFriction: 0.22,
        kp: 180,
        kd: 28,
        motorParams: {
          type: 'pmsm',
          name: 'UR5 Size 3 Joint Motor (Harmonic Drive FHA-25C)',
          ratedVoltage: 48,
          ratedCurrent: 8.5,
          peakCurrent: 22.0,
          ratedTorque: 1.25,
          peakTorque: 3.5,
          maxRpm: 3600,
          torqueConstant: 0.147,
          backEmfConstant: 0.147,
          armatureResistance: 0.28,
          armatureInductance: 0.00030,
          rotorInertia: 0.000025,
          rotorDamping: 0.00002,
          gearRatio: 101.0,
          gearEfficiency: 0.94,
          polePairs: 7,
        },
      },
      {
        jointIndex: 3,
        name: 'J3 - Elbow Joint',
        maxTorque: 150.0,
        viscousFriction: 0.0010,
        coulombFriction: 0.18,
        kp: 160,
        kd: 26,
        motorParams: {
          type: 'pmsm',
          name: 'UR5 Size 3 Joint Motor (Harmonic Drive FHA-25C)',
          ratedVoltage: 48,
          ratedCurrent: 8.5,
          peakCurrent: 22.0,
          ratedTorque: 1.25,
          peakTorque: 3.5,
          maxRpm: 3600,
          torqueConstant: 0.147,
          backEmfConstant: 0.147,
          armatureResistance: 0.28,
          armatureInductance: 0.00030,
          rotorInertia: 0.000025,
          rotorDamping: 0.00002,
          gearRatio: 101.0,
          gearEfficiency: 0.94,
          polePairs: 7,
        },
      },
      {
        jointIndex: 4,
        name: 'J4 - Wrist 1 Tilt',
        maxTorque: 28.0,
        viscousFriction: 0.0005,
        coulombFriction: 0.08,
        kp: 130,
        kd: 20,
        motorParams: {
          type: 'pmsm',
          name: 'UR5 Size 1 Wrist Motor (Harmonic Drive FHA-17C)',
          ratedVoltage: 48,
          ratedCurrent: 4.2,
          peakCurrent: 10.5,
          ratedTorque: 0.45,
          peakTorque: 1.20,
          maxRpm: 4500,
          torqueConstant: 0.107,
          backEmfConstant: 0.107,
          armatureResistance: 0.45,
          armatureInductance: 0.00022,
          rotorInertia: 0.000006,
          rotorDamping: 0.00001,
          gearRatio: 101.0,
          gearEfficiency: 0.92,
          polePairs: 7,
        },
      },
      {
        jointIndex: 5,
        name: 'J5 - Wrist 2 Pan',
        maxTorque: 28.0,
        viscousFriction: 0.0005,
        coulombFriction: 0.08,
        kp: 130,
        kd: 20,
        motorParams: {
          type: 'pmsm',
          name: 'UR5 Size 1 Wrist Motor (Harmonic Drive FHA-17C)',
          ratedVoltage: 48,
          ratedCurrent: 4.2,
          peakCurrent: 10.5,
          ratedTorque: 0.45,
          peakTorque: 1.20,
          maxRpm: 4500,
          torqueConstant: 0.107,
          backEmfConstant: 0.107,
          armatureResistance: 0.45,
          armatureInductance: 0.00022,
          rotorInertia: 0.000006,
          rotorDamping: 0.00001,
          gearRatio: 101.0,
          gearEfficiency: 0.92,
          polePairs: 7,
        },
      },
      {
        jointIndex: 6,
        name: 'J6 - Wrist 3 Roll',
        maxTorque: 28.0,
        viscousFriction: 0.0003,
        coulombFriction: 0.05,
        kp: 120,
        kd: 18,
        motorParams: {
          type: 'pmsm',
          name: 'UR5 Size 1 Wrist Motor (Harmonic Drive FHA-17C)',
          ratedVoltage: 48,
          ratedCurrent: 4.2,
          peakCurrent: 10.5,
          ratedTorque: 0.45,
          peakTorque: 1.20,
          maxRpm: 4500,
          torqueConstant: 0.107,
          backEmfConstant: 0.107,
          armatureResistance: 0.45,
          armatureInductance: 0.00022,
          rotorInertia: 0.000006,
          rotorDamping: 0.00001,
          gearRatio: 101.0,
          gearEfficiency: 0.92,
          polePairs: 7,
        },
      },
    ],
  },
  // 1. Unimation Puma 560 (54.5 kg, 6-DOF, heavy geared research benchmark)
  Puma560: {
    robotId: 'Puma560',
    robotName: 'PUMA 560',
    manufacturer: 'Unimation',
    controllerType: 'computed-torque',
    defaultPayloadKg: 2.5,
    timeStep: 0.002,
    joints: [
      {
        jointIndex: 1,
        name: 'J1 - Waist Servo',
        maxTorque: 211.7,
        viscousFriction: 0.0015,
        coulombFriction: 0.35,
        kp: 180,
        kd: 28,
        motorParams: {
          type: 'pmsm',
          name: 'PUMA J1 Waist Servo (RoboDrive ILM 70x18)',
          ratedVoltage: 48,
          ratedCurrent: 10.0,
          peakCurrent: 27.0,
          ratedTorque: 1.40,
          peakTorque: 3.80,
          maxRpm: 4500,
          torqueConstant: 0.140,
          backEmfConstant: 0.140,
          armatureResistance: 0.22,
          armatureInductance: 0.00025,
          rotorInertia: 0.00020,
          rotorDamping: 0.00005,
          gearRatio: 62.61,
          gearEfficiency: 0.89,
          polePairs: 6,
        },
      },
      {
        jointIndex: 2,
        name: 'J2 - Shoulder Servo',
        maxTorque: 403.0,
        viscousFriction: 0.002,
        coulombFriction: 0.45,
        kp: 220,
        kd: 32,
        motorParams: {
          type: 'pmsm',
          name: 'PUMA J2 Shoulder Heavy Servo (RoboDrive ILM 70x18 HD)',
          ratedVoltage: 48,
          ratedCurrent: 10.7,
          peakCurrent: 30.0,
          ratedTorque: 1.50,
          peakTorque: 4.20,
          maxRpm: 4500,
          torqueConstant: 0.140,
          backEmfConstant: 0.140,
          armatureResistance: 0.20,
          armatureInductance: 0.00024,
          rotorInertia: 0.00020,
          rotorDamping: 0.00005,
          gearRatio: 107.82,
          gearEfficiency: 0.89,
          polePairs: 6,
        },
      },
      {
        jointIndex: 3,
        name: 'J3 - Elbow Servo',
        maxTorque: 133.8,
        viscousFriction: 0.0018,
        coulombFriction: 0.40,
        kp: 160,
        kd: 25,
        motorParams: {
          type: 'pmsm',
          name: 'PUMA J3 Elbow Mid Servo (RoboDrive ILM 70x10)',
          ratedVoltage: 48,
          ratedCurrent: 9.5,
          peakCurrent: 24.0,
          ratedTorque: 1.10,
          peakTorque: 2.80,
          maxRpm: 4500,
          torqueConstant: 0.115,
          backEmfConstant: 0.115,
          armatureResistance: 0.28,
          armatureInductance: 0.00030,
          rotorInertia: 0.00014,
          rotorDamping: 0.00004,
          gearRatio: 53.71,
          gearEfficiency: 0.89,
          polePairs: 6,
        },
      },
      {
        jointIndex: 4,
        name: 'J4 - Forearm Roll',
        maxTorque: 44.0,
        viscousFriction: 0.0008,
        coulombFriction: 0.15,
        kp: 250,
        kd: 28,
        motorParams: {
          type: 'pmsm',
          name: 'PUMA J4 Wrist Roll Micro Servo (RoboDrive ILM 38x10)',
          ratedVoltage: 48,
          ratedCurrent: 5.5,
          peakCurrent: 14.0,
          ratedTorque: 0.25,
          peakTorque: 0.65,
          maxRpm: 6000,
          torqueConstant: 0.045,
          backEmfConstant: 0.045,
          armatureResistance: 0.85,
          armatureInductance: 0.00055,
          rotorInertia: 0.000033,
          rotorDamping: 0.00001,
          gearRatio: 76.04,
          gearEfficiency: 0.89,
          polePairs: 4,
        },
      },
      {
        jointIndex: 5,
        name: 'J5 - Wrist Pitch',
        maxTorque: 35.2,
        viscousFriction: 0.0006,
        coulombFriction: 0.12,
        kp: 220,
        kd: 26,
        motorParams: {
          type: 'pmsm',
          name: 'PUMA J5 Wrist Pitch Micro Servo (RoboDrive ILM 38x10)',
          ratedVoltage: 48,
          ratedCurrent: 5.0,
          peakCurrent: 13.0,
          ratedTorque: 0.22,
          peakTorque: 0.55,
          maxRpm: 6000,
          torqueConstant: 0.043,
          backEmfConstant: 0.043,
          armatureResistance: 0.92,
          armatureInductance: 0.00058,
          rotorInertia: 0.000030,
          rotorDamping: 0.00001,
          gearRatio: 71.92,
          gearEfficiency: 0.89,
          polePairs: 4,
        },
      },
      {
        jointIndex: 6,
        name: 'J6 - Tool Flange',
        maxTorque: 30.7,
        viscousFriction: 0.0005,
        coulombFriction: 0.10,
        kp: 180,
        kd: 22,
        motorParams: {
          type: 'pmsm',
          name: 'PUMA J6 Tool Flange Micro Servo (RoboDrive ILM 38x06)',
          ratedVoltage: 48,
          ratedCurrent: 4.5,
          peakCurrent: 11.0,
          ratedTorque: 0.18,
          peakTorque: 0.45,
          maxRpm: 6000,
          torqueConstant: 0.040,
          backEmfConstant: 0.040,
          armatureResistance: 1.05,
          armatureInductance: 0.00062,
          rotorInertia: 0.000025,
          rotorDamping: 0.00001,
          gearRatio: 76.69,
          gearEfficiency: 0.89,
          polePairs: 4,
        },
      },
    ],
  },

  // 2. ABB IRB 120 (25 kg tabletop, 3 kg payload, lightweight compact servos)
  ABBIRB120: {
    robotId: 'ABBIRB120',
    robotName: 'IRB 120',
    manufacturer: 'ABB',
    controllerType: 'computed-torque',
    defaultPayloadKg: 1.0,
    timeStep: 0.002,
    joints: [
      { jointIndex: 1, name: 'J1 - Base Azimuth', maxTorque: 65.0, viscousFriction: 0.001, coulombFriction: 0.20, kp: 130, kd: 20 },
      { jointIndex: 2, name: 'J2 - Vertical Arm', maxTorque: 85.0, viscousFriction: 0.0012, coulombFriction: 0.25, kp: 150, kd: 24 },
      { jointIndex: 3, name: 'J3 - Forearm Pitch', maxTorque: 50.0, viscousFriction: 0.001, coulombFriction: 0.20, kp: 110, kd: 18 },
      { jointIndex: 4, name: 'J4 - Wrist Rotation', maxTorque: 18.0, viscousFriction: 0.0005, coulombFriction: 0.08, kp: 35, kd: 6 },
      { jointIndex: 5, name: 'J5 - Wrist Bend', maxTorque: 18.0, viscousFriction: 0.0005, coulombFriction: 0.08, kp: 30, kd: 5 },
      { jointIndex: 6, name: 'J6 - Turn Disc', maxTorque: 12.0, viscousFriction: 0.0004, coulombFriction: 0.05, kp: 25, kd: 4 },
    ],
  },

  // 3. FANUC M-10iA (130 kg, 10 kg payload, arc welding high-speed servos)
  FanucM10iA: {
    robotId: 'FanucM10iA',
    robotName: 'M-10iA',
    manufacturer: 'FANUC',
    controllerType: 'computed-torque',
    defaultPayloadKg: 5.0,
    timeStep: 0.002,
    joints: [
      { jointIndex: 1, name: 'J1 - Base Rotation', maxTorque: 220.0, viscousFriction: 0.0025, coulombFriction: 0.50, kp: 200, kd: 30 },
      { jointIndex: 2, name: 'J2 - Lower Arm', maxTorque: 320.0, viscousFriction: 0.003, coulombFriction: 0.60, kp: 250, kd: 36 },
      { jointIndex: 3, name: 'J3 - Upper Arm', maxTorque: 180.0, viscousFriction: 0.002, coulombFriction: 0.45, kp: 180, kd: 26 },
      { jointIndex: 4, name: 'J4 - Wrist Twist', maxTorque: 55.0, viscousFriction: 0.0009, coulombFriction: 0.18, kp: 60, kd: 10 },
      { jointIndex: 5, name: 'J5 - Wrist Swivel', maxTorque: 45.0, viscousFriction: 0.0008, coulombFriction: 0.15, kp: 45, kd: 8 },
      { jointIndex: 6, name: 'J6 - Wrist Roll', maxTorque: 35.0, viscousFriction: 0.0006, coulombFriction: 0.12, kp: 35, kd: 6 },
    ],
  },

  // 4. KUKA KR 5 & KR 5 Sixx (28-127 kg, continuous-path industrial robot)
  KukaKR5: {
    robotId: 'KukaKR5',
    robotName: 'KR 5',
    manufacturer: 'KUKA',
    controllerType: 'computed-torque',
    defaultPayloadKg: 3.0,
    timeStep: 0.002,
    joints: [
      { jointIndex: 1, name: 'A1 - Column Pivot', maxTorque: 160.0, viscousFriction: 0.0018, coulombFriction: 0.35, kp: 170, kd: 26 },
      { jointIndex: 2, name: 'A2 - Link Arm', maxTorque: 240.0, viscousFriction: 0.0022, coulombFriction: 0.45, kp: 210, kd: 30 },
      { jointIndex: 3, name: 'A3 - Arm Joint', maxTorque: 130.0, viscousFriction: 0.0016, coulombFriction: 0.30, kp: 150, kd: 22 },
      { jointIndex: 4, name: 'A4 - Hand Axis 1', maxTorque: 40.0, viscousFriction: 0.0008, coulombFriction: 0.12, kp: 45, kd: 8 },
      { jointIndex: 5, name: 'A5 - Hand Axis 2', maxTorque: 32.0, viscousFriction: 0.0007, coulombFriction: 0.10, kp: 35, kd: 6 },
      { jointIndex: 6, name: 'A6 - Flange Axis', maxTorque: 24.0, viscousFriction: 0.0005, coulombFriction: 0.08, kp: 28, kd: 5 },
    ],
  },

  // 5. Heavy Industrial Giants (Fanuc R-2000i, KUKA KR 210, ABB IRB 6650: 1000+ kg, high payload 150-200 kg)
  FanucR2000i: {
    robotId: 'FanucR2000i',
    robotName: 'R-2000i',
    manufacturer: 'FANUC',
    controllerType: 'computed-torque',
    defaultPayloadKg: 50.0,
    timeStep: 0.002,
    joints: [
      { jointIndex: 1, name: 'J1 - High-Torque Turntable', maxTorque: 1400.0, viscousFriction: 0.015, coulombFriction: 2.5, kp: 450, kd: 65 },
      { jointIndex: 2, name: 'J2 - Boom Pivot', maxTorque: 2400.0, viscousFriction: 0.02, coulombFriction: 3.5, kp: 580, kd: 85 },
      { jointIndex: 3, name: 'J3 - Forearm Pivot', maxTorque: 1500.0, viscousFriction: 0.016, coulombFriction: 2.8, kp: 420, kd: 60 },
      { jointIndex: 4, name: 'J4 - Wrist Roll', maxTorque: 320.0, viscousFriction: 0.004, coulombFriction: 0.8, kp: 140, kd: 24 },
      { jointIndex: 5, name: 'J5 - Wrist Pitch', maxTorque: 260.0, viscousFriction: 0.0035, coulombFriction: 0.7, kp: 120, kd: 20 },
      { jointIndex: 6, name: 'J6 - Tool Roll', maxTorque: 180.0, viscousFriction: 0.0025, coulombFriction: 0.5, kp: 90, kd: 16 },
    ],
  },

  KukaKR210Ultra: {
    robotId: 'KukaKR210Ultra',
    robotName: 'KR 210 Ultra',
    manufacturer: 'KUKA',
    controllerType: 'computed-torque',
    defaultPayloadKg: 60.0,
    timeStep: 0.002,
    joints: [
      { jointIndex: 1, name: 'A1 - Base Drive', maxTorque: 1500.0, viscousFriction: 0.016, coulombFriction: 2.6, kp: 460, kd: 68 },
      { jointIndex: 2, name: 'A2 - Rocker Drive', maxTorque: 2600.0, viscousFriction: 0.022, coulombFriction: 3.8, kp: 600, kd: 88 },
      { jointIndex: 3, name: 'A3 - Arm Drive', maxTorque: 1600.0, viscousFriction: 0.018, coulombFriction: 3.0, kp: 440, kd: 64 },
      { jointIndex: 4, name: 'A4 - Wrist In-line', maxTorque: 340.0, viscousFriction: 0.0045, coulombFriction: 0.85, kp: 150, kd: 26 },
      { jointIndex: 5, name: 'A5 - Wrist Center', maxTorque: 280.0, viscousFriction: 0.0038, coulombFriction: 0.75, kp: 130, kd: 22 },
      { jointIndex: 6, name: 'A6 - Flange Face', maxTorque: 200.0, viscousFriction: 0.0028, coulombFriction: 0.55, kp: 100, kd: 18 },
    ],
  },

  // 6. Compact Epson C3-A601S (27 kg semiconductor handling)
  EpsonC3A60CT: {
    robotId: 'EpsonC3A60CT',
    robotName: 'C3-A601S',
    manufacturer: 'Epson',
    controllerType: 'computed-torque',
    defaultPayloadKg: 1.0,
    timeStep: 0.002,
    joints: [
      { jointIndex: 1, name: 'J1 - High-Speed Base', maxTorque: 55.0, viscousFriction: 0.0008, coulombFriction: 0.18, kp: 140, kd: 22 },
      { jointIndex: 2, name: 'J2 - Agile Shoulder', maxTorque: 75.0, viscousFriction: 0.001, coulombFriction: 0.22, kp: 160, kd: 25 },
      { jointIndex: 3, name: 'J3 - Agile Elbow', maxTorque: 45.0, viscousFriction: 0.0008, coulombFriction: 0.18, kp: 120, kd: 19 },
      { jointIndex: 4, name: 'J4 - Compact Roll', maxTorque: 15.0, viscousFriction: 0.0004, coulombFriction: 0.06, kp: 35, kd: 6 },
      { jointIndex: 5, name: 'J5 - Compact Pitch', maxTorque: 15.0, viscousFriction: 0.0004, coulombFriction: 0.06, kp: 30, kd: 5 },
      { jointIndex: 6, name: 'J6 - Vacuum Chuck', maxTorque: 10.0, viscousFriction: 0.0003, coulombFriction: 0.04, kp: 25, kd: 4 },
    ],
  },
};

export class RobotDynamicsProfileManager {
  /**
   * Generates tailored baseline profile for any generic or imported robot
   */
  public static createDefaultProfile(model: RobotModel): RobotDynamicsProfile {
    // Check known factory database
    const matchedKey = Object.keys(FACTORY_DYNAMICS_PROFILES).find(
      (k) => k.toLowerCase() === model.id.toLowerCase() || model.name.toLowerCase().includes(k.toLowerCase())
    );

    if (matchedKey && FACTORY_DYNAMICS_PROFILES[matchedKey]) {
      const p = FACTORY_DYNAMICS_PROFILES[matchedKey];
      return {
        ...p,
        robotId: model.id,
        robotName: model.name,
        manufacturer: model.manufacturer,
        joints: p.joints.slice(0, model.dof),
        isCustomTuned: false,
      };
    }

    // Algorithmic scaling based on robot physical mass and reach
    const totalMass = Math.max(10, model.totalWeightKg || 50);
    const reachM = Math.max(0.4, (model.reachMm || 800) / 1000);
    const scaleFactor = Math.sqrt(totalMass / 50.0);

    const joints: JointMotorConfig[] = [];
    for (let i = 0; i < model.dof; i++) {
      const isBaseJoint = i < 3;
      const fraction = isBaseJoint ? (1.0 - i * 0.18) : (0.28 - (i - 3) * 0.06);
      const maxTorque = Math.round(totalMass * 9.81 * reachM * fraction * 0.4);
      const kp = Math.round((isBaseJoint ? 160 : 40) * scaleFactor);
      const kd = Math.round(2.0 * Math.sqrt(kp) * (isBaseJoint ? 1.0 : 0.7));

      joints.push({
        jointIndex: i + 1,
        name: `J${i + 1} - ${isBaseJoint ? 'Arm Motor' : 'Wrist Motor'}`,
        maxTorque: Math.max(15, maxTorque),
        viscousFriction: Math.round(0.001 * scaleFactor * 10000) / 10000,
        coulombFriction: Math.round(0.2 * scaleFactor * 100) / 100,
        kp: Math.max(20, kp),
        kd: Math.max(3, kd),
      });
    }

    return {
      robotId: model.id,
      robotName: model.name,
      manufacturer: model.manufacturer,
      controllerType: 'computed-torque',
      defaultPayloadKg: model.payloadKg || 2.0,
      timeStep: 0.002,
      joints,
      isCustomTuned: false,
    };
  }

  /**
   * Retrieves active profile for a robot: checks localStorage first, falls back to factory defaults
   */
  public static getProfileForRobot(robotId: string, model: RobotModel): RobotDynamicsProfile {
    try {
      const stored = localStorage.getItem(`${STORAGE_PREFIX}${robotId}`);
      if (stored) {
        const parsed: RobotDynamicsProfile = JSON.parse(stored);
        if (parsed.joints && parsed.joints.length === model.dof) {
          return {
            ...parsed,
            isCustomTuned: true,
          };
        }
      }
    } catch (e) {
      console.warn(`Could not read stored dynamics profile for ${robotId}:`, e);
    }

    return this.createDefaultProfile(model);
  }

  /**
   * Persists customized profile to localStorage
   */
  public static saveProfileForRobot(profile: RobotDynamicsProfile): void {
    try {
      const toStore: RobotDynamicsProfile = {
        ...profile,
        isCustomTuned: true,
        lastUpdated: new Date().toISOString(),
      };
      localStorage.setItem(`${STORAGE_PREFIX}${profile.robotId}`, JSON.stringify(toStore));
    } catch (e) {
      console.error(`Failed to persist dynamics profile for ${profile.robotId}:`, e);
    }
  }

  /**
   * Resets robot profile to factory baseline, purging local storage overrides
   */
  public static resetProfileToFactory(robotId: string, model: RobotModel): RobotDynamicsProfile {
    try {
      localStorage.removeItem(`${STORAGE_PREFIX}${robotId}`);
    } catch (e) {
      // Ignore storage clear error
    }
    return this.createDefaultProfile(model);
  }

  /**
   * Exports profile as a standalone JSON file download
   */
  public static exportProfileToJSON(profile: RobotDynamicsProfile): void {
    const dataStr = JSON.stringify(profile, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${profile.robotId}_dynamics_profile.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Validates and imports a profile from a user-supplied JSON string
   */
  public static importProfileFromJSON(
    jsonStr: string,
    targetRobotId: string,
    expectedDof: number
  ): { profile: RobotDynamicsProfile | null; error?: string } {
    try {
      const parsed = JSON.parse(jsonStr) as Partial<RobotDynamicsProfile>;

      if (!parsed.joints || !Array.isArray(parsed.joints)) {
        return { profile: null, error: 'File JSON không chứa danh sách thông số các khớp (joints array).' };
      }

      if (parsed.joints.length !== expectedDof) {
        return {
          profile: null,
          error: `Số lượng khớp trong file (${parsed.joints.length}) không khớp với bậc tự do của robot hiện tại (${expectedDof} DOF).`,
        };
      }

      // Sanitize joints
      const sanitizedJoints: JointMotorConfig[] = parsed.joints.map((j, idx) => ({
        jointIndex: idx + 1,
        name: j.name || `Khớp J${idx + 1}`,
        maxTorque: Math.max(5, Number(j.maxTorque) || 100),
        viscousFriction: Math.max(0, Number(j.viscousFriction) || 0.001),
        coulombFriction: Math.max(0, Number(j.coulombFriction) || 0.2),
        kp: Math.max(1, Number(j.kp) || 120),
        kd: Math.max(0.5, Number(j.kd) || 20),
        motorParams: j.motorParams || MotorDriveEngine.MOTOR_PRESETS.robodrive_pmsm_ilm70.params,
      }));

      const fullProfile: RobotDynamicsProfile = {
        robotId: targetRobotId,
        robotName: parsed.robotName || targetRobotId,
        manufacturer: parsed.manufacturer || 'Custom',
        controllerType: parsed.controllerType || 'computed-torque',
        defaultPayloadKg: Number(parsed.defaultPayloadKg) || 0,
        timeStep: Number(parsed.timeStep) || 0.002,
        joints: sanitizedJoints,
        isCustomTuned: true,
        lastUpdated: new Date().toISOString(),
      };

      this.saveProfileForRobot(fullProfile);
      return { profile: fullProfile };
    } catch (e: any) {
      return { profile: null, error: `Lỗi phân tích cú pháp JSON: ${e.message}` };
    }
  }

  /**
   * Applies motor constraints (max torque, friction) onto RNE InertialParameters
   */
  public static applyProfileToInertiaList(
    inertiaList: InertialParameters[],
    profile: RobotDynamicsProfile
  ): InertialParameters[] {
    return inertiaList.map((item, idx) => {
      const motorCfg = profile.joints[idx];
      if (!motorCfg) return item;
      return {
        ...item,
        maxTorque: motorCfg.maxTorque,
        viscousFriction: motorCfg.viscousFriction,
        coulombFriction: motorCfg.coulombFriction,
      };
    });
  }
}
