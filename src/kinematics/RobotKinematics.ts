import * as THREE from 'three';
import { DHParameter, CartesianPose, ManipulabilityInfo, IKConfiguration, SkeletonMode } from '../types/robot';

export interface SkeletonBone {
  from: THREE.Vector3;
  to: THREE.Vector3;
  linkIndex: number;
}

export interface SkeletonResult {
  pathPoints: THREE.Vector3[];
  spherePositions: THREE.Vector3[];
  bones: SkeletonBone[];
  adjustedTransforms?: THREE.Matrix4[];
}

export class RobotKinematics {
  /**
   * Computes the 4x4 Standard Denavit-Hartenberg transformation matrix A_i
   * @param thetaDeg Total joint angle in degrees (theta_offset + q)
   * @param d Joint offset along previous z-axis
   * @param a Link length along current x-axis
   * @param alphaDeg Twist angle in degrees
   */
  public static computeDHMatrix(thetaDeg: number, d: number, a: number, alphaDeg: number): THREE.Matrix4 {
    const theta = THREE.MathUtils.degToRad(thetaDeg);
    const alpha = THREE.MathUtils.degToRad(alphaDeg);

    const cTh = Math.cos(theta);
    const sTh = Math.sin(theta);
    const cAl = Math.cos(alpha);
    const sAl = Math.sin(alpha);

    const mat = new THREE.Matrix4();
    mat.set(
      cTh, -sTh * cAl,  sTh * sAl, a * cTh,
      sTh,  cTh * cAl, -cTh * sAl, a * sTh,
      0,    sAl,        cAl,       d,
      0,    0,          0,         1
    );
    return mat;
  }

  /**
   * Computes cumulative forward kinematic transformation matrices T_0^0 ... T_0^n
   */
  public static computeForwardKinematics(
    joints: DHParameter[],
    jointAnglesDeg: number[]
  ): THREE.Matrix4[] {
    const transforms: THREE.Matrix4[] = [new THREE.Matrix4().identity()];
    let currentT = new THREE.Matrix4().identity();

    for (let i = 0; i < joints.length; i++) {
      const joint = joints[i];
      const q = jointAnglesDeg[i] !== undefined ? jointAnglesDeg[i] : 0;
      const totalTheta = joint.thetaOffsetDeg + q;

      const A = this.computeDHMatrix(totalTheta, joint.d, joint.a, joint.alphaDeg);
      currentT = currentT.clone().multiply(A);
      transforms.push(currentT.clone());
    }

    return transforms;
  }

  /**
   * Extracts Cartesian position (X, Y, Z) and Euler angles (Roll, Pitch, Yaw in degrees)
   */
  public static extractCartesianPose(transform: THREE.Matrix4): CartesianPose {
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();

    transform.decompose(position, quaternion, scale);
    const euler = new THREE.Euler().setFromQuaternion(quaternion, 'ZYX');

    return {
      position: {
        x: Number(position.x.toFixed(2)),
        y: Number(position.y.toFixed(2)),
        z: Number(position.z.toFixed(2))
      },
      orientationEuler: {
        roll: Number(THREE.MathUtils.radToDeg(euler.x).toFixed(2)),
        pitch: Number(THREE.MathUtils.radToDeg(euler.y).toFixed(2)),
        yaw: Number(THREE.MathUtils.radToDeg(euler.z).toFixed(2))
      },
      matrix: transform.clone()
    };
  }

  /**
   * Computes joint origins for skeleton visualization
   */
  public static extractJointOrigins(transforms: THREE.Matrix4[]): THREE.Vector3[] {
    return transforms.map((t) => {
      const pos = new THREE.Vector3();
      t.decompose(pos, new THREE.Quaternion(), new THREE.Vector3());
      return pos;
    });
  }

