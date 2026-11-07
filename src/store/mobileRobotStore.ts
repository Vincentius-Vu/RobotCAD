import { create } from 'zustand';
import {
  MobileDriveType,
  MobileRobotSpecs,
  MobileRobotPose,
  MobileRobotVelocity,
  WheelState,
  Obstacle,
  LidarConfig,
  LidarScanPoint,
  NavGoal,
  PathWaypoint,
  MobilePoseWaypoint,
} from '../types/mobileRobot';
import { MobileRobotKinematics } from '../kinematics/MobileRobotKinematics';
import { LidarSensor } from '../navigation/LidarSensor';
import { PathPlanner } from '../navigation/PathPlanner';
import { TrajectoryFollower } from '../navigation/TrajectoryFollower';
import { AGVDigitalTwinEngine, AGVState, AGVLogEntry } from '../physics/mobile/AGVDigitalTwinEngine';

export interface AGVHistoryPoint {
  time: number;
  vx: number;
  wz: number;
  vL: number;
  vR: number;
  omega_wL: number;
  omega_wR: number;
  id_L: number;
  iq_L: number;
  id_R: number;
  iq_R: number;
  Te_L: number;
  Te_R: number;
  Vdc: number;
  Ibatt: number;
  slip_L: number;
  slip_R: number;
  Fx_L: number;
  Fx_R: number;
  Fz_L: number;
  Fz_R: number;
  Fz_cF: number;
  Fz_cR: number;
  psi_cF: number;
  psi_cR: number;
  omega_cF: number;
  omega_cR: number;
  ax: number;
  ay: number;
  pitchDeg: number;
  rollDeg: number;
  id_ref_L: number;
  iq_ref_L: number;
  id_ref_R: number;
  iq_ref_R: number;
  S_fw_L: number;
  S_fw_R: number;
  Vmag_L: number;
  Vmag_R: number;
  id_fw_L: number;
  id_fw_R: number;
  epsilon_ccc: number;
  u_sync: number;
  Te_cmd_L: number;
  Te_cmd_R: number;
}

export const DEFAULT_DIFF_DRIVE_SPECS: MobileRobotSpecs = {
  id: 'diff_amr_01',
  name: 'RoboTrans AMR-200 (SSoT Differential AGV)',
  driveType: 'differential',
  chassisWidthM: 0.56,
  chassisLengthM: 0.96,
  chassisHeightM: 0.28,
  wheelRadiusM: 0.10, // SSoT: rw = 0.10 m (200 mm diameter)
  trackWidthM: 0.50,  // SSoT: L = 0.50 m gauge
  wheelBaseM: 0.84,   // SSoT: LcF + LcR = 0.42 + 0.42 = 0.84 m
  maxLinearSpeedMps: 1.5,
  maxAngularSpeedRadps: 2.5,
  maxAccelerationMps2: 2.0,
  massKg: 200.0,      // SSoT: M = 200.0 kg
};

export const DEFAULT_MECANUM_SPECS: MobileRobotSpecs = {
  id: 'mecanum_amr_02',
  name: 'RoboOmni Mecanum-4WD',
  driveType: 'mecanum',
  chassisWidthM: 0.48,
  chassisLengthM: 0.60,
  chassisHeightM: 0.24,
  wheelRadiusM: 0.075,
  trackWidthM: 0.42,
  wheelBaseM: 0.40,
  maxLinearSpeedMps: 1.5,
  maxAngularSpeedRadps: 3.14,
  maxAccelerationMps2: 2.0,
  massKg: 24.0,
};

