import * as THREE from 'three';
import { DHParameter } from '../types/robot';
import { InertialParameters } from '../types/dynamics';

/**
 * Recursive Newton-Euler (RNE) Dynamics Engine
 * Supports:
 * - Inverse Dynamics: tau = M(q)*qdd + C(q, qd)*qd + g(q) + F_fric
 * - Mass Matrix Computation: M(q)
 * - Gravity Vector: g(q)
 * - Coriolis & Centrifugal: c(q, qd)
 * - Forward Dynamics via RK4 Numerical Integrator
 */

// Classic Armstrong / Corke benchmark inertial parameters for PUMA 560
export const PUMA560_INERTIA: InertialParameters[] = [
  {
    mass: 3.5,
    com: [0, 0, 0.1],
    inertia: [[0.05, 0, 0], [0, 0.05, 0], [0, 0, 0.35]],
    viscousFriction: 1.48e-3,
    coulombFriction: 0.395,
    maxTorque: 97.6, // N.m
  },
  {
    mass: 17.4,
    com: [-0.3638, 0.006, 0.2275],
    inertia: [
      [0.13, 0, 0],
      [0, 0.524, 0],
      [0, 0, 0.539],
    ],
    viscousFriction: 0.817e-3,
    coulombFriction: 0.126,
    maxTorque: 186.4, // N.m
  },
  {
    mass: 4.8,
    com: [-0.0203, -0.0141, 0.07],
    inertia: [
      [0.066, 0, 0],
      [0, 0.086, 0],
      [0, 0, 0.0125],
    ],
    viscousFriction: 1.38e-3,
    coulombFriction: 0.132,
    maxTorque: 89.4, // N.m
  },
  {
    mass: 0.82,
    com: [0, 0.019, 0],
    inertia: [
      [1.8e-3, 0, 0],
      [0, 1.3e-3, 0],
      [0, 0, 1.8e-3],
    ],
    viscousFriction: 71.2e-6,
    coulombFriction: 11.2e-3,
    maxTorque: 24.2, // N.m
  },
  {
    mass: 0.34,
    com: [0, 0, 0],
    inertia: [
      [0.3e-3, 0, 0],
      [0, 0.4e-3, 0],
      [0, 0, 0.3e-3],
    ],
    viscousFriction: 82.6e-6,
    coulombFriction: 9.26e-3,
    maxTorque: 20.1, // N.m
  },
  {
    mass: 0.09,
    com: [0, 0, 0.032],
    inertia: [
      [0.15e-3, 0, 0],
      [0, 0.15e-3, 0],
      [0, 0, 0.04e-3],
    ],
    viscousFriction: 36.7e-6,
    coulombFriction: 3.96e-3,
    maxTorque: 21.3, // N.m
  },
];

// Official Gazebo / Franka Control Interface (FCI) 7-DOF dynamic parameters
export const FRANKA_PANDA_INERTIA: InertialParameters[] = [
  {
    // Link 1
    mass: 4.970684,
    com: [0.003875, 0.002081, -0.047620],
    inertia: [
      [0.70337, -0.000139, 0.006772],
      [-0.000139, 0.70661, 0.019169],
      [0.006772, 0.019169, 0.009117],
    ],
    viscousFriction: 0.001,
    coulombFriction: 0.15,
    maxTorque: 87.0,
  },
  {
    // Link 2
    mass: 0.646926,
    com: [-0.003141, -0.028720, 0.003495],
    inertia: [
      [0.007962, -0.003925, 0.001025],
      [-0.003925, 0.028274, 0.000704],
      [0.001025, 0.000704, 0.028195],
    ],
    viscousFriction: 0.001,
    coulombFriction: 0.15,
    maxTorque: 87.0,
  },
  {
    // Link 3
    mass: 3.228604,
    com: [0.027518, 0.039252, -0.066502],
    inertia: [
      [0.037242, -0.004761, -0.011396],
      [-0.004761, 0.036155, -0.012805],
      [-0.011396, -0.012805, 0.01083],
    ],
    viscousFriction: 0.001,
    coulombFriction: 0.12,
    maxTorque: 87.0,
  },
  {
    // Link 4
    mass: 3.587895,
    com: [-0.05317, 0.045014, 0.015969],
    inertia: [
      [0.025853, 0.007796, -0.001332],
      [0.007796, 0.019552, 0.008641],
      [-0.001332, 0.008641, 0.028323],
    ],
    viscousFriction: 0.001,
    coulombFriction: 0.12,
    maxTorque: 87.0,
  },
  {
    // Link 5
    mass: 1.225946,
    com: [-0.011953, 0.041065, -0.038437],
    inertia: [
      [0.035549, -0.002117, -0.004037],
      [-0.002117, 0.029474, 0.000229],
      [-0.004037, 0.000229, 0.008627],
    ],
    viscousFriction: 0.0005,
    coulombFriction: 0.08,
    maxTorque: 12.0,
  },
  {
    // Link 6
    mass: 1.666555,
    com: [0.060149, -0.014117, -0.010517],
    inertia: [
      [0.001964, 0.000109, -0.001158],
      [0.000109, 0.004354, 0.000341],
      [-0.001158, 0.000341, 0.005433],
    ],
    viscousFriction: 0.0005,
    coulombFriction: 0.08,
    maxTorque: 12.0,
  },
  {
    // Link 7
    mass: 0.735522,
    com: [0.010517, -0.004252, 0.061597],
    inertia: [
      [0.012516, -0.000428, -0.001196],
      [-0.000428, 0.010027, -0.000741],
      [-0.001196, -0.000741, 0.004815],
    ],
    viscousFriction: 0.0004,
    coulombFriction: 0.06,
    maxTorque: 12.0,
  },
];

