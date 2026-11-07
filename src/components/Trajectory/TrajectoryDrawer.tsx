import React, { useState } from 'react';
import { useRobotStore } from '../../store/robotStore';
import { TrajectoryPlanner } from '../../kinematics/TrajectoryPlanner';
import { MotionProfilePlots } from './MotionProfilePlots';
import { TrajectoryExportModal } from '../UI/TrajectoryExportModal';
import {
  X,
  Plus,
  Trash2,
  Eye,
  Sliders,
  Download,
  Play,
  Pause,
  Sparkles,
  Info,
  Camera,
} from 'lucide-react';

export const TrajectoryDrawer: React.FC = () => {
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const {
    isTrajectoryDrawerOpen,
    toggleTrajectoryDrawer,
    waypoints,
    activeTrajectory,
    currentRobotId,
    loadPresetTrajectory,
    removeWaypoint,
    updateWaypointDuration,
    addWaypointFromCurrent,
    openAddPoseModal,
    clearWaypoints,
    setAllJointAngles,
    interpolationType,
    playbackState,
    playTrajectory,
    pauseTrajectory,
  } = useRobotStore();

  if (!isTrajectoryDrawerOpen) return null;

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

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-xl bg-slate-900/95 backdrop-blur-xl border-l border-slate-800 shadow-2xl z-50 flex flex-col overflow-hidden">
      {/* Drawer Header */}
      <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-400">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
              <span>Trajectory Planner & Motion Profiles</span>
            </h2>
            <p className="text-[11px] text-slate-400 font-mono">
              Multi-Waypoint Interpolation & Real-Time Kinematic Analysis
            </p>
          </div>
        </div>

        <button
          onClick={toggleTrajectoryDrawer}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Drawer Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Presets & Quick Actions */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-300 flex items-center space-x-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Industrial Trajectory Presets</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {presets.map((preset) => (
              <button
                key={preset.id}
                onClick={() => loadPresetTrajectory(preset.id)}
                className="p-2.5 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-left transition flex flex-col justify-between"
              >
                <div>
                  <h4 className="text-xs font-medium text-slate-200">{preset.name}</h4>
                  <p className="text-[10px] text-slate-400 mt-1 line-clamp-2">
                    {preset.description}
                  </p>
                </div>
                <span className="text-[9px] font-mono text-sky-400 mt-2">
                  {preset.waypoints.length} waypoints • {preset.interpolationType}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Interpolation Theory Banner */}
        <div className="p-3 bg-sky-950/30 border border-sky-800/40 rounded-xl space-y-1">
          <div className="flex items-center space-x-2 text-xs font-semibold text-sky-300">
            <Info className="w-4 h-4 text-sky-400" />
            <span>Profile: {interpolationType.toUpperCase()}</span>
          </div>
          <p className="text-[11px] text-slate-300">
            {interpolationType === 'quintic' &&
              'Quintic Splines enforce continuous acceleration (zero jerk at waypoint transitions), protecting gearboxes and motors from mechanical shock.'}
            {interpolationType === 'cubic' &&
              'Cubic Polynomials guarantee position and velocity continuity between points with minimal computation.'}
            {interpolationType === 'lspb' &&
              'LSPB creates trapezoidal velocity profiles with constant-speed linear cruise and parabolic acceleration blends.'}
            {interpolationType === 'cartesian-linear' &&
              'Cartesian linear path moves the TCP along straight lines in 3D space with SLERP quaternion orientation interpolation.'}
          </p>
        </div>

        {/* Live Motion Curves Visualizer */}
        <MotionProfilePlots />

        {/* Waypoints Sequence List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <h3 className="text-xs font-semibold text-slate-200">
                Waypoints Sequence ({waypoints.length})
              </h3>
            </div>
            <div className="flex items-center space-x-1.5">
              <button
                onClick={() => openAddPoseModal()}
                className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-medium transition shadow"
                title="Thêm Pose mới với Vị trí X/Y/Z, Hướng Roll/Pitch/Yaw và Thời gian dự kiến"
              >
                <Plus className="w-3 h-3" />
                <span>+ Add Pose</span>
              </button>
              <button
                onClick={() => addWaypointFromCurrent()}
                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 text-[11px] font-medium transition"
                title="Lấy nhanh tư thế hiện tại"
              >
                Lấy hiện tại
              </button>
              <button
                onClick={clearWaypoints}
                className="px-2 py-1 rounded-lg bg-rose-600/20 text-rose-300 hover:bg-rose-600/30 text-[11px] font-medium border border-rose-500/30 transition"
              >
                Clear
              </button>
            </div>
          </div>

          {waypoints.length === 0 ? (
            <div className="p-6 bg-slate-950/60 rounded-xl border border-slate-800/80 text-center text-xs text-slate-400">
              No waypoints defined. Jog the robot or drag the TCP Gizmo, then click "Add Pose".
            </div>
          ) : (
            <div className="space-y-2">
              {waypoints.map((wp, index) => (
                <div
                  key={wp.id}
                  className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl flex items-center justify-between space-x-3"
                >
                  <div className="flex items-center space-x-3">
                    <span className="w-6 h-6 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center text-xs font-mono font-bold">
                      {index + 1}
                    </span>
                    <div>
                      <h4 className="text-xs font-medium text-slate-200">{wp.name}</h4>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                        q: [{wp.jointAngles.map((a) => a.toFixed(0)).join('°, ')}°]
                      </p>
                      <p className="text-[10px] text-slate-500 font-mono">
                        TCP: ({wp.cartesianPose.position.x.toFixed(0)},{' '}
                        {wp.cartesianPose.position.y.toFixed(0)},{' '}
                        {wp.cartesianPose.position.z.toFixed(0)}) mm
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {/* Duration input */}
                    {index > 0 && (
                      <div className="flex items-center space-x-1">
                        <input
                          type="number"
                          step="0.5"
                          min="0.2"
                          max="20"
                          value={wp.segmentDuration}
                          onChange={(e) =>
                            updateWaypointDuration(wp.id, parseFloat(e.target.value) || 1.0)
                          }
                          className="w-14 bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-xs font-mono text-slate-200 text-center focus:outline-none focus:border-sky-500"
                        />
                        <span className="text-[10px] text-slate-500 font-mono">s</span>
                      </div>
                    )}

                    {/* Move Robot to Waypoint */}
                    <button
                      onClick={() => setAllJointAngles(wp.jointAngles)}
                      className="p-1.5 rounded-lg bg-slate-900 text-slate-400 hover:text-sky-300 hover:bg-slate-850 border border-slate-800 transition"
                      title="Move robot to this waypoint posture"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete Waypoint */}
                    <button
                      onClick={() => removeWaypoint(wp.id)}
                      className="p-1.5 rounded-lg bg-slate-900 text-slate-400 hover:text-rose-400 hover:bg-slate-850 border border-slate-800 transition"
                      title="Delete waypoint"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Drawer Footer */}
      <div className="px-6 py-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsExportModalOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-medium border border-slate-700 transition"
            title="Export High-Resolution Trajectory PNG (Select 96 / 150 / 300 / 600 DPI)"
          >
            <Camera className="w-3.5 h-3.5 text-amber-400" />
            <span>Export PNG (DPI)</span>
          </button>

          <button
            onClick={handleExportJSON}
            disabled={!activeTrajectory}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-medium border border-slate-700 transition disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Plan (JSON)</span>
          </button>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() =>
              playbackState.isPlaying ? pauseTrajectory() : playTrajectory()
            }
            disabled={!activeTrajectory || activeTrajectory.samples.length < 2}
            className={`flex items-center space-x-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white shadow-md transition disabled:opacity-40 ${
              playbackState.isPlaying
                ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/30'
                : 'bg-sky-600 hover:bg-sky-500 shadow-sky-600/30'
            }`}
          >
            {playbackState.isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Play Simulation</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Trajectory PNG DPI Export Modal */}
      <TrajectoryExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
      />
    </div>
  );
};
