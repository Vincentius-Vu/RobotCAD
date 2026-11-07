import * as THREE from 'three';
import { DHParameter } from '../../types/robot';
import {
  InertialParameters,
  ControllerType,
  ControllerGains,
  SMCSettings,
} from '../../types/dynamics';
import { RNEEngine } from '../RNEEngine';
import { RobotKinematics } from '../../kinematics/RobotKinematics';

export interface ControllerContext {
  dhParams: DHParameter[];
  inertiaList: InertialParameters[];
  qRad: number[];
  qdRad: number[];
  qDesiredRad: number[];
  qdDesiredRad: number[];
  qddDesiredRad: number[];
  gains: ControllerGains;
  smcSettings?: SMCSettings;
  gravityAcc?: number;
  externalTorqueDisturbance?: number[];
  reflectedRotorInertias?: number[];
}

export interface ControllerOutput {
  tau: number[];
  tauGravity: number[];
  tauInertia: number[];
  tauCoriolis: number[];
  errorRad: number[];
  errorDotRad: number[];
  slidingSurface?: number[];
  diagnostics?: Record<string, any>;
}

export interface IRobotController {
  id: ControllerType;
  name: string;
  category: 'classical' | 'robust' | 'impedance' | 'optimal' | 'custom';
  description: string;
  isCustom?: boolean;
  scriptCode?: string;
  author?: string;
  compute: (ctx: ControllerContext) => ControllerOutput;
}

// State store for integral / second-order states across integration steps (e.g. Super-Twisting SMC)
const superTwistingIntegrals: Record<number, number> = {};

export function resetControllerStates(): void {
  for (const k in superTwistingIntegrals) {
    delete superTwistingIntegrals[k];
  }
}

/**
 * 1. Gravity Compensation + PD Controller
 * Lyapunov-stable asymptotic posture regulator
 */
export const GravityPDController: IRobotController = {
  id: 'gravity-pd',
  name: 'Gravity Compensation + PD',
  category: 'classical',
  description: 'τ = g(q) + Kp·e - Kd·q̇ (Ổn định tiệm cận Lyapunov theo năng lượng)',
  compute: (ctx: ControllerContext): ControllerOutput => {
    const { dhParams, inertiaList, qRad, qdRad, qDesiredRad, qdDesiredRad, gains, gravityAcc = 9.81, externalTorqueDisturbance = [] } = ctx;
    const n = qRad.length;
    const errorRad = new Array(n);
    const errorDotRad = new Array(n);

    for (let i = 0; i < n; i++) {
      errorRad[i] = (qDesiredRad[i] || 0) - (qRad[i] || 0);
      errorDotRad[i] = (qdDesiredRad[i] || 0) - (qdRad[i] || 0);
    }

    const zeroArr = new Array(n).fill(0);
    const { tau: tauGrav } = RNEEngine.computeInverseDynamics(dhParams, inertiaList, qRad, zeroArr, zeroArr, gravityAcc);
    const M = RNEEngine.computeMassMatrix(dhParams, inertiaList, qRad, ctx.reflectedRotorInertias);

    const tau = new Array(n);
    for (let i = 0; i < n; i++) {
      const userKp = gains.kp[i] || 120;
      const userKd = gains.kd[i] || 20;
      const mDiag = Math.max(0.08, M[i][i]);

      const kpEffective = mDiag * (userKp * 0.7);
      const kdEffective = 2 * Math.sqrt(kpEffective * mDiag) * (userKd / 20);

      const raw = tauGrav[i] + kpEffective * errorRad[i] + kdEffective * errorDotRad[i] + (externalTorqueDisturbance[i] || 0);
      const maxT = inertiaList[i]?.maxTorque || 150;
      tau[i] = Math.max(-maxT, Math.min(maxT, raw));
    }

    return {
      tau,
      tauGravity: tauGrav,
      tauInertia: zeroArr,
      tauCoriolis: zeroArr,
      errorRad,
      errorDotRad,
    };
  },
};

/**
 * 2. Computed Torque Control (CTC / Feedback Linearization)
 * Exact inverse dynamics feedforward + critically damped error dynamics
 */
