import { MotorDynamicState } from './motor';
import { DCBusDynamicState } from './powerConverter';

export interface InertialParameters {
  mass: number; // kg
  com: [number, number, number]; // [x, y, z] in meters from link frame
  inertia: [
    [number, number, number],
    [number, number, number],
    [number, number, number]
  ]; // 3x3 inertia matrix kg.m^2 about link COM
  viscousFriction: number; // N.m.s/rad
  coulombFriction: number; // N.m
  maxTorque: number; // N.m (peak motor rated torque)
}

export type ControllerType =
  | 'gravity-pd'
  | 'computed-torque'
  | 'cartesian-impedance'
  | 'sliding-mode'
  | (string & {});

export type SMCSwitchingFunction = 'sign' | 'boundary-layer' | 'tanh' | 'super-twisting';

export interface SMCSettings {
  lambda: number[]; // Sliding surface slope (rad/s), e.g. [15, 15, 15, 20, 20, 20]
  switchingGain: number[]; // K_switch (N.m) robust gain
  boundaryLayer: number[]; // Phi boundary layer thickness
  switchingFunction: SMCSwitchingFunction;
}

export interface DynamicSample {
  time: number; // s
  qDeg: number[]; // deg
  qdDeg: number[]; // deg/s
  qddDeg: number[]; // deg/s^2
  qDesiredDeg: number[]; // deg
  errorDeg: number[]; // deg
  errorDotDeg?: number[]; // deg/s (for Phase Plane analysis)
  slidingSurface?: number[]; // s(t) = e_dot + lambda * e
  tau: number[]; // N.m applied
  tauGravity: number[]; // N.m
  tauInertia: number[]; // N.m
  tauCoriolis: number[]; // N.m
  kineticEnergy: number; // Joules
  potentialEnergy: number; // Joules
  totalEnergy: number; // Joules
  motorStates?: MotorDynamicState[]; // Electromechanical actuator drive states
  dcBusState?: DCBusDynamicState; // Shared DC bus & inverter power electronics states
}

export interface ControllerGains {
  kp: number[]; // Proportional gains for each joint
  kd: number[]; // Derivative gains for each joint
}

export interface DynamicsSettings {
  controllerType: ControllerType;
  isRunning: boolean;
  timeStep: number; // s (e.g. 0.002 = 500Hz)
  gravityAcc: number; // m/s^2 (e.g. 9.81)
  payloadMass: number; // kg additional load at end-effector
  externalForce: [number, number, number]; // [Fx, Fy, Fz] in Newtons at TCP
  gains: ControllerGains;
  smcSettings: SMCSettings;
  autoExportCSVOnStop?: boolean; // Automatically export scientific benchmark CSV on simulation stop
}