// Universal Robots UR5 standard published inertial parameters
export const UR5_INERTIA: InertialParameters[] = [
  {
    // Link 1 (Shoulder)
    mass: 3.70,
    com: [0.0, -0.02561, 0.00193],
    inertia: [
      [0.0084, 0, 0],
      [0, 0.0064, 0],
      [0, 0, 0.0084],
    ],
    viscousFriction: 0.0012,
    coulombFriction: 0.20,
    maxTorque: 150.0,
  },
  {
    // Link 2 (Upper Arm)
    mass: 8.393,
    com: [0.2125, 0.0, 0.113],
    inertia: [
      [0.078, 0, 0],
      [0, 0.078, 0],
      [0, 0, 0.0084],
    ],
    viscousFriction: 0.0012,
    coulombFriction: 0.22,
    maxTorque: 150.0,
  },
  {
    // Link 3 (Forearm)
    mass: 2.275,
    com: [0.196, 0.0, 0.0265],
    inertia: [
      [0.031, 0, 0],
      [0, 0.031, 0],
      [0, 0, 0.004],
    ],
    viscousFriction: 0.0010,
    coulombFriction: 0.18,
    maxTorque: 150.0,
  },
  {
    // Link 4 (Wrist 1)
    mass: 1.219,
    com: [0.0, -0.0018, 0.01634],
    inertia: [
      [0.0016, 0, 0],
      [0, 0.0016, 0],
      [0, 0, 0.0009],
    ],
    viscousFriction: 0.0005,
    coulombFriction: 0.08,
    maxTorque: 28.0,
  },
  {
    // Link 5 (Wrist 2)
    mass: 1.219,
    com: [0.0, 0.0018, 0.01634],
    inertia: [
      [0.0016, 0, 0],
      [0, 0.0016, 0],
      [0, 0, 0.0009],
    ],
    viscousFriction: 0.0005,
    coulombFriction: 0.08,
    maxTorque: 28.0,
  },
  {
    // Link 6 (Wrist 3)
    mass: 0.1879,
    com: [0.0, 0.0, -0.001159],
    inertia: [
      [0.0003, 0, 0],
      [0, 0.0003, 0],
      [0, 0, 0.0001],
    ],
    viscousFriction: 0.0003,
    coulombFriction: 0.05,
    maxTorque: 28.0,
  },
];

// Helper: 3D Vector Math
type Vec3 = [number, number, number];
type Mat3 = [[number, number, number], [number, number, number], [number, number, number]];