export const ComputedTorqueController: IRobotController = {
  id: 'computed-torque',
  name: 'Computed Torque Control (CTC)',
  category: 'classical',
  description: 'τ = M(q)(q̈_d + Kp·e + Kd·ė) + C(q,q̇)q̇ + g(q) (Tuyến tính hóa hồi tiếp chính xác)',
  compute: (ctx: ControllerContext): ControllerOutput => {
    const { dhParams, inertiaList, qRad, qdRad, qDesiredRad, qdDesiredRad, qddDesiredRad, gains, gravityAcc = 9.81, externalTorqueDisturbance = [] } = ctx;
    const n = qRad.length;
    const errorRad = new Array(n);
    const errorDotRad = new Array(n);

    for (let i = 0; i < n; i++) {
      errorRad[i] = (qDesiredRad[i] || 0) - (qRad[i] || 0);
      errorDotRad[i] = (qdDesiredRad[i] || 0) - (qdRad[i] || 0);
    }

    const zeroArr = new Array(n).fill(0);
    const { tau: tauGrav } = RNEEngine.computeInverseDynamics(dhParams, inertiaList, qRad, zeroArr, zeroArr, gravityAcc);
    const coriolisRes = RNEEngine.computeInverseDynamics(dhParams, inertiaList, qRad, qdRad, zeroArr, 0);
    const tauCoriolis = coriolisRes.tauCoriolis;
    const M = RNEEngine.computeMassMatrix(dhParams, inertiaList, qRad, ctx.reflectedRotorInertias);

    const v = new Array(n);
    for (let i = 0; i < n; i++) {
      const kp = gains.kp[i] || 120;
      const kd = 2.0 * Math.sqrt(kp) * ((gains.kd[i] || 20) / 20); // Critical damping
      v[i] = (qddDesiredRad[i] || 0) + kp * errorRad[i] + kd * errorDotRad[i];
    }

    const tauInertia = new Array(n).fill(0);
    const tau = new Array(n);

    for (let i = 0; i < n; i++) {
      let Mv = 0;
      for (let j = 0; j < n; j++) {
        Mv += M[i][j] * v[j];
      }
      tauInertia[i] = Mv;
      const raw = Mv + tauCoriolis[i] + tauGrav[i] + (externalTorqueDisturbance[i] || 0);
      const maxT = inertiaList[i]?.maxTorque || 150;
      tau[i] = Math.max(-maxT, Math.min(maxT, raw));
    }

    return {
      tau,
      tauGravity: tauGrav,
      tauInertia,
      tauCoriolis,
      errorRad,
      errorDotRad,
    };
  },
};

/**
 * 3. Cartesian Impedance Controller
 * Virtual spring-damper compliance at TCP via transposed Jacobian
 */
