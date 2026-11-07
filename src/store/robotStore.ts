import { create } from 'zustand';
import {
  RobotModel,
  CartesianPose,
  CameraPreset,
  RenderingStyle,
  ViewportOverlaySettings,
  SkeletonMode,
  BackgroundTheme,
  LightingSettings,
  CameraSettings,
  ManipulabilityInfo,
  IKConfiguration,
} from '../types/robot';
import {
  Waypoint,
  TrajectoryInterpolationType,
  TrajectoryPlan,
} from '../types/trajectory';
import { WorkspaceCloudData, WorkspaceSettings } from '../types/workspace';
import { WorkspaceMode, RightInspectorTab, BottomDockTab } from '../types/ui';
import * as THREE from 'three';
import { robotLoader, ROBOT_DEFAULT_POSTURES } from '../services/robotLoader';
import { RobotKinematics } from '../kinematics/RobotKinematics';
import { TrajectoryPlanner } from '../kinematics/TrajectoryPlanner';
import { WorkspaceGenerator } from '../kinematics/WorkspaceGenerator';
import { RNEEngine } from '../physics/RNEEngine';
import { Controllers } from '../physics/Controllers';
import { resetControllerStates } from '../physics/controllers/ControllerStrategyRegistry';
import { DynamicsSettings, DynamicSample, InertialParameters } from '../types/dynamics';
import {
  RobotDynamicsProfileManager,
  RobotDynamicsProfile,
  JointMotorConfig,
} from '../services/robotDynamicsProfiles';
import { MotorDriveEngine } from '../physics/motors/MotorDriveEngine';
import { MotorDynamicState, MotorDriveParameters } from '../types/motor';
import { PowerConverterEngine } from '../physics/converters/PowerConverterEngine';
import {
  DCBusParameters,
  DCBusDynamicState,
  PowerConverterParameters,
} from '../types/powerConverter';
import { ScientificBenchmarkExporter } from '../services/scientificBenchmarkExporter';

interface RobotStoreState {
  // Primary Domain Switcher (Manipulator vs Autonomous Mobile Robot)
  activeDomain: 'manipulator' | 'mobile_robot';
  setActiveDomain: (domain: 'manipulator' | 'mobile_robot') => void;

  currentRobotId: string;
  robotModel: RobotModel | null;
  jointAngles: number[]; // In degrees
  angleUnit: 'deg' | 'rad';
  isLoading: boolean;
  loadingProgressText: string;
  errorMessage: string | null;

  // Viewport & Lighting / Environment Settings
  cameraPreset: CameraPreset;
  renderingStyle: RenderingStyle;
  overlays: ViewportOverlaySettings;
  backgroundTheme: BackgroundTheme;
  lighting: LightingSettings;
  cameraSettings: CameraSettings;

  // Real-time TCP Pose, Jacobian & Manipulability
  tcpPose: CartesianPose | null;
  jacobianMatrix: number[][] | null;
  manipulabilityInfo: ManipulabilityInfo | null;
  ikConfigurations: IKConfiguration[];
  activeIKIndex: number | null;
  gizmoMode: 'translate' | 'rotate';

  // Trajectory Planning & Playback State
  waypoints: Waypoint[];
  activeTrajectory: TrajectoryPlan | null;
  interpolationType: TrajectoryInterpolationType;
  playbackState: {
    isPlaying: boolean;
    currentTime: number;
    speedMultiplier: number;
    isLooping: boolean;
  };
  isTrajectoryDrawerOpen: boolean;
  isAddPoseModalOpen: boolean;
  openAddPoseModal: () => void;
  closeAddPoseModal: () => void;

  traceClearTrigger: number;
  captureRequest: {
    format: 'white' | 'transparent' | 'current';
    resolutionScale?: number;
    dpi?: number;
    customFileName?: string;
    timestamp: number;
  } | null;

  // Video Recording State
  isRecording: boolean;
  recordingSeconds: number;
  recordingRequest: { action: 'start' | 'stop'; timestamp: number } | null;

  // Workspace Analysis State
  workspaceData: WorkspaceCloudData | null;
  workspaceSettings: WorkspaceSettings;
  isGeneratingWorkspace: boolean;
  workspaceProgressPct: number;
  isWorkspaceDrawerOpen: boolean;

  // Commercial Unified UI Layout State
  activeWorkspaceMode: WorkspaceMode;
  isLeftSidebarOpen: boolean;
  isRightInspectorOpen: boolean;
  rightInspectorTab: RightInspectorTab;
  isBottomDockExpanded: boolean;
  bottomDockTab: BottomDockTab;

  // Dynamics & Control State (Phase 3)
  inertialParameters: InertialParameters[];
  activeDynamicsProfile: RobotDynamicsProfile | null;
  dynamicsSettings: DynamicsSettings;
  dynamicSamples: DynamicSample[];
  activeDynamicState: DynamicSample | null;
  trajectoryTorques: {
    time: number;
    tau: number[];
    tauGravity: number[];
    tauInertia: number[];
    tauCoriolis: number[];
  }[] | null;

  // Actions
  loadRobot: (robotId: string) => Promise<void>;
  setJointAngle: (index: number, angleDeg: number) => void;
  setAllJointAngles: (anglesDeg: number[]) => void;
  setAngleUnit: (unit: 'deg' | 'rad') => void;
  setCameraPreset: (preset: CameraPreset) => void;
  setRenderingStyle: (style: RenderingStyle) => void;
  toggleOverlay: (key: keyof ViewportOverlaySettings) => void;
  setSkeletonMode: (mode: SkeletonMode) => void;
  toggleSkeletonMode: () => void;
  setBackgroundTheme: (theme: BackgroundTheme) => void;
  setLighting: (settings: Partial<LightingSettings>) => void;
  setCameraFov: (fov: number) => void;
  setCameraSettings: (settings: Partial<CameraSettings>) => void;
  triggerCapture: (options?: {
    format?: 'white' | 'transparent' | 'current';
    resolutionScale?: number;
    dpi?: number;
    customFileName?: string;
  } | 'white' | 'transparent' | 'current') => void;
  startVideoRecording: () => void;
  stopVideoRecording: () => void;
  setTcpPose: (pose: CartesianPose) => void;
  clearTrace: () => void;

  // IK and Jacobian Actions
  updateMetricsAndIK: () => void;
  applyIKConfiguration: (config: IKConfiguration) => void;
  solveTargetIK: (targetT: THREE.Matrix4) => void;
  setGizmoMode: (mode: 'translate' | 'rotate') => void;

  // Trajectory Actions
  addWaypointFromCurrent: (name?: string) => void;
  addPoseWaypoint: (
    position: { x: number; y: number; z: number },
    orientationEuler: { roll: number; pitch: number; yaw: number },
    segmentDuration: number,
    name?: string
  ) => { success: boolean; error?: string };
  removeWaypoint: (id: string) => void;
  updateWaypointDuration: (id: string, duration: number) => void;
  updateWaypoint: (id: string, updates: Partial<Waypoint>) => void;
  setInterpolationType: (type: TrajectoryInterpolationType) => void;
  generateTrajectory: () => void;
  playTrajectory: () => void;
  pauseTrajectory: () => void;
  seekTrajectoryTime: (time: number) => void;
  setPlaybackSpeed: (speed: number) => void;
  togglePlaybackLoop: () => void;
  loadPresetTrajectory: (presetId: string) => void;
  clearWaypoints: () => void;
  toggleTrajectoryDrawer: () => void;

