import * as THREE from 'three';
import { RobotModel } from '../types/robot';
import { WorkspaceCloudData } from '../types/workspace';

export class WorkspaceGenerator {
  /**
   * Generates a dense 3D point cloud via Monte-Carlo joint space sampling
   * Computes exact positions and Yoshikawa manipulability metrics asynchronously
   */
  public static async generateCloud(
    robotModel: RobotModel,
    sampleCount = 50000,
    onProgress?: (progressPct: number) => void
  ): Promise<WorkspaceCloudData> {
    const dof = robotModel.dof;
    const joints = robotModel.joints;

    const positions = new Float32Array(sampleCount * 3);
    const manipulabilities = new Float32Array(sampleCount);

    let maxRadiusMm = 0;
    let minRadiusMm = Infinity;
    let maxZMm = -Infinity;
    let minZMm = Infinity;
    let maxManip = 0;
    let minManip = Infinity;

    // Voxel grid set for accurate occupied volume estimation (voxel size = 50mm)
    const voxelSize = 50;
    const occupiedVoxels = new Set<string>();

    // Chunked computation to keep 60 FPS UI smooth
    const chunkSize = 5000;
    const totalChunks = Math.ceil(sampleCount / chunkSize);

    // Pre-allocated math objects for ultra-fast calculation
    const T = new THREE.Matrix4();
    const A = new THREE.Matrix4();
    const linkTransforms: THREE.Matrix4[] = Array.from({ length: dof + 1 }, () => new THREE.Matrix4());
    const zAxes: THREE.Vector3[] = Array.from({ length: dof }, () => new THREE.Vector3());
    const origins: THREE.Vector3[] = Array.from({ length: dof + 1 }, () => new THREE.Vector3());
    const tcpPos = new THREE.Vector3();
    const diff = new THREE.Vector3();
    const JvCol = new THREE.Vector3();

    // 3x6 Jv columns
    const Jv: number[][] = [
      new Array(dof).fill(0),
      new Array(dof).fill(0),
      new Array(dof).fill(0),
    ];

    for (let chunk = 0; chunk < totalChunks; chunk++) {
      const startIdx = chunk * chunkSize;
      const endIdx = Math.min(sampleCount, startIdx + chunkSize);

      for (let i = startIdx; i < endIdx; i++) {
        // 1. Generate random joint angle within physical limits
        T.identity();
        linkTransforms[0].identity();
        origins[0].set(0, 0, 0);

        for (let j = 0; j < dof; j++) {
          const qMin = joints[j].qMinDeg;
          const qMax = joints[j].qMaxDeg;
          const qRand = qMin + Math.random() * (qMax - qMin);

          const theta = (qRand + joints[j].thetaOffsetDeg) * (Math.PI / 180);
          const alpha = joints[j].alphaDeg * (Math.PI / 180);
          const d = joints[j].d;
          const a = joints[j].a;

          const cosTh = Math.cos(theta);
          const sinTh = Math.sin(theta);
          const cosAl = Math.cos(alpha);
          const sinAl = Math.sin(alpha);

          // Standard D-H 4x4 matrix
          A.set(
            cosTh, -sinTh * cosAl,  sinTh * sinAl, a * cosTh,
            sinTh,  cosTh * cosAl, -cosTh * sinAl, a * sinTh,
            0,      sinAl,          cosAl,         d,
            0,      0,              0,             1
          );

          T.multiply(A);
          linkTransforms[j + 1].copy(T);

          // Extract z-axis (column 2) and origin (column 3)
          const elements = linkTransforms[j].elements;
          zAxes[j].set(elements[8], elements[9], elements[10]);
          origins[j].set(elements[12], elements[13], elements[14]);
        }

        // Final TCP position
        const finalElem = linkTransforms[dof].elements;
        tcpPos.set(finalElem[12], finalElem[13], finalElem[14]);
        origins[dof].copy(tcpPos);

        const x = tcpPos.x;
        const y = tcpPos.y;
        const z = tcpPos.z;

        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;

        // 2. Compute 3xDOF Jacobian linear velocity Jv = z_{j-1} x (p_n - p_{j-1})
        for (let j = 0; j < dof; j++) {
          diff.subVectors(tcpPos, origins[j]);
          JvCol.crossVectors(zAxes[j], diff);
          Jv[0][j] = JvCol.x;
          Jv[1][j] = JvCol.y;
          Jv[2][j] = JvCol.z;
        }

        // 3. Compute A = Jv * Jv^T (3x3 symmetric matrix)
        let a00 = 0, a01 = 0, a02 = 0;
        let a11 = 0, a12 = 0, a22 = 0;
        for (let j = 0; j < dof; j++) {
          const v0 = Jv[0][j];
          const v1 = Jv[1][j];
          const v2 = Jv[2][j];
          a00 += v0 * v0;
          a01 += v0 * v1;
          a02 += v0 * v2;
          a11 += v1 * v1;
          a12 += v1 * v2;
          a22 += v2 * v2;
        }

        // Direct determinant of 3x3 symmetric matrix: det(A)
        const detA =
          a00 * (a11 * a22 - a12 * a12) -
          a01 * (a01 * a22 - a12 * a02) +
          a02 * (a01 * a12 - a11 * a02);

        // Yoshikawa manipulability index: w = sqrt(det(Jv * Jv^T))
        const w = Math.sqrt(Math.max(0, detA)) / 1000; // Scaled to reasonable range
        manipulabilities[i] = w;

        if (w > maxManip) maxManip = w;
        if (w < minManip) minManip = w;

        // Track spatial extents
        const radius = Math.hypot(x, y);
        if (radius > maxRadiusMm) maxRadiusMm = radius;
        if (radius < minRadiusMm && radius > 50) minRadiusMm = radius;
        if (z > maxZMm) maxZMm = z;
        if (z < minZMm) minZMm = z;

        // Voxel hashing for volume
        const vx = Math.floor(x / voxelSize);
        const vy = Math.floor(y / voxelSize);
        const vz = Math.floor(z / voxelSize);
        occupiedVoxels.add(`${vx},${vy},${vz}`);
      }

      // Report progress and yield to event loop
      if (onProgress) {
        onProgress(Math.round(((chunk + 1) / totalChunks) * 100));
      }
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    // Volume in m^3 = number of occupied voxels * voxelVolume (m^3)
    const voxelVolumeM3 = Math.pow(voxelSize / 1000, 3);
    const volumeM3 = Number((occupiedVoxels.size * voxelVolumeM3).toFixed(3));

    return {
      robotId: robotModel.id,
      totalPoints: sampleCount,
      positions,
      manipulabilities,
      minManipulability: minManip,
      maxManipulability: maxManip,
      maxRadiusMm: Math.round(maxRadiusMm),
      minRadiusMm: minRadiusMm === Infinity ? 0 : Math.round(minRadiusMm),
      maxZMm: Math.round(maxZMm),
      minZMm: Math.round(minZMm),
      volumeM3,
    };
  }
}