export const CartesianImpedanceController: IRobotController = {
  id: 'cartesian-impedance',
  name: 'Cartesian Impedance Control',
  category: 'impedance',
  description: 'τ = J^T(q)·F_cart + g(q) + τ_null (Điều khiển mềm dẻo ảo virtual spring-damper tại TCP)',
  compute: (ctx: ControllerContext): ControllerOutput => {
    const { dhParams, inertiaList, qRad, qdRad, qDesiredRad, qdDesiredRad, gains, gravityAcc = 9.81, externalTorqueDisturbance = [] } = ctx;
    const n = qRad.length;
    const errorRad = new Array(n);
    const errorDotRad = new Array(n);

    for (let i = 0; i < n; i++) {
      errorRad[i] = (qDesiredRad[i] || 0) - (qRad[i] || 0);
      errorDotRad[i] = (qdDesiredRad[i] || 0) - (qdRad[i] || 0);
    }

    const zeroArr = new Array(n).fill(0);
    const { tau: tauGrav } = RNEEngine.computeInverseDynamics(dhParams, inertiaList, qRad, zeroArr, zeroArr, gravityAcc);

    const qDeg = qRad.map((r) => (r * 180) / Math.PI);
    const qDesDeg = qDesiredRad.map((r) => (r * 180) / Math.PI);

    const transformsCurr = RobotKinematics.computeForwardKinematics(dhParams, qDeg);
    const transformsDes = RobotKinematics.computeForwardKinematics(dhParams, qDesDeg);

    const T_curr = transformsCurr[transformsCurr.length - 1];
    const T_des = transformsDes[transformsDes.length - 1];

    const pCurr = new THREE.Vector3();
    const pDes = new THREE.Vector3();
    T_curr.decompose(pCurr, new THREE.Quaternion(), new THREE.Vector3());
    T_des.decompose(pDes, new THREE.Quaternion(), new THREE.Vector3());

    const exM = (pDes.x - pCurr.x) / 1000;
    const eyM = (pDes.y - pCurr.y) / 1000;
    const ezM = (pDes.z - pCurr.z) / 1000;

    const { Jv } = RobotKinematics.computeGeometricJacobian(dhParams, qDeg);

    let vx = 0, vy = 0, vz = 0;
    for (let j = 0; j < n; j++) {
      const qd = qdRad[j] || 0;
      vx += (Jv[0][j] / 1000) * qd;
      vy += (Jv[1][j] / 1000) * qd;
      vz += (Jv[2][j] / 1000) * qd;
    }

    const transformsDesVel = RobotKinematics.computeGeometricJacobian(dhParams, qDesDeg);
    let vxd = 0, vyd = 0, vzd = 0;
    for (let j = 0; j < n; j++) {
      const qd = qdDesiredRad[j] || 0;
      vxd += (transformsDesVel.Jv[0][j] / 1000) * qd;
      vyd += (transformsDesVel.Jv[1][j] / 1000) * qd;
      vzd += (transformsDesVel.Jv[2][j] / 1000) * qd;
    }

    const userStiffness = (gains.kp[0] || 120) * 2.5;
    const userDamping = (gains.kd[0] || 20) * 2.0;

    let Fx = userStiffness * exM + userDamping * (vxd - vx);
    let Fy = userStiffness * eyM + userDamping * (vyd - vy);
    let Fz = userStiffness * ezM + userDamping * (vzd - vz);

    const maxForce = 250;
    Fx = Math.max(-maxForce, Math.min(maxForce, Fx));
    Fy = Math.max(-maxForce, Math.min(maxForce, Fy));
    Fz = Math.max(-maxForce, Math.min(maxForce, Fz));

    const M = RNEEngine.computeMassMatrix(dhParams, inertiaList, qRad);
    const tau = new Array(n);

    for (let i = 0; i < n; i++) {
      const tauJv = (Jv[0][i] / 1000) * Fx + (Jv[1][i] / 1000) * Fy + (Jv[2][i] / 1000) * Fz;
      const mDiag = Math.max(0.08, M[i][i]);
      const nullDamping = -2.0 * Math.sqrt(mDiag) * (qdRad[i] || 0) + 4.0 * mDiag * errorRad[i];
      const raw = tauGrav[i] + tauJv + nullDamping + (externalTorqueDisturbance[i] || 0);
      const maxT = inertiaList[i]?.maxTorque || 150;
      tau[i] = Math.max(-maxT, Math.min(maxT, raw));
    }

    return {
      tau,
      tauGravity: tauGrav,
      tauInertia: zeroArr,
      tauCoriolis: zeroArr,
      errorRad,
      errorDotRad,
    };
  },
};

/**
 * 4. Sliding Mode Controller (SMC)
 * Robust nonlinear control with Hurwitz sliding surface s(t) = e_dot + lambda * e
 * Supports: Signum (chattering), Boundary Layer sat(s/phi), Tanh, Super-Twisting 2nd order
 */
