import { CartesianPose } from './robot';

export type TrajectoryInterpolationType =
  | 'cubic'
  | 'quintic'
  | 'lspb'
  | 'cartesian-linear';

export interface Waypoint {
  id: string;
  name: string;
  jointAngles: number[]; // In degrees
  cartesianPose: CartesianPose;
  segmentDuration: number; // In seconds (transit time from previous waypoint)
}

export interface TrajectorySample {
  time: number; // Elapsed time in seconds
  jointAngles: number[]; // In degrees
  jointVelocities: number[]; // In deg/s
  jointAccelerations: number[]; // In deg/s^2
  tcpPosition: { x: number; y: number; z: number }; // In mm
  tcpLinearVelocity: number; // In mm/s
  segmentIndex: number;
}

export interface TrajectoryPlan {
  samples: TrajectorySample[];
  totalDuration: number; // In seconds
  timeStep: number; // In seconds (default 0.02s = 50Hz)
  waypoints: Waypoint[];
  interpolationType: TrajectoryInterpolationType;
}

export interface TrajectoryPreset {
  id: string;
  name: string;
  description: string;
  interpolationType: TrajectoryInterpolationType;
  waypoints: {
    name: string;
    jointAngles: number[];
    segmentDuration: number;
  }[];
}
