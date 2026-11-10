import React from 'react';
import { useRobotStore } from '../../store/robotStore';
import { TrajectoryPlanner } from '../../kinematics/TrajectoryPlanner';
import { TrajectoryInterpolationType } from '../../types/trajectory';
import { WorkspaceSliceMode, WorkspaceColorMode } from '../../types/workspace';
import { ControllerType } from '../../types/dynamics';
import {
  Sliders,
  Sparkles,
  Move,
  RotateCw,
  Eye,
  Trash2,
  Plus,
  Box,
  Cpu,
  Download,
  Activity,
  Loader2,
  Zap,
  Play,
  Pause,
  RotateCcw,
  Scale,
  Upload,
  CheckCircle2,
  AlertCircle,
  Settings2,
  ChevronDown,
  ChevronUp,
  Pencil,
  FileSpreadsheet,
} from 'lucide-react';
import {
  ControllerStrategyRegistry,
  CustomControllerDefinition,
} from '../../physics/Controllers';
import { CustomControllerModal } from '../../components/Dynamics/CustomControllerModal';
import { MotorDriveModal } from '../../components/Dynamics/MotorDriveModal';
import { DEFAULT_LINK_PALETTE } from '../../services/robotLoader';
import { MobileRobotSidebar } from './MobileRobotSidebar';
import { useTranslation } from '../../i18n';