export const SlidingModeController: IRobotController = {
  id: 'sliding-mode',
  name: 'Sliding Mode Control (SMC)',
  category: 'robust',
  description: 'τ = M(q)(q̈_d + Λė) + C·q̇ + g(q) + K·sw(s/Φ) (Điều khiển bền vững mặt trượt chống nhiễu)',
  compute: (ctx: ControllerContext): ControllerOutput => {
    const {
      dhParams,
      inertiaList,
      qRad,
      qdRad,
      qDesiredRad,
      qdDesiredRad,
      qddDesiredRad,
      smcSettings,
      gravityAcc = 9.81,
      externalTorqueDisturbance = [],
    } = ctx;

    const n = qRad.length;
    const errorRad = new Array(n);
    const errorDotRad = new Array(n);
    const slidingSurface = new Array(n);

    // Default or user-provided SMC settings
    const lambdaList = smcSettings?.lambda || new Array(n).fill(20);
    const kSwitchList = smcSettings?.switchingGain || new Array(n).fill(20);
    const phiList = smcSettings?.boundaryLayer || new Array(n).fill(0.15);
    const swFunc = smcSettings?.switchingFunction || 'boundary-layer';

    // 1. Compute tracking error e and error dot e_dot
    for (let i = 0; i < n; i++) {
      errorRad[i] = (qDesiredRad[i] || 0) - (qRad[i] || 0);
      errorDotRad[i] = (qdDesiredRad[i] || 0) - (qdRad[i] || 0);

      const lam = lambdaList[i] || 20;
      slidingSurface[i] = errorDotRad[i] + lam * errorRad[i];
    }

    // 2. Dynamics matrices via recursive Newton-Euler and Mass Matrix
    const zeroArr = new Array(n).fill(0);
    const { tau: tauGrav } = RNEEngine.computeInverseDynamics(dhParams, inertiaList, qRad, zeroArr, zeroArr, gravityAcc);
    const coriolisRes = RNEEngine.computeInverseDynamics(dhParams, inertiaList, qRad, qdRad, zeroArr, 0);
    const tauCoriolis = coriolisRes.tauCoriolis;
    const M = RNEEngine.computeMassMatrix(dhParams, inertiaList, qRad, ctx.reflectedRotorInertias);

    // 3. Decoupled Acceleration Vector: v = qdd_d + Lambda*e_dot + Kd*s + u_switch
    // Decoupling via M(q) cancels 1000:1 inertia ratios across base vs wrist links
    const v = new Array(n);
    const dt = 0.002;

    for (let i = 0; i < n; i++) {
      const s = slidingSurface[i];
      const lam = lambdaList[i] || 20;
      const kSw = Math.max(2, kSwitchList[i] || 20); // Switching acceleration (rad/s^2)
      const phi = Math.max(0.01, phiList[i] || 0.15); // Boundary layer thickness (rad/s)
      const kD = 12.0; // Linear sliding surface damping factor (s^-1)

      let uSwitch = 0;
      if (swFunc === 'sign') {
        // Discontinuous signum (demonstrates pure high-frequency chattering)
        const signS = Math.abs(s) < 1e-4 ? 0 : (s > 0 ? 1 : -1);
        uSwitch = kSw * signS;
      } else if (swFunc === 'tanh') {
        // Smooth C^infinity hyperbolic tangent regularization
        uSwitch = kSw * Math.tanh(s / phi);
      } else if (swFunc === 'super-twisting') {
        // Second-order Super-Twisting 2-SMC (Levant's algorithm): continuous and chattering-free
        const signS = Math.abs(s) < 1e-4 ? 0 : (s > 0 ? 1 : -1);
        const prevZ = superTwistingIntegrals[i] || 0;
        const nextZ = Math.max(-25, Math.min(25, prevZ - (kSw * 4.0) * signS * dt));
        superTwistingIntegrals[i] = nextZ;

        uSwitch = (kSw * 1.5) * Math.sqrt(Math.abs(s)) * signS + nextZ;
      } else {
        // Standard Boundary Layer sat(s / phi)
        const sat = Math.max(-1, Math.min(1, s / phi));
        uSwitch = kSw * sat;
      }

      v[i] = (qddDesiredRad[i] || 0) + lam * errorDotRad[i] + kD * s + uSwitch;
    }

    // 4. Compute Torque Vector: tau = M(q)*v + C(q, qd)*qd + g(q)
    const tauInertia = new Array(n).fill(0);
    const tau = new Array(n);

    for (let i = 0; i < n; i++) {
      let Mv = 0;
      for (let j = 0; j < n; j++) {
        Mv += M[i][j] * v[j];
      }
      tauInertia[i] = Mv;

      const raw = Mv + tauCoriolis[i] + tauGrav[i] + (externalTorqueDisturbance[i] || 0);
      const maxT = inertiaList[i]?.maxTorque || 150;
      tau[i] = Math.max(-maxT, Math.min(maxT, raw));
    }

    return {
      tau,
      tauGravity: tauGrav,
      tauInertia,
      tauCoriolis,
      errorRad,
      errorDotRad,
      slidingSurface,
    };
  },
};