export const DEFAULT_WAREHOUSE_OBSTACLES: Obstacle[] = [
  // 4 Central Pillars
  {
    id: 'pillar_1',
    name: 'Cột trụ nhà kho A1',
    type: 'cylinder',
    position: { x: 2.0, y: 2.0, z: 1.0 },
    dimensions: { radius: 0.32, height: 2.0 },
    color: '#eab308',
    isStatic: true,
  },
  {
    id: 'pillar_2',
    name: 'Cột trụ nhà kho A2',
    type: 'cylinder',
    position: { x: -2.0, y: 2.0, z: 1.0 },
    dimensions: { radius: 0.32, height: 2.0 },
    color: '#eab308',
    isStatic: true,
  },
  {
    id: 'pillar_3',
    name: 'Cột trụ nhà kho B1',
    type: 'cylinder',
    position: { x: 2.0, y: -2.0, z: 1.0 },
    dimensions: { radius: 0.32, height: 2.0 },
    color: '#eab308',
    isStatic: true,
  },
  {
    id: 'pillar_4',
    name: 'Cột trụ nhà kho B2',
    type: 'cylinder',
    position: { x: -2.0, y: -2.0, z: 1.0 },
    dimensions: { radius: 0.32, height: 2.0 },
    color: '#eab308',
    isStatic: true,
  },
  // Pallet Cargo Boxes
  {
    id: 'box_1',
    name: 'Kiện hàng Pallet Bắc',
    type: 'box',
    position: { x: 0.0, y: 3.2, z: 0.5 },
    dimensions: { width: 1.2, depth: 0.8, height: 1.0 },
    color: '#d97706',
    isStatic: true,
  },
  {
    id: 'box_2',
    name: 'Kiện hàng Pallet Đông',
    type: 'box',
    position: { x: 3.2, y: 0.0, z: 0.6 },
    dimensions: { width: 0.8, depth: 1.4, height: 1.2 },
    color: '#d97706',
    isStatic: true,
  },
  {
    id: 'box_3',
    name: 'Kiện hàng Pallet Tây',
    type: 'box',
    position: { x: -3.2, y: 0.0, z: 0.5 },
    dimensions: { width: 0.8, depth: 1.2, height: 1.0 },
    color: '#d97706',
    isStatic: true,
  },
  // Boundary Walls (Warehouse Bounds +/- 5.5m)
  {
    id: 'wall_north',
    name: 'Tường biên Bắc',
    type: 'wall',
    position: { x: 0, y: 5.5, z: 0.75 },
    dimensions: { width: 11.0, depth: 0.25, height: 1.5 },
    color: '#475569',
    isStatic: true,
  },
  {
    id: 'wall_south',
    name: 'Tường biên Nam',
    type: 'wall',
    position: { x: 0, y: -5.5, z: 0.75 },
    dimensions: { width: 11.0, depth: 0.25, height: 1.5 },
    color: '#475569',
    isStatic: true,
  },
  {
    id: 'wall_east',
    name: 'Tường biên Đông',
    type: 'wall',
    position: { x: 5.5, y: 0, z: 0.75 },
    dimensions: { width: 0.25, depth: 11.0, height: 1.5 },
    color: '#475569',
    isStatic: true,
  },
  {
    id: 'wall_west',
    name: 'Tường biên Tây',
    type: 'wall',
    position: { x: -5.5, y: 0, z: 0.75 },
    dimensions: { width: 0.25, depth: 11.0, height: 1.5 },
    color: '#475569',
    isStatic: true,
  },
];

export const DEFAULT_LIDAR_CONFIG: LidarConfig = {
  numRays: 180,
  fovRad: 2 * Math.PI, // 360 deg full sweep
  minRangeM: 0.12,
  maxRangeM: 7.5,
  updateRateHz: 20,
};

export const DEFAULT_MISSION_POSES: MobilePoseWaypoint[] = [
  { id: 'pose_pickup', name: 'Trạm bốc dỡ hàng (A1)', x: -2.5, y: 2.0, thetaDeg: 90, segmentDuration: 6.0 },
  { id: 'pose_transfer', name: 'Điểm chuyển tiếp (B2)', x: 2.5, y: 1.5, thetaDeg: 0, segmentDuration: 8.0 },
  { id: 'pose_charge', name: 'Trạm sạc tự động (Home)', x: 0.0, y: -3.8, thetaDeg: 90, segmentDuration: 7.0 },
];

