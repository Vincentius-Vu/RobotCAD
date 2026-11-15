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
import {
  KDSNode,
  KDSTrajectoryPoint,
  KDSPlanResult,
  SOTABenchmarkSummary,
  KDSMotionPlanner,
} from '../navigation/KDSMotionPlanner';
import { TrajectoryAlgorithm } from '../kinematics/TrajectoryProfileGenerators';
import {
  MultiPhysicsBatchBenchmark,
  MultiPhysicsBatchReport,
} from '../navigation/MultiPhysicsBatchBenchmark';
import { KDSEnergyModel, DEFAULT_AMR_ACTUATOR_PARAMS } from '../physics/mobile/KDSEnergyModel';
import {
  DiscreteLyapunovTracker,
  DEFAULT_LYAPUNOV_CONFIG,
  TrackingControlOutput,
} from '../navigation/DiscreteLyapunovTracker';
import { IndustrialContinuousPlanner } from '../navigation/IndustrialContinuousPlanner';


export interface BenchmarkScenario {
  id: number;
  name: string;
  category: string;
  description: string;
  distanceM: number;
  nodes: KDSNode[];
}

export const BENCHMARK_SCENARIOS: BenchmarkScenario[] = [
  {
    id: 1,
    name: 'Kịch bản 1: Tuyến chuẩn Logistics (SIMPAT Baseline)',
    category: 'Standard Route',
    description: 'Tuyến đường cơ sở 4 trạm gồm đoạn thẳng tốc độ cao, rẽ vuông góc và cập bến dock (11.3 m).',
    distanceM: 11.3,
    nodes: [
      { id: 1, name: 'N1 (Dock/Start)', type: 'Waypoint', x: 0.0, y: 0.0, theta: 0.0, t_arrival: 0.0, t_dwell: 1.0 },
      { id: 2, name: 'N2 (Aisle Turn 1)', type: 'Waypoint', x: 2.0, y: 2.0, theta: 0.0, t_arrival: 0.0, t_dwell: 0.0 },
      { id: 3, name: 'N3 (Aisle Turn 2)', type: 'Waypoint', x: 2.0, y: -2.0, theta: 0.0, t_arrival: 0.0, t_dwell: 0.0 },
      { id: 4, name: 'N4 (Station Dock)', type: 'Target', x: -2.0, y: 0.0, theta: Math.PI / 2.0, t_arrival: 0.0, t_dwell: 2.0 },
    ],
  },
  {
    id: 2,
    name: 'Kịch bản 2: Tránh vật cản & Chuyển làn đôi (Double Lane Change)',
    category: 'Obstacle Bypass',
    description: 'Chuyển làn liên tục hình chữ S đánh giá lực quán tính ngang, trượt lốp cao su và mô-men cản xoay caster (13.5 m).',
    distanceM: 13.5,
    nodes: [
      { id: 1, name: 'N1 (Entry Aisle)', type: 'Waypoint', x: 0.0, y: 0.0, theta: 0.0, t_arrival: 0.0, t_dwell: 0.5 },
      { id: 2, name: 'N2 (Obstacle Approach)', type: 'Waypoint', x: 3.0, y: 0.0, theta: 0.0, t_arrival: 0.0, t_dwell: 0.0 },
      { id: 3, name: 'N3 (Left Lane In)', type: 'Waypoint', x: 5.0, y: 1.5, theta: 0.0, t_arrival: 0.0, t_dwell: 0.0 },
      { id: 4, name: 'N4 (Bypass Straight)', type: 'Waypoint', x: 8.0, y: 1.5, theta: 0.0, t_arrival: 0.0, t_dwell: 0.0 },
      { id: 5, name: 'N5 (Right Return)', type: 'Waypoint', x: 10.0, y: 0.0, theta: 0.0, t_arrival: 0.0, t_dwell: 0.0 },
      { id: 6, name: 'N6 (Exit Station)', type: 'Target', x: 13.0, y: 0.0, theta: 0.0, t_arrival: 0.0, t_dwell: 1.0 },
    ],
  },
  {
    id: 3,
    name: 'Kịch bản 3: Hành lang hẹp 90° & Cập kệ chính xác (Narrow Aisle & Docking)',
    category: 'Aisle Containment',
    description: 'Thao tác trong không gian kệ hàng hẹp, kiểm tra giới hạn an toàn lệch ngang |ey| < 100 mm và ma sát scrub caster.',
    distanceM: 7.5,
    nodes: [
      { id: 1, name: 'N1 (Corridor Start)', type: 'Waypoint', x: 0.0, y: 0.0, theta: 0.0, t_arrival: 0.0, t_dwell: 0.5 },
      { id: 2, name: 'N2 (90° Corner Pivot)', type: 'Waypoint', x: 4.0, y: 0.0, theta: 0.0, t_arrival: 0.0, t_dwell: 0.0 },
      { id: 3, name: 'N3 (Rack Entry Aisle)', type: 'Waypoint', x: 4.0, y: 2.5, theta: Math.PI / 2.0, t_arrival: 0.0, t_dwell: 0.0 },
      { id: 4, name: 'N4 (Buffer Dock End)', type: 'Target', x: 4.0, y: 1.0, theta: Math.PI / 2.0, t_arrival: 0.0, t_dwell: 2.0 },
    ],
  },
  {
    id: 4,
    name: 'Kịch bản 4: Vòng lặp tuần hoàn kho bãi (High-Cadence Warehouse Loop)',
    category: 'Continuous Endurance',
    description: 'Chu trình khép kín 6 trạm kiểm nghiệm tích lũy nhiệt cuộn dây stator và tiêu hao năng lượng phụ trợ kéo dài (20.0 m).',
    distanceM: 20.0,
    nodes: [
      { id: 1, name: 'N1 (Charging Bay)', type: 'Waypoint', x: 0.0, y: 0.0, theta: 0.0, t_arrival: 0.0, t_dwell: 1.0 },
      { id: 2, name: 'N2 (Aisle South)', type: 'Waypoint', x: 6.0, y: 0.0, theta: 0.0, t_arrival: 0.0, t_dwell: 0.0 },
      { id: 3, name: 'N3 (East Transfer)', type: 'Waypoint', x: 6.0, y: 4.0, theta: Math.PI / 2.0, t_arrival: 0.0, t_dwell: 0.0 },
      { id: 4, name: 'N4 (Inspection Station)', type: 'Waypoint', x: 3.0, y: 4.0, theta: Math.PI, t_arrival: 0.0, t_dwell: 0.0 },
      { id: 5, name: 'N5 (Depot West)', type: 'Waypoint', x: 0.0, y: 4.0, theta: Math.PI, t_arrival: 0.0, t_dwell: 0.0 },
      { id: 6, name: 'N6 (Loop Return)', type: 'Target', x: 0.0, y: 0.0, theta: -Math.PI / 2.0, t_arrival: 0.0, t_dwell: 2.0 },
    ],
  },
  {
    id: 5,
    name: 'Kịch bản 5: Bứt tốc cực đại & Dừng khẩn cấp (Acceleration & Emergency Stop)',
    category: 'Stress / Shock Test',
    description: 'Đẩy tải gia tốc cực hạn lên 1.2 m/s rồi phanh gấp, kiểm tra xung dòng FOC và biên độ quá áp DC-Link.',
    distanceM: 6.5,
    nodes: [
      { id: 1, name: 'N1 (Launch Pad)', type: 'Waypoint', x: 0.0, y: 0.0, theta: 0.0, t_arrival: 0.0, t_dwell: 0.5 },
      { id: 2, name: 'N2 (Full Throttle Cruise)', type: 'Waypoint', x: 4.0, y: 0.0, theta: 0.0, t_arrival: 0.0, t_dwell: 0.0 },
      { id: 3, name: 'N3 (Emergency Stop Line)', type: 'Target', x: 6.5, y: 0.0, theta: 0.0, t_arrival: 0.0, t_dwell: 2.0 },
    ],
  },
];