  /**
   * Computes joint origins and 3D bones for kinematic skeleton visualization.
   * In 'physical' mode (default), adapts structural branches (such as PUMA 560 shoulder lateral boom)
   * so bones pass directly through the physical CAD link bodies rather than through mathematical abstract frame origins.
   * In 'dh' mode, follows the textbook D-H frame origins sequentially.
   */
  public static computeSkeleton(
    robotId: string,
    transforms: THREE.Matrix4[],
    mode: SkeletonMode = 'physical'
  ): SkeletonResult {
    const origins = this.extractJointOrigins(transforms);
    const n = transforms.length;

    const isPuma = robotId.toLowerCase().includes('puma');

    // Standard D-H skeleton or robots without lateral shoulder offsets
    if (mode === 'dh' || !isPuma || n < 7) {
      const bones: SkeletonBone[] = [];
      for (let i = 0; i < n - 1; i++) {
        bones.push({
          from: origins[i],
          to: origins[i + 1],
          linkIndex: i + 1,
        });
      }
      return {
        pathPoints: origins,
        spherePositions: origins,
        bones,
      };
    }

    // Physical Structural Skeleton for PUMA 560:
    // O0: Base anchor
    // O1: Waist pillar top
    // S: Physical shoulder joint pivot (offset by 150mm along Joint 2 axis)
    // O3: Physical elbow joint pivot
    // O4, O5, O6: Forearm, wrist and tool
    const O0 = origins[0];
    const O1 = origins[1];
    const O3 = origins[3];
    const O4 = origins[4];
    const O5 = origins[5];
    const O6 = origins[6];

    // Compute shoulder pivot S by projecting O3 onto the shoulder axis passing through O1
    const T1 = transforms[1];
    const Z1 = new THREE.Vector3(0, 0, 1).applyQuaternion(
      new THREE.Quaternion().setFromRotationMatrix(T1)
    );
    const v13 = new THREE.Vector3().subVectors(O3, O1);
    const offsetAlongZ1 = v13.dot(Z1);
    const S = O1.clone().addScaledVector(Z1, offsetAlongZ1);

    const pathPoints = [O0, O1, S, O3, O4, O5, O6];
    const spherePositions = [O0, O1, S, O3, O4, O5, O6];

    const bones: SkeletonBone[] = [
      { from: O0, to: O1, linkIndex: 1 }, // Link 1: Waist column
      { from: O1, to: S, linkIndex: 1 },  // Link 1: Shoulder lateral boom
      { from: S, to: O3, linkIndex: 2 },  // Link 2: Upper arm (passes directly through CAD mesh)
      { from: O3, to: O4, linkIndex: 3 }, // Link 3: Forearm (passes directly through CAD mesh)
      { from: O4, to: O5, linkIndex: 5 }, // Link 5: Wrist
      { from: O5, to: O6, linkIndex: 6 }, // Link 6: Tool flange
    ];

    // Build adjusted coordinate frame transforms for physical joint placement
    // For PUMA 560, Frame {2} is physically located at shoulder bearing S rather than phantom origin O2
    const adjustedTransforms = transforms.map((t, i) => {
      if (i === 2) {
        return t.clone().setPosition(S);
      }
      return t;
    });

    return {
      pathPoints,
      spherePositions,
      bones,
      adjustedTransforms,
    };
  }