export interface MobileRobotStoreState {
  specs: MobileRobotSpecs;
  pose: MobileRobotPose;
  velocity: MobileRobotVelocity;
  wheelState: WheelState;
  obstacles: Obstacle[];
  lidarConfig: LidarConfig;
  lidarScan: LidarScanPoint[];
  navGoal: NavGoal | null;
  plannedPath: PathWaypoint[];
  currentWaypointIndex: number;
  isNavigating: boolean;
  navCrossTrackError: number;
  cameraMode: 'orbit' | 'chase' | 'top_down';
  tracePoints: Array<{ x: number; y: number }>;
  isSimRunning: boolean;

  // Multi-Physics Digital Twin state
  physicsFidelity: 'kinematic' | 'multiphysics';
  agvState: AGVState | null;
  agvHistory: AGVHistoryPoint[];
  isLiveRecording: boolean;

  // Mission Pose Waypoints
  poseWaypoints: MobilePoseWaypoint[];
  isMissionRunning: boolean;
  currentMissionIndex: number;
  navTargetSpeed: number;

  // Actions
  setPhysicsFidelity: (fidelity: 'kinematic' | 'multiphysics') => void;
  runScientificBenchmark: (tStopSec?: number) => AGVLogEntry[];
  exportBenchmarkCSV: () => string;
  runSCurveBenchmark: () => AGVLogEntry[];
  exportSCurveCSV: () => string;
  playSCurveManeuver: () => void;
  setIsSimRunning: (running: boolean) => void;
  toggleSimRunning: () => void;
  setIsLiveRecording: (recording: boolean) => void;
  clearAgvHistory: () => void;
  setDriveType: (type: MobileDriveType) => void;
  setTargetVelocity: (v: number, omega: number, vY?: number) => void;
  setPose: (pose: Partial<MobileRobotPose>) => void;
  resetPose: () => void;
  setNavGoal: (goal: NavGoal | null) => void;
  planPathToGoal: () => boolean;
  startAutonomousNavigation: () => void;
  stopAutonomousNavigation: () => void;
  addPoseWaypoint: (wp: Omit<MobilePoseWaypoint, 'id'>) => void;
  addPoseFromCurrent: (name?: string, duration?: number) => void;
  removePoseWaypoint: (id: string) => void;
  clearPoseWaypoints: () => void;
  executeMissionPose: (id: string) => void;
  executeMultiPoseMission: () => void;
  setCameraMode: (mode: 'orbit' | 'chase' | 'top_down') => void;
  addObstacle: (obs: Obstacle) => void;
  removeObstacle: (id: string) => void;
  clearObstacles: () => void;
  resetObstacles: () => void;
  clearTrace: () => void;
  tickSimulation: (dtSec: number) => void;
}

const agvEngine = new AGVDigitalTwinEngine();