export const DEFAULT_KDS_NODES: KDSNode[] = BENCHMARK_SCENARIOS[0].nodes;


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
  // Layer 3 Closed-Loop Tracking Telemetry
  ePosMm?: number;
  eThetaDeg?: number;
  exMm?: number;
  eyMm?: number;
  vRef?: number;
  wRef?: number;
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

export const DEFAULT_WHEEL_LEGGED_SPECS: MobileRobotSpecs = {
  id: 'wheel_legged_bipedal_01',
  name: 'Wheel-Legged Robot (ESP32 Onshape)',
  driveType: 'wheel_legged',
  chassisWidthM: 0.277,
  chassisLengthM: 0.386,
  chassisHeightM: 0.237,
  wheelRadiusM: 0.035,
  trackWidthM: 0.200,
  wheelBaseM: 0.0,
  maxLinearSpeedMps: 2.5,
  maxAngularSpeedRadps: 5.0,
  maxAccelerationMps2: 4.0,
  massKg: 2.2,
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

  // Context-Aware KDS & S-Curve State
  systemMode: 'industrial' | 'research';
  researchSubTab: 'trajectory_planning' | 'tracking_control' | 'plant_physics';
  kdsSelectedAlgorithm: TrajectoryAlgorithm;
  kdsNodes: KDSNode[];
  kdsTrajectory: KDSTrajectoryPoint[];
  kdsPlanResult: KDSPlanResult | null;
  sotaBenchmarkSummary: SOTABenchmarkSummary | null;
  kdsUseOptimalScaling: boolean;
  kdsIsPlaying: boolean;
  isKDSSOTAModalOpen: boolean;
  criticalDistanceM: number;
  kdsTrackingMode: 'closed_loop' | 'open_loop';
  kdsEnableDisturbance: boolean;
  kdsTrackingError: TrackingControlOutput | null;
  kdsTrackingHistory: {
    t: number;
    ePosMm: number;
    eThetaDeg: number;
    exMm: number;
    eyMm: number;
    vRef: number;
    vCmd: number;
    wRef: number;
    wCmd: number;
  }[];

  // Automated Multi-Physics Batch Benchmark State
  batchBenchmarkReport: MultiPhysicsBatchReport | null;
  isBatchBenchmarkRunning: boolean;
  batchBenchmarkProgress: number;
  batchBenchmarkStatusText: string;
  isBatchBenchmarkModalOpen: boolean;
  activeScenarioId: number;

  // Actions
  setSystemMode: (mode: 'industrial' | 'research') => void;
  setResearchSubTab: (tab: 'trajectory_planning' | 'tracking_control' | 'plant_physics') => void;
  startIndustrialAutonomousMission: () => boolean;
  stopIndustrialMission: () => void;
  setKDSTrackingMode: (mode: 'closed_loop' | 'open_loop') => void;
  setKDSEnableDisturbance: (enable: boolean) => void;
  setKDSNodes: (nodes: KDSNode[]) => void;

  addKDSNode: (node: Omit<KDSNode, 'id'>) => void;
  removeKDSNode: (id: number) => void;
  toggleKDSNodeType: (id: number) => void;
  updateKDSNode: (id: number, updates: Partial<KDSNode>) => void;
  setKDSSelectedAlgorithm: (algo: TrajectoryAlgorithm) => void;
  setKDSUseOptimalScaling: (useOptimal: boolean) => void;
  generateKDSPlan: () => KDSPlanResult;
  playKDSTrajectory: () => void;
  stopKDSTrajectory: () => void;
  runKDSSOTABenchmark: () => SOTABenchmarkSummary;
  setKDSSOTAModalOpen: (open: boolean) => void;
  exportKDSResultsCSV: () => string;
  runMultiPhysicsBatchBenchmark: (scenarioName?: string) => Promise<MultiPhysicsBatchReport>;
  setBatchBenchmarkModalOpen: (open: boolean) => void;
  exportBatchBenchmarkCSV: () => string;
  loadBenchmarkScenario: (scenarioId: number) => void;
  loadGrandLogisticsScenario: () => void;
  loadShortAisleScenario: () => void;

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

  // Context-Aware KDS & S-Curve State
  systemMode: 'industrial',
  researchSubTab: 'trajectory_planning',
  kdsSelectedAlgorithm: 'kds_scurve',
  kdsNodes: DEFAULT_KDS_NODES,
  kdsTrajectory: [],
  kdsPlanResult: null,
  sotaBenchmarkSummary: null,
  kdsUseOptimalScaling: true,
  kdsIsPlaying: false,
  isKDSSOTAModalOpen: false,
  criticalDistanceM: KDSEnergyModel.findCriticalDistance(),
  kdsTrackingMode: 'closed_loop',
  kdsEnableDisturbance: true,
  kdsTrackingError: null,
  kdsTrackingHistory: [],

  // Automated Multi-Physics Batch Benchmark State
  batchBenchmarkReport: null,
  isBatchBenchmarkRunning: false,
  batchBenchmarkProgress: 0,
  batchBenchmarkStatusText: '',
  isBatchBenchmarkModalOpen: false,
  activeScenarioId: 1,

  setSystemMode: (mode: 'industrial' | 'research') => {
    set({ systemMode: mode });
  },

  setResearchSubTab: (tab: 'trajectory_planning' | 'tracking_control' | 'plant_physics') => {
    set({ researchSubTab: tab });
  },

  startIndustrialAutonomousMission: (): boolean => {
    const { pose, navGoal, obstacles } = get();
    if (!navGoal) return false;

    // 1. Path Planning (Layer 3: Collision-Free Geometric Path via A*)
    const rawPath = PathPlanner.planPath(pose.x, pose.y, navGoal.x, navGoal.y, obstacles);
    if (!rawPath || rawPath.length < 2) return false;

    // 2. Continuous S-Curve Trajectory Generation with Corner Blending (Layer 2)
    // Non-stop profile: maintains v > 0 through corners, decelerates to v = 0 ONLY at Docking Goal
    const continuousPlan = IndustrialContinuousPlanner.planContinuousTrajectory(
      rawPath,
      pose,
      navGoal.thetaRad,
      obstacles,
      DEFAULT_AMR_ACTUATOR_PARAMS,
      0.005
    );

    if (!continuousPlan || continuousPlan.points.length === 0) return false;

    // 3. Extract pruned corner waypoints for UI visualization
    const prunedWaypoints = IndustrialContinuousPlanner.prunePathLineOfSight(rawPath, obstacles);
    const nodes: KDSNode[] = prunedWaypoints.map((pt, idx) => {
      const isStart = idx === 0;
      const isGoal = idx === prunedWaypoints.length - 1;
      let heading = 0;
      if (isStart) heading = pose.thetaRad;
      else if (isGoal) heading = navGoal.thetaRad ?? 0;
      else {
        const prev = prunedWaypoints[idx - 1];
        heading = Math.atan2(pt.y - prev.y, pt.x - prev.x);
      }

      return {
        id: idx + 1,
        name: isStart
          ? 'Khởi hành (Start)'
          : isGoal
          ? 'Trạm Đích (Target Docking)'
          : `Góc Cua Bo Tròn C${idx}`,
        x: Number(pt.x.toFixed(2)),
        y: Number(pt.y.toFixed(2)),
        theta: heading,
        type: isGoal ? 'Target' : 'Waypoint',
        t_dwell: isGoal ? 2.0 : 0.0,
      };
    });

    set({
      plannedPath: rawPath,
      kdsNodes: nodes,
      kdsTrajectory: continuousPlan.points,
      kdsPlanResult: continuousPlan,
      kdsTrackingMode: 'closed_loop',
      kdsEnableDisturbance: false,
    });

    // 4. Execute Closed-Loop Discrete Lyapunov Tracking (Layer 1 & Layer 0 Multi-Physics)
    get().playKDSTrajectory();
    return true;
  },

  stopIndustrialMission: () => {
    get().stopKDSTrajectory();
    get().stopAutonomousNavigation();
  },

  setKDSTrackingMode: (mode: 'closed_loop' | 'open_loop') => {
    set({ kdsTrackingMode: mode });
  },

  setKDSEnableDisturbance: (enable: boolean) => {
    set({ kdsEnableDisturbance: enable });
  },

  setKDSNodes: (nodes: KDSNode[]) => {

    set({ kdsNodes: nodes });
  },

  addKDSNode: (node: Omit<KDSNode, 'id'>) => {
    const current = get().kdsNodes;
    const nextId = current.length > 0 ? Math.max(...current.map((n) => n.id)) + 1 : 1;
    const newNode: KDSNode = { ...node, id: nextId };
    set({ kdsNodes: [...current, newNode] });
  },

  removeKDSNode: (id: number) => {
    set((state) => ({ kdsNodes: state.kdsNodes.filter((n) => n.id !== id) }));
  },

  toggleKDSNodeType: (id: number) => {
    set((state) => ({
      kdsNodes: state.kdsNodes.map((n) =>
        n.id === id ? { ...n, type: n.type === 'Waypoint' ? 'Target' : 'Waypoint' } : n
      ),
    }));
  },

  updateKDSNode: (id: number, updates: Partial<KDSNode>) => {
    set((state) => ({
      kdsNodes: state.kdsNodes.map((n) => (n.id === id ? { ...n, ...updates } : n)),
    }));
  },

  setKDSSelectedAlgorithm: (algo: TrajectoryAlgorithm) => {
    set({ kdsSelectedAlgorithm: algo });
    get().generateKDSPlan();
  },

  setKDSUseOptimalScaling: (useOptimal: boolean) => {
    set({ kdsUseOptimalScaling: useOptimal });
  },

  generateKDSPlan: (): KDSPlanResult => {
    const { kdsNodes, kdsUseOptimalScaling, kdsSelectedAlgorithm } = get();
    const result = KDSMotionPlanner.planTrajectory(
      kdsNodes,
      kdsUseOptimalScaling,
      DEFAULT_AMR_ACTUATOR_PARAMS,
      0.005,
      true,
      kdsSelectedAlgorithm
    );
    set({ kdsPlanResult: result, kdsTrajectory: result.points });
    return result;
  },

  playKDSTrajectory: () => {
    const { kdsTrajectory, generateKDSPlan, stopKDSTrajectory, kdsTrackingMode, kdsEnableDisturbance } = get();
    let traj = kdsTrajectory;
    if (!traj || traj.length === 0) {
      const res = generateKDSPlan();
      traj = res.points;
    }
    if (!traj || traj.length === 0) return;

    stopKDSTrajectory();

    // Perturbation: initial pose offset (Delta x = -0.12m, Delta y = +0.15m, Delta theta = +6.0 deg)
    const initOffsetX = kdsEnableDisturbance ? -0.12 : 0;
    const initOffsetY = kdsEnableDisturbance ? 0.15 : 0;
    const initOffsetTh = kdsEnableDisturbance ? (6.0 * Math.PI) / 180.0 : 0;

    const startPose = {
      x: traj[0].x + initOffsetX,
      y: traj[0].y + initOffsetY,
      thetaRad: traj[0].theta + initOffsetTh,
      z: 0.08,
    };

    // Initialize Multi-Physics Digital Twin Engine for realistic PMSM / Inverter / Pacejka simulation
    if (get().specs.driveType === 'differential') {
      agvEngine.resetState({ x: startPose.x, y: startPose.y, psi: startPose.thetaRad });
    }

    set({
      isNavigating: false,
      isMissionRunning: false,
      isSimRunning: false,
      kdsIsPlaying: true,
      pose: startPose,
      tracePoints: [{ x: startPose.x, y: startPose.y }],
      velocity: { v: traj[0].v, vY: 0, omega: traj[0].w, steerAngleRad: 0 },
      kdsTrackingError: null,
      kdsTrackingHistory: [],
      agvHistory: [], // reset history for live oscilloscope stream
    });


    let currentPose = { ...startPose };
    let idx = 0;
    const intervalMs = 25; // 40 FPS playback (0.025 s)
    const dtSec = intervalMs / 1000.0;
    const dtTraj = traj.length > 1 ? (traj[1].t - traj[0].t) : 0.005;
    const stepRatio = Math.max(1, Math.round(dtSec / dtTraj));

    const trackingHistory: {
      t: number;
      ePosMm: number;
      eThetaDeg: number;
      exMm: number;
      eyMm: number;
      vRef: number;
      vCmd: number;
      wRef: number;
      wCmd: number;
    }[] = [];

    const timer = setInterval(() => {
      idx += stepRatio;
      if (idx >= traj.length) {
        clearInterval(timer);
        // Safely park AGV Digital Twin at goal destination and prevent unsolicited simulation restarts
        agvEngine.resetState({ x: currentPose.x, y: currentPose.y, psi: currentPose.thetaRad });

        (set as any)({
          _kdsTimer: null,
          kdsIsPlaying: false,
          isSimRunning: false, // Keep simulation stopped so robot remains stationary and stable
          isNavigating: false,
          isMissionRunning: false,
          velocity: { v: 0, vY: 0, omega: 0, steerAngleRad: 0 },
          wheelState: {
            speedsRadps: [0, 0],
            anglesRad: get().wheelState.anglesRad,
          },
        });
        return;
      }
      const refPt = traj[idx];

      let vExec = refPt.v;
      let wExec = refPt.w;
      let newPose = { ...currentPose };
      let trackingOutput: TrackingControlOutput | null = null;

      const specs = get().specs;
      // Tire micro-slip disturbance model on warehouse floor (1.5% micro-slip)
      const slipFactor = kdsEnableDisturbance ? (1.0 - 0.018 * Math.sin(refPt.t * 2.5)) : 1.0;
      let nextAgvState: AGVState | null = null;
      const isMultiPhys = get().physicsFidelity === 'multiphysics' && specs.driveType === 'differential';

      if (kdsTrackingMode === 'closed_loop') {
        // Run Layer 3 Discrete Lyapunov Controller with measured yaw rate damping
        const curWz = isMultiPhys ? agvEngine.getState().wz : undefined;
        trackingOutput = DiscreteLyapunovTracker.computeControl(
          currentPose,
          refPt,
          DEFAULT_LYAPUNOV_CONFIG,
          curWz
        );
        vExec = trackingOutput.v_cmd;
        wExec = trackingOutput.omega_cmd;

        if (isMultiPhys) {
          // Multi-physics closed-loop execution (Dual IPMSM + FOC + CCC + Pacejka tire dynamics)
          nextAgvState = agvEngine.stepWithFOCAndCCC(dtSec, vExec, wExec, refPt.a, 200);
          newPose = {
            x: nextAgvState.X,
            y: nextAgvState.Y,
            thetaRad: nextAgvState.psi,
            z: 0.08,
          };
        } else {
          // Numerical integration of real AMR motion under commanded velocities + floor slip
          newPose = MobileRobotKinematics.integrateOdometry(
            currentPose,
            { v: vExec * slipFactor, vY: 0, omega: wExec, steerAngleRad: 0 },
            dtSec
          );
        }

        // Record tracking error telemetry
        trackingHistory.push({
          t: refPt.t,
          ePosMm: trackingOutput.ePosMm,
          eThetaDeg: trackingOutput.eThetaDeg,
          exMm: trackingOutput.ex * 1000.0,
          eyMm: trackingOutput.ey * 1000.0,
          vRef: refPt.v,
          vCmd: vExec,
          wRef: refPt.w,
          wCmd: wExec,
        });
      } else {
        // Open-loop kinematic playback:
        // Robot executes pure feedforward velocity commands without feedback regulation
        vExec = refPt.v;
        wExec = refPt.w;

        if (isMultiPhys) {
          nextAgvState = agvEngine.stepWithFOCAndCCC(dtSec, vExec, wExec, refPt.a, 200);
          newPose = {
            x: nextAgvState.X,
            y: nextAgvState.Y,
            thetaRad: nextAgvState.psi,
            z: 0.08,
          };
        } else {
          newPose = MobileRobotKinematics.integrateOdometry(
            currentPose,
            { v: vExec * slipFactor, vY: 0, omega: wExec, steerAngleRad: 0 },
            dtSec
          );
        }

        // Compute actual open-loop deviation from reference trajectory
        const dx = refPt.x - newPose.x;
        const dy = refPt.y - newPose.y;
        const th = newPose.thetaRad;
        const cosTh = Math.cos(th);
        const sinTh = Math.sin(th);
        const ex = cosTh * dx + sinTh * dy;
        const ey = -sinTh * dx + cosTh * dy;
        const eTheta = MobileRobotKinematics.normalizeAngle(refPt.theta - th);
        const ePosM = Math.hypot(ex, ey);

        trackingOutput = {
          v_cmd: vExec,
          omega_cmd: wExec,
          ex,
          ey,
          eThetaRad: eTheta,
          eThetaDeg: (eTheta * 180.0) / Math.PI,
          ePosM,
          ePosMm: ePosM * 1000.0,
          lyapunovV: 0.5 * (ex * ex + ey * ey),
          isDwell: false,
        };

        trackingHistory.push({
          t: refPt.t,
          ePosMm: trackingOutput.ePosMm,
          eThetaDeg: trackingOutput.eThetaDeg,
          exMm: trackingOutput.ex * 1000.0,
          eyMm: trackingOutput.ey * 1000.0,
          vRef: refPt.v,
          vCmd: vExec,
          wRef: refPt.w,
          wCmd: wExec,
        });
      }

      currentPose = newPose;

      const currentTrace = get().tracePoints;
      const lastPt = currentTrace[currentTrace.length - 1];
      const newTrace = (!lastPt || Math.hypot(newPose.x - lastPt.x, newPose.y - lastPt.y) >= 0.04)
        ? [...currentTrace, { x: newPose.x, y: newPose.y }]
        : currentTrace;

      // Construct live telemetry point for Mobile Robot Oscilloscope
      const vL = vExec - (specs.trackWidthM / 2.0) * wExec;
      const vR = vExec + (specs.trackWidthM / 2.0) * wExec;
      const wL = vL / specs.wheelRadiusM;
      const wR = vR / specs.wheelRadiusM;

      const histPt: AGVHistoryPoint = nextAgvState ? {
        time: Number(refPt.t.toFixed(4)),
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
        ePosMm: trackingOutput ? trackingOutput.ePosMm : 0,
        eThetaDeg: trackingOutput ? trackingOutput.eThetaDeg : 0,
        exMm: trackingOutput ? trackingOutput.ex * 1000 : 0,
        eyMm: trackingOutput ? trackingOutput.ey * 1000 : 0,
        vRef: refPt.v,
        wRef: refPt.w,
      } : {
        time: Number(refPt.t.toFixed(3)),
        vx: vExec,
        wz: wExec,
        vL,
        vR,
        omega_wL: wL,
        omega_wR: wR,
        id_L: 0,
        iq_L: trackingOutput ? trackingOutput.v_cmd * 3.5 : vExec * 3.5,
        id_R: 0,
        iq_R: trackingOutput ? trackingOutput.v_cmd * 3.5 : vExec * 3.5,
        Te_L: 0.5 * refPt.a * specs.massKg * specs.wheelRadiusM,
        Te_R: 0.5 * refPt.a * specs.massKg * specs.wheelRadiusM,
        Vdc: 48.0,
        Ibatt: Math.max(0.2, refPt.P_total / 48.0),
        slip_L: 0.005 * Math.abs(wExec),
        slip_R: 0.005 * Math.abs(wExec),
        Fx_L: 0.5 * refPt.a * specs.massKg,
        Fx_R: 0.5 * refPt.a * specs.massKg,
        Fz_L: specs.massKg * 9.81 * 0.35,
        Fz_R: specs.massKg * 9.81 * 0.35,
        Fz_cF: specs.massKg * 9.81 * 0.15,
        Fz_cR: specs.massKg * 9.81 * 0.15,
        psi_cF: 0,
        psi_cR: 0,
        omega_cF: 0,
        omega_cR: 0,
        ax: refPt.a,
        ay: vExec * wExec,
        pitchDeg: -refPt.a * 0.8,
        rollDeg: vExec * wExec * 0.5,
        id_ref_L: 0,
        iq_ref_L: 0,
        id_ref_R: 0,
        iq_ref_R: 0,
        S_fw_L: 0,
        S_fw_R: 0,
        Vmag_L: Math.abs(vExec) * 12,
        Vmag_R: Math.abs(vExec) * 12,
        id_fw_L: 0,
        id_fw_R: 0,
        epsilon_ccc: 0,
        u_sync: 0,
        Te_cmd_L: 0,
        Te_cmd_R: 0,
        ePosMm: trackingOutput ? trackingOutput.ePosMm : 0,
        eThetaDeg: trackingOutput ? trackingOutput.eThetaDeg : 0,
        exMm: trackingOutput ? trackingOutput.ex * 1000 : 0,
        eyMm: trackingOutput ? trackingOutput.ey * 1000 : 0,
        vRef: refPt.v,
        wRef: refPt.w,
      };

      set((state) => {
        let nextHist = [...state.agvHistory, histPt];
        if (nextHist.length > 600) nextHist.shift();

        const actVel = nextAgvState ? {
          v: nextAgvState.vx,
          vY: 0,
          omega: nextAgvState.wz,
          steerAngleRad: 0,
        } : { v: vExec, vY: 0, omega: wExec, steerAngleRad: 0 };

        const actWheelSpeeds = nextAgvState
          ? [nextAgvState.omega_wL, nextAgvState.omega_wR]
          : [wL, wR];

        return {
          pose: newPose,
          velocity: actVel,
          wheelState: {
            speedsRadps: actWheelSpeeds,
            anglesRad: [
              state.wheelState.anglesRad[0] + actWheelSpeeds[0] * dtSec,
              state.wheelState.anglesRad[1] + actWheelSpeeds[1] * dtSec,
            ],
          },
          tracePoints: newTrace,
          kdsTrackingError: trackingOutput,
          kdsTrackingHistory: trackingHistory.length % 3 === 0 ? [...trackingHistory] : state.kdsTrackingHistory,
          agvHistory: nextHist,
        };
      });
    }, intervalMs);


    (set as any)({ _kdsTimer: timer });
  },


  stopKDSTrajectory: () => {
    const existingTimer = (get() as any)._kdsTimer;
    if (existingTimer) {
      clearInterval(existingTimer);
      (set as any)({ _kdsTimer: null });
    }
    const curPose = get().pose;
    agvEngine.resetState({ x: curPose.x, y: curPose.y, psi: curPose.thetaRad });

    set({
      kdsIsPlaying: false,
      isSimRunning: false,
      isNavigating: false,
      isMissionRunning: false,
      velocity: { v: 0, vY: 0, omega: 0, steerAngleRad: 0 },
      wheelState: {
        speedsRadps: [0, 0],
        anglesRad: get().wheelState.anglesRad,
      },
    });
  },

  runKDSSOTABenchmark: (): SOTABenchmarkSummary => {
    const { kdsNodes } = get();
    const summary = KDSMotionPlanner.runSOTAComparison(kdsNodes, DEFAULT_AMR_ACTUATOR_PARAMS);
    set({ sotaBenchmarkSummary: summary });
    get().runMultiPhysicsBatchBenchmark();
    return summary;
  },

  setKDSSOTAModalOpen: (open: boolean) => {
    set({ isKDSSOTAModalOpen: open });
  },

  setBatchBenchmarkModalOpen: (open: boolean) => {
    set({ isBatchBenchmarkModalOpen: open });
  },

  runMultiPhysicsBatchBenchmark: async (scenarioName?: string): Promise<MultiPhysicsBatchReport> => {
    const { kdsNodes, kdsUseOptimalScaling, activeScenarioId } = get();
    const currentSc = BENCHMARK_SCENARIOS.find((s) => s.id === activeScenarioId);
    const resolvedName = scenarioName || currentSc?.name || 'Tuyến chuẩn Logistics (SIMPAT Baseline)';
    set({
      isBatchBenchmarkRunning: true,
      batchBenchmarkProgress: 10,
      batchBenchmarkStatusText: 'Đang khởi tạo Bộ nhân Mô phỏng Đa vật lý FOC...',
      isBatchBenchmarkModalOpen: true,
    });

    // Helper to yield control so React UI can render progress updates
    const yieldFrame = () => new Promise<void>((resolve) => setTimeout(resolve, 60));

    await yieldFrame();
    set({ batchBenchmarkProgress: 25, batchBenchmarkStatusText: 'Đang tích phân: Trapezoidal Profile (1st-Order / C⁰)...' });
    await yieldFrame();

    set({ batchBenchmarkProgress: 50, batchBenchmarkStatusText: 'Đang tích phân: Cubic Polynomial Spline (3rd-Order / C¹)...' });
    await yieldFrame();

    set({ batchBenchmarkProgress: 75, batchBenchmarkStatusText: 'Đang tích phân: Quintic Polynomial Spline (5th-Order / C²)...' });
    await yieldFrame();

    set({ batchBenchmarkProgress: 90, batchBenchmarkStatusText: 'Đang tối ưu: Proposed KDS S-Curve (Zero-Jerk & λ*)...' });
    await yieldFrame();

    const report = MultiPhysicsBatchBenchmark.runFullBatch(
      kdsNodes,
      resolvedName,
      kdsUseOptimalScaling
    );

    set({
      batchBenchmarkReport: report,
      isBatchBenchmarkRunning: false,
      batchBenchmarkProgress: 100,
      batchBenchmarkStatusText: 'Hoàn tất toàn bộ chuỗi đối chuẩn Đa vật lý!',
      isBatchBenchmarkModalOpen: true,
    });

    return report;
  },

  exportBatchBenchmarkCSV: (): string => {
    const { batchBenchmarkReport } = get();
    if (!batchBenchmarkReport) return '';
    return MultiPhysicsBatchBenchmark.exportBatchReportToCSV(batchBenchmarkReport);
  },

  exportKDSResultsCSV: (): string => {
    const { kdsPlanResult, generateKDSPlan } = get();
    const res = kdsPlanResult ?? generateKDSPlan();
    if (!res || res.points.length === 0) return '';

    const headers = [
      'time_s',
      'algorithm',
      'x_m',
      'y_m',
      'theta_rad',
      'theta_deg',
      'v_mps',
      'w_radps',
      'accel_mps2',
      'alpha_radps2',
      'jerk_mps3',
      'phase',
      'is_backward',
      'segment_idx',
      'power_total_w',
      'energy_accum_j',
    ];

    const lines = res.points.map((p) =>
      [
        p.t.toFixed(4),
        res.algorithm || 'kds_scurve',
        p.x.toFixed(4),
        p.y.toFixed(4),
        p.theta.toFixed(4),
        ((p.theta * 180) / Math.PI).toFixed(2),
        p.v.toFixed(4),
        p.w.toFixed(4),
        p.a.toFixed(4),
        p.alpha.toFixed(4),
        p.jerk.toFixed(4),
        p.phase,
        p.isBackward ? 1 : 0,
        p.segmentIndex,
        p.P_total.toFixed(2),
        p.energyAccumJ.toFixed(2),
      ].join(',')
    );

    return [headers.join(','), ...lines].join('\n');
  },

  loadBenchmarkScenario: (scenarioId: number) => {
    const sc = BENCHMARK_SCENARIOS.find((s) => s.id === scenarioId) || BENCHMARK_SCENARIOS[0];
    set({
      activeScenarioId: sc.id,
      kdsNodes: sc.nodes,
      pose: { x: sc.nodes[0].x, y: sc.nodes[0].y, thetaRad: sc.nodes[0].theta, z: 0.08 },
    });
    get().generateKDSPlan();
  },

  loadGrandLogisticsScenario: () => {
    get().loadBenchmarkScenario(1);
  },

  loadShortAisleScenario: () => {
    get().loadBenchmarkScenario(3);
  },


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
        const curPose = get().pose;
        agvEngine.resetState({ x: curPose.x, y: curPose.y, psi: curPose.thetaRad });
        set({
          isSimRunning: false,
          velocity: { v: 0, vY: 0, omega: 0, steerAngleRad: 0 },
          wheelState: {
            speedsRadps: [0, 0],
            anglesRad: get().wheelState.anglesRad,
          },
        });
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
    let specs = DEFAULT_DIFF_DRIVE_SPECS;
    if (type === 'mecanum') specs = DEFAULT_MECANUM_SPECS;
    else if (type === 'wheel_legged') specs = DEFAULT_WHEEL_LEGGED_SPECS;
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
    TrajectoryFollower.resetState();
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
    TrajectoryFollower.resetState();
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
          TrajectoryFollower.resetState();
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
      const isStationary =
        !state.isNavigating &&
        Math.abs(vel.v) < 1e-3 &&
        Math.abs(vel.omega) < 1e-3 &&
        Math.abs(agvEngine.getState().vx) < 0.02 &&
        Math.abs(agvEngine.getState().wz) < 0.02;

      if (isStationary) {
        newPose = { ...pose };
        actualVel = { v: 0, vY: 0, omega: 0, steerAngleRad: 0 };
        wheelSpeeds = [0, 0];
      } else {
        // High-performance closed-loop FOC / MTPA / Field-Weakening / CCC (SSoT Sections 3.7 & 3.8)
        const updatedState = agvEngine.stepWithFOCAndCCC(dtSec, vel.v, vel.omega, 0.0, 200);
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
      }
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