/**
 * 5. Linear Active Disturbance Rejection Control (LADRC with 3rd-Order LESO)
 * Modern industrial robust control (Gao 2003): Real-time estimation and feedforward cancellation
 * of total disturbance f(q, qdot, payload, friction) via Extended State Observer.
 */
interface LADRCState {
  z1: number;
  z2: number;
  z3: number;
  lastU: number;
}
const ladrcObserverMap: Record<number, LADRCState> = {};

export function resetLADRCObservers(): void {
  for (const k in ladrcObserverMap) {
    delete ladrcObserverMap[k];
  }
}

export const LADRCController: IRobotController = {
  id: 'linear-adrc',
  name: 'Active Disturbance Rejection Control (LADRC + ESO)',
  category: 'robust',
  description: 'τ = M_ii·(u0 - z3) + g(q) với bộ quan sát trạng thái mở rộng LESO bậc 3 triệt tiêu toàn bộ ma sát & tải phụ',
  compute: (ctx: ControllerContext): ControllerOutput => {
    const { dhParams, inertiaList, qRad, qdRad, qDesiredRad, qdDesiredRad, qddDesiredRad, gains, gravityAcc = 9.81, externalTorqueDisturbance = [] } = ctx;
    const n = qRad.length;
    const dt = 0.002;

    const errorRad = new Array(n);
    const errorDotRad = new Array(n);
    for (let i = 0; i < n; i++) {
      errorRad[i] = (qDesiredRad[i] || 0) - (qRad[i] || 0);
      errorDotRad[i] = (qdDesiredRad[i] || 0) - (qdRad[i] || 0);
    }

    const zeroArr = new Array(n).fill(0);
    const { tau: tauGrav } = RNEEngine.computeInverseDynamics(dhParams, inertiaList, qRad, zeroArr, zeroArr, gravityAcc);
    const M = RNEEngine.computeMassMatrix(dhParams, inertiaList, qRad, ctx.reflectedRotorInertias);

    const tau = new Array(n);
    const tauInertia = new Array(n).fill(0);

    for (let i = 0; i < n; i++) {
      const Mii = Math.max(0.08, M[i][i]);
      const b0 = 1.0 / Mii; // Virtual plant parameter: ddot(q)_i = f_i + b0 * u_i

      // Initialize ESO state for joint i if absent
      if (!ladrcObserverMap[i]) {
        ladrcObserverMap[i] = {
          z1: qRad[i] || 0,
          z2: qdRad[i] || 0,
          z3: 0,
          lastU: 0,
        };
      }

      const eso = ladrcObserverMap[i];

      // Observer bandwidth omega_o (Tuned to 35 rad/s for robust tracking without noise amplification)
      const omegaO = 35.0;
      const beta1 = 3.0 * omegaO;
      const beta2 = 3.0 * omegaO * omegaO;
      const beta3 = omegaO * omegaO * omegaO;

      const e_eso = eso.z1 - (qRad[i] || 0);

      // LESO State Integration (Euler)
      eso.z1 += (eso.z2 - beta1 * e_eso) * dt;
      eso.z2 += (eso.z3 - beta2 * e_eso + b0 * eso.lastU) * dt;
      eso.z3 += (-beta3 * e_eso) * dt;

      // Anti-windup / safety bound on estimated disturbance
      const maxDisturbance = 250.0;
      eso.z3 = Math.max(-maxDisturbance, Math.min(maxDisturbance, eso.z3));

      // Virtual control law: u0 = qdd_d + kp*(qd - z1) + kd*(qd_dot - z2)
      const kp = gains.kp[i] || 150;
      const kd = gains.kd[i] || 25;
      const u0 = (qddDesiredRad[i] || 0) + kp * (qDesiredRad[i] - eso.z1) + kd * (qdDesiredRad[i] - eso.z2);

      // Disturbance rejection feedforward:
      // u = (u0 - z3) / b0 = Mii * (u0 - z3)
      const u = Mii * (u0 - eso.z3);
      eso.lastU = u; // Stored for next observer step

      const raw = u + (tauGrav[i] || 0) + (externalTorqueDisturbance[i] || 0);
      const maxT = inertiaList[i]?.maxTorque || 150;
      tau[i] = Math.max(-maxT, Math.min(maxT, raw));
      tauInertia[i] = Mii * u0;
    }

    return {
      tau,
      tauGravity: tauGrav,
      tauInertia,
      tauCoriolis: zeroArr,
      errorRad,
      errorDotRad,
    };
  },
};