export const useMobileRobotStore = create<MobileRobotStoreState>((set, get) => ({
  specs: DEFAULT_DIFF_DRIVE_SPECS,
  pose: { x: 0, y: -3.8, thetaRad: Math.PI / 2, z: 0.08 },
  velocity: { v: 0, vY: 0, omega: 0, steerAngleRad: 0 },
  wheelState: { speedsRadps: [0, 0], anglesRad: [0, 0] },
  obstacles: DEFAULT_WAREHOUSE_OBSTACLES,
  lidarConfig: DEFAULT_LIDAR_CONFIG,
  lidarScan: [],
  navGoal: { x: 0, y: 3.8, thetaRad: Math.PI / 2 },
  plannedPath: [],
  currentWaypointIndex: 0,
  isNavigating: false,
  navCrossTrackError: 0,
  cameraMode: 'orbit',
  tracePoints: [],
  isSimRunning: true,

  // Multi-Physics Digital Twin state
  physicsFidelity: 'multiphysics',
  agvState: agvEngine.getState(),
  agvHistory: [],
  isLiveRecording: true,

  // Mission Pose Waypoints
  poseWaypoints: DEFAULT_MISSION_POSES,
  isMissionRunning: false,
  currentMissionIndex: 0,
  navTargetSpeed: 0.8,

  setPhysicsFidelity: (fidelity: 'kinematic' | 'multiphysics') => {
    set({ physicsFidelity: fidelity });
  },

  setIsSimRunning: (running: boolean) => set({ isSimRunning: running }),
  toggleSimRunning: () => set((state) => ({ isSimRunning: !state.isSimRunning })),
  setIsLiveRecording: (recording: boolean) => set({ isLiveRecording: recording }),
  clearAgvHistory: () => set({ agvHistory: [] }),

  runScientificBenchmark: (tStopSec = 1.0): AGVLogEntry[] => {
    const freshEngine = new AGVDigitalTwinEngine();
    return freshEngine.simulateScientificBenchmark(tStopSec, 1.0e-6);
  },

  exportBenchmarkCSV: (): string => {
    const log = get().runScientificBenchmark(1.0);
    return AGVDigitalTwinEngine.exportToCSV(log);
  },

  runSCurveBenchmark: (): AGVLogEntry[] => {
    const freshEngine = new AGVDigitalTwinEngine();
    return freshEngine.simulateSCurveBenchmark(5.5, 1.0e-6);
  },

  exportSCurveCSV: (): string => {
    const log = get().runSCurveBenchmark();
    return AGVDigitalTwinEngine.exportToCSV(log);
  },

  playSCurveManeuver: () => {
    set({ isNavigating: false, isMissionRunning: false, isSimRunning: false });
    const log = get().runSCurveBenchmark();
    if (!log || log.length === 0) return;

    set({
      pose: { x: log[0].X, y: log[0].Y, thetaRad: log[0].psi, z: 0.08 },
      tracePoints: [{ x: log[0].X, y: log[0].Y }],
      velocity: { v: 0, vY: 0, omega: 0, steerAngleRad: 0 },
    });

    let idx = 0;
    const intervalMs = 25; // 40 FPS playback
    const stepRatio = Math.max(1, Math.round((intervalMs / 1000) / 1.0e-3));
    const timer = setInterval(() => {
      idx += stepRatio;
      if (idx >= log.length) {
        clearInterval(timer);
        set({ isSimRunning: true });
        return;
      }
      const entry = log[idx];
      const newPose = { x: entry.X, y: entry.Y, thetaRad: entry.psi, z: 0.08 };
      const currentTrace = get().tracePoints;
      const lastPt = currentTrace[currentTrace.length - 1];
      const newTrace = (!lastPt || Math.hypot(newPose.x - lastPt.x, newPose.y - lastPt.y) >= 0.04)
        ? [...currentTrace, { x: newPose.x, y: newPose.y }]
        : currentTrace;

      set((state) => ({
        pose: newPose,
        velocity: { v: entry.vx, vY: entry.vy, omega: entry.wz, steerAngleRad: 0 },
        wheelState: {
          speedsRadps: [entry.omega_wL, entry.omega_wR],
          anglesRad: [
            (state.wheelState.anglesRad[0] + entry.omega_wL * (intervalMs / 1000)) % (2 * Math.PI),
            (state.wheelState.anglesRad[1] + entry.omega_wR * (intervalMs / 1000)) % (2 * Math.PI),
          ],
        },
        tracePoints: newTrace,
      }));
    }, intervalMs);
  },

  setDriveType: (type: MobileDriveType) => {
    const specs = type === 'mecanum' ? DEFAULT_MECANUM_SPECS : DEFAULT_DIFF_DRIVE_SPECS;
    const numWheels = type === 'mecanum' ? 4 : 2;
    set({
      specs,
      wheelState: {
        speedsRadps: new Array(numWheels).fill(0),
        anglesRad: new Array(numWheels).fill(0),
      },
      velocity: { v: 0, vY: 0, omega: 0, steerAngleRad: 0 },
      isNavigating: false,
    });
  },

  setTargetVelocity: (v: number, omega: number, vY: number = 0) => {
    const { specs, isNavigating } = get();
    // Manual input cancels autonomous navigation
    if (isNavigating && (Math.abs(v) > 0.01 || Math.abs(omega) > 0.01 || Math.abs(vY) > 0.01)) {
      set({ isNavigating: false });
    }

    const clampedV = Math.max(-specs.maxLinearSpeedMps, Math.min(specs.maxLinearSpeedMps, v));
    const clampedVY = specs.driveType === 'mecanum'
      ? Math.max(-specs.maxLinearSpeedMps, Math.min(specs.maxLinearSpeedMps, vY))
      : 0;
    const clampedOmega = Math.max(-specs.maxAngularSpeedRadps, Math.min(specs.maxAngularSpeedRadps, omega));

    set({
      velocity: {
        v: clampedV,
        vY: clampedVY,
        omega: clampedOmega,
        steerAngleRad: 0,
      },
    });
  },

  setPose: (partialPose) => {
    set((state) => ({
      pose: { ...state.pose, ...partialPose },
    }));
  },

  resetPose: () => {
    agvEngine.resetState({ x: 0, y: -3.8, psi: Math.PI / 2 });
    set({
      pose: { x: 0, y: -3.8, thetaRad: Math.PI / 2, z: 0.08 },
      velocity: { v: 0, vY: 0, omega: 0, steerAngleRad: 0 },
      isNavigating: false,
      plannedPath: [],
      currentWaypointIndex: 0,
      tracePoints: [],
      agvState: agvEngine.getState(),
      agvHistory: [],
    });
  },

  setNavGoal: (goal: NavGoal | null) => {
    set({ navGoal: goal });
    if (goal) {
      get().planPathToGoal();
    }
  },

  planPathToGoal: (): boolean => {
    const { pose, navGoal, obstacles } = get();
    if (!navGoal) return false;

    const path = PathPlanner.planPath(pose.x, pose.y, navGoal.x, navGoal.y, obstacles);
    if (path && path.length > 0) {
      set({
        plannedPath: path,
        currentWaypointIndex: 0,
        isNavigating: false,
      });
      return true;
    }
    return false;
  },

  startAutonomousNavigation: () => {
    const { plannedPath } = get();
    if (plannedPath.length === 0) {
      const ok = get().planPathToGoal();
      if (!ok) return;
    }
    set({
      isNavigating: true,
      currentWaypointIndex: 0,
    });
  },

  stopAutonomousNavigation: () => {
    set({
      isNavigating: false,
      isMissionRunning: false,
      velocity: { v: 0, vY: 0, omega: 0, steerAngleRad: 0 },
    });
  },

  addPoseWaypoint: (wp) => {
    const newId = `pose_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newWp: MobilePoseWaypoint = {
      id: newId,
      name: wp.name || `Pose ${get().poseWaypoints.length + 1}`,
      x: Number(wp.x.toFixed(2)),
      y: Number(wp.y.toFixed(2)),
      thetaDeg: Number(wp.thetaDeg.toFixed(1)),
      segmentDuration: Math.max(0.5, Number(wp.segmentDuration.toFixed(1))),
    };
    set((state) => ({
      poseWaypoints: [...state.poseWaypoints, newWp],
    }));
  },

  addPoseFromCurrent: (name, duration = 5.0) => {
    const { pose, poseWaypoints } = get();
    const newWp: MobilePoseWaypoint = {
      id: `pose_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: name || `Pose ${poseWaypoints.length + 1}`,
      x: Number(pose.x.toFixed(2)),
      y: Number(pose.y.toFixed(2)),
      thetaDeg: Number(((pose.thetaRad * 180) / Math.PI).toFixed(1)),
      segmentDuration: Math.max(0.5, duration),
    };
    set((state) => ({
      poseWaypoints: [...state.poseWaypoints, newWp],
    }));
  },

  removePoseWaypoint: (id: string) => {
    set((state) => ({
      poseWaypoints: state.poseWaypoints.filter((w) => w.id !== id),
    }));
  },

  clearPoseWaypoints: () => {
    set({ poseWaypoints: [], isMissionRunning: false });
  },

  executeMissionPose: (id: string) => {
    const { poseWaypoints, pose, obstacles, specs } = get();
    const target = poseWaypoints.find((w) => w.id === id);
    if (!target) return;

    const goal: NavGoal = {
      x: target.x,
      y: target.y,
      thetaRad: (target.thetaDeg * Math.PI) / 180,
    };
    const path = PathPlanner.planPath(pose.x, pose.y, goal.x, goal.y, obstacles);
    if (!path || path.length === 0) return;

    const dist = path.reduce((acc, pt, idx) => {
      if (idx === 0) return 0;
      return acc + Math.hypot(pt.x - path[idx - 1].x, pt.y - path[idx - 1].y);
    }, 0);
    const speed = target.segmentDuration > 0
      ? Math.max(0.2, Math.min(specs.maxLinearSpeedMps, dist / target.segmentDuration))
      : 0.8;

    const idx = poseWaypoints.findIndex((w) => w.id === id);
    set({
      isMissionRunning: false,
      currentMissionIndex: idx !== -1 ? idx : 0,
      navGoal: goal,
      plannedPath: path,
      currentWaypointIndex: 0,
      isNavigating: true,
      navTargetSpeed: speed,
    });
  },

  executeMultiPoseMission: () => {
    const { poseWaypoints, pose, obstacles, specs } = get();
    if (poseWaypoints.length === 0) return;

    const firstTarget = poseWaypoints[0];
    const firstGoal: NavGoal = {
      x: firstTarget.x,
      y: firstTarget.y,
      thetaRad: (firstTarget.thetaDeg * Math.PI) / 180,
    };
    const path = PathPlanner.planPath(pose.x, pose.y, firstGoal.x, firstGoal.y, obstacles);
    if (!path || path.length === 0) return;

    const dist = path.reduce((acc, pt, idx) => {
      if (idx === 0) return 0;
      return acc + Math.hypot(pt.x - path[idx - 1].x, pt.y - path[idx - 1].y);
    }, 0);
    const speed = firstTarget.segmentDuration > 0
      ? Math.max(0.2, Math.min(specs.maxLinearSpeedMps, dist / firstTarget.segmentDuration))
      : 0.8;

    set({
      isMissionRunning: true,
      currentMissionIndex: 0,
      navGoal: firstGoal,
      plannedPath: path,
      currentWaypointIndex: 0,
      isNavigating: true,
      navTargetSpeed: speed,
    });
  },

  setCameraMode: (mode: 'orbit' | 'chase' | 'top_down') => {
    set({ cameraMode: mode });
  },

  addObstacle: (obs: Obstacle) => {
    set((state) => ({ obstacles: [...state.obstacles, obs] }));
  },

  removeObstacle: (id: string) => {
    set((state) => ({ obstacles: state.obstacles.filter((o) => o.id !== id) }));
  },

  clearObstacles: () => {
    // Keep perimeter boundary walls only
    set((state) => ({
      obstacles: state.obstacles.filter((o) => o.type === 'wall'),
    }));
  },

  resetObstacles: () => {
    set({ obstacles: DEFAULT_WAREHOUSE_OBSTACLES });
  },

  clearTrace: () => {
    set({ tracePoints: [] });
  },

  tickSimulation: (dtSec: number) => {
    const state = get();
    if (!state.isSimRunning) return;

    const { specs, pose, obstacles, lidarConfig, isNavigating, plannedPath, currentWaypointIndex, navGoal } = state;
    let vel = { ...state.velocity };
    let nextIdx = currentWaypointIndex;
    let xtrackErr = state.navCrossTrackError;

    // 1. Autonomous Navigation step if active
    if (isNavigating && plannedPath.length > 0) {
      const follow = TrajectoryFollower.computePurePursuit(
        pose,
        plannedPath,
        currentWaypointIndex,
        specs,
        state.navTargetSpeed || 0.8,
        navGoal?.thetaRad
      );

      vel = follow.velocity;
      nextIdx = follow.nextWaypointIndex;
      xtrackErr = follow.crossTrackErrorM;

      if (follow.isGoalReached) {
        const { isMissionRunning, currentMissionIndex, poseWaypoints } = get();
        if (isMissionRunning && currentMissionIndex + 1 < poseWaypoints.length) {
          const nextIdxMission = currentMissionIndex + 1;
          const nextTarget = poseWaypoints[nextIdxMission];
          const nextGoal: NavGoal = {
            x: nextTarget.x,
            y: nextTarget.y,
            thetaRad: (nextTarget.thetaDeg * Math.PI) / 180,
          };
          const nextPath = PathPlanner.planPath(pose.x, pose.y, nextGoal.x, nextGoal.y, obstacles);
          const dist = nextPath.reduce((acc, pt, idx) => {
            if (idx === 0) return 0;
            return acc + Math.hypot(pt.x - nextPath[idx - 1].x, pt.y - nextPath[idx - 1].y);
          }, 0);
          const computedSpeed = nextTarget.segmentDuration > 0
            ? Math.max(0.2, Math.min(specs.maxLinearSpeedMps, dist / nextTarget.segmentDuration))
            : 0.8;

          set({
            currentMissionIndex: nextIdxMission,
            navGoal: nextGoal,
            plannedPath: nextPath,
            currentWaypointIndex: 0,
            navTargetSpeed: computedSpeed,
          });
          vel = { v: 0, vY: 0, omega: 0, steerAngleRad: 0 };
        } else {
          set({
            isNavigating: false,
            isMissionRunning: false,
            velocity: { v: 0, vY: 0, omega: 0, steerAngleRad: 0 },
          });
          vel = { v: 0, vY: 0, omega: 0, steerAngleRad: 0 };
        }
      }
    }

    // 2. Multi-Physics Simulation OR Kinematic Integration
    let newPose: MobileRobotPose;
    let actualVel: MobileRobotVelocity;
    let wheelSpeeds: number[] = [];
    let nextAgvState = state.agvState;

    if (state.physicsFidelity === 'multiphysics' && specs.driveType === 'differential') {
      // High-performance closed-loop FOC / MTPA / Field-Weakening / CCC (SSoT Sections 3.7 & 3.8)
      // Coordinates dual IPMSMs with optimal reluctance torque and Lyapunov cross-coupled synchronization
      const updatedState = agvEngine.stepWithFOCAndCCC(dtSec, vel.v, vel.omega, 60);
      nextAgvState = updatedState;

      newPose = {
        x: updatedState.X,
        y: updatedState.Y,
        thetaRad: updatedState.psi,
        z: 0.08,
      };

      actualVel = {
        v: updatedState.vx,
        vY: 0,
        omega: updatedState.wz,
        steerAngleRad: 0,
      };

      wheelSpeeds = [updatedState.omega_wL, updatedState.omega_wR];
    } else {
      // Ideal kinematic integration
      newPose = MobileRobotKinematics.integrateOdometry(pose, vel, dtSec);
      actualVel = vel;
      if (specs.driveType === 'differential') {
        wheelSpeeds = MobileRobotKinematics.computeDifferentialDriveWheelSpeeds(vel.v, vel.omega, specs);
      } else {
        wheelSpeeds = MobileRobotKinematics.computeMecanumWheelSpeeds(vel.v, vel.vY ?? 0, vel.omega, specs);
      }
      agvEngine.resetState({ x: newPose.x, y: newPose.y, psi: newPose.thetaRad });
    }

    const newWheelState = MobileRobotKinematics.updateWheelAngles(state.wheelState, wheelSpeeds, dtSec);

    // 4. Raycast LIDAR
    const scan = LidarSensor.simulateScan(newPose, obstacles, lidarConfig);

    // 5. Accumulate ground trace points
    const trace = [...state.tracePoints];
    const lastP = trace[trace.length - 1];
    if (!lastP || Math.hypot(newPose.x - lastP.x, newPose.y - lastP.y) >= 0.08) {
      trace.push({ x: newPose.x, y: newPose.y });
      if (trace.length > 800) trace.shift();
    }

    // 6. Accumulate time-series history for real-time Mobile Robot Oscilloscope
    let newHistory = state.agvHistory;
    if (state.isLiveRecording) {
      const historyPoint: AGVHistoryPoint = nextAgvState ? {
        time: Number(nextAgvState.time.toFixed(4)),
        vx: nextAgvState.vx,
        wz: nextAgvState.wz,
        vL: nextAgvState.vL,
        vR: nextAgvState.vR,
        omega_wL: nextAgvState.omega_wL,
        omega_wR: nextAgvState.omega_wR,
        id_L: nextAgvState.id_L,
        iq_L: nextAgvState.iq_L,
        id_R: nextAgvState.id_R,
        iq_R: nextAgvState.iq_R,
        Te_L: nextAgvState.Te_L,
        Te_R: nextAgvState.Te_R,
        Vdc: nextAgvState.Vdc,
        Ibatt: nextAgvState.Ibatt,
        slip_L: nextAgvState.slip_L,
        slip_R: nextAgvState.slip_R,
        Fx_L: nextAgvState.Fx_L,
        Fx_R: nextAgvState.Fx_R,
        Fz_L: nextAgvState.Fz_L,
        Fz_R: nextAgvState.Fz_R,
        Fz_cF: nextAgvState.Fz_cF,
        Fz_cR: nextAgvState.Fz_cR,
        psi_cF: nextAgvState.psi_cF,
        psi_cR: nextAgvState.psi_cR,
        omega_cF: nextAgvState.omega_cF,
        omega_cR: nextAgvState.omega_cR,
        ax: nextAgvState.ax,
        ay: nextAgvState.ay,
        pitchDeg: nextAgvState.pitchDeg,
        rollDeg: nextAgvState.rollDeg,
        id_ref_L: nextAgvState.id_ref_L,
        iq_ref_L: nextAgvState.iq_ref_L,
        id_ref_R: nextAgvState.id_ref_R,
        iq_ref_R: nextAgvState.iq_ref_R,
        S_fw_L: nextAgvState.S_fw_L,
        S_fw_R: nextAgvState.S_fw_R,
        Vmag_L: nextAgvState.Vmag_L,
        Vmag_R: nextAgvState.Vmag_R,
        id_fw_L: nextAgvState.id_fw_L,
        id_fw_R: nextAgvState.id_fw_R,
        epsilon_ccc: nextAgvState.epsilon_ccc,
        u_sync: nextAgvState.u_sync,
        Te_cmd_L: nextAgvState.Te_cmd_L,
        Te_cmd_R: nextAgvState.Te_cmd_R,
      } : {
        time: Number(((state.agvHistory[state.agvHistory.length - 1]?.time || 0) + dtSec).toFixed(4)),
        vx: actualVel.v,
        wz: actualVel.omega,
        vL: actualVel.v - (specs.trackWidthM / 2) * actualVel.omega,
        vR: actualVel.v + (specs.trackWidthM / 2) * actualVel.omega,
        omega_wL: wheelSpeeds[0] || 0,
        omega_wR: wheelSpeeds[1] || 0,
        id_L: 0, iq_L: 0, id_R: 0, iq_R: 0,
        Te_L: 0, Te_R: 0,
        Vdc: 48, Ibatt: 0,
        slip_L: 0, slip_R: 0,
        Fx_L: 0, Fx_R: 0,
        Fz_L: 654, Fz_R: 654,
        Fz_cF: 327, Fz_cR: 327,
        psi_cF: 0, psi_cR: 0,
        omega_cF: 0, omega_cR: 0,
        ax: 0, ay: actualVel.v * actualVel.omega,
        pitchDeg: 0, rollDeg: 0,
        id_ref_L: 0, iq_ref_L: 0,
        id_ref_R: 0, iq_ref_R: 0,
        S_fw_L: 0, S_fw_R: 0,
        Vmag_L: 0, Vmag_R: 0,
        id_fw_L: 0, id_fw_R: 0,
        epsilon_ccc: 0, u_sync: 0,
        Te_cmd_L: 0, Te_cmd_R: 0,
      };

      newHistory = [...state.agvHistory, historyPoint];
      if (newHistory.length > 500) {
        newHistory.shift();
      }
    }

    set({
      pose: newPose,
      velocity: actualVel,
      wheelState: newWheelState,
      agvState: nextAgvState,
      agvHistory: newHistory,
      lidarScan: scan,
      currentWaypointIndex: nextIdx,
      navCrossTrackError: xtrackErr,
      tracePoints: trace,
    });
  },
}));