  // Workspace Actions
  generateWorkspaceCloud: (sampleCount?: number) => Promise<void>;
  setWorkspaceSettings: (settings: Partial<WorkspaceSettings>) => void;
  toggleWorkspaceDrawer: () => void;
  toggleWorkspaceVisible: () => void;

  // Commercial Layout Actions
  setActiveWorkspaceMode: (mode: WorkspaceMode) => void;
  toggleLeftSidebar: () => void;
  toggleRightInspector: (tab?: RightInspectorTab) => void;
  setRightInspectorTab: (tab: RightInspectorTab) => void;
  toggleBottomDockExpanded: () => void;
  setBottomDockTab: (tab: BottomDockTab) => void;

  // Posture Presets
  applyHomePosture: () => void;
  applyZeroPosture: () => void;
  applyBoundarySingularity: () => void;
  applyWristSingularity: () => void;

  // Power Electronics & Inverter Actions
  dcBusSettings: DCBusParameters;
  inverterSettings: PowerConverterParameters;
  updateDCBusSettings: (settings: Partial<DCBusParameters>) => void;
  updateInverterSettings: (settings: Partial<PowerConverterParameters>) => void;

  // Dynamics Actions (Phase 3)
  setDynamicsSettings: (settings: Partial<DynamicsSettings>) => void;
  startDynamicsSimulation: () => void;
  stopDynamicsSimulation: () => void;
  resetDynamicsSimulation: () => void;
  calculateTrajectoryTorques: () => void;
  updateJointMotorConfig: (jointIndex: number, config: Partial<JointMotorConfig>) => void;
  updateJointMotorParams: (jointIndex: number, params: Partial<MotorDriveParameters>) => void;
  applyMotorPresetToAllJoints: (presetId: string) => void;
  updateMasterGainScale: (scaleKp: number, scaleKd: number) => void;
  resetDynamicsProfileToFactory: () => void;
  exportDynamicsProfileJSON: () => void;
  importDynamicsProfileJSON: (jsonStr: string) => { success: boolean; message: string };
  exportScientificBenchmarkCSV: () => void;
}

let playbackAnimFrameId: number | null = null;
let lastTickTime = performance.now();

function startPlaybackLoop(get: any, set: any) {
  if (playbackAnimFrameId !== null) return;
  lastTickTime = performance.now();

  const tick = (now: number) => {
    const { playbackState, activeTrajectory, setAllJointAngles } = get();
    if (!playbackState.isPlaying || !activeTrajectory || activeTrajectory.samples.length < 2) {
      playbackAnimFrameId = null;
      return;
    }

    const dt = (now - lastTickTime) / 1000;
    lastTickTime = now;

    let nextTime = playbackState.currentTime + dt * playbackState.speedMultiplier;
    const totalDuration = activeTrajectory.totalDuration;

    if (nextTime >= totalDuration) {
      if (playbackState.isLooping) {
        nextTime = nextTime % (totalDuration || 1);
      } else {
        nextTime = totalDuration;
        set({ playbackState: { ...playbackState, currentTime: nextTime, isPlaying: false } });
        playbackAnimFrameId = null;
        const lastSample = activeTrajectory.samples[activeTrajectory.samples.length - 1];
        setAllJointAngles(lastSample.jointAngles);
        return;
      }
    }

    set({ playbackState: { ...playbackState, currentTime: nextTime } });

    const samples = activeTrajectory.samples;
    let idx = Math.floor(nextTime / activeTrajectory.timeStep);
    if (idx >= samples.length - 1) idx = samples.length - 2;
    if (idx < 0) idx = 0;

    const s0 = samples[idx];
    const s1 = samples[idx + 1] || s0;
    const denom = s1.time - s0.time || 1e-4;
    const alpha = Math.max(0, Math.min(1, (nextTime - s0.time) / denom));

    const interpAngles = s0.jointAngles.map((q0: number, j: number) => q0 + alpha * ((s1.jointAngles[j] ?? q0) - q0));
    setAllJointAngles(interpAngles);

    playbackAnimFrameId = requestAnimationFrame(tick);
  };

  playbackAnimFrameId = requestAnimationFrame(tick);
}

let dynSimAnimFrameId: number | null = null;
let dynSimTime = 0;
let lastTickPerf = performance.now();
let currentDynQRad: number[] = [];
let currentDynQdRad: number[] = [];
let dynTargetQRad: number[] = [];
let dynFrameCounter = 0;
let currentMotorStates: MotorDynamicState[] = [];
let currentDCBusState: DCBusDynamicState | null = null;
let fullSessionSamples: DynamicSample[] = [];

