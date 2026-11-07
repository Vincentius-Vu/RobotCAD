import React, { useState } from 'react';
import { useRobotStore } from '../../store/robotStore';
import { TrajectoryInterpolationType } from '../../types/trajectory';
import { TrajectoryExportModal } from '../UI/TrajectoryExportModal';
import {
  Play,
  Pause,
  RotateCcw,
  Repeat,
  Plus,
  Sliders,
  Camera,
} from 'lucide-react';

export const TrajectoryTimelineBar: React.FC = () => {
  const {
    activeTrajectory,
    playbackState,
    playTrajectory,
    pauseTrajectory,
    seekTrajectoryTime,
    setPlaybackSpeed,
    togglePlaybackLoop,
    addWaypointFromCurrent,
    interpolationType,
    setInterpolationType,
    toggleTrajectoryDrawer,
    waypoints,
    isRecording,
    recordingSeconds,
    startVideoRecording,
    stopVideoRecording,
  } = useRobotStore();

  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  const totalDuration = activeTrajectory?.totalDuration || 0;
  const currentTime = playbackState.currentTime;

  const formatRecordTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    seekTrajectoryTime(time);
  };

  const interpolationOptions: { id: TrajectoryInterpolationType; label: string }[] = [
    { id: 'quintic', label: 'Quintic (Smooth Jerk)' },
    { id: 'cubic', label: 'Cubic Spline' },
    { id: 'lspb', label: 'LSPB (Trapezoidal)' },
    { id: 'cartesian-linear', label: 'Cartesian SLERP' },
  ];

  const speeds = [0.25, 0.5, 1.0, 2.0];

  return (
    <div className="absolute bottom-5 left-1/2 -translate-x-1/2 w-11/12 max-w-4xl bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-2xl p-3.5 shadow-2xl z-20 flex flex-col space-y-2.5">
      {/* Upper Bar: Controls, Time & Waypoint Actions */}
      <div className="flex items-center justify-between">
        {/* Left: Play/Pause, Rewind, Loop, Speed */}
        <div className="flex items-center space-x-2">
          {/* Play / Pause */}
          <button
            onClick={() => (playbackState.isPlaying ? pauseTrajectory() : playTrajectory())}
            disabled={!activeTrajectory || activeTrajectory.samples.length < 2}
            className={`w-9 h-9 rounded-xl flex items-center justify-center font-medium shadow-md transition disabled:opacity-40 disabled:cursor-not-allowed ${
              playbackState.isPlaying
                ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/30'
                : 'bg-sky-600 hover:bg-sky-500 text-white shadow-sky-600/30'
            }`}
            title={playbackState.isPlaying ? 'Pause Trajectory' : 'Play Trajectory (60 FPS)'}
          >
            {playbackState.isPlaying ? (
              <Pause className="w-4 h-4 fill-current" />
            ) : (
              <Play className="w-4 h-4 fill-current ml-0.5" />
            )}
          </button>

          {/* Rewind */}
          <button
            onClick={() => seekTrajectoryTime(0)}
            disabled={!activeTrajectory}
            className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-750 hover:text-white border border-slate-700 transition disabled:opacity-40"
            title="Rewind to Start (0.0s)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Loop Toggle */}
          <button
            onClick={togglePlaybackLoop}
            className={`p-2 rounded-lg border transition ${
              playbackState.isLooping
                ? 'bg-sky-600/20 text-sky-400 border-sky-500/50'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
            title={playbackState.isLooping ? 'Looping Enabled' : 'Looping Disabled'}
          >
            <Repeat className="w-3.5 h-3.5" />
          </button>

          {/* Speed Selector */}
          <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800">
            {speeds.map((s) => (
              <button
                key={s}
                onClick={() => setPlaybackSpeed(s)}
                className={`px-2 py-1 rounded text-[10px] font-mono font-medium transition ${
                  playbackState.speedMultiplier === s
                    ? 'bg-sky-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>

          {/* Record 3D Simulation Video Button */}
          <button
            onClick={() => (isRecording ? stopVideoRecording() : startVideoRecording())}
            className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-mono font-medium transition ${
              isRecording
                ? 'bg-rose-600/30 text-rose-300 border-rose-500 shadow-md shadow-rose-600/20'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white hover:bg-slate-750'
            }`}
            title={
              isRecording
                ? 'Click to Stop Video Recording and save .webm file'
                : 'Record 3D Trajectory Simulation Video (60 FPS)'
            }
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isRecording ? 'bg-rose-500 animate-ping' : 'bg-rose-500'
              }`}
            />
            <span>{isRecording ? `REC ${formatRecordTime(recordingSeconds)}` : 'Rec Video'}</span>
          </button>
        </div>

        {/* Center: Timer Display */}
        <div className="flex items-center space-x-1.5 font-mono text-xs text-slate-200">
          <span className="text-sky-400 font-semibold">{currentTime.toFixed(2)}s</span>
          <span className="text-slate-500">/</span>
          <span className="text-slate-400">{totalDuration.toFixed(2)}s</span>
        </div>

        {/* Right: Interpolation Selector, Add Waypoint & Drawer Toggle */}
        <div className="flex items-center space-x-2">
          {/* Snap High-DPI Trajectory PNG */}
          <button
            onClick={() => setIsExportModalOpen(true)}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700 text-xs font-medium transition"
            title="Export High-Resolution Trajectory PNG (Select 96 / 150 / 300 / 600 DPI)"
          >
            <Camera className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">PNG (DPI)</span>
          </button>

          {/* Interpolation Type Dropdown */}
          <select
            value={interpolationType}
            onChange={(e) => setInterpolationType(e.target.value as TrajectoryInterpolationType)}
            className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-sky-500 font-mono"
            title="Kinematic Trajectory Interpolation Profile"
          >
            {interpolationOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Add Waypoint Button */}
          <button
            onClick={() => addWaypointFromCurrent()}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium shadow-md shadow-emerald-600/20 border border-emerald-500 transition"
            title="Record current robot joint posture as a new trajectory waypoint"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Add Pose</span>
          </button>

          {/* Open Trajectory Editor Drawer */}
          <button
            onClick={toggleTrajectoryDrawer}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-medium border border-slate-700 transition"
            title="Open Waypoints Manager & Motion Curves Drawer"
          >
            <Sliders className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden sm:inline">Trajectory ({waypoints.length})</span>
          </button>
        </div>
      </div>

      {/* Lower Bar: Scrub Slider with Waypoint Ticks */}
      <div className="relative flex items-center w-full">
        <input
          type="range"
          min="0"
          max={totalDuration || 1}
          step="0.01"
          value={currentTime}
          onChange={handleSeek}
          disabled={!activeTrajectory || totalDuration === 0}
          className="w-full h-2 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-sky-500 focus:outline-none disabled:opacity-40"
        />

        {/* Waypoint Tick Indicators along timeline */}
        {totalDuration > 0 &&
          waypoints.map((wp, idx) => {
            // Find accumulated time of this waypoint
            let wpTime = 0;
            for (let i = 0; i < idx; i++) {
              wpTime += waypoints[i + 1]?.segmentDuration || 2.0;
            }
            const leftPct = (wpTime / totalDuration) * 100;
            return (
              <div
                key={wp.id}
                style={{ left: `${leftPct}%` }}
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-amber-400 border border-slate-900 pointer-events-none"
                title={`${wp.name} at ${wpTime.toFixed(1)}s`}
              />
            );
          })}
      </div>

      {/* Trajectory PNG DPI Export Modal */}
      <TrajectoryExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
      />
    </div>
  );
};
