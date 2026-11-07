export type CodeExportTarget =
  | 'python-rtb'
  | 'cpp-eigen'
  | 'matlab-rst'
  | 'ros2-urdf';

export interface CodeExportOptions {
  target: CodeExportTarget;
  includeKinematics: boolean;
  includeJacobian: boolean;
  includeDynamics: boolean;
  includeVisualization: boolean;
  useCurrentAngles: boolean;
}

export interface GeneratedCodeResult {
  code: string;
  language: string;
  fileName: string;
  mimeType: string;
  description: string;
  instructions: string;
}