function startDynamicsLoop(get: any, set: any) {
  if (dynSimAnimFrameId !== null) return;

  const { jointAngles, robotModel, inertialParameters, activeTrajectory, setAllJointAngles } = get();
  if (!robotModel) return;

  const inertias =
    inertialParameters && inertialParameters.length > 0
      ? inertialParameters
      : RNEEngine.getInertialParameters(
          robotModel.id,
          robotModel.dof,
          robotModel.totalWeightKg,
          robotModel.reachMm
        );

  // Initialize motor states for each DOF
  if (currentMotorStates.length !== robotModel.dof) {
    currentMotorStates = Array.from({ length: robotModel.dof }, () =>
      MotorDriveEngine.createInitialState()
    );
  }

  // If a trajectory is loaded, synchronize the starting physical state with the trajectory origin
  if (activeTrajectory && activeTrajectory.samples && activeTrajectory.samples.length > 1) {
    const startAngles = activeTrajectory.samples[0].jointAngles;
    currentDynQRad = startAngles.map((d: number) => (d * Math.PI) / 180);
    currentDynQdRad = new Array(robotModel.dof).fill(0);
    setAllJointAngles(startAngles);
  } else {
    currentDynQRad = jointAngles.map((d: number) => (d * Math.PI) / 180);
    currentDynQdRad = new Array(robotModel.dof).fill(0);
  }

  dynTargetQRad = [...currentDynQRad];
  dynSimTime = 0;
  lastTickPerf = performance.now();
  dynFrameCounter = 0;

  const tick = () => {
    const { dynamicsSettings, robotModel, activeTrajectory, setAllJointAngles, dynamicSamples } = get();
    if (!dynamicsSettings.isRunning || !robotModel) {
      dynSimAnimFrameId = null;
      return;
    }

    const now = performance.now();
    let dtFrame = (now - lastTickPerf) / 1000;
    lastTickPerf = now;

    // Guard against background tab suspension / frame spikes
    dtFrame = Math.max(0.001, Math.min(0.033, dtFrame));

    // High-precision sub-stepping at 500 Hz (subDt = 0.002s)
    const baseSubDt = 0.002;
    const subSteps = Math.max(1, Math.min(10, Math.round(dtFrame / baseSubDt)));
    const subDt = dtFrame / subSteps;

    let lastResult: any = null;
    let lastQDes = dynTargetQRad;
    let lastActualJointTorques: number[] = [];

    for (let step = 0; step < subSteps; step++) {
      dynSimTime += subDt;

      // Desired kinematics at current synchronized physical simulation time
      let qDes = dynTargetQRad;
      let qdDes = new Array(robotModel.dof).fill(0);
      let qddDes = new Array(robotModel.dof).fill(0);

      if (activeTrajectory && activeTrajectory.samples.length > 1) {
        const { playbackState } = get();
        const totalDuration = activeTrajectory.totalDuration;
        const isLooping = playbackState?.isLooping ?? true;

        if (!isLooping && dynSimTime >= totalDuration) {
          // Trajectory completed: hold target posture stably at rest
          const lastSample = activeTrajectory.samples[activeTrajectory.samples.length - 1];
          qDes = lastSample.jointAngles.map((d: number) => (d * Math.PI) / 180);
          qdDes = new Array(robotModel.dof).fill(0);
          qddDes = new Array(robotModel.dof).fill(0);
        } else {
          const curT = totalDuration > 0
            ? (isLooping ? dynSimTime % totalDuration : Math.min(dynSimTime, totalDuration))
            : 0;

          // Continuous Cubic Hermite Spline Interpolation across discrete trajectory samples
          const timeStep = activeTrajectory.timeStep > 0 ? activeTrajectory.timeStep : 0.02;
          const exactIdx = curT / timeStep;
          const idx0 = Math.max(0, Math.min(activeTrajectory.samples.length - 2, Math.floor(exactIdx)));
          const idx1 = idx0 + 1;
          const s0 = activeTrajectory.samples[idx0];
          const s1 = activeTrajectory.samples[idx1];
          const dtSeg = Math.max(1e-4, (s1.time - s0.time) || timeStep);
          const alpha = Math.max(0, Math.min(1, (curT - s0.time) / dtSeg));

          // Cubic Hermite polynomials
          const h00 = 2 * Math.pow(alpha, 3) - 3 * Math.pow(alpha, 2) + 1;
          const h10 = Math.pow(alpha, 3) - 2 * Math.pow(alpha, 2) + alpha;
          const h01 = -2 * Math.pow(alpha, 3) + 3 * Math.pow(alpha, 2);
          const h11 = Math.pow(alpha, 3) - Math.pow(alpha, 2);

          // Analytical time-derivatives of basis functions
          const dh00 = (6 * Math.pow(alpha, 2) - 6 * alpha) / dtSeg;
          const dh10 = 3 * Math.pow(alpha, 2) - 4 * alpha + 1;
          const dh01 = (-6 * Math.pow(alpha, 2) + 6 * alpha) / dtSeg;
          const dh11 = 3 * Math.pow(alpha, 2) - 2 * alpha;

          qDes = new Array(robotModel.dof);
          qdDes = new Array(robotModel.dof);
          qddDes = new Array(robotModel.dof);

          for (let j = 0; j < robotModel.dof; j++) {
            const p0 = ((s0.jointAngles[j] ?? robotModel.defaultPostureDeg[j] ?? 0) * Math.PI) / 180;
            const p1 = ((s1.jointAngles[j] ?? robotModel.defaultPostureDeg[j] ?? 0) * Math.PI) / 180;
            const v0 = ((s0.jointVelocities[j] ?? 0) * Math.PI) / 180;
            const v1 = ((s1.jointVelocities[j] ?? 0) * Math.PI) / 180;
            const a0 = ((s0.jointAccelerations[j] ?? 0) * Math.PI) / 180;
            const a1 = ((s1.jointAccelerations[j] ?? 0) * Math.PI) / 180;

            qDes[j] = h00 * p0 + h01 * p1 + dtSeg * (h10 * v0 + h11 * v1);
            qdDes[j] = (dh00 * p0 + dh01 * p1) + (dh10 * v0 + dh11 * v1);
            qddDes[j] = (1 - alpha) * a0 + alpha * a1;
          }
        }
      }

      lastQDes = qDes;

      const { activeDynamicsProfile, dcBusSettings, inverterSettings } = get();

      // Compute reflected rotor inertias of all motor gearboxes for dynamic decoupling
      const reflectedRotorInertias = new Array(robotModel.dof).fill(0);
      for (let j = 0; j < robotModel.dof; j++) {
        const baseMotorParam =
          activeDynamicsProfile?.joints?.[j]?.motorParams ||
          MotorDriveEngine.MOTOR_PRESETS.robodrive_pmsm_ilm70.params;
        reflectedRotorInertias[j] = MotorDriveEngine.computeReflectedInertia(baseMotorParam);
      }

      lastResult = Controllers.computeControlTorque(
        dynamicsSettings.controllerType,
        robotModel.joints,
        inertias,
        currentDynQRad,
        currentDynQdRad,
        qDes,
        qdDes,
        qddDes,
        dynamicsSettings.gains,
        dynamicsSettings.gravityAcc,
        [],
        dynamicsSettings.smcSettings,
        reflectedRotorInertias
      );

      // Electromechanical Actuator & Motor Drive Model
      const actualJointTorques = new Array(robotModel.dof).fill(0);
      const axisMotorPowers = new Array(robotModel.dof).fill(0);
      const axisMotorCurrents = new Array(robotModel.dof).fill(0);
      const axisVoltageRequests = new Array(robotModel.dof).fill(0);

      // Initialize DC Bus if not present
      if (!currentDCBusState || currentDCBusState.axisStates.length !== robotModel.dof) {
        currentDCBusState = PowerConverterEngine.createInitialState(robotModel.dof, dcBusSettings);
      }

      const liveBusVoltage = currentDCBusState.voltageV;

      for (let j = 0; j < robotModel.dof; j++) {
        const baseMotorParam =
          activeDynamicsProfile?.joints?.[j]?.motorParams ||
          MotorDriveEngine.MOTOR_PRESETS.robodrive_pmsm_ilm70.params;

        // Dynamic DC Bus coupling: motor terminal voltage ceiling tracks live DC bus
        const motorParam = {
          ...baseMotorParam,
          ratedVoltage: liveBusVoltage,
        };

        const motorRes = MotorDriveEngine.stepMotor(
          motorParam,
          currentMotorStates[j] || MotorDriveEngine.createInitialState(),
          lastResult.tau[j] || 0,
          currentDynQRad[j] || 0,
          currentDynQdRad[j] || 0,
          subDt
        );

        actualJointTorques[j] = motorRes.tauJointActual;
        currentMotorStates[j] = motorRes.nextState;
        reflectedRotorInertias[j] = MotorDriveEngine.computeReflectedInertia(motorParam);

        axisMotorPowers[j] = motorRes.nextState.powerElectricalW;
        axisMotorCurrents[j] = motorRes.nextState.currentA;
        axisVoltageRequests[j] = motorRes.nextState.voltageV;
      }

      // Step Common Shared DC Bus & Multi-Axis Power Inverters
      const convRes = PowerConverterEngine.stepConverter(
        dcBusSettings,
        inverterSettings,
        currentDCBusState,
        axisMotorPowers,
        axisMotorCurrents,
        axisVoltageRequests,
        subDt
      );
      currentDCBusState = convRes.nextState;

      lastActualJointTorques = actualJointTorques;

      const rk4 = RNEEngine.stepRK4(
        robotModel.joints,
        inertias,
        currentDynQRad,
        currentDynQdRad,
        actualJointTorques,
        subDt,
        dynamicsSettings.gravityAcc,
        reflectedRotorInertias
      );

      currentDynQRad = rk4.qNextRad;
      currentDynQdRad = rk4.qdNextRad;
    }

    const energy = RNEEngine.computeEnergy(
      robotModel.joints,
      inertias,
      currentDynQRad,
      currentDynQdRad,
      dynamicsSettings.gravityAcc
    );

    const qDeg = currentDynQRad.map((r: number) => (r * 180) / Math.PI);
    setAllJointAngles(qDeg);

    dynFrameCounter++;
    // Throttle React state update to ~30 FPS to avoid overloading the render pipeline
    if (lastResult && dynFrameCounter % 2 === 0) {
      const sample: DynamicSample = {
        time: dynSimTime,
        qDeg,
        qdDeg: currentDynQdRad.map((r: number) => (r * 180) / Math.PI),
        qddDeg: new Array(robotModel.dof).fill(0),
        qDesiredDeg: lastQDes.map((r: number) => (r * 180) / Math.PI),
        errorDeg: lastResult.errorRad.map((r: number) => (r * 180) / Math.PI),
        errorDotDeg: (lastResult.errorDotRad || []).map((r: number) => (r * 180) / Math.PI),
        slidingSurface: lastResult.slidingSurface || [],
        tau: lastActualJointTorques.length > 0 ? lastActualJointTorques : lastResult.tau,
        tauGravity: lastResult.tauGravity,
        tauInertia: lastResult.tauInertia,
        tauCoriolis: lastResult.tauCoriolis,
        kineticEnergy: energy.kinetic,
        potentialEnergy: energy.potential,
        totalEnergy: energy.total,
        motorStates: [...currentMotorStates],
        dcBusState: currentDCBusState ? { ...currentDCBusState } : undefined,
      };

      if (fullSessionSamples.length < 50000) {
        fullSessionSamples.push(sample);
      }

      const history = dynamicSamples || [];
      const updatedHistory = [...history.slice(-150), sample];
      set({
        activeDynamicState: sample,
        dynamicSamples: updatedHistory,
      });
    }

    dynSimAnimFrameId = requestAnimationFrame(tick);
  };

  dynSimAnimFrameId = requestAnimationFrame(tick);
}