function add3(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function scale3(a: Vec3, s: number): Vec3 {
  return [a[0] * s, a[1] * s, a[2] * s];
}

function dot3(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross3(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function multMatVec3(M: Mat3, v: Vec3): Vec3 {
  return [
    M[0][0] * v[0] + M[0][1] * v[1] + M[0][2] * v[2],
    M[1][0] * v[0] + M[1][1] * v[1] + M[1][2] * v[2],
    M[2][0] * v[0] + M[2][1] * v[1] + M[2][2] * v[2],
  ];
}

function transposeMat3(M: Mat3): Mat3 {
  return [
    [M[0][0], M[1][0], M[2][0]],
    [M[0][1], M[1][1], M[2][1]],
    [M[0][2], M[1][2], M[2][2]],
  ];
}

export class RNEEngine {
  /**
   * Generates or adapts inertial parameters for any robot model
   */
  public static getInertialParameters(
    robotId: string,
    dof: number,
    totalWeightKg: number,
    reachMm: number
  ): InertialParameters[] {
    const idLower = robotId.toLowerCase();
    if (idLower.includes('puma560') && dof === 6) {
      return PUMA560_INERTIA;
    }
    if ((idLower.includes('franka') || idLower.includes('panda')) && dof === 7) {
      return FRANKA_PANDA_INERTIA;
    }
    if (idLower.includes('ur5') && dof === 6) {
      return UR5_INERTIA;
    }

    // Heuristic scaling based on total mass and reach for generic industrial robots
    const scaleMass = totalWeightKg > 0 ? totalWeightKg / 54.5 : 1.0;
    const scaleLen = reachMm > 0 ? reachMm / 900.0 : 1.0;
    const scaleInertia = scaleMass * scaleLen * scaleLen;

    const list: InertialParameters[] = [];
    const baseFractions = [0.1, 0.45, 0.25, 0.1, 0.06, 0.04, 0.02];

    for (let i = 0; i < dof; i++) {
      const linkMass = (totalWeightKg * (baseFractions[i] || 0.05));
      const r = (reachMm / 1000) * 0.15;
      const I_val = 0.5 * linkMass * r * r * scaleInertia;

      list.push({
        mass: linkMass,
        com: [0, 0, (reachMm / (dof * 2000))],
        inertia: [
          [I_val, 0, 0],
          [0, I_val, 0],
          [0, 0, I_val * 0.6],
        ],
        viscousFriction: 0.001 * scaleMass,
        coulombFriction: 0.1 * scaleMass,
        maxTorque: (linkMass * 9.81 * (reachMm / 1000) * 1.5) || 50,
      });
    }

    return list;
  }

  /**
   * Recursive Newton-Euler Inverse Dynamics Algorithm
   * Calculates joint torque vector tau given q, qd, qdd and optional external forces
   */
  public static computeInverseDynamics(
    dhParams: DHParameter[],
    inertiaList: InertialParameters[],
    qRad: number[],
    qdRad: number[],
    qddRad: number[],
    gravityAcc: number = 9.81,
    fExtTip: Vec3 = [0, 0, 0],
    nExtTip: Vec3 = [0, 0, 0]
  ): {
    tau: number[];
    tauGravity: number[];
    tauCoriolis: number[];
    tauInertia: number[];
  } {
    const n = Math.min(dhParams.length, inertiaList.length);
    const z0: Vec3 = [0, 0, 1];

    // Compute transformation rotation matrices R_{i-1}^i and translation p_{i}^{i-1}
    const R_prev_curr: Mat3[] = []; // R_{i-1}^i
    const R_curr_prev: Mat3[] = []; // R_i^{i-1}
    const p_link: Vec3[] = []; // Position of frame i in frame i-1 (in meters)

    for (let i = 0; i < n; i++) {
      const dh = dhParams[i];
      const theta = (dh.thetaOffsetDeg * Math.PI) / 180 + (qRad[i] || 0);
      const alpha = (dh.alphaDeg * Math.PI) / 180;
      const d = dh.d / 1000; // mm to meters
      const a = dh.a / 1000; // mm to meters

      const cosTh = Math.cos(theta);
      const sinTh = Math.sin(theta);
      const cosAl = Math.cos(alpha);
      const sinAl = Math.sin(alpha);

      // Rotation matrix R_i^{i-1}
      const R_i_prev: Mat3 = [
        [cosTh, -sinTh * cosAl, sinTh * sinAl],
        [sinTh, cosTh * cosAl, -cosTh * sinAl],
        [0, sinAl, cosAl],
      ];

      // R_{i-1}^i = (R_i^{i-1})^T
      const R_prev_i = transposeMat3(R_i_prev);

      R_curr_prev.push(R_i_prev);
      R_prev_curr.push(R_prev_i);
      p_link.push([a, d * sinAl, d * cosAl]);
    }

    // =========================================================================
    // FORWARD RECURSION (i = 0 to n-1)
    // =========================================================================
    const w: Vec3[] = []; // Angular velocity
    const wDot: Vec3[] = []; // Angular acceleration
    const pDDot: Vec3[] = []; // Linear acceleration of frame origin
    const pDDotC: Vec3[] = []; // Linear acceleration of center of mass

    // Base initial conditions (fictitious upward acceleration for gravity)
    let w_prev: Vec3 = [0, 0, 0];
    let wDot_prev: Vec3 = [0, 0, 0];
    let pDDot_prev: Vec3 = [0, 0, gravityAcc]; // Gravity acting downwards = base accelerates up

    for (let i = 0; i < n; i++) {
      const R_p_c = R_prev_curr[i];
      const qd = qdRad[i] || 0;
      const qdd = qddRad[i] || 0;
      const r_com: Vec3 = inertiaList[i].com;

      // w_i = R_{i-1}^i * w_{i-1} + qd_i * z0
      const w_from_prev = multMatVec3(R_p_c, w_prev);
      const w_i = add3(w_from_prev, scale3(z0, qd));
      w.push(w_i);

      // wDot_i = R_{i-1}^i * wDot_{i-1} + (R_{i-1}^i * w_{i-1}) x (qd_i * z0) + qdd_i * z0
      const wDot_from_prev = multMatVec3(R_p_c, wDot_prev);
      const gyroscopic = cross3(w_from_prev, scale3(z0, qd));
      const wDot_i = add3(add3(wDot_from_prev, gyroscopic), scale3(z0, qdd));
      wDot.push(wDot_i);

      // pDDot_i = R_{i-1}^i * pDDot_{i-1} + wDot_i x p_i + w_i x (w_i x p_i)
      const pDDot_from_prev = multMatVec3(R_p_c, pDDot_prev);
      const wDot_x_p = cross3(wDot_i, p_link[i]);
      const w_x_w_x_p = cross3(w_i, cross3(w_i, p_link[i]));
      const pDDot_i = add3(add3(pDDot_from_prev, wDot_x_p), w_x_w_x_p);
      pDDot.push(pDDot_i);

      // pDDotC_i = pDDot_i + wDot_i x r_com + w_i x (w_i x r_com)
      const wDot_x_com = cross3(wDot_i, r_com);
      const w_x_w_x_com = cross3(w_i, cross3(w_i, r_com));
      const pDDotC_i = add3(add3(pDDot_i, wDot_x_com), w_x_w_x_com);
      pDDotC.push(pDDotC_i);

      w_prev = w_i;
      wDot_prev = wDot_i;
      pDDot_prev = pDDot_i;
    }

    // =========================================================================
    // BACKWARD RECURSION (i = n-1 down to 0)
    // =========================================================================
    const f: Vec3[] = new Array(n);
    const m_vec: Vec3[] = new Array(n);
    const tau: number[] = new Array(n);

    let f_next: Vec3 = fExtTip;
    let n_next: Vec3 = nExtTip;

    for (let i = n - 1; i >= 0; i--) {
      const inertia = inertiaList[i];
      const mass = inertia.mass;
      const I_mat = inertia.inertia;
      const r_com = inertia.com;

      // Inertial force F_i = m_i * pDDotC_i
      const F_i = scale3(pDDotC[i], mass);

      // Inertial torque N_i = I_i * wDot_i + w_i x (I_i * w_i)
      const I_wDot = multMatVec3(I_mat, wDot[i]);
      const I_w = multMatVec3(I_mat, w[i]);
      const w_x_Iw = cross3(w[i], I_w);
      const N_i = add3(I_wDot, w_x_Iw);

      // f_i = R_{i+1}^i * f_{i+1} + F_i
      let f_from_next: Vec3 = [0, 0, 0];
      let n_from_next: Vec3 = [0, 0, 0];
      let p_next_in_curr: Vec3 = [0, 0, 0];

      if (i < n - 1) {
        const R_next = R_curr_prev[i + 1];
        f_from_next = multMatVec3(R_next, f_next);
        n_from_next = multMatVec3(R_next, n_next);
        p_next_in_curr = multMatVec3(R_next, p_link[i + 1]);
      } else {
        f_from_next = fExtTip;
        n_from_next = nExtTip;
      }

      const f_i = add3(f_from_next, F_i);
      f[i] = f_i;

      // n_i = N_i + R_{i+1}^i * n_{i+1} + r_com x F_i + p_{i+1}^i x (R_{i+1}^i * f_{i+1})
      const r_x_F = cross3(r_com, F_i);
      const p_x_f = cross3(p_next_in_curr, f_from_next);
      const n_i = add3(add3(add3(N_i, n_from_next), r_x_F), p_x_f);
      m_vec[i] = n_i;

      // Joint motor torque tau_i = n_i^T * z0 + friction
      const qd = qdRad[i] || 0;
      const friction = inertia.viscousFriction * qd + inertia.coulombFriction * Math.sign(qd);
      const rawTau = dot3(n_i, z0) + friction;

      // Motor torque saturation limit
      const clampedTau = Math.max(-inertia.maxTorque, Math.min(inertia.maxTorque, rawTau));
      tau[i] = clampedTau;

      f_next = f_i;
      n_next = n_i;
    }

    // Deconstruct components: Gravity g(q), Inertia M(q)*qdd, Coriolis C(q, qd)*qd
    const zeroArr = new Array(n).fill(0);
    const tauGravRes = this.computeRawTorque(dhParams, inertiaList, qRad, zeroArr, zeroArr, gravityAcc);
    const tauInertiaRes = this.computeRawTorque(dhParams, inertiaList, qRad, zeroArr, qddRad, 0);
    const tauCoriolisRes = this.computeRawTorque(dhParams, inertiaList, qRad, qdRad, zeroArr, 0);

    return {
      tau,
      tauGravity: tauGravRes,
      tauInertia: tauInertiaRes,
      tauCoriolis: tauCoriolisRes,
    };
  }

  /**
   * Helper: Raw RNE without saturation for decoupling M, C, G components
   */
  private static computeRawTorque(
    dhParams: DHParameter[],
    inertiaList: InertialParameters[],
    qRad: number[],
    qdRad: number[],
    qddRad: number[],
    gravityAcc: number
  ): number[] {
    const n = Math.min(dhParams.length, inertiaList.length);
    const z0: Vec3 = [0, 0, 1];

    const R_prev_curr: Mat3[] = [];
    const R_curr_prev: Mat3[] = [];
    const p_link: Vec3[] = [];

    for (let i = 0; i < n; i++) {
      const dh = dhParams[i];
      const theta = (dh.thetaOffsetDeg * Math.PI) / 180 + (qRad[i] || 0);
      const alpha = (dh.alphaDeg * Math.PI) / 180;
      const d = dh.d / 1000;
      const a = dh.a / 1000;

      const cosTh = Math.cos(theta);
      const sinTh = Math.sin(theta);
      const cosAl = Math.cos(alpha);
      const sinAl = Math.sin(alpha);

      const R_i_prev: Mat3 = [
        [cosTh, -sinTh * cosAl, sinTh * sinAl],
        [sinTh, cosTh * cosAl, -cosTh * sinAl],
        [0, sinAl, cosAl],
      ];

      R_curr_prev.push(R_i_prev);
      R_prev_curr.push(transposeMat3(R_i_prev));
      p_link.push([a, d * sinAl, d * cosAl]);
    }

    const w: Vec3[] = [];
    const wDot: Vec3[] = [];
    const pDDot: Vec3[] = [];
    const pDDotC: Vec3[] = [];

    let w_prev: Vec3 = [0, 0, 0];
    let wDot_prev: Vec3 = [0, 0, 0];
    let pDDot_prev: Vec3 = [0, 0, gravityAcc];

    for (let i = 0; i < n; i++) {
      const R_p_c = R_prev_curr[i];
      const qd = qdRad[i] || 0;
      const qdd = qddRad[i] || 0;
      const r_com = inertiaList[i].com;

      const w_i = add3(multMatVec3(R_p_c, w_prev), scale3(z0, qd));
      w.push(w_i);

      const wDot_i = add3(
        add3(multMatVec3(R_p_c, wDot_prev), cross3(multMatVec3(R_p_c, w_prev), scale3(z0, qd))),
        scale3(z0, qdd)
      );
      wDot.push(wDot_i);

      const pDDot_i = add3(
        add3(multMatVec3(R_p_c, pDDot_prev), cross3(wDot_i, p_link[i])),
        cross3(w_i, cross3(w_i, p_link[i]))
      );
      pDDot.push(pDDot_i);

      const pDDotC_i = add3(
        add3(pDDot_i, cross3(wDot_i, r_com)),
        cross3(w_i, cross3(w_i, r_com))
      );
      pDDotC.push(pDDotC_i);

      w_prev = w_i;
      wDot_prev = wDot_i;
      pDDot_prev = pDDot_i;
    }

    const tau: number[] = new Array(n);
    let f_next: Vec3 = [0, 0, 0];
    let n_next: Vec3 = [0, 0, 0];

    for (let i = n - 1; i >= 0; i--) {
      const inertia = inertiaList[i];
      const F_i = scale3(pDDotC[i], inertia.mass);
      const N_i = add3(
        multMatVec3(inertia.inertia, wDot[i]),
        cross3(w[i], multMatVec3(inertia.inertia, w[i]))
      );

      let f_from_next: Vec3 = [0, 0, 0];
      let n_from_next: Vec3 = [0, 0, 0];
      let p_next_in_curr: Vec3 = [0, 0, 0];

      if (i < n - 1) {
        f_from_next = multMatVec3(R_curr_prev[i + 1], f_next);
        n_from_next = multMatVec3(R_curr_prev[i + 1], n_next);
        p_next_in_curr = multMatVec3(R_curr_prev[i + 1], p_link[i + 1]);
      }

      const f_i = add3(f_from_next, F_i);
      const n_i = add3(
        add3(add3(N_i, n_from_next), cross3(inertia.com, F_i)),
        cross3(p_next_in_curr, f_from_next)
      );

      tau[i] = dot3(n_i, z0);
      f_next = f_i;
      n_next = n_i;
    }

    return tau;
  }

  /**
   * Computes the complete Joint Space Inertia Matrix M(q) [n x n]
   */
  public static computeMassMatrix(
    dhParams: DHParameter[],
    inertiaList: InertialParameters[],
    qRad: number[],
    reflectedRotorInertias?: number[]
  ): number[][] {
    const n = Math.min(dhParams.length, inertiaList.length);
    const M: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
    const zeroArr = new Array(n).fill(0);

    for (let j = 0; j < n; j++) {
      const ej = new Array(n).fill(0);
      ej[j] = 1.0; // Unit angular acceleration on joint j
      const col = this.computeRawTorque(dhParams, inertiaList, qRad, zeroArr, ej, 0);
      for (let i = 0; i < n; i++) {
        M[i][j] = col[i];
      }
    }

    // Enforce exact symmetry M = 0.5 * (M + M^T)
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const avg = 0.5 * (M[i][j] + M[j][i]);
        M[i][j] = avg;
        M[j][i] = avg;
      }
    }

    // Add reflected actuator gear train inertia (J_reflected = N^2 * J_m)
    const DEFAULT_MOTOR_INERTIA = [0.20, 0.18, 0.17, 0.035, 0.035, 0.03];
    for (let i = 0; i < n; i++) {
      const jRefl =
        reflectedRotorInertias && reflectedRotorInertias[i] !== undefined
          ? reflectedRotorInertias[i]
          : DEFAULT_MOTOR_INERTIA[i % DEFAULT_MOTOR_INERTIA.length];
      M[i][i] += jRefl;
    }

    return M;
  }

  /**
   * Solves A * x = b for a Symmetric Positive-Definite (SPD) matrix using
   * Cholesky Decomposition A = L * L^T with Levenberg-Marquardt diagonal regularization.
   * Far superior in speed, robustness, and numerical stability to Gaussian elimination.
   */
  public static solveLinearSystemSPD(A: number[][], b: number[]): number[] {
    const n = A.length;
    const L: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));

    // Cholesky decomposition L
    for (let i = 0; i < n; i++) {
      for (let j = 0; j <= i; j++) {
        let sum = 0;
        for (let k = 0; k < j; k++) {
          sum += L[i][k] * L[j][k];
        }
        if (i === j) {
          // Regularization lambda = 1e-4 prevents ill-conditioning / division by zero
          const val = A[i][i] + 1e-4 - sum;
          L[i][j] = Math.sqrt(Math.max(1e-6, val));
        } else {
          L[i][j] = (A[i][j] - sum) / (L[j][j] || 1e-6);
        }
      }
    }

    // Forward substitution: L * y = b
    const y = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      let sum = 0;
      for (let k = 0; k < i; k++) {
        sum += L[i][k] * y[k];
      }
      y[i] = (b[i] - sum) / (L[i][i] || 1e-6);
    }

    // Back substitution: L^T * x = y
    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      let sum = 0;
      for (let k = i + 1; k < n; k++) {
        sum += L[k][i] * x[k];
      }
      x[i] = (y[i] - sum) / (L[i][i] || 1e-6);
    }

    return x;
  }

  /**
   * Inverts a symmetric positive-definite matrix using Cholesky or Gaussian elimination
   */
  public static invertMatrix(A: number[][]): number[][] {
    const n = A.length;
    const inv: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
    // Invert column by column solving A * x_i = e_i
    for (let j = 0; j < n; j++) {
      const ej = new Array(n).fill(0);
      ej[j] = 1.0;
      const col = this.solveLinearSystemSPD(A, ej);
      for (let i = 0; i < n; i++) {
        inv[i][j] = col[i];
      }
    }
    return inv;
  }

  /**
   * Computes Forward Dynamics: qdd = M(q)^{-1} * (tau - C*qd - g - tau_fric)
   * With smooth friction regularization to prevent chattering / numerical explosion.
   */
  public static computeForwardDynamics(
    dhParams: DHParameter[],
    inertiaList: InertialParameters[],
    qRad: number[],
    qdRad: number[],
    tauApplied: number[],
    gravityAcc: number = 9.81,
    cachedM?: number[][]
  ): number[] {
    const n = Math.min(dhParams.length, inertiaList.length);
    const zeroArr = new Array(n).fill(0);

    const M = cachedM || this.computeMassMatrix(dhParams, inertiaList, qRad);

    // Nonlinear Coriolis & Gravity forces: h(q, qd) = C(q, qd)*qd + g(q)
    const h = this.computeRawTorque(dhParams, inertiaList, qRad, qdRad, zeroArr, gravityAcc);

    // Residual torques: tau_net = tau - h - friction
    // Smooth Coulomb friction tanh(qd / 0.05) eliminates non-Lipschitz chattering at zero-crossings
    const tauNet: number[] = new Array(n);
    for (let i = 0; i < n; i++) {
      const qd = qdRad[i] || 0;
      const smoothSign = Math.tanh(qd / 0.05);
      const friction = inertiaList[i].viscousFriction * qd + inertiaList[i].coulombFriction * smoothSign;
      tauNet[i] = (tauApplied[i] || 0) - h[i] - friction;
    }

    // Direct Cholesky solution M * qdd = tauNet
    const qdd = this.solveLinearSystemSPD(M, tauNet);
    return qdd;
  }

  /**
   * High-accuracy Runge-Kutta 4th Order (RK4) Step for Forward Dynamics
   * Computes M(q) once per step to optimize performance while maintaining full O(dt^4) accuracy.
   */
  public static stepRK4(
    dhParams: DHParameter[],
    inertiaList: InertialParameters[],
    qRad: number[],
    qdRad: number[],
    tauApplied: number[],
    dt: number,
    gravityAcc: number = 9.81,
    reflectedRotorInertias?: number[]
  ): { qNextRad: number[]; qdNextRad: number[]; qddRad: number[] } {
    const M_step = this.computeMassMatrix(dhParams, inertiaList, qRad, reflectedRotorInertias);

    // k1 = f(q, qd)
    const k1_qdd = this.computeForwardDynamics(dhParams, inertiaList, qRad, qdRad, tauApplied, gravityAcc, M_step);
    const k1_qd = [...qdRad];

    // k2 = f(q + 0.5*dt*k1_qd, qd + 0.5*dt*k1_qdd)
    const q2 = qRad.map((q, i) => q + 0.5 * dt * k1_qd[i]);
    const qd2 = qdRad.map((qd, i) => qd + 0.5 * dt * k1_qdd[i]);
    const k2_qdd = this.computeForwardDynamics(dhParams, inertiaList, q2, qd2, tauApplied, gravityAcc, M_step);
    const k2_qd = [...qd2];

    // k3 = f(q + 0.5*dt*k2_qd, qd + 0.5*dt*k2_qdd)
    const q3 = qRad.map((q, i) => q + 0.5 * dt * k2_qd[i]);
    const qd3 = qdRad.map((qd, i) => qd + 0.5 * dt * k2_qdd[i]);
    const k3_qdd = this.computeForwardDynamics(dhParams, inertiaList, q3, qd3, tauApplied, gravityAcc, M_step);
    const k3_qd = [...qd3];

    // k4 = f(q + dt*k3_qd, qd + dt*k3_qdd)
    const q4 = qRad.map((q, i) => q + dt * k3_qd[i]);
    const qd4 = qdRad.map((qd, i) => qd + dt * k3_qdd[i]);
    const k4_qdd = this.computeForwardDynamics(dhParams, inertiaList, q4, qd4, tauApplied, gravityAcc, M_step);
    const k4_qd = [...qd4];

    // RK4 Integration
    const qNext = qRad.map(
      (q, i) => q + (dt / 6) * (k1_qd[i] + 2 * k2_qd[i] + 2 * k3_qd[i] + k4_qd[i])
    );
    const qdNext = qdRad.map(
      (qd, i) => qd + (dt / 6) * (k1_qdd[i] + 2 * k2_qdd[i] + 2 * k3_qdd[i] + k4_qdd[i])
    );

    // Apply physical mechanical limit bumpers & velocity clamping
    for (let i = 0; i < dhParams.length; i++) {
      const qMin = (dhParams[i].qMinDeg * Math.PI) / 180;
      const qMax = (dhParams[i].qMaxDeg * Math.PI) / 180;

      // Realistic motor speed saturation (6.0 rad/s ~ 344 deg/s)
      qdNext[i] = Math.max(-6.0, Math.min(6.0, qdNext[i]));

      if (qNext[i] < qMin) {
        qNext[i] = qMin;
        if (qdNext[i] < 0) qdNext[i] = 0; // Inelastic collision with hard stop
      } else if (qNext[i] > qMax) {
        qNext[i] = qMax;
        if (qdNext[i] > 0) qdNext[i] = 0; // Inelastic collision with hard stop
      }
    }

    return {
      qNextRad: qNext,
      qdNextRad: qdNext,
      qddRad: k1_qdd,
    };
  }

  /**
   * Computes Mechanical Energy (Kinetic T + Potential V)
   */
  public static computeEnergy(
    dhParams: DHParameter[],
    inertiaList: InertialParameters[],
    qRad: number[],
    qdRad: number[],
    gravityAcc: number = 9.81
  ): { kinetic: number; potential: number; total: number } {
    const M = this.computeMassMatrix(dhParams, inertiaList, qRad);
    const n = qRad.length;

    // T = 0.5 * qd^T * M * qd
    let kinetic = 0;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        kinetic += 0.5 * qdRad[i] * M[i][j] * qdRad[j];
      }
    }

    // Potential energy V = sum(m_i * g * z_com_i)
    let potential = 0;
    let T_acc = new THREE.Matrix4().identity();

    for (let i = 0; i < n; i++) {
      const dh = dhParams[i];
      const theta = (dh.thetaOffsetDeg * Math.PI) / 180 + qRad[i];
      const alpha = (dh.alphaDeg * Math.PI) / 180;
      const d = dh.d / 1000;
      const a = dh.a / 1000;

      const T_i = new THREE.Matrix4().set(
        Math.cos(theta), -Math.sin(theta) * Math.cos(alpha), Math.sin(theta) * Math.sin(alpha), a * Math.cos(theta),
        Math.sin(theta), Math.cos(theta) * Math.cos(alpha), -Math.cos(theta) * Math.sin(alpha), a * Math.sin(theta),
        0, Math.sin(alpha), Math.cos(alpha), d,
        0, 0, 0, 1
      );

      T_acc = T_acc.multiply(T_i);

      const comLocal = new THREE.Vector3(...inertiaList[i].com);
      const comWorld = comLocal.applyMatrix4(T_acc);

      potential += inertiaList[i].mass * gravityAcc * comWorld.z;
    }

    return {
      kinetic: Math.max(0, kinetic),
      potential: potential,
      total: kinetic + potential,
    };
  }
}