  /**
   * Computes 6xn Geometric Jacobian Matrix in base frame {0}
   * v_e = J_v * q_dot, omega_e = J_w * q_dot
   */
  public static computeGeometricJacobian(
    joints: DHParameter[],
    jointAnglesDeg: number[]
  ): { J: number[][]; Jv: number[][]; Jw: number[][] } {
    const transforms = this.computeForwardKinematics(joints, jointAnglesDeg);
    const n = joints.length;
    const pe = new THREE.Vector3();
    transforms[transforms.length - 1].decompose(pe, new THREE.Quaternion(), new THREE.Vector3());

    const J: number[][] = Array.from({ length: 6 }, () => new Array(n).fill(0));
    const Jv: number[][] = Array.from({ length: 3 }, () => new Array(n).fill(0));
    const Jw: number[][] = Array.from({ length: 3 }, () => new Array(n).fill(0));

    for (let i = 0; i < n; i++) {
      const Ti = transforms[i]; // Frame i-1 origin and z-axis
      const pi = new THREE.Vector3();
      const qi = new THREE.Quaternion();
      Ti.decompose(pi, qi, new THREE.Vector3());

      const zi = new THREE.Vector3(0, 0, 1).applyQuaternion(qi);
      const r = new THREE.Vector3().subVectors(pe, pi);
      const jvCol = new THREE.Vector3().crossVectors(zi, r);

      // Jv
      Jv[0][i] = jvCol.x;
      Jv[1][i] = jvCol.y;
      Jv[2][i] = jvCol.z;

      // Jw
      Jw[0][i] = zi.x;
      Jw[1][i] = zi.y;
      Jw[2][i] = zi.z;

      // Full J
      J[0][i] = jvCol.x;
      J[1][i] = jvCol.y;
      J[2][i] = jvCol.z;
      J[3][i] = zi.x;
      J[4][i] = zi.y;
      J[5][i] = zi.z;
    }

    return { J, Jv, Jw };
  }