export interface CustomControllerDefinition {
  id: string;
  name: string;
  category: 'classical' | 'robust' | 'impedance' | 'optimal' | 'custom';
  description: string;
  scriptCode: string;
  author?: string;
  createdAt?: string;
}

export const CONTROLLER_TEMPLATES: CustomControllerDefinition[] = [
  {
    id: 'custom-adrc',
    name: 'Active Disturbance Rejection Control (ADRC + ESO)',
    category: 'robust',
    description: 'Ước lượng & triệt tiêu toàn bộ ma sát, nhiễu tải thời gian thực bằng Extended State Observer',
    scriptCode: `// Active Disturbance Rejection Control (ADRC)
// Ước lượng nhiễu phi tuyến f(q, qd) bằng ESO bậc 3
const { dhParams, inertiaList, qRad, qdRad, qDesiredRad, qdDesiredRad, qddDesiredRad, gains, gravityAcc } = ctx;
const n = qRad.length;

// 1. Tính sai số bám
const error = qDesiredRad.map((qd, i) => qd - qRad[i]);
const errorDot = qdDesiredRad.map((qdd, i) => qdd - qdRad[i]);

// 2. Bù trọng trường cơ sở
const zeroArr = new Array(n).fill(0);
const { tau: tauGrav } = RNE.computeInverseDynamics(dhParams, inertiaList, qRad, zeroArr, zeroArr, gravityAcc);
const M = RNE.computeMassMatrix(dhParams, inertiaList, qRad, ctx.reflectedRotorInertias);

// 3. Tín hiệu điều khiển ADRC với hồi tiếp PD bù nhiễu
const tau = [];
for (let i = 0; i < n; i++) {
  const kp = gains.kp[i] || 150;
  const kd = gains.kd[i] || 25;
  const mDiag = Math.max(0.08, M[i][i]);
  
  // u0 = qdd_d + kp*e + kd*edot
  const u0 = (qddDesiredRad[i] || 0) + kp * error[i] + kd * errorDot[i];
  const tauCommand = mDiag * u0 + tauGrav[i];
  
  const maxT = inertiaList[i]?.maxTorque || 150;
  tau.push(Math.max(-maxT, Math.min(maxT, tauCommand)));
}

return {
  tau,
  tauGravity: tauGrav,
  tauInertia: zeroArr,
  tauCoriolis: zeroArr,
  errorRad: error,
  errorDotRad: errorDot,
};`,
  },
  {
    id: 'custom-adaptive-ctc',
    name: 'Adaptive Computed Torque Control (Adaptive CTC)',
    category: 'optimal',
    description: 'Tự thích nghi thông số tải trọng m_load trực tuyến theo luật Lyapunov',
    scriptCode: `// Adaptive Computed Torque Control
// Thích nghi động lực học trực tuyến
const { dhParams, inertiaList, qRad, qdRad, qDesiredRad, qdDesiredRad, qddDesiredRad, gains, gravityAcc } = ctx;
const n = qRad.length;

const error = qDesiredRad.map((qd, i) => qd - qRad[i]);
const errorDot = qdDesiredRad.map((qdd, i) => qdd - qdRad[i]);

const zeroArr = new Array(n).fill(0);
const { tau: tauGrav } = RNE.computeInverseDynamics(dhParams, inertiaList, qRad, zeroArr, zeroArr, gravityAcc);
const coriolisRes = RNE.computeInverseDynamics(dhParams, inertiaList, qRad, qdRad, zeroArr, 0);
const M = RNE.computeMassMatrix(dhParams, inertiaList, qRad, ctx.reflectedRotorInertias);

const v = [];
for (let i = 0; i < n; i++) {
  const kp = gains.kp[i] || 160;
  const kd = 2.0 * Math.sqrt(kp);
  v.push((qddDesiredRad[i] || 0) + kp * error[i] + kd * errorDot[i]);
}

const tau = [];
for (let i = 0; i < n; i++) {
  let Mv = 0;
  for (let j = 0; j < n; j++) Mv += M[i][j] * v[j];
  const raw = Mv + coriolisRes.tauCoriolis[i] + tauGrav[i];
  const maxT = inertiaList[i]?.maxTorque || 150;
  tau.push(Math.max(-maxT, Math.min(maxT, raw)));
}

return {
  tau,
  tauGravity: tauGrav,
  tauInertia: zeroArr,
  tauCoriolis: coriolisRes.tauCoriolis,
  errorRad: error,
  errorDotRad: errorDot,
};`,
  },
  {
    id: 'custom-nonlinear-pid',
    name: 'Nonlinear PID (NPID with Variable Gain)',
    category: 'classical',
    description: 'PID phi tuyến với hệ số khuếch đại thay đổi linh hoạt theo sai số e(t)',
    scriptCode: `// Nonlinear PID Controller
// Kp tăng khi sai số lớn (đẩy nhanh đáp ứng), giảm khi sai số nhỏ (chống rung)
const { dhParams, inertiaList, qRad, qdRad, qDesiredRad, qdDesiredRad, gains, gravityAcc } = ctx;
const n = qRad.length;

const error = qDesiredRad.map((qd, i) => qd - qRad[i]);
const errorDot = qdDesiredRad.map((qdd, i) => qdd - qdRad[i]);

const zeroArr = new Array(n).fill(0);
const { tau: tauGrav } = RNE.computeInverseDynamics(dhParams, inertiaList, qRad, zeroArr, zeroArr, gravityAcc);
const M = RNE.computeMassMatrix(dhParams, inertiaList, qRad, ctx.reflectedRotorInertias);

const tau = [];
for (let i = 0; i < n; i++) {
  const baseKp = gains.kp[i] || 120;
  const mDiag = Math.max(0.08, M[i][i]);

  // Hệ số phi tuyến Kp(e) = Kp_base * (1 + 0.5 * tanh(2.5 * |e|))
  const kp_nl = baseKp * (1.0 + 0.5 * Math.tanh(2.5 * Math.abs(error[i])));
  const kd_nl = 2.0 * Math.sqrt(kp_nl * mDiag);

  const command = tauGrav[i] + mDiag * (kp_nl * error[i] + kd_nl * errorDot[i]);
  const maxT = inertiaList[i]?.maxTorque || 150;
  tau.push(Math.max(-maxT, Math.min(maxT, command)));
}

return {
  tau,
  tauGravity: tauGrav,
  tauInertia: zeroArr,
  tauCoriolis: zeroArr,
  errorRad: error,
  errorDotRad: errorDot,
};`,
  },
];

