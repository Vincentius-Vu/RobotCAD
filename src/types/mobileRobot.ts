export type MobileDriveType = 'differential' | 'mecanum' | 'ackermann';

export type MobileNavigationMode = 'manual_teleop' | 'waypoint_navigation' | 'path_following';

export interface MobileRobotSpecs {
  id: string;
  name: string;
  driveType: MobileDriveType;
  chassisWidthM: number;     // e.g. 0.4 m
  chassisLengthM: number;    // e.g. 0.5 m
  chassisHeightM: number;    // e.g. 0.2 m
  wheelRadiusM: number;      // e.g. 0.05 m (50 mm)
  trackWidthM: number;       // e.g. 0.35 m (distance between left and right wheels)
  wheelBaseM: number;        // e.g. 0.35 m (distance between front and rear axles for 4WD)
  maxLinearSpeedMps: number; // e.g. 1.2 m/s
  maxAngularSpeedRadps: number; // e.g. 3.14 rad/s (180 deg/s)
  maxAccelerationMps2: number; // e.g. 2.0 m/s^2
  massKg: number;
}

export interface MobileRobotPose {
  x: number;       // meters in world frame
  y: number;       // meters in world frame
  thetaRad: number;// heading in radians [-pi, pi]
  z: number;       // meters (usually wheelRadiusM)
}

export interface MobileRobotVelocity {
  v: number;       // linear forward speed (m/s)
  vY: number;      // lateral speed (m/s, for Mecanum drive only)
  omega: number;   // angular yaw speed (rad/s)
  steerAngleRad: number; // front steering angle for Ackermann
}

export interface WheelState {
  speedsRadps: number[]; // wheel rotational speeds [omega_L, omega_R] or [w1, w2, w3, w4]
  anglesRad: number[];   // cumulative rotation of wheels for 3D animation
}

export interface Obstacle {
  id: string;
  name: string;
  type: 'box' | 'cylinder' | 'wall';
  position: { x: number; y: number; z: number }; // meters
  dimensions: {
    width?: number;  // for box/wall
    depth?: number;  // for box/wall
    height?: number; // for box/wall/cylinder
    radius?: number; // for cylinder
  };
  color?: string;
  isStatic?: boolean;
}

export interface LidarConfig {
  numRays: number;      // e.g. 180 or 360 rays
  fovRad: number;       // e.g. 2 * Math.PI (360 deg)
  minRangeM: number;    // e.g. 0.12 m
  maxRangeM: number;    // e.g. 8.0 m
  updateRateHz: number; // e.g. 20 Hz
}

export interface LidarScanPoint {
  angleRad: number;
  distanceM: number;
  hitX: number; // world x
  hitY: number; // world y
  hasHit: boolean;
}

export interface NavGoal {
  x: number;
  y: number;
  thetaRad?: number;
}

export interface PathWaypoint {
  x: number;
  y: number;
}

export interface MobilePoseWaypoint {
  id: string;
  name: string;
  x: number; // Tọa độ X (m)
  y: number; // Tọa độ Y (m)
  thetaDeg: number; // Hướng xe (độ)
  segmentDuration: number; // Thời gian dự kiến di chuyển (s)
}