  /**
   * Computes Yoshikawa manipulability index w = sqrt(det(Jv * Jv^T)) and 3D ellipsoid principal axes
   */
  public static computeManipulability(Jv: number[][]): ManipulabilityInfo {
    const n = Jv[0].length;
    // A = Jv * Jv^T (3x3 symmetric matrix)
    const A: number[][] = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0]
    ];

    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        for (let k = 0; k < n; k++) {
          sum += Jv[r][k] * Jv[c][k];
        }
        A[r][c] = sum;
      }
    }

    // Determinant of 3x3
    const detA =
      A[0][0] * (A[1][1] * A[2][2] - A[1][2] * A[2][1]) -
      A[0][1] * (A[1][0] * A[2][2] - A[1][2] * A[2][0]) +
      A[0][2] * (A[1][0] * A[2][1] - A[1][1] * A[2][0]);

    const yoshikawaIndex = Math.sqrt(Math.max(0, detA));
    const isNearSingularity = yoshikawaIndex < 1e-4;

    // Symmetric 3x3 Eigenvalue Solver via Jacobi iterations
    const { eigenvalues, eigenvectors } = this.solveSymmetricEigen3x3(A);

    // Singular values are square roots of eigenvalues of Jv*Jv^T
    const s1 = Math.sqrt(Math.max(0, eigenvalues[0]));
    const s2 = Math.sqrt(Math.max(0, eigenvalues[1]));
    const s3 = Math.sqrt(Math.max(0, eigenvalues[2]));

    return {
      yoshikawaIndex: Number(yoshikawaIndex.toFixed(4)),
      singularValues: [Number(s1.toFixed(3)), Number(s2.toFixed(3)), Number(s3.toFixed(3))],
      eigenVectors: [
        new THREE.Vector3(eigenvectors[0][0], eigenvectors[1][0], eigenvectors[2][0]),
        new THREE.Vector3(eigenvectors[0][1], eigenvectors[1][1], eigenvectors[2][1]),
        new THREE.Vector3(eigenvectors[0][2], eigenvectors[1][2], eigenvectors[2][2])
      ],
      isNearSingularity
    };
  }

  /**
   * Fast Jacobi eigenvalue algorithm for 3x3 symmetric matrix
   */
  private static solveSymmetricEigen3x3(mat: number[][]): { eigenvalues: number[]; eigenvectors: number[][] } {
    const A = [
      [mat[0][0], mat[0][1], mat[0][2]],
      [mat[1][0], mat[1][1], mat[1][2]],
      [mat[2][0], mat[2][1], mat[2][2]]
    ];
    const V = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1]
    ];

    for (let iter = 0; iter < 20; iter++) {
      let maxOff = 0;
      let p = 0, q = 1;
      for (let i = 0; i < 3; i++) {
        for (let j = i + 1; j < 3; j++) {
          if (Math.abs(A[i][j]) > maxOff) {
            maxOff = Math.abs(A[i][j]);
            p = i;
            q = j;
          }
        }
      }
      if (maxOff < 1e-9) break;

      const app = A[p][p];
      const aqq = A[q][q];
      const apq = A[p][q];
      const theta = 0.5 * Math.atan2(2 * apq, aqq - app);
      const c = Math.cos(theta);
      const s = Math.sin(theta);

      // Rotate A
      for (let k = 0; k < 3; k++) {
        const akp = A[k][p];
        const akq = A[k][q];
        A[k][p] = c * akp - s * akq;
        A[k][q] = s * akp + c * akq;
      }
      for (let k = 0; k < 3; k++) {
        A[p][k] = A[k][p];
        A[q][k] = A[k][q];
      }
      A[p][p] = c * c * app - 2 * s * c * apq + s * s * aqq;
      A[q][q] = s * s * app + 2 * s * c * apq + c * c * aqq;
      A[p][q] = 0;
      A[q][p] = 0;

      // Accumulate eigenvectors in V
      for (let k = 0; k < 3; k++) {
        const vkp = V[k][p];
        const vkq = V[k][q];
        V[k][p] = c * vkp - s * vkq;
        V[k][q] = s * vkp + c * vkq;
      }
    }

    return {
      eigenvalues: [A[0][0], A[1][1], A[2][2]],
      eigenvectors: V
    };
  }

  /**
   * Closed-form analytical Inverse Kinematics for PUMA 560
   * Evaluates all 8 distinct kinematic postures:
   * (Shoulder Left/Right) x (Elbow Down/Up) x (Wrist No-Flip/Flip)
   */
  public static solveAnalyticalIKPuma560(targetT: THREE.Matrix4): IKConfiguration[] {
    // Dimensions in mm for Puma 560
    const a2 = 432.0;
    const a3 = 2.0;
    const d3 = 150.0;
    const d4 = 432.0;

    const te = targetT.elements;
    // targetT rotation columns:
    const nx = te[0], ny = te[1], nz = te[2];
    const ox = te[4], oy = te[5], oz = te[6];
    const ax = te[8], ay = te[9], az = te[10];
    const px = te[12], py = te[13], pz = te[14];

    // Tool offset (d6 = -56 mm)
    const d6 = -56.0;
    const pwx = px - d6 * ax;
    const pwy = py - d6 * ay;
    const pwz = pz - d6 * az;

    const r_xy_sq = pwx * pwx + pwy * pwy;
    if (r_xy_sq < d3 * d3) return []; // In shoulder singular zone

    const phi = Math.atan2(pwy, pwx);
    const configs: IKConfiguration[] = [];

    // 1. Two Shoulder configurations: Right (+1) and Left (-1)
    const shoulderOptions: ('right' | 'left')[] = ['right', 'left'];
    const elbowOptions: ('down' | 'up')[] = ['down', 'up'];
    const wristOptions: ('no-flip' | 'flip')[] = ['no-flip', 'flip'];

    let configIndex = 0;

    for (const sh of shoulderOptions) {
      const signSh = sh === 'right' ? 1.0 : -1.0;
      const val = Math.sqrt(Math.max(0, r_xy_sq - d3 * d3));
      const th1 = phi - Math.atan2(d3, signSh * val);
      const c1 = Math.cos(th1);
      const s1 = Math.sin(th1);

      // Coordinates in arm plane
      const f = c1 * pwx + s1 * pwy;
      const g = pwz;

      // 2. Two Elbow branches: Down (+1) and Up (-1)
      const num = f * f + g * g - a2 * a2 - a3 * a3 - d4 * d4;
      const den = 2.0 * a2 * Math.sqrt(a3 * a3 + d4 * d4);
      const D = num / den;
      if (Math.abs(D) > 1.0) continue; // Out of reach

      const psi = Math.atan2(d4, a3);

      for (const el of elbowOptions) {
        const signEl = el === 'down' ? 1.0 : -1.0;
        const th3 = Math.atan2(signEl * Math.sqrt(Math.max(0, 1.0 - D * D)), D) - psi;

        const k1 = a2 + a3 * Math.cos(th3) - d4 * Math.sin(th3);
        const k2 = a3 * Math.sin(th3) + d4 * Math.cos(th3);
        const th2 = Math.atan2(k1 * g - k2 * f, k1 * f + k2 * g);

        // Compute rotation R_03
        const c23 = Math.cos(th2 + th3);
        const s23 = Math.sin(th2 + th3);

        const r13 = [c1 * c23, -c1 * s23, -s1];
        const r23 = [s1 * c23, -s1 * s23,  c1];
        const r33 = [   -s23,      -c23,   0 ];

        // Relative wrist orientation R_36 = R_03^T * R_target
        // R_target = [ [nx, ox, ax], [ny, oy, ay], [nz, oz, az] ]
        const r36_13 = r13[0] * ax + r23[0] * ay + r33[0] * az;
        const r36_23 = r13[1] * ax + r23[1] * ay + r33[1] * az;
        const r36_33 = r13[2] * ax + r23[2] * ay + r33[2] * az;

        const s5_mag = Math.sqrt(r36_13 * r36_13 + r36_23 * r36_23);

        for (const wr of wristOptions) {
          const signWr = wr === 'no-flip' ? 1.0 : -1.0;
          let th4 = 0, th5 = 0, th6 = 0;

          if (s5_mag < 1e-6) {
            // Wrist singularity
            th5 = 0;
            th4 = 0;
            const r36_11 = r13[0] * nx + r23[0] * ny + r33[0] * nz;
            const r36_21 = r13[1] * nx + r23[1] * ny + r33[1] * nz;
            th6 = Math.atan2(r36_21, r36_11);
          } else {
            th5 = Math.atan2(signWr * s5_mag, r36_33);
            if (signWr > 0) {
              th4 = Math.atan2(r36_23, r36_13);
              const r36_31 = r13[2] * nx + r23[2] * ny + r33[2] * nz;
              const r36_32 = r13[2] * ox + r23[2] * oy + r33[2] * oz;
              th6 = Math.atan2(-r36_32, r36_31);
            } else {
              th4 = Math.atan2(-r36_23, -r36_13);
              const r36_31 = r13[2] * nx + r23[2] * ny + r33[2] * nz;
              const r36_32 = r13[2] * ox + r23[2] * oy + r33[2] * oz;
              th6 = Math.atan2(r36_32, -r36_31);
            }
          }

          const anglesDeg = [
            Number(THREE.MathUtils.radToDeg(th1).toFixed(2)),
            Number(THREE.MathUtils.radToDeg(th2).toFixed(2)),
            Number(THREE.MathUtils.radToDeg(th3).toFixed(2)),
            Number(THREE.MathUtils.radToDeg(th4).toFixed(2)),
            Number(THREE.MathUtils.radToDeg(th5).toFixed(2)),
            Number(THREE.MathUtils.radToDeg(th6).toFixed(2))
          ];

          configIndex++;
          configs.push({
            index: configIndex,
            name: `${sh.toUpperCase()} / ${el.toUpperCase()} / ${wr.toUpperCase()}`,
            shoulder: sh,
            elbow: el,
            wrist: wr,
            anglesDeg
          });
        }
      }
    }

    return configs;
  }

  /**
   * General Numerical Inverse Kinematics solver using Damped Least Squares (DLS)
   * Suitable for ANY 6-DOF industrial manipulator
   */
  public static solveNumericalIK(
    joints: DHParameter[],
    initialAnglesDeg: number[],
    targetT: THREE.Matrix4,
    maxIter = 25,
    damping = 0.08
  ): number[] | null {
    const q = [...initialAnglesDeg];
    const n = joints.length;

    const targetPos = new THREE.Vector3();
    const targetQuat = new THREE.Quaternion();
    targetT.decompose(targetPos, targetQuat, new THREE.Vector3());

    for (let iter = 0; iter < maxIter; iter++) {
      const transforms = this.computeForwardKinematics(joints, q);
      const currentT = transforms[transforms.length - 1];

      const currentPos = new THREE.Vector3();
      const currentQuat = new THREE.Quaternion();
      currentT.decompose(currentPos, currentQuat, new THREE.Vector3());

      // Position error
      const posError = new THREE.Vector3().subVectors(targetPos, currentPos);

      // Orientation error via quaternion log / cross product
      const qErr = targetQuat.clone().multiply(currentQuat.clone().invert());
      const rotError = new THREE.Vector3(qErr.x, qErr.y, qErr.z).multiplyScalar(2.0);
      if (qErr.w < 0) rotError.negate();

      const errorMag = Math.sqrt(posError.lengthSq() + rotError.lengthSq() * 100);
      if (errorMag < 1.0) {
        return q; // Converged within 1mm
      }

      // Compute Jacobian
      const { J } = this.computeGeometricJacobian(joints, q);

      // Error vector e = [posError.x, posError.y, posError.z, rotError.x, rotError.y, rotError.z]
      const e = [posError.x, posError.y, posError.z, rotError.x, rotError.y, rotError.z];

      // Damped Least Squares: delta_q = J^T * (J * J^T + lambda^2 * I)^(-1) * e
      // Compute JJT (6x6)
      const JJT: number[][] = Array.from({ length: 6 }, () => new Array(6).fill(0));
      for (let r = 0; r < 6; r++) {
        for (let c = 0; c < 6; c++) {
          let sum = 0;
          for (let k = 0; k < n; k++) {
            sum += J[r][k] * J[c][k];
          }
          JJT[r][c] = sum + (r === c ? damping * damping * 1000 : 0);
        }
      }

      // Invert 6x6 JJT via Gauss-Jordan elimination
      const invJJT = this.invert6x6(JJT);
      if (!invJJT) break;

      // temp = invJJT * e
      const temp = new Array(6).fill(0);
      for (let r = 0; r < 6; r++) {
        for (let c = 0; c < 6; c++) {
          temp[r] += invJJT[r][c] * e[c];
        }
      }

      // delta_q = J^T * temp
      for (let i = 0; i < n; i++) {
        let dq = 0;
        for (let r = 0; r < 6; r++) {
          dq += J[r][i] * temp[r];
        }
        // Convert to degrees and apply gain
        const dqDeg = THREE.MathUtils.radToDeg(dq) * 0.6;
        q[i] = Math.max(joints[i].qMinDeg, Math.min(joints[i].qMaxDeg, q[i] + dqDeg));
      }
    }

    return q;
  }

  /**
   * Inverts a 6x6 matrix using Gauss-Jordan elimination
   */
  private static invert6x6(A: number[][]): number[][] | null {
    const n = 6;
    const M: number[][] = Array.from({ length: n }, (_, i) => [
      ...A[i],
      ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))
    ]);

    for (let i = 0; i < n; i++) {
      let maxEl = Math.abs(M[i][i]);
      let maxRow = i;
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(M[k][i]) > maxEl) {
          maxEl = Math.abs(M[k][i]);
          maxRow = k;
        }
      }

      if (maxEl < 1e-12) return null; // Singular

      const tmp = M[i];
      M[i] = M[maxRow];
      M[maxRow] = tmp;

      const pivot = M[i][i];
      for (let j = 0; j < 2 * n; j++) {
        M[i][j] /= pivot;
      }

      for (let k = 0; k < n; k++) {
        if (k !== i) {
          const factor = M[k][i];
          for (let j = 0; j < 2 * n; j++) {
            M[k][j] -= factor * M[i][j];
          }
        }
      }
    }

    return M.map((row) => row.slice(n));
  }
}