export const LeftSidebar: React.FC = () => {
  const { t } = useTranslation();
  const {
    activeDomain,
    isLeftSidebarOpen,
    activeWorkspaceMode,
    robotModel,
    jointAngles,
    setJointAngle,
    setAllJointAngles,
    angleUnit,
    setAngleUnit,
    applyHomePosture,
    applyZeroPosture,
    applyBoundarySingularity,
    applyWristSingularity,

    // IK
    gizmoMode,
    setGizmoMode,
    ikConfigurations,
    activeIKIndex,
    applyIKConfiguration,

    // Trajectory
    waypoints,
    addWaypointFromCurrent,
    openAddPoseModal,
    removeWaypoint,
    interpolationType,
    setInterpolationType,
    loadPresetTrajectory,
    clearWaypoints,
    currentRobotId,
    activeTrajectory,

    // Workspace
    workspaceData,
    workspaceSettings,
    setWorkspaceSettings,
    isGeneratingWorkspace,
    workspaceProgressPct,
    generateWorkspaceCloud,

    // Dynamics
    dynamicsSettings,
    setDynamicsSettings,
    startDynamicsSimulation,
    stopDynamicsSimulation,
    resetDynamicsSimulation,
    setBottomDockTab,
    activeDynamicsProfile,
    updateJointMotorConfig,
    updateMasterGainScale,
    resetDynamicsProfileToFactory,
    exportDynamicsProfileJSON,
    importDynamicsProfileJSON,
    exportScientificBenchmarkCSV,
  } = useRobotStore();

  const [dynTuningMode, setDynTuningMode] = React.useState<'master' | 'joints'>('master');
  const [dynExpandedJoint, setDynExpandedJoint] = React.useState<number | null>(null);
  const [dynToast, setDynToast] = React.useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const dynFileInputRef = React.useRef<HTMLInputElement>(null);

  // Custom Controller Modal State
  const [isControllerModalOpen, setIsControllerModalOpen] = React.useState(false);
  const [editingControllerDef, setEditingControllerDef] = React.useState<CustomControllerDefinition | null>(null);

  // Motor Drive Modal State
  const [isMotorModalOpen, setIsMotorModalOpen] = React.useState(false);
  const [motorModalJointIdx, setMotorModalJointIdx] = React.useState(0);

  const handleProfileFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) return;
      const res = importDynamicsProfileJSON(content);
      if (res.success) {
        setDynToast({ text: res.message, type: 'success' });
      } else {
        setDynToast({ text: res.message, type: 'error' });
      }
      setTimeout(() => setDynToast(null), 4000);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  if (!isLeftSidebarOpen || !robotModel) return null;

  const presets = TrajectoryPlanner.getPresets(currentRobotId);

  const handleExportJSON = () => {
    if (!activeTrajectory) return;
    const blob = new Blob([JSON.stringify(activeTrajectory, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentRobotId}_trajectory_${interpolationType}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sliceModes: { id: WorkspaceSliceMode; label: string }[] = [
    { id: 'full-3d', label: 'Full 3D' },
    { id: 'slice-xz', label: 'Side (X-Z)' },
    { id: 'slice-yz', label: 'Front (Y-Z)' },
    { id: 'slice-xy', label: 'Top (X-Y)' },
  ];

  const colorModes: { id: WorkspaceColorMode; label: string }[] = [
    { id: 'yoshikawa', label: 'Yoshikawa w' },
    { id: 'height', label: 'Z-Height' },
    { id: 'uniform', label: 'Cyan' },
  ];

  if (activeDomain === 'mobile_robot') {
    return (
      <aside className="w-80 bg-slate-900 border-r border-slate-800 flex flex-col z-20 shrink-0 select-none overflow-hidden h-[calc(100vh-3.5rem)]">
        <div className="px-4 py-3 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Sliders className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-300">
              {t.topRibbon.domainMobile}
            </h3>
          </div>
        </div>
        <MobileRobotSidebar />
      </aside>
    );
  }

  return (
    <aside className="w-80 bg-slate-900 border-r border-slate-800 flex flex-col z-20 shrink-0 select-none overflow-hidden h-[calc(100vh-3.5rem)]">
      {/* Sidebar Mode Title Banner */}
      <div className="px-4 py-3 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {activeWorkspaceMode === 'jogging' && <Sliders className="w-4 h-4 text-sky-400" />}
          {activeWorkspaceMode === 'ik' && <Activity className="w-4 h-4 text-amber-400" />}
          {activeWorkspaceMode === 'trajectory' && <Sliders className="w-4 h-4 text-purple-400" />}
          {activeWorkspaceMode === 'workspace' && <Box className="w-4 h-4 text-emerald-400" />}
          {activeWorkspaceMode === 'dynamics' && <Cpu className="w-4 h-4 text-rose-400" />}
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            {activeWorkspaceMode === 'jogging' && 'Forward Kinematics'}
            {activeWorkspaceMode === 'ik' && 'Inverse Kinematics & Gizmo'}
            {activeWorkspaceMode === 'trajectory' && 'Trajectory Waypoints'}
            {activeWorkspaceMode === 'workspace' && 'Workspace Analysis'}
            {activeWorkspaceMode === 'dynamics' && 'Dynamics & Control'}
          </h3>
        </div>

        {activeWorkspaceMode === 'jogging' && (
          <div className="flex items-center space-x-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-[10px]">
            <button
              onClick={() => setAngleUnit('deg')}
              className={`px-1.5 py-0.5 rounded font-mono ${
                angleUnit === 'deg' ? 'bg-sky-600 text-white' : 'text-slate-400'
              }`}
            >
              DEG
            </button>
            <button
              onClick={() => setAngleUnit('rad')}
              className={`px-1.5 py-0.5 rounded font-mono ${
                angleUnit === 'rad' ? 'bg-sky-600 text-white' : 'text-slate-400'
              }`}
            >
              RAD
            </button>
          </div>
        )}
      </div>

      {/* Scrollable Contextual Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* ======================================================== */}
        {/* MODE 1: JOGGING & FK SLIDERS                            */}
        {/* ======================================================== */}
        {activeWorkspaceMode === 'jogging' && (
          <>
            {/* Joint Sliders with Dual Badges (Joint J_i & Link L_i) and Link-matched Color Accents */}
            <div className="space-y-3">
              {robotModel.joints.map((joint, index) => {
                const currentVal = jointAngles[index] ?? 0;
                const minVal = joint.qMinDeg;
                const maxVal = joint.qMaxDeg;
                const linkColor =
                  robotModel.links[index + 1]?.color ||
                  DEFAULT_LINK_PALETTE[(index + 1) % DEFAULT_LINK_PALETTE.length];

                return (
                  <div key={joint.jointIndex} className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-850 space-y-2">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <div className="flex items-center space-x-1.5">
                        {/* Joint Badge (J_i) */}
                        <span
                          className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold shadow-xs"
                          title={`${t.manipulator.actuatedJoint} J${joint.jointIndex}`}
                        >
                          J{joint.jointIndex}
                        </span>
                        {/* Link Badge (L_i) */}
                        <span
                          className="px-1.5 py-0.5 rounded text-[10px] font-bold border shadow-xs"
                          style={{
                            backgroundColor: `${linkColor}33`,
                            borderColor: linkColor,
                            color: '#f8fafc',
                          }}
                          title={`${t.manipulator.mechanicalLink} L${joint.jointIndex}`}
                        >
                          L{joint.jointIndex}
                        </span>
                        <span className="text-slate-400 font-medium text-[11px]">
                          {t.manipulator.jointLabel} {joint.jointIndex}
                        </span>
                      </div>
                      <span className="text-sky-400 font-bold">
                        {angleUnit === 'deg'
                          ? `${currentVal.toFixed(1)}°`
                          : `${((currentVal * Math.PI) / 180).toFixed(3)} rad`}
                      </span>
                    </div>

                    <input
                      type="range"
                      min={minVal}
                      max={maxVal}
                      step={angleUnit === 'deg' ? 1 : 0.05}
                      value={currentVal}
                      onChange={(e) => setJointAngle(index, parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                      style={{ accentColor: linkColor }}
                    />

                    <div className="flex justify-between text-[10px] font-mono text-slate-500">
                      <span>{minVal}°</span>
                      <span>{maxVal}°</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Posture Presets */}
            <div className="space-y-2 pt-2 border-t border-slate-850">
              <span className="text-[11px] font-semibold text-slate-400">Posture Presets</span>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={applyHomePosture}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-medium border border-slate-700 transition"
                >
                  Home Posture
                </button>
                <button
                  onClick={applyZeroPosture}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-medium border border-slate-700 transition"
                >
                  Zero Posture
                </button>
                <button
                  onClick={applyBoundarySingularity}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-medium border border-slate-700 transition"
                >
                  Reach Singularity
                </button>
                <button
                  onClick={applyWristSingularity}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-medium border border-slate-700 transition"
                >
                  Wrist Singularity
                </button>
              </div>
            </div>
          </>
        )}

        {/* ======================================================== */}
        {/* MODE 2: IK & GIZMO                                      */}
        {/* ======================================================== */}
        {activeWorkspaceMode === 'ik' && (
          <>
            {/* 3D Gizmo Controls */}
            <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-2">
              <span className="text-xs font-semibold text-slate-300">3D Interactive TCP Gizmo</span>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => setGizmoMode('translate')}
                  className={`flex items-center justify-center space-x-1.5 py-1.5 rounded-lg text-xs font-medium border transition ${
                    gizmoMode === 'translate'
                      ? 'bg-amber-600 text-white border-amber-500 shadow-md shadow-amber-600/20'
                      : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-850'
                  }`}
                >
                  <Move className="w-3.5 h-3.5" />
                  <span>Translate (X,Y,Z)</span>
                </button>

                <button
                  onClick={() => setGizmoMode('rotate')}
                  className={`flex items-center justify-center space-x-1.5 py-1.5 rounded-lg text-xs font-medium border transition ${
                    gizmoMode === 'rotate'
                      ? 'bg-amber-600 text-white border-amber-500 shadow-md shadow-amber-600/20'
                      : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-850'
                  }`}
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Rotate (R,P,Y)</span>
                </button>
              </div>
              <p className="text-[10px] text-slate-400">
                Drag the colorful 3D arrows directly on the robot tool flange in the viewport.
              </p>
            </div>

            {/* 8 Pieper Configurations */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-300">8 Analytical Pieper Postures</span>
              <div className="grid grid-cols-2 gap-1.5">
                {ikConfigurations.map((cfg) => (
                  <button
                    key={cfg.index}
                    onClick={() => applyIKConfiguration(cfg)}
                    className={`p-2 rounded-xl text-left border text-[11px] transition ${
                      activeIKIndex === cfg.index
                        ? 'bg-amber-600/30 border-amber-500 text-amber-200'
                        : 'bg-slate-950/70 border-slate-850 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <span className="font-bold">Cfg #{cfg.index + 1}</span>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {cfg.shoulder} • {cfg.elbow} • {cfg.wrist}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ======================================================== */}
        {/* MODE 3: TRAJECTORY STUDIO                               */}
        {/* ======================================================== */}
        {activeWorkspaceMode === 'trajectory' && (
          <>
            {/* Presets */}
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-slate-300 flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Trajectory Presets</span>
              </span>
              <div className="grid grid-cols-1 gap-1.5">
                {presets.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => loadPresetTrajectory(preset.id)}
                    className="p-2 rounded-xl bg-slate-950/80 hover:bg-slate-850 border border-slate-850 text-left transition"
                  >
                    <div className="flex justify-between items-center">
                      <h4 className="text-xs font-medium text-slate-200">{preset.name}</h4>
                      <span className="text-[9px] font-mono text-purple-400">
                        {preset.waypoints.length} pts
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Profile Interpolation Selector */}
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-slate-300">Motion Profile</span>
              <select
                value={interpolationType}
                onChange={(e) => setInterpolationType(e.target.value as TrajectoryInterpolationType)}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-purple-500 font-mono"
              >
                <option value="quintic">Quintic Spline (Zero Jerk)</option>
                <option value="cubic">Cubic Polynomial</option>
                <option value="lspb">LSPB (Trapezoidal Velocity)</option>
                <option value="cartesian-linear">Cartesian Straight Line (SLERP)</option>
              </select>
            </div>

            {/* Waypoints Sequence List */}
            <div className="space-y-2 pt-2 border-t border-slate-850">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">
                  Waypoints ({waypoints.length})
                </span>
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => openAddPoseModal()}
                    className="flex items-center space-x-1 px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-medium transition shadow"
                    title={t.manipulator.addPoseTooltip}
                  >
                    <Plus className="w-3 h-3" />
                    <span>+ Add Pose</span>
                  </button>
                  <button
                    onClick={() => addWaypointFromCurrent()}
                    className="px-1.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-medium transition"
                    title={t.manipulator.sampleTcpTooltip}
                  >
                    {t.manipulator.sampleTcpBtn}
                  </button>
                  <button
                    onClick={clearWaypoints}
                    className="px-2 py-1 rounded bg-rose-600/20 text-rose-300 text-[10px] font-medium border border-rose-500/30 transition"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {waypoints.map((wp, idx) => (
                <div
                  key={wp.id}
                  className="p-2 rounded-xl bg-slate-950/80 border border-slate-850 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center space-x-2">
                    <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center text-[10px] font-mono font-bold">
                      {idx + 1}
                    </span>
                    <div>
                      <h5 className="font-medium text-slate-200 text-[11px] truncate w-32">{wp.name}</h5>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {wp.segmentDuration}s
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => setAllJointAngles(wp.jointAngles)}
                      className="p-1 rounded text-slate-400 hover:text-sky-300 transition"
                      title="Preview this posture"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => removeWaypoint(wp.id)}
                      className="p-1 rounded text-slate-400 hover:text-rose-400 transition"
                      title="Delete waypoint"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}

              <button
                onClick={handleExportJSON}
                disabled={!activeTrajectory}
                className="w-full mt-2 flex items-center justify-center space-x-1.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-medium border border-slate-700 transition disabled:opacity-40"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Plan (JSON)</span>
              </button>
            </div>
          </>
        )}

        {/* ======================================================== */}
        {/* MODE 4: WORKSPACE CLOUD & 2D SLICING                    */}
        {/* ======================================================== */}
        {activeWorkspaceMode === 'workspace' && (
          <>
            {/* Sampling & Progress */}
            <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-slate-200">Monte-Carlo Sampling</span>
                <span className="text-[10px] font-mono text-emerald-400">
                  {workspaceSettings.sampleCount / 1000}k points
                </span>
              </div>

              <div className="grid grid-cols-3 gap-1">
                {[20000, 50000, 100000].map((n) => (
                  <button
                    key={n}
                    onClick={() => setWorkspaceSettings({ sampleCount: n })}
                    className={`py-1 rounded text-[10px] font-mono transition ${
                      workspaceSettings.sampleCount === n
                        ? 'bg-sky-600 text-white font-medium'
                        : 'bg-slate-900 text-slate-400 border border-slate-850'
                    }`}
                  >
                    {(n / 1000).toFixed(0)}k
                  </button>
                ))}
              </div>

              <button
                onClick={() => generateWorkspaceCloud(workspaceSettings.sampleCount)}
                disabled={isGeneratingWorkspace}
                className="w-full py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium shadow-md shadow-emerald-600/20 transition flex items-center justify-center space-x-1.5 disabled:opacity-50"
              >
                {isGeneratingWorkspace ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Generating {workspaceProgressPct}%</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Re-Sample Cloud</span>
                  </>
                )}
              </button>
            </div>

            {/* Slicing Modes */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-300">2D Cross-Sections</span>
              <div className="grid grid-cols-2 gap-1.5">
                {sliceModes.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setWorkspaceSettings({ sliceMode: m.id })}
                    className={`p-2 rounded-xl border text-xs font-medium transition text-center ${
                      workspaceSettings.sliceMode === m.id
                        ? 'bg-sky-600/30 border-sky-500 text-sky-200'
                        : 'bg-slate-950/70 border-slate-850 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {workspaceSettings.sliceMode !== 'full-3d' && (
                <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-mono">
                      <span className="text-slate-400">Slice Band Thickness:</span>
                      <span className="text-sky-400 font-bold">{workspaceSettings.sliceThicknessMm} mm</span>
                    </div>
                    <input
                      type="range"
                      min="20"
                      max="200"
                      step="5"
                      value={workspaceSettings.sliceThicknessMm}
                      onChange={(e) => setWorkspaceSettings({ sliceThicknessMm: parseFloat(e.target.value) })}
                      className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-sky-500"
                    />
                  </div>

                  {workspaceSettings.sliceMode === 'slice-xy' && (
                    <div className="space-y-1 pt-1.5 border-t border-slate-850">
                      <div className="flex justify-between text-[10px] font-mono">
                        <span className="text-slate-400">Elevation (Z):</span>
                        <span className="text-amber-400 font-bold">{workspaceSettings.sliceElevationMm} mm</span>
                      </div>
                      <input
                        type="range"
                        min={workspaceData ? workspaceData.minZMm : -500}
                        max={workspaceData ? workspaceData.maxZMm : 1800}
                        step="10"
                        value={workspaceSettings.sliceElevationMm}
                        onChange={(e) => setWorkspaceSettings({ sliceElevationMm: parseFloat(e.target.value) })}
                        className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-amber-500"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Point Color Map */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-300">Point Color Map</span>
              <div className="grid grid-cols-3 gap-1.5">
                {colorModes.map((cm) => (
                  <button
                    key={cm.id}
                    onClick={() => setWorkspaceSettings({ colorMode: cm.id })}
                    className={`p-1.5 rounded-lg border text-[11px] font-mono transition text-center ${
                      workspaceSettings.colorMode === cm.id
                        ? 'bg-sky-600/30 border-sky-500 text-sky-200 font-bold'
                        : 'bg-slate-950/70 border-slate-850 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    {cm.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Constraints */}
            <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-200 font-medium">Floor Limit (Z ≥ 0)</span>
                <button
                  onClick={() =>
                    setWorkspaceSettings({ enforceFloorLimit: !workspaceSettings.enforceFloorLimit })
                  }
                  className={`px-2 py-0.5 rounded text-[10px] font-mono transition border ${
                    workspaceSettings.enforceFloorLimit
                      ? 'bg-emerald-600/30 text-emerald-300 border-emerald-500'
                      : 'bg-slate-900 text-slate-400 border-slate-800'
                  }`}
                >
                  {workspaceSettings.enforceFloorLimit ? 'Active' : 'Off'}
                </button>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-mono">
                  <span className="text-slate-400">Dexterous Sweet Spot:</span>
                  <span className="text-sky-400 font-bold">
                    {workspaceSettings.dexterousThreshold === 0
                      ? '0% (All)'
                      : `> ${Math.round(workspaceSettings.dexterousThreshold * 100)}% w`}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="0.6"
                  step="0.05"
                  value={workspaceSettings.dexterousThreshold}
                  onChange={(e) => setWorkspaceSettings({ dexterousThreshold: parseFloat(e.target.value) })}
                  className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-sky-500"
                />
              </div>
            </div>
          </>
        )}

        {/* ======================================================== */}
        {/* MODE 5: DYNAMICS & CONTROL LAB (PHASE 3)                */}
        {/* ======================================================== */}
        {activeWorkspaceMode === 'dynamics' && (
          <div className="space-y-4">
            {/* 1. Simulation Engine Transport */}
            <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-slate-200 uppercase tracking-wider flex items-center space-x-1.5">
                  <Cpu className="w-3.5 h-3.5 text-rose-400" />
                  <span>RK4 Physics Simulation</span>
                </span>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                  500 Hz
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() =>
                    dynamicsSettings.isRunning
                      ? stopDynamicsSimulation()
                      : startDynamicsSimulation()
                  }
                  className={`flex items-center justify-center space-x-1.5 py-2 px-3 rounded-lg text-xs font-mono font-bold transition shadow ${
                    dynamicsSettings.isRunning
                      ? 'bg-rose-600 hover:bg-rose-500 text-white'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  }`}
                >
                  {dynamicsSettings.isRunning ? (
                    <>
                      <Pause className="w-3.5 h-3.5 fill-current" />
                      <span>{t.manipulator.haltPhysics}</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                      <span>{t.manipulator.runSimulation}</span>
                    </>
                  )}
                </button>

                <button
                  onClick={resetDynamicsSimulation}
                  className="flex items-center justify-center space-x-1 py-2 px-3 rounded-lg bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-xs font-mono transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{t.manipulator.balanceGravity}</span>
                </button>
              </div>

              {/* Scientific Benchmark CSV Auto-Export & Action */}
              <div className="pt-2 border-t border-slate-800 space-y-1.5">
                <label className="flex items-center space-x-2 text-[10px] font-mono text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={dynamicsSettings.autoExportCSVOnStop ?? true}
                    onChange={(e) =>
                      setDynamicsSettings({ autoExportCSVOnStop: e.target.checked })
                    }
                    className="rounded bg-slate-900 border-slate-700 text-rose-500 focus:ring-0 focus:ring-offset-0 cursor-pointer accent-rose-500"
                  />
                  <span>{t.manipulator.autoSaveCsvNotice}</span>
                </label>

                <button
                  onClick={exportScientificBenchmarkCSV}
                  className="w-full flex items-center justify-center space-x-1.5 py-1.5 px-2 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-[10px] font-mono font-semibold transition"
                  title={t.manipulator.exportCsvTooltip}
                >
                  <FileSpreadsheet className="w-3 h-3 text-emerald-400" />
                  <span>{t.manipulator.exportCsvBtn}</span>
                </button>
              </div>
            </div>

            {/* 2. Control Architecture Selection */}
            <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-slate-300 block">
                  {t.manipulator.controlAlgorithmTitle}
                </span>
                <button
                  onClick={() => {
                    setEditingControllerDef(null);
                    setIsControllerModalOpen(true);
                  }}
                  className="flex items-center space-x-1 px-2 py-1 rounded-md bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 text-[10px] font-mono font-medium transition"
                  title={t.manipulator.addControllerTooltip}
                >
                  <Plus className="w-3 h-3 text-rose-400" />
                  <span>{t.manipulator.addControllerBtn}</span>
                </button>
              </div>

              {/* Grouped combobox selector */}
              <div className="relative">
                <select
                  value={dynamicsSettings.controllerType}
                  onChange={(e) => {
                    setDynamicsSettings({ controllerType: e.target.value as ControllerType });
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-xs font-mono text-slate-100 focus:outline-none focus:border-rose-500 transition appearance-none cursor-pointer pr-8"
                >
                  {Object.entries({
                    classical: t.manipulator.groupClassical,
                    robust: t.manipulator.groupRobust,
                    impedance: t.manipulator.groupImpedance,
                    optimal: t.manipulator.groupOptimal,
                    custom: t.manipulator.groupCustom,
                  }).map(([catKey, catLabel]) => {
                    const groupCtrls = ControllerStrategyRegistry.getAll().filter((c) => c.category === catKey);
                    if (groupCtrls.length === 0) return null;
                    return (
                      <optgroup key={catKey} label={catLabel} className="bg-slate-900 text-slate-400 font-bold">
                        {groupCtrls.map((ctrl) => (
                          <option key={ctrl.id} value={ctrl.id} className="text-slate-200 bg-slate-950 font-normal">
                            {ctrl.name}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
              </div>

              {/* Active Controller Summary Card */}
              {(() => {
                const activeCtrl = ControllerStrategyRegistry.get(dynamicsSettings.controllerType) || ControllerStrategyRegistry.get('computed-torque');
                if (!activeCtrl) return null;
                return (
                  <div className="p-2 bg-slate-900/90 rounded-lg border border-slate-800 space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded uppercase font-semibold tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30">
                        {activeCtrl.category}
                      </span>
                      {activeCtrl.isCustom && (
                        <button
                          onClick={() => {
                            const defs = ControllerStrategyRegistry.getCustomControllerDefinitions();
                            const found = defs.find((d) => d.id === activeCtrl.id);
                            if (found) {
                              setEditingControllerDef(found);
                              setIsControllerModalOpen(true);
                            }
                          }}
                          className="flex items-center space-x-1 text-[10px] text-amber-400 hover:text-amber-300 font-mono transition"
                        >
                          <Pencil className="w-3 h-3" />
                          <span>{t.manipulator.editSourceCode}</span>
                        </button>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono leading-relaxed mt-0.5">
                      {activeCtrl.description}
                    </div>
                  </div>
                );
              })()}

              {/* SMC Specialized Parameters Subpanel */}
              {dynamicsSettings.controllerType === 'sliding-mode' && (
                <div className="p-2.5 bg-slate-900/90 rounded-lg border border-purple-500/40 space-y-2 mt-2 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-1">
                    <span className="text-[11px] font-mono font-bold text-purple-300 flex items-center space-x-1">
                      <Sparkles className="w-3 h-3 text-purple-400" />
                      <span>{t.manipulator.smcSlidingSurface}</span>
                    </span>
                  </div>

                  {/* Switching Law Function Selector */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono text-slate-400 block">{t.manipulator.switchingFunction}</span>
                    <div className="grid grid-cols-2 gap-1 text-[10px] font-mono">
                      {[
                        { id: 'boundary-layer', name: 'Sat (Boundary)' },
                        { id: 'tanh', name: 'Tanh (Smooth)' },
                        { id: 'super-twisting', name: 'Super-Twisting' },
                        { id: 'sign', name: 'Sign (Chattering!)' },
                      ].map((fn) => (
                        <button
                          key={fn.id}
                          onClick={() => {
                            const cur = dynamicsSettings.smcSettings || {
                              lambda: [20, 20, 20, 25, 25, 25],
                              switchingGain: [35, 45, 30, 10, 8, 5],
                              boundaryLayer: [0.05, 0.05, 0.05, 0.05, 0.05, 0.05],
                              switchingFunction: 'boundary-layer',
                            };
                            setDynamicsSettings({
                              smcSettings: { ...cur, switchingFunction: fn.id as any },
                            });
                          }}
                          className={`p-1 rounded text-center border transition ${
                            dynamicsSettings.smcSettings?.switchingFunction === fn.id
                              ? 'bg-purple-600 text-white font-bold border-purple-400 shadow'
                              : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                          }`}
                        >
                          {fn.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Lambda Slider */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-mono">
                      <span className="text-slate-400">{t.manipulator.surfaceSlopeLambda}</span>
                      <span className="text-purple-300 font-bold">{dynamicsSettings.smcSettings?.lambda[0] || 20}</span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="60"
                      step="2"
                      value={dynamicsSettings.smcSettings?.lambda[0] || 20}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        const cur = dynamicsSettings.smcSettings;
                        const newLam = new Array(robotModel.dof).fill(val);
                        setDynamicsSettings({
                          smcSettings: { ...cur!, lambda: newLam },
                        });
                      }}
                      className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-purple-500"
                    />
                  </div>

                  {/* Switching Gain K_sw */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-mono">
                      <span className="text-slate-400">{t.manipulator.robustGainKsw}</span>
                      <span className="text-amber-400 font-bold">{dynamicsSettings.smcSettings?.switchingGain[0] || 20} rad/s²</span>
                    </div>
                    <input
                      type="range"
                      min="2"
                      max="60"
                      step="2"
                      value={dynamicsSettings.smcSettings?.switchingGain[0] || 20}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        const cur = dynamicsSettings.smcSettings;
                        const newK = new Array(robotModel.dof).fill(val);
                        setDynamicsSettings({
                          smcSettings: { ...cur!, switchingGain: newK },
                        });
                      }}
                      className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-amber-500"
                    />
                  </div>

                  {/* Boundary Layer Phi */}
                  {dynamicsSettings.smcSettings?.switchingFunction !== 'sign' && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] font-mono">
                        <span className="text-slate-400">{t.manipulator.boundaryLayerPhi}</span>
                        <span className="text-emerald-400 font-bold">{dynamicsSettings.smcSettings?.boundaryLayer[0] || 0.15} rad/s</span>
                      </div>
                      <input
                        type="range"
                        min="0.02"
                        max="0.5"
                        step="0.01"
                        value={dynamicsSettings.smcSettings?.boundaryLayer[0] || 0.15}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          const cur = dynamicsSettings.smcSettings;
                          const newPhi = new Array(robotModel.dof).fill(val);
                          setDynamicsSettings({
                            smcSettings: { ...cur!, boundaryLayer: newPhi },
                          });
                        }}
                        className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-emerald-500"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 3. Payload Mass & External Disturbance */}
            <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-2.5">
              <span className="text-xs font-mono font-bold text-slate-300 flex items-center space-x-1.5">
                <Scale className="w-3.5 h-3.5 text-amber-400" />
                <span>{t.manipulator.payloadDisturbanceTitle}</span>
              </span>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-mono">
                  <span className="text-slate-400">{t.manipulator.payloadAdded}</span>
                  <span className="text-amber-400 font-bold">{dynamicsSettings.payloadMass} kg</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="0.5"
                  value={dynamicsSettings.payloadMass}
                  onChange={(e) => setDynamicsSettings({ payloadMass: parseFloat(e.target.value) })}
                  className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-amber-500"
                />
              </div>

              {/* Push Disturbance Buttons */}
              <div className="pt-1 border-t border-slate-850 space-y-1">
                <span className="text-[10px] text-slate-400 font-mono block">{t.manipulator.instantaneousDisturbance}</span>
                <div className="grid grid-cols-2 gap-1.5 text-[11px] font-mono">
                  <button
                    onClick={() => {
                      const cur = dynamicsSettings.externalForce;
                      setDynamicsSettings({ externalForce: [cur[0] + 15, cur[1], cur[2]] });
                      setTimeout(() => setDynamicsSettings({ externalForce: [0, 0, 0] }), 400);
                    }}
                    className="p-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-750 text-slate-300 text-center"
                  >
                    {t.manipulator.pushFx}
                  </button>
                  <button
                    onClick={() => {
                      const cur = dynamicsSettings.externalForce;
                      setDynamicsSettings({ externalForce: [cur[0], cur[1], cur[2] - 25] });
                      setTimeout(() => setDynamicsSettings({ externalForce: [0, 0, 0] }), 400);
                    }}
                    className="p-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-750 text-slate-300 text-center"
                  >
                    {t.manipulator.pushFz}
                  </button>
                </div>
              </div>
            </div>

            {/* 4. Robot-Specific Motor & Controller Tuning System */}
            <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-2.5">
              {/* Header with Robot Model & Preset Status */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-slate-200 flex items-center space-x-1.5">
                  <Settings2 className="w-3.5 h-3.5 text-sky-400" />
                  <span>{t.manipulator.motorParamsPidTitle}</span>
                </span>
                <span
                  className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                    activeDynamicsProfile?.isCustomTuned
                      ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                      : 'bg-sky-500/15 text-sky-300 border-sky-500/40'
                  }`}
                  title={
                    activeDynamicsProfile?.isCustomTuned
                      ? t.manipulator.customParamsSavedNotice
                      : t.manipulator.defaultLabParamsNotice
                  }
                >
                  {activeDynamicsProfile?.isCustomTuned ? t.manipulator.customTunedBadge : t.manipulator.factoryDefaultBadge}
                </span>
              </div>

              {/* Toast Message Notification */}
              {dynToast && (
                <div
                  className={`p-1.5 rounded-lg text-[10px] font-mono flex items-center space-x-1.5 border animate-in fade-in duration-150 ${
                    dynToast.type === 'success'
                      ? 'bg-emerald-950/80 text-emerald-300 border-emerald-600/50'
                      : 'bg-rose-950/80 text-rose-300 border-rose-600/50'
                  }`}
                >
                  {dynToast.type === 'success' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  )}
                  <span className="truncate">{dynToast.text}</span>
                </div>
              )}

              {/* Action Toolbar: Import JSON, Export JSON, Reset Defaults */}
              <div className="grid grid-cols-3 gap-1.5 text-[10px] font-mono">
                {/* Hidden File Input for Upload */}
                <input
                  type="file"
                  ref={dynFileInputRef}
                  accept=".json"
                  className="hidden"
                  onChange={handleProfileFileUpload}
                />

                <button
                  onClick={() => dynFileInputRef.current?.click()}
                  className="flex items-center justify-center space-x-1 p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-sky-300 border border-slate-750 hover:border-sky-500/50 transition"
                  title={t.manipulator.uploadJsonTooltip}
                >
                  <Upload className="w-3 h-3 text-sky-400" />
                  <span>{t.manipulator.uploadJsonBtn}</span>
                </button>

                <button
                  onClick={exportDynamicsProfileJSON}
                  className="flex items-center justify-center space-x-1 p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-emerald-300 border border-slate-750 hover:border-emerald-500/50 transition"
                  title={t.manipulator.downloadJsonTooltip}
                >
                  <Download className="w-3 h-3 text-emerald-400" />
                  <span>{t.manipulator.downloadJsonBtn}</span>
                </button>

                <button
                  onClick={() => {
                    resetDynamicsProfileToFactory();
                    setDynToast({ text: `${t.manipulator.restoredSuccessToast} ${robotModel.name}`, type: 'success' });
                    setTimeout(() => setDynToast(null), 3000);
                  }}
                  className="flex items-center justify-center space-x-1 p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-750 hover:border-slate-600 transition"
                  title={t.manipulator.restoreDefaultsTooltip}
                >
                  <RotateCcw className="w-3 h-3 text-slate-400" />
                  <span>{t.manipulator.restoreDefaultsBtn}</span>
                </button>
              </div>

              {/* Motor Drive Architecture & Inverter Modal Trigger */}
              <button
                onClick={() => {
                  setMotorModalJointIdx(0);
                  setIsMotorModalOpen(true);
                }}
                className="w-full flex items-center justify-between p-2.5 rounded-xl bg-gradient-to-r from-rose-950/50 via-purple-950/30 to-slate-900 border border-rose-500/40 hover:border-rose-400 text-rose-300 text-xs font-mono font-semibold transition shadow"
              >
                <div className="flex items-center space-x-2">
                  <Cpu className="w-4 h-4 text-rose-400" />
                  <span>{t.manipulator.motorModelTitle}</span>
                </div>
                <span className="text-[10px] bg-rose-500/20 text-rose-200 px-2 py-0.5 rounded-md border border-rose-500/30 flex items-center space-x-1">
                  <span>500Hz</span>
                  <span>→</span>
                </span>
              </button>

              {/* Tuning Mode Tab Switcher */}
              <div className="flex bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-[10px] font-mono">
                <button
                  onClick={() => setDynTuningMode('master')}
                  className={`flex-1 py-1 rounded transition text-center ${
                    dynTuningMode === 'master'
                      ? 'bg-sky-600 text-white font-bold shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t.manipulator.masterSynchronous}
                </button>
                <button
                  onClick={() => setDynTuningMode('joints')}
                  className={`flex-1 py-1 rounded transition text-center ${
                    dynTuningMode === 'joints'
                      ? 'bg-purple-600 text-white font-bold shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t.manipulator.individualJointTuning} ({robotModel.dof})
                </button>
              </div>

              {/* Tab 1: Master Proportional Scaling */}
              {dynTuningMode === 'master' && (
                <div className="space-y-2 pt-1">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-mono">
                      <span className="text-slate-400">{t.manipulator.kpScale}</span>
                      <span className="text-sky-400 font-bold">
                        {Math.round(((dynamicsSettings.gains.kp[0] || 120) / (activeDynamicsProfile?.joints[0]?.kp || 120)) * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.3"
                      max="2.5"
                      step="0.05"
                      defaultValue="1.0"
                      onChange={(e) => {
                        const factor = parseFloat(e.target.value);
                        updateMasterGainScale(factor, 1.0);
                      }}
                      className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-sky-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-mono">
                      <span className="text-slate-400">{t.manipulator.kdScale}</span>
                      <span className="text-purple-400 font-bold">
                        {Math.round(((dynamicsSettings.gains.kd[0] || 20) / (activeDynamicsProfile?.joints[0]?.kd || 20)) * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.3"
                      max="2.5"
                      step="0.05"
                      defaultValue="1.0"
                      onChange={(e) => {
                        const factor = parseFloat(e.target.value);
                        updateMasterGainScale(1.0, factor);
                      }}
                      className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-purple-500"
                    />
                  </div>

                  {/* Summary Joint Table */}
                  <div className="mt-2 bg-slate-900/60 rounded-lg p-2 border border-slate-850 space-y-1">
                    <div className="grid grid-cols-4 text-[9px] font-mono text-slate-500 border-b border-slate-800 pb-1">
                      <span>{t.manipulator.jointColumn}</span>
                      <span className="text-center">Kp</span>
                      <span className="text-center">Kd</span>
                      <span className="text-right">τ_max</span>
                    </div>
                    {activeDynamicsProfile?.joints.map((jCfg, idx) => (
                      <div key={idx} className="grid grid-cols-4 text-[10px] font-mono text-slate-300">
                        <span className="text-sky-400 font-semibold">J{jCfg.jointIndex}</span>
                        <span className="text-center text-sky-300">{dynamicsSettings.gains.kp[idx] ?? jCfg.kp}</span>
                        <span className="text-center text-purple-300">{dynamicsSettings.gains.kd[idx] ?? jCfg.kd}</span>
                        <span className="text-right text-amber-400 font-mono">{jCfg.maxTorque} Nm</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tab 2: Individual Joint Motor Tuning */}
              {dynTuningMode === 'joints' && (
                <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                  {activeDynamicsProfile?.joints.map((jCfg, idx) => {
                    const isExpanded = dynExpandedJoint === idx;
                    const curKp = dynamicsSettings.gains.kp[idx] ?? jCfg.kp;
                    const curKd = dynamicsSettings.gains.kd[idx] ?? jCfg.kd;

                    return (
                      <div
                        key={idx}
                        className={`rounded-lg border transition ${
                          isExpanded
                            ? 'bg-slate-900/90 border-slate-700'
                            : 'bg-slate-900/50 border-slate-850 hover:border-slate-800'
                        }`}
                      >
                        {/* Motor Header Card */}
                        <div
                          onClick={() => setDynExpandedJoint(isExpanded ? null : idx)}
                          className="flex items-center justify-between p-2 cursor-pointer select-none"
                        >
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-mono font-bold text-sky-400">J{jCfg.jointIndex}</span>
                            <span className="text-[11px] font-mono text-slate-300 truncate max-w-[140px]">
                              {jCfg.name}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2 text-[10px] font-mono">
                            <span className="text-sky-300 font-semibold">{curKp}</span>
                            <span className="text-slate-600">/</span>
                            <span className="text-purple-300 font-semibold">{curKd}</span>
                            {isExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                            )}
                          </div>
                        </div>

                        {/* Expanded Motor Details */}
                        {isExpanded && (
                          <div className="p-2.5 pt-1 border-t border-slate-800 space-y-2 text-[10px] font-mono animate-in fade-in duration-100">
                            {/* Kp Slider */}
                            <div className="space-y-1">
                              <div className="flex justify-between">
                                <span className="text-slate-400">{t.manipulator.jointKp}</span>
                                <input
                                  type="number"
                                  value={curKp}
                                  onChange={(e) =>
                                    updateJointMotorConfig(idx, { kp: parseFloat(e.target.value) || 10 })
                                  }
                                  className="w-14 bg-slate-950 border border-slate-700 rounded px-1 text-center text-sky-300 font-bold"
                                />
                              </div>
                              <input
                                type="range"
                                min="10"
                                max="800"
                                step="5"
                                value={curKp}
                                onChange={(e) => updateJointMotorConfig(idx, { kp: parseFloat(e.target.value) })}
                                className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-sky-500"
                              />
                            </div>

                            {/* Kd Slider */}
                            <div className="space-y-1">
                              <div className="flex justify-between">
                                <span className="text-slate-400">{t.manipulator.jointKd}</span>
                                <input
                                  type="number"
                                  value={curKd}
                                  onChange={(e) =>
                                    updateJointMotorConfig(idx, { kd: parseFloat(e.target.value) || 1 })
                                  }
                                  className="w-14 bg-slate-950 border border-slate-700 rounded px-1 text-center text-purple-300 font-bold"
                                />
                              </div>
                              <input
                                type="range"
                                min="1"
                                max="120"
                                step="1"
                                value={curKd}
                                onChange={(e) => updateJointMotorConfig(idx, { kd: parseFloat(e.target.value) })}
                                className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-purple-500"
                              />
                            </div>

                            {/* Max Torque Limit */}
                            <div className="space-y-1 pt-1 border-t border-slate-800">
                              <div className="flex justify-between">
                                <span className="text-slate-400">{t.manipulator.peakTorque}</span>
                                <span className="text-amber-400 font-bold">{jCfg.maxTorque} N·m</span>
                              </div>
                              <input
                                type="range"
                                min="10"
                                max="2500"
                                step="10"
                                value={jCfg.maxTorque}
                                onChange={(e) =>
                                  updateJointMotorConfig(idx, { maxTorque: parseFloat(e.target.value) })
                                }
                                className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-amber-500"
                              />
                            </div>

                            {/* Friction params */}
                            <div className="grid grid-cols-2 gap-2 text-[9px] text-slate-400 pt-1">
                              <div>
                                <span>{t.manipulator.viscousFriction}</span>
                                <input
                                  type="number"
                                  step="0.001"
                                  value={jCfg.viscousFriction}
                                  onChange={(e) =>
                                    updateJointMotorConfig(idx, { viscousFriction: parseFloat(e.target.value) || 0 })
                                  }
                                  className="w-full bg-slate-950 border border-slate-800 rounded px-1 py-0.5 mt-0.5 text-slate-200"
                                />
                              </div>
                              <div>
                                <span>{t.manipulator.coulombFriction}</span>
                                <input
                                  type="number"
                                  step="0.05"
                                  value={jCfg.coulombFriction}
                                  onChange={(e) =>
                                    updateJointMotorConfig(idx, { coulombFriction: parseFloat(e.target.value) || 0 })
                                  }
                                  className="w-full bg-slate-950 border border-slate-800 rounded px-1 py-0.5 mt-0.5 text-slate-200"
                                />
                              </div>
                            </div>

                            {/* Motor Drive Architecture quick button */}
                            <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                              <span className="text-[9px] text-slate-400">{t.manipulator.motorTypeLabel}</span>
                              <button
                                onClick={() => {
                                  setMotorModalJointIdx(idx);
                                  setIsMotorModalOpen(true);
                                }}
                                className="px-2 py-0.5 rounded bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 text-[9px] font-mono font-bold uppercase transition flex items-center space-x-1"
                              >
                                <span>{jCfg.motorParams?.type || 'PMSM'}</span>
                                <span className="text-slate-400 font-normal">{t.manipulator.motorConfigBtn}</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 5. Quick Button to Open Torque Waveforms */}
            <button
              onClick={() => setBottomDockTab('torques')}
              className="w-full flex items-center justify-center space-x-2 py-2.5 px-3 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 text-xs font-mono font-bold transition shadow"
            >
              <Zap className="w-4 h-4 text-amber-400" />
              <span>{t.manipulator.viewTorqueOscilloscope}</span>
            </button>
          </div>
        )}
      </div>

      {/* Custom Controller Editor & Sandbox Modal */}
      <CustomControllerModal
        isOpen={isControllerModalOpen}
        onClose={() => setIsControllerModalOpen(false)}
        onRegistered={(newId) => {
          setDynamicsSettings({ controllerType: newId });
        }}
        initialDefinition={editingControllerDef}
      />

      {/* Motor Drive Configuration & Telemetry Modal */}
      <MotorDriveModal
        isOpen={isMotorModalOpen}
        onClose={() => setIsMotorModalOpen(false)}
        initialJointIndex={motorModalJointIdx}
      />
    </aside>
  );
};
