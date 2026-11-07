export type WorkspaceSliceMode = 'full-3d' | 'slice-xz' | 'slice-yz' | 'slice-xy';
export type WorkspaceColorMode = 'yoshikawa' | 'height' | 'uniform';

export interface WorkspacePoint {
  x: number;
  y: number;
  z: number;
  manipulability: number;
}

export interface WorkspaceCloudData {
  robotId: string;
  totalPoints: number;
  positions: Float32Array; // Flattened [x0, y0, z0, x1, y1, z1, ...]
  manipulabilities: Float32Array; // Flattened [w0, w1, ...]
  minManipulability: number;
  maxManipulability: number;
  maxRadiusMm: number;
  minRadiusMm: number;
  maxZMm: number;
  minZMm: number;
  volumeM3: number;
}

export interface WorkspaceSettings {
  visible: boolean;
  sampleCount: number; // e.g. 20000, 50000, 100000
  sliceMode: WorkspaceSliceMode;
  sliceThicknessMm: number;
  sliceElevationMm: number;
  colorMode: WorkspaceColorMode;
  pointSize: number;
  opacity: number;
  enforceFloorLimit: boolean; // Discards points with Z < 0 (floor collision)
  dexterousThreshold: number; // 0 to 1 (0 = Reachable workspace, > 0 = Dexterous sweet spot)
}
