import * as THREE from 'three';

export interface DHParameter {
  jointIndex: number;
  thetaOffsetDeg: number;  // Initial theta from XML (degrees)
  d: number;               // Joint offset along z_{i-1} (mm or m)
  a: number;               // Link length along x_i (mm or m)
  alphaDeg: number;        // Link twist around x_i (degrees)
  qMinDeg: number;         // Minimum joint angle limit (degrees)
  qMaxDeg: number;         // Maximum joint angle limit (degrees)
}

export interface RobotLink {
  index: number;
  fileName: string;
  color: string;
}

export interface RobotModel {
  id: string;
  name: string;
  manufacturer: string;
  modelName: string;
  payloadKg: number;
  totalWeightKg: number;
  scale: number;
  reachMm: number;
  dof: number;
  joints: DHParameter[];
  links: RobotLink[];
  defaultPostureDeg: number[];
}

export interface CartesianPose {
  position: { x: number; y: number; z: number };
  orientationEuler: { roll: number; pitch: number; yaw: number }; // In degrees
  matrix: THREE.Matrix4;
}

export type CameraPreset = 'isometric' | 'front' | 'top' | 'side' | 'tcp';
export type RenderingStyle = 'solid' | 'ghosted';
export type BackgroundTheme = 'academic-white' | 'technical-light' | 'studio-dark' | 'deep-space';

export interface LightingSettings {
  ambientIntensity: number;
  keyLightIntensity: number;
  rimLightIntensity: number;
  shadowOpacity: number;
  lightAzimuthDeg: number;
}

export interface CameraSettings {
  fov: number; // degrees
  distance: number; // mm
  elevationDeg: number; // degrees
  azimuthDeg: number; // degrees
}

export interface IKConfiguration {
  index: number;
  name: string;
  shoulder: 'left' | 'right';
  elbow: 'down' | 'up';
  wrist: 'no-flip' | 'flip';
  anglesDeg: number[];
}

export interface ManipulabilityInfo {
  yoshikawaIndex: number;
  singularValues: [number, number, number];
  eigenVectors: [THREE.Vector3, THREE.Vector3, THREE.Vector3];
  isNearSingularity: boolean;
}

export type SkeletonMode = 'physical' | 'dh';

export interface ViewportOverlaySettings {
  showFrames: boolean;
  showSkeleton: boolean;
  skeletonMode: SkeletonMode;
  showTcp: boolean;
  showTrace: boolean;
  showGrid: boolean;
  showShadows: boolean;
  wireframeOnly: boolean;
  showManipulabilityEllipsoid: boolean;
  showIKGizmo: boolean;
}