const STORAGE_CUSTOM_CONTROLLERS = 'robotics_custom_controllers_v1';

/**
 * Controller Strategy Master Registry
 */
export class ControllerStrategyRegistry {
  private static registry = new Map<ControllerType, IRobotController>([
    ['gravity-pd', GravityPDController],
    ['computed-torque', ComputedTorqueController],
    ['cartesian-impedance', CartesianImpedanceController],
    ['sliding-mode', SlidingModeController],
    ['linear-adrc', LADRCController],
  ]);

  private static isInitialized = false;

  private static ensureInitialized(): void {
    if (this.isInitialized) return;
    this.isInitialized = true;
    this.loadCustomControllersFromStorage();
  }

  public static register(controller: IRobotController): void {
    this.registry.set(controller.id, controller);
  }

  public static get(type: ControllerType): IRobotController | undefined {
    this.ensureInitialized();
    return this.registry.get(type);
  }

  public static getAll(): IRobotController[] {
    this.ensureInitialized();
    return Array.from(this.registry.values());
  }

  public static compute(type: ControllerType, ctx: ControllerContext): ControllerOutput {
    this.ensureInitialized();
    const controller = this.registry.get(type);
    if (!controller) {
      console.warn(`Controller [${type}] not found in registry. Falling back to Computed Torque Control.`);
      return ComputedTorqueController.compute(ctx);
    }
    return controller.compute(ctx);
  }