export const useRobotStore = create<RobotStoreState>((set, get) => ({
  activeDomain: 'manipulator',
  setActiveDomain: (domain) => set({ activeDomain: domain }),

  currentRobotId: 'Puma560',
  robotModel: null,
  jointAngles: [0, 30, -45, 0, 30, 0],
  angleUnit: 'deg',
  isLoading: true,
  loadingProgressText: 'Initializing Kinematics Engine...',
  errorMessage: null,

  cameraPreset: 'isometric',
  renderingStyle: 'solid',
  overlays: {
    showFrames: true,
    showSkeleton: false,
    skeletonMode: 'physical',
    showTcp: true,
    showTrace: true,
    showGrid: true,
    showShadows: true,
    wireframeOnly: false,
    showManipulabilityEllipsoid: false,
    showIKGizmo: false,
  },
  backgroundTheme: 'studio-dark',
  lighting: {
    ambientIntensity: 0.7,
    keyLightIntensity: 1.3,
    rimLightIntensity: 0.7,
    shadowOpacity: 0.35,
    lightAzimuthDeg: 45,
  },
  cameraSettings: {
    fov: 42,
    distance: 2600,
    elevationDeg: 28,
    azimuthDeg: 45,
  },

  tcpPose: null,
  jacobianMatrix: null,
  manipulabilityInfo: null,
  ikConfigurations: [],
  activeIKIndex: null,
  gizmoMode: 'translate',
  setGizmoMode: (mode) => set({ gizmoMode: mode }),

  // Trajectory State
  waypoints: [],
  activeTrajectory: null,
  interpolationType: 'quintic',
  playbackState: {
    isPlaying: false,
    currentTime: 0,
    speedMultiplier: 1.0,
    isLooping: true,
  },
  isTrajectoryDrawerOpen: false,
  isAddPoseModalOpen: false,
  openAddPoseModal: () => set({ isAddPoseModalOpen: true }),
  closeAddPoseModal: () => set({ isAddPoseModalOpen: false }),

  traceClearTrigger: 0,
  captureRequest: null,

  isRecording: false,
  recordingSeconds: 0,
  recordingRequest: null,

  // Workspace Initial State
  workspaceData: null,
  workspaceSettings: {
    visible: false,
    sampleCount: 50000,
    sliceMode: 'full-3d',
    sliceThicknessMm: 80,
    sliceElevationMm: 350,
    colorMode: 'yoshikawa',
    pointSize: 2.0,
    opacity: 0.65,
    enforceFloorLimit: true,
    dexterousThreshold: 0,
  },
  isGeneratingWorkspace: false,
  workspaceProgressPct: 0,
  isWorkspaceDrawerOpen: false,

  // Commercial Layout State
  activeWorkspaceMode: 'jogging',
  isLeftSidebarOpen: true,
  isRightInspectorOpen: false,
  rightInspectorTab: 'dh',
  isBottomDockExpanded: false,
  bottomDockTab: 'timeline',

  // Dynamics Initial State
  inertialParameters: [],
  activeDynamicsProfile: null,
  dynamicsSettings: {
    controllerType: 'computed-torque',
    isRunning: false,
    timeStep: 0.002,
    gravityAcc: 9.81,
    payloadMass: 0,
    externalForce: [0, 0, 0],
    gains: {
      kp: [180, 220, 160, 50, 40, 30],
      kd: [28, 32, 25, 9, 7, 5],
    },
    smcSettings: {
      lambda: [20, 20, 20, 25, 25, 25],
      switchingGain: [40, 50, 35, 12, 10, 8],
      boundaryLayer: [0.05, 0.05, 0.05, 0.05, 0.05, 0.05],
      switchingFunction: 'boundary-layer',
    },
    autoExportCSVOnStop: true,
  },
  dynamicSamples: [],
  activeDynamicState: null,
  trajectoryTorques: null,

  loadRobot: async (robotId: string) => {
    try {
      set({ isLoading: true, errorMessage: null, loadingProgressText: `Loading ${robotId} kinematic specifications...` });
      const model = await robotLoader.loadRobotDefinition(robotId);
      const defaultPosture = ROBOT_DEFAULT_POSTURES[robotId] || new Array(model.dof).fill(0);
      
      // Calculate initial FK
      const transforms = RobotKinematics.computeForwardKinematics(model.joints, defaultPosture);
      const initialPose = RobotKinematics.extractCartesianPose(transforms[transforms.length - 1]);
      const rawInertias = RNEEngine.getInertialParameters(model.id, model.dof, model.totalWeightKg, model.reachMm);

      // Load robot-specific or customized motor/control profile (auto-loaded from localStorage or pre-tuned factory database)
      const profile = RobotDynamicsProfileManager.getProfileForRobot(model.id, model);
      const inertias = RobotDynamicsProfileManager.applyProfileToInertiaList(rawInertias, profile);

      set({
        currentRobotId: robotId,
        robotModel: model,
        jointAngles: [...defaultPosture],
        tcpPose: initialPose,
        workspaceData: null,
        inertialParameters: inertias,
        activeDynamicsProfile: profile,
        dynamicsSettings: {
          ...get().dynamicsSettings,
          controllerType: profile.controllerType,
          payloadMass: profile.defaultPayloadKg,
          timeStep: profile.timeStep || 0.002,
          gains: {
            kp: profile.joints.map((j) => j.kp),
            kd: profile.joints.map((j) => j.kd),
          },
          smcSettings: {
            lambda: new Array(model.dof).fill(20),
            switchingGain: profile.joints.map((j) => Math.max(10, Math.round(j.maxTorque * 0.25))),
            boundaryLayer: new Array(model.dof).fill(0.05),
            switchingFunction: 'boundary-layer',
          },
        },
        isLoading: false,
        loadingProgressText: '',
      });

      get().updateMetricsAndIK();
      get().loadPresetTrajectory('pick-and-place');
    } catch (err: any) {
      console.error('Failed to load robot:', err);
      set({
        isLoading: false,
        errorMessage: err.message || 'Failed to load robot configuration.',
      });
    }
  },

  setJointAngle: (index: number, angleDeg: number) => {
    const { jointAngles, robotModel } = get();
    const newAngles = [...jointAngles];
    newAngles[index] = angleDeg;

    let newPose = get().tcpPose;
    if (robotModel) {
      const transforms = RobotKinematics.computeForwardKinematics(robotModel.joints, newAngles);
      newPose = RobotKinematics.extractCartesianPose(transforms[transforms.length - 1]);
    }

    set({
      jointAngles: newAngles,
      tcpPose: newPose,
    });

    get().updateMetricsAndIK();
  },

  setAllJointAngles: (anglesDeg: number[]) => {
    const { robotModel } = get();
    let newPose = get().tcpPose;
    if (robotModel) {
      const transforms = RobotKinematics.computeForwardKinematics(robotModel.joints, anglesDeg);
      newPose = RobotKinematics.extractCartesianPose(transforms[transforms.length - 1]);
    }

    set({
      jointAngles: [...anglesDeg],
      tcpPose: newPose,
    });

    get().updateMetricsAndIK();
  },

  setAngleUnit: (unit) => set({ angleUnit: unit }),
  setCameraPreset: (cameraPreset) => set({ cameraPreset }),
  setRenderingStyle: (renderingStyle) => set({ renderingStyle }),
  toggleOverlay: (key) =>
    set((state) => ({
      overlays: {
        ...state.overlays,
        [key]: !state.overlays[key],
      },
    })),

  setSkeletonMode: (mode) =>
    set((state) => ({
      overlays: {
        ...state.overlays,
        skeletonMode: mode,
      },
    })),

  toggleSkeletonMode: () =>
    set((state) => ({
      overlays: {
        ...state.overlays,
        skeletonMode: state.overlays.skeletonMode === 'physical' ? 'dh' : 'physical',
      },
    })),

  setTcpPose: (tcpPose) => set({ tcpPose }),
  clearTrace: () => set((state) => ({ traceClearTrigger: state.traceClearTrigger + 1 })),

  setBackgroundTheme: (theme) => set({ backgroundTheme: theme }),
  setLighting: (settings) =>
    set((state) => ({
      lighting: {
        ...state.lighting,
        ...settings,
      },
    })),
  setCameraFov: (fov) =>
    set((state) => ({
      cameraSettings: {
        ...state.cameraSettings,
        fov,
      },
    })),
  setCameraSettings: (settings) =>
    set((state) => ({
      cameraSettings: {
        ...state.cameraSettings,
        ...settings,
      },
    })),
  triggerCapture: (options = 'current') => {
    if (typeof options === 'string') {
      set({ captureRequest: { format: options, timestamp: Date.now() } });
    } else {
      set({
        captureRequest: {
          format: options?.format || 'current',
          resolutionScale: options?.resolutionScale,
          dpi: options?.dpi || 150,
          customFileName: options?.customFileName,
          timestamp: Date.now(),
        },
      });
    }
  },

  startVideoRecording: () => {
    set({
      isRecording: true,
      recordingSeconds: 0,
      recordingRequest: { action: 'start', timestamp: Date.now() },
    });
  },

  stopVideoRecording: () => {
    set({
      isRecording: false,
      recordingRequest: { action: 'stop', timestamp: Date.now() },
    });
  },

  updateMetricsAndIK: () => {
    const { robotModel, jointAngles, tcpPose } = get();
    if (!robotModel) return;

    // 1. Geometric Jacobian
    const { J, Jv } = RobotKinematics.computeGeometricJacobian(robotModel.joints, jointAngles);

    // 2. Manipulability
    const manipulability = RobotKinematics.computeManipulability(Jv);

    // 3. Analytical IK for Puma 560 if active
    let ikConfigs: IKConfiguration[] = [];
    if (robotModel.id === 'Puma560' && tcpPose) {
      ikConfigs = RobotKinematics.solveAnalyticalIKPuma560(tcpPose.matrix);
    }

    set({
      jacobianMatrix: J,
      manipulabilityInfo: manipulability,
      ikConfigurations: ikConfigs,
    });
  },

  applyIKConfiguration: (config: IKConfiguration) => {
    get().setAllJointAngles(config.anglesDeg);
    set({ activeIKIndex: config.index });
  },

  solveTargetIK: (targetT: THREE.Matrix4) => {
    const { robotModel, jointAngles } = get();
    if (!robotModel) return;

    let solvedAngles: number[] | null = null;
    if (robotModel.id === 'Puma560') {
      const configs = RobotKinematics.solveAnalyticalIKPuma560(targetT);
      if (configs.length > 0) {
        // Choose closest posture
        let bestDist = Infinity;
        let bestConfig = configs[0];
        configs.forEach((cfg) => {
          const dist = cfg.anglesDeg.reduce((sum, a, i) => sum + Math.pow(a - jointAngles[i], 2), 0);
          if (dist < bestDist) {
            bestDist = dist;
            bestConfig = cfg;
          }
        });
        solvedAngles = bestConfig.anglesDeg;
        set({ ikConfigurations: configs, activeIKIndex: bestConfig.index });
      }
    }

    // Fallback to Numerical DLS
    if (!solvedAngles) {
      solvedAngles = RobotKinematics.solveNumericalIK(robotModel.joints, jointAngles, targetT);
    }

    if (solvedAngles) {
      get().setAllJointAngles(solvedAngles);
    }
  },

  addWaypointFromCurrent: (name) => {
    const { robotModel, jointAngles, tcpPose, waypoints } = get();
    if (!robotModel || !tcpPose) return;
    const newWp: Waypoint = {
      id: `wp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: name || `Waypoint ${waypoints.length + 1}`,
      jointAngles: [...jointAngles],
      cartesianPose: JSON.parse(JSON.stringify(tcpPose)),
      segmentDuration: 2.0,
    };
    set({ waypoints: [...waypoints, newWp] });
    get().generateTrajectory();
  },

  addPoseWaypoint: (position, orientationEuler, segmentDuration, name) => {
    const { robotModel, jointAngles, waypoints } = get();
    if (!robotModel) return { success: false, error: 'Chưa tải mô hình robot' };

    // 1. Build transformation matrix T from position and Euler angles (XYZ)
    const pos = new THREE.Vector3(position.x, position.y, position.z);
    const euler = new THREE.Euler(
      THREE.MathUtils.degToRad(orientationEuler.roll),
      THREE.MathUtils.degToRad(orientationEuler.pitch),
      THREE.MathUtils.degToRad(orientationEuler.yaw),
      'XYZ'
    );
    const rotMatrix = new THREE.Matrix4().makeRotationFromEuler(euler);
    const targetT = new THREE.Matrix4().setPosition(pos).multiply(rotMatrix);

    // 2. Solve Inverse Kinematics (Analytical for Puma 560 or Numerical DLS fallback)
    let solvedAngles: number[] | null = null;
    if (robotModel.id === 'Puma560') {
      const configs = RobotKinematics.solveAnalyticalIKPuma560(targetT);
      if (configs.length > 0) {
        let bestDist = Infinity;
        let bestConfig = configs[0];
        configs.forEach((cfg) => {
          const dist = cfg.anglesDeg.reduce((sum, a, i) => sum + Math.pow(a - jointAngles[i], 2), 0);
          if (dist < bestDist) {
            bestDist = dist;
            bestConfig = cfg;
          }
        });
        solvedAngles = bestConfig.anglesDeg;
      }
    }

    if (!solvedAngles) {
      solvedAngles = RobotKinematics.solveNumericalIK(robotModel.joints, jointAngles, targetT);
    }

    if (!solvedAngles) {
      return {
        success: false,
        error: 'Không tìm thấy cấu hình khớp khả thi (Vị trí ngoài không gian làm việc hoặc điểm kỳ dị)',
      };
    }

    // 3. Create Waypoint and append to trajectory
    const newWp: Waypoint = {
      id: `wp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: name || `Pose ${waypoints.length + 1}`,
      jointAngles: solvedAngles,
      cartesianPose: {
        position: { x: position.x, y: position.y, z: position.z },
        orientationEuler: { roll: orientationEuler.roll, pitch: orientationEuler.pitch, yaw: orientationEuler.yaw },
        matrix: targetT,
      },
      segmentDuration: Math.max(0.2, segmentDuration),
    };

    set({ waypoints: [...waypoints, newWp] });
    get().generateTrajectory();
    return { success: true };
  },

  removeWaypoint: (id) => {
    const { waypoints } = get();
    set({ waypoints: waypoints.filter((w) => w.id !== id) });
    get().generateTrajectory();
  },

  updateWaypointDuration: (id, duration) => {
    const { waypoints } = get();
    set({
      waypoints: waypoints.map((w) =>
        w.id === id ? { ...w, segmentDuration: Math.max(0.1, duration) } : w
      ),
    });
    get().generateTrajectory();
  },

  updateWaypoint: (id, updates) => {
    const { waypoints } = get();
    set({
      waypoints: waypoints.map((w) => (w.id === id ? { ...w, ...updates } : w)),
    });
    get().generateTrajectory();
  },

  setInterpolationType: (type) => {
    set({ interpolationType: type });
    get().generateTrajectory();
  },

  generateTrajectory: () => {
    const { waypoints, interpolationType, robotModel } = get();
    if (!robotModel || waypoints.length === 0) {
      set({ activeTrajectory: null });
      return;
    }
    const plan = TrajectoryPlanner.planTrajectory(waypoints, interpolationType, robotModel);
    set({
      activeTrajectory: plan,
      playbackState: {
        ...get().playbackState,
        currentTime: 0,
      },
    });
    get().calculateTrajectoryTorques();
  },

  playTrajectory: () => {
    const { activeTrajectory, playbackState } = get();
    if (!activeTrajectory || activeTrajectory.samples.length < 2) return;
    set({ playbackState: { ...playbackState, isPlaying: true } });
    startPlaybackLoop(get, set);
  },

  pauseTrajectory: () => {
    if (playbackAnimFrameId !== null) {
      cancelAnimationFrame(playbackAnimFrameId);
      playbackAnimFrameId = null;
    }
    set({ playbackState: { ...get().playbackState, isPlaying: false } });
  },

  seekTrajectoryTime: (time) => {
    const { activeTrajectory, playbackState, setAllJointAngles } = get();
    if (!activeTrajectory || activeTrajectory.samples.length === 0) return;
    const clampedTime = Math.max(0, Math.min(activeTrajectory.totalDuration, time));
    set({ playbackState: { ...playbackState, currentTime: clampedTime } });

    const samples = activeTrajectory.samples;
    let idx = Math.floor(clampedTime / activeTrajectory.timeStep);
    if (idx >= samples.length - 1) idx = samples.length - 2;
    if (idx < 0) idx = 0;
    const s0 = samples[idx];
    const s1 = samples[idx + 1] || s0;
    const denom = s1.time - s0.time || 1e-4;
    const alpha = Math.max(0, Math.min(1, (clampedTime - s0.time) / denom));

    const interpAngles = s0.jointAngles.map((q0: number, j: number) => q0 + alpha * ((s1.jointAngles[j] ?? q0) - q0));
    setAllJointAngles(interpAngles);
  },

  setPlaybackSpeed: (speed) => {
    set({ playbackState: { ...get().playbackState, speedMultiplier: speed } });
  },

  togglePlaybackLoop: () => {
    const { playbackState } = get();
    set({ playbackState: { ...playbackState, isLooping: !playbackState.isLooping } });
  },

  loadPresetTrajectory: (presetId) => {
    const { currentRobotId, robotModel } = get();
    if (!robotModel) return;
    const presets = TrajectoryPlanner.getPresets(currentRobotId);
    const preset = presets.find((p) => p.id === presetId) || presets[0];
    if (!preset) return;

    const wps: Waypoint[] = preset.waypoints.map((item, idx) => {
      // Ensure joint angles array matches robotModel.dof exactly
      const targetAngles = [...item.jointAngles];
      while (targetAngles.length < robotModel.dof) {
        targetAngles.push(robotModel.defaultPostureDeg[targetAngles.length] ?? 0);
      }
      if (targetAngles.length > robotModel.dof) {
        targetAngles.length = robotModel.dof;
      }
      const transforms = RobotKinematics.computeForwardKinematics(robotModel.joints, targetAngles);
      const pose = RobotKinematics.extractCartesianPose(transforms[transforms.length - 1]);
      return {
        id: `wp-preset-${idx}-${Date.now()}`,
        name: item.name,
        jointAngles: targetAngles,
        cartesianPose: pose,
        segmentDuration: item.segmentDuration,
      };
    });

    set({
      waypoints: wps,
      interpolationType: preset.interpolationType,
    });
    get().generateTrajectory();
  },

  clearWaypoints: () => {
    get().pauseTrajectory();
    set({
      waypoints: [],
      activeTrajectory: null,
      playbackState: {
        isPlaying: false,
        currentTime: 0,
        speedMultiplier: 1.0,
        isLooping: true,
      },
    });
  },

  toggleTrajectoryDrawer: () => {
    set({ isTrajectoryDrawerOpen: !get().isTrajectoryDrawerOpen });
  },

  generateWorkspaceCloud: async (sampleCount) => {
    const { robotModel, workspaceSettings } = get();
    if (!robotModel) return;
    const count = sampleCount || workspaceSettings.sampleCount || 50000;
    try {
      set({ isGeneratingWorkspace: true, workspaceProgressPct: 0 });
      const cloud = await WorkspaceGenerator.generateCloud(
        robotModel,
        count,
        (pct) => set({ workspaceProgressPct: pct })
      );
      set({
        workspaceData: cloud,
        workspaceSettings: {
          ...workspaceSettings,
          visible: true,
          sampleCount: count,
        },
        isGeneratingWorkspace: false,
        workspaceProgressPct: 100,
      });
    } catch (err) {
      console.error('Failed to generate workspace cloud:', err);
      set({ isGeneratingWorkspace: false });
    }
  },

  setWorkspaceSettings: (settings) => {
    set((state) => ({
      workspaceSettings: {
        ...state.workspaceSettings,
        ...settings,
      },
    }));
  },

  toggleWorkspaceDrawer: () => {
    set({ isWorkspaceDrawerOpen: !get().isWorkspaceDrawerOpen });
  },

  toggleWorkspaceVisible: () => {
    const { workspaceSettings, workspaceData, generateWorkspaceCloud } = get();
    const nextVis = !workspaceSettings.visible;
    set({
      workspaceSettings: {
        ...workspaceSettings,
        visible: nextVis,
      },
    });
    if (nextVis && !workspaceData) {
      generateWorkspaceCloud();
    }
  },

  setActiveWorkspaceMode: (mode) => {
    const { overlays, workspaceSettings, generateWorkspaceCloud, workspaceData } = get();
    if (mode === 'ik') {
      set({
        activeWorkspaceMode: mode,
        isLeftSidebarOpen: true,
        overlays: { ...overlays, showIKGizmo: true },
      });
    } else if (mode === 'trajectory') {
      set({
        activeWorkspaceMode: mode,
        isLeftSidebarOpen: true,
        overlays: { ...overlays, showTrace: true, showIKGizmo: false },
      });
    } else if (mode === 'workspace') {
      set({
        activeWorkspaceMode: mode,
        isLeftSidebarOpen: true,
        overlays: { ...overlays, showIKGizmo: false },
        workspaceSettings: { ...workspaceSettings, visible: true },
      });
      if (!workspaceData) {
        generateWorkspaceCloud();
      }
    } else if (mode === 'dynamics') {
      set({
        activeWorkspaceMode: mode,
        isLeftSidebarOpen: true,
        isBottomDockExpanded: true,
        bottomDockTab: 'torques',
        overlays: { ...overlays, showIKGizmo: false },
      });
      get().calculateTrajectoryTorques();
    } else {
      set({
        activeWorkspaceMode: mode,
        isLeftSidebarOpen: true,
        overlays: { ...overlays, showIKGizmo: false },
      });
    }
  },

  toggleLeftSidebar: () => {
    set({ isLeftSidebarOpen: !get().isLeftSidebarOpen });
  },

  toggleRightInspector: (tab) => {
    const currentOpen = get().isRightInspectorOpen;
    const currentTab = get().rightInspectorTab;
    if (tab && currentTab !== tab) {
      set({ isRightInspectorOpen: true, rightInspectorTab: tab });
    } else {
      set({ isRightInspectorOpen: !currentOpen, rightInspectorTab: tab || currentTab });
    }
  },

  setRightInspectorTab: (tab) => {
    set({ rightInspectorTab: tab, isRightInspectorOpen: true });
  },

  toggleBottomDockExpanded: () => {
    set({ isBottomDockExpanded: !get().isBottomDockExpanded });
  },

  setBottomDockTab: (tab) => {
    set({ bottomDockTab: tab, isBottomDockExpanded: true });
  },

  applyHomePosture: () => {
    const { robotModel } = get();
    if (!robotModel) return;
    const home = robotModel.defaultPostureDeg;
    get().setAllJointAngles(home);
  },

  applyZeroPosture: () => {
    const { robotModel } = get();
    if (!robotModel) return;
    const zero = new Array(robotModel.dof).fill(0);
    get().setAllJointAngles(zero);
  },

  applyBoundarySingularity: () => {
    const { robotModel } = get();
    if (!robotModel) return;
    // Maximum outstretched horizontal reach
    const boundary = [0, 0, 0, 0, 0, 0];
    if (robotModel.id === 'Puma560') {
      // In Puma 560, elbow at 0 deg extends arm straight
      boundary[1] = 0;
      boundary[2] = 0;
    }
    get().setAllJointAngles(boundary);
  },

  applyWristSingularity: () => {
    const { robotModel, jointAngles } = get();
    if (!robotModel) return;
    const angles = [...jointAngles];
    // In spherical wrist (joints 4, 5, 6), when q5 = 0, axes 4 and 6 align!
    angles[4] = 0;
    get().setAllJointAngles(angles);
  },

  // Power Electronics & Inverter Actions
  dcBusSettings: PowerConverterEngine.DEFAULT_DC_BUS,
  inverterSettings: PowerConverterEngine.DEFAULT_INVERTER,

  updateDCBusSettings: (settings: Partial<DCBusParameters>) => {
    set({
      dcBusSettings: {
        ...get().dcBusSettings,
        ...settings,
      },
    });
  },

  updateInverterSettings: (settings: Partial<PowerConverterParameters>) => {
    set({
      inverterSettings: {
        ...get().inverterSettings,
        ...settings,
      },
    });
  },

  // Dynamics Actions (Phase 3)
  setDynamicsSettings: (settings) => {
    const { dynamicsSettings, activeDynamicsProfile } = get();
    const updatedDynamics = {
      ...dynamicsSettings,
      ...settings,
    };

    if (activeDynamicsProfile && (settings.controllerType || settings.payloadMass !== undefined)) {
      const updatedProfile: RobotDynamicsProfile = {
        ...activeDynamicsProfile,
        controllerType: settings.controllerType || activeDynamicsProfile.controllerType,
        defaultPayloadKg: settings.payloadMass !== undefined ? settings.payloadMass : activeDynamicsProfile.defaultPayloadKg,
        lastUpdated: new Date().toISOString(),
      };
      RobotDynamicsProfileManager.saveProfileForRobot(updatedProfile);
      set({
        dynamicsSettings: updatedDynamics,
        activeDynamicsProfile: updatedProfile,
      });
      return;
    }

    set({ dynamicsSettings: updatedDynamics });
  },

  startDynamicsSimulation: () => {
    fullSessionSamples = [];
    set({
      dynamicsSettings: {
        ...get().dynamicsSettings,
        isRunning: true,
      },
    });
    startDynamicsLoop(get, set);
  },

  stopDynamicsSimulation: () => {
    if (dynSimAnimFrameId !== null) {
      cancelAnimationFrame(dynSimAnimFrameId);
      dynSimAnimFrameId = null;
    }
    const wasRunning = get().dynamicsSettings.isRunning;
    set({
      dynamicsSettings: {
        ...get().dynamicsSettings,
        isRunning: false,
      },
    });

    // Automatically export scientific research CSV report if enabled
    if (wasRunning && get().dynamicsSettings.autoExportCSVOnStop && fullSessionSamples.length >= 5) {
      get().exportScientificBenchmarkCSV();
    }
  },

  resetDynamicsSimulation: () => {
    get().stopDynamicsSimulation();
    resetControllerStates();
    currentMotorStates = [];
    currentDCBusState = null;
    fullSessionSamples = [];
    const { robotModel } = get();
    if (robotModel) {
      get().setAllJointAngles(robotModel.defaultPostureDeg);
    }
    set({
      dynamicSamples: [],
      activeDynamicState: null,
    });
  },

  calculateTrajectoryTorques: () => {
    const { activeTrajectory, robotModel, inertialParameters, dynamicsSettings } = get();
    if (!activeTrajectory || !robotModel || activeTrajectory.samples.length < 2) {
      set({ trajectoryTorques: null });
      return;
    }

    const inertias =
      inertialParameters && inertialParameters.length > 0
        ? inertialParameters
        : RNEEngine.getInertialParameters(
            robotModel.id,
            robotModel.dof,
            robotModel.totalWeightKg,
            robotModel.reachMm
          );

    const torques = activeTrajectory.samples.map((s) => {
      const qRad = s.jointAngles.map((d) => (d * Math.PI) / 180);
      const qdRad = s.jointVelocities.map((d) => (d * Math.PI) / 180);
      const qddRad = s.jointAccelerations.map((d) => (d * Math.PI) / 180);

      const res = RNEEngine.computeInverseDynamics(
        robotModel.joints,
        inertias,
        qRad,
        qdRad,
        qddRad,
        dynamicsSettings.gravityAcc
      );

      return {
        time: s.time,
        tau: res.tau,
        tauGravity: res.tauGravity,
        tauInertia: res.tauInertia,
        tauCoriolis: res.tauCoriolis,
      };
    });

    set({ trajectoryTorques: torques });
  },

  updateJointMotorConfig: (jointIndex: number, config: Partial<JointMotorConfig>) => {
    const { activeDynamicsProfile, robotModel, inertialParameters, dynamicsSettings } = get();
    if (!activeDynamicsProfile || !robotModel) return;

    const newJoints = [...activeDynamicsProfile.joints];
    if (newJoints[jointIndex]) {
      newJoints[jointIndex] = {
        ...newJoints[jointIndex],
        ...config,
      };
    }

    const updatedProfile: RobotDynamicsProfile = {
      ...activeDynamicsProfile,
      joints: newJoints,
      isCustomTuned: true,
      lastUpdated: new Date().toISOString(),
    };

    const updatedInertias = RobotDynamicsProfileManager.applyProfileToInertiaList(
      inertialParameters,
      updatedProfile
    );

    RobotDynamicsProfileManager.saveProfileForRobot(updatedProfile);

    set({
      activeDynamicsProfile: updatedProfile,
      inertialParameters: updatedInertias,
      dynamicsSettings: {
        ...dynamicsSettings,
        gains: {
          kp: newJoints.map((j) => j.kp),
          kd: newJoints.map((j) => j.kd),
        },
      },
    });
  },

  updateJointMotorParams: (jointIndex: number, params: Partial<MotorDriveParameters>) => {
    const { activeDynamicsProfile } = get();
    if (!activeDynamicsProfile) return;
    const currentJoint = activeDynamicsProfile.joints[jointIndex];
    if (!currentJoint) return;

    const existingParams =
      currentJoint.motorParams || MotorDriveEngine.MOTOR_PRESETS.robodrive_pmsm_ilm70.params;
    const updatedParams: MotorDriveParameters = {
      ...existingParams,
      ...params,
    };

    get().updateJointMotorConfig(jointIndex, {
      motorParams: updatedParams,
      maxTorque: Math.round(
        updatedParams.peakTorque * updatedParams.gearRatio * updatedParams.gearEfficiency
      ),
    });
  },

  applyMotorPresetToAllJoints: (presetId: string) => {
    const preset = MotorDriveEngine.MOTOR_PRESETS[presetId];
    if (!preset) return;
    const { activeDynamicsProfile, robotModel } = get();
    if (!activeDynamicsProfile || !robotModel) return;

    for (let i = 0; i < robotModel.dof; i++) {
      get().updateJointMotorConfig(i, {
        motorParams: { ...preset.params },
        maxTorque: Math.round(
          preset.params.peakTorque * preset.params.gearRatio * preset.params.gearEfficiency
        ),
      });
    }
  },

  updateMasterGainScale: (scaleKp: number, scaleKd: number) => {
    const { activeDynamicsProfile, robotModel, dynamicsSettings } = get();
    if (!activeDynamicsProfile || !robotModel) return;

    const newJoints = activeDynamicsProfile.joints.map((j) => ({
      ...j,
      kp: Math.max(5, Math.round(j.kp * scaleKp)),
      kd: Math.max(1, Math.round(j.kd * scaleKd)),
    }));

    const updatedProfile: RobotDynamicsProfile = {
      ...activeDynamicsProfile,
      joints: newJoints,
      isCustomTuned: true,
      lastUpdated: new Date().toISOString(),
    };

    RobotDynamicsProfileManager.saveProfileForRobot(updatedProfile);

    set({
      activeDynamicsProfile: updatedProfile,
      dynamicsSettings: {
        ...dynamicsSettings,
        gains: {
          kp: newJoints.map((j) => j.kp),
          kd: newJoints.map((j) => j.kd),
        },
      },
    });
  },

  resetDynamicsProfileToFactory: () => {
    const { robotModel, inertialParameters, dynamicsSettings } = get();
    if (!robotModel) return;

    const factoryProfile = RobotDynamicsProfileManager.resetProfileToFactory(robotModel.id, robotModel);
    const updatedInertias = RobotDynamicsProfileManager.applyProfileToInertiaList(
      inertialParameters,
      factoryProfile
    );

    set({
      activeDynamicsProfile: factoryProfile,
      inertialParameters: updatedInertias,
      dynamicsSettings: {
        ...dynamicsSettings,
        controllerType: factoryProfile.controllerType,
        payloadMass: factoryProfile.defaultPayloadKg,
        gains: {
          kp: factoryProfile.joints.map((j) => j.kp),
          kd: factoryProfile.joints.map((j) => j.kd),
        },
      },
    });
  },

  exportDynamicsProfileJSON: () => {
    const { activeDynamicsProfile } = get();
    if (activeDynamicsProfile) {
      RobotDynamicsProfileManager.exportProfileToJSON(activeDynamicsProfile);
    }
  },

  importDynamicsProfileJSON: (jsonStr: string) => {
    const { robotModel, inertialParameters, dynamicsSettings } = get();
    if (!robotModel) {
      return { success: false, message: 'Chưa tải mô hình robot.' };
    }

    const { profile, error } = RobotDynamicsProfileManager.importProfileFromJSON(
      jsonStr,
      robotModel.id,
      robotModel.dof
    );

    if (error || !profile) {
      return { success: false, message: error || 'Lỗi không xác định khi nhập file.' };
    }

    const updatedInertias = RobotDynamicsProfileManager.applyProfileToInertiaList(
      inertialParameters,
      profile
    );

    set({
      activeDynamicsProfile: profile,
      inertialParameters: updatedInertias,
      dynamicsSettings: {
        ...dynamicsSettings,
        controllerType: profile.controllerType,
        payloadMass: profile.defaultPayloadKg,
        gains: {
          kp: profile.joints.map((j) => j.kp),
          kd: profile.joints.map((j) => j.kd),
        },
      },
    });

    return {
      success: true,
      message: `Đã nạp thành công bộ thông số điều khiển cho ${profile.robotName} (${profile.joints.length} khớp)!`,
    };
  },

  exportScientificBenchmarkCSV: () => {
    const {
      robotModel,
      activeDynamicsProfile,
      dynamicsSettings,
      dcBusSettings,
      inverterSettings,
      activeTrajectory,
    } = get();
    if (!robotModel || !activeDynamicsProfile || fullSessionSamples.length === 0) return;

    const result = ScientificBenchmarkExporter.generateCSV(fullSessionSamples, {
      robotModel,
      activeProfile: activeDynamicsProfile,
      controllerType: dynamicsSettings.controllerType,
      payloadKg: dynamicsSettings.payloadMass,
      dcBusSettings,
      inverterSettings,
      trajectoryName: activeTrajectory
        ? `${activeTrajectory.interpolationType.toUpperCase()} (${activeTrajectory.totalDuration.toFixed(1)}s)`
        : 'Default Run',
    });

    ScientificBenchmarkExporter.triggerDownload(result.csvContent, result.filename);
  },
}));