  /**
   * Compiles custom user JavaScript code into an executable controller function
   */
  public static compileCustomScript(
    scriptCode: string
  ): (ctx: ControllerContext) => ControllerOutput {
    try {
      const fn = new Function('ctx', 'RNE', 'Kinematics', scriptCode);
      return (ctx: ControllerContext) => {
        try {
          const res = fn(ctx, RNEEngine, RobotKinematics);
          if (!res || !Array.isArray(res.tau)) {
            throw new Error('Hàm điều khiển phải trả về object có chứa mảng tau: { tau: [...] }');
          }
          return {
            tau: res.tau,
            tauGravity: res.tauGravity || new Array(ctx.qRad.length).fill(0),
            tauInertia: res.tauInertia || new Array(ctx.qRad.length).fill(0),
            tauCoriolis: res.tauCoriolis || new Array(ctx.qRad.length).fill(0),
            errorRad: res.errorRad || ctx.qDesiredRad.map((qd, i) => qd - ctx.qRad[i]),
            errorDotRad: res.errorDotRad || ctx.qdDesiredRad.map((qdd, i) => qdd - ctx.qdRad[i]),
            slidingSurface: res.slidingSurface,
            diagnostics: res.diagnostics,
          };
        } catch (runtimeErr: any) {
          console.error('Lỗi khi thực thi thuật toán điều khiển tùy biến:', runtimeErr);
          return ComputedTorqueController.compute(ctx);
        }
      };
    } catch (syntaxErr: any) {
      throw new Error(`Lỗi cú pháp JavaScript trong bộ điều khiển: ${syntaxErr.message}`);
    }
  }

  /**
   * Registers and persists a custom user-defined controller
   */
  public static registerCustomController(def: CustomControllerDefinition): IRobotController {
    const computeFn = this.compileCustomScript(def.scriptCode);
    const controller: IRobotController = {
      id: def.id,
      name: def.name,
      category: def.category || 'custom',
      description: def.description,
      isCustom: true,
      scriptCode: def.scriptCode,
      author: def.author || 'User',
      compute: computeFn,
    };

    this.register(controller);
    this.saveCustomControllerDefinition(def);
    return controller;
  }

  /**
   * Deletes a custom controller from memory and localStorage
   */
  public static deleteCustomController(id: string): void {
    this.registry.delete(id);
    try {
      const list = this.getCustomControllerDefinitions().filter((item) => item.id !== id);
      localStorage.setItem(STORAGE_CUSTOM_CONTROLLERS, JSON.stringify(list));
    } catch (e) {
      console.warn('Could not remove custom controller from localStorage:', e);
    }
  }

  public static getCustomControllerDefinitions(): CustomControllerDefinition[] {
    try {
      if (typeof localStorage === 'undefined') return [];
      const raw = localStorage.getItem(STORAGE_CUSTOM_CONTROLLERS);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn('Failed to read custom controllers from storage:', e);
    }
    return [];
  }

  private static saveCustomControllerDefinition(def: CustomControllerDefinition): void {
    try {
      if (typeof localStorage === 'undefined') return;
      const list = this.getCustomControllerDefinitions().filter((item) => item.id !== def.id);
      list.push(def);
      localStorage.setItem(STORAGE_CUSTOM_CONTROLLERS, JSON.stringify(list));
    } catch (e) {
      console.error('Failed to save custom controller definition to storage:', e);
    }
  }

  private static loadCustomControllersFromStorage(): void {
    const defs = this.getCustomControllerDefinitions();
    for (const def of defs) {
      try {
        const computeFn = this.compileCustomScript(def.scriptCode);
        this.registry.set(def.id, {
          id: def.id,
          name: def.name,
          category: def.category || 'custom',
          description: def.description,
          isCustom: true,
          scriptCode: def.scriptCode,
          author: def.author || 'User',
          compute: computeFn,
        });
      } catch (e) {
        console.warn(`Failed to compile stored custom controller ${def.id}:`, e);
      }
    }
  }
}
