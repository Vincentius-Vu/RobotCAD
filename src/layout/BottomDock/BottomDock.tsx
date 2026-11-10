import React, { useState, useCallback, useRef } from 'react';
import { useRobotStore } from '../../store/robotStore';
import { useMobileRobotStore } from '../../store/mobileRobotStore';
import { useTranslation } from '../../i18n';
import { MotionProfilePlots } from '../../components/Trajectory/MotionProfilePlots';
import { TorqueOscilloscope } from '../../components/Dynamics/TorqueOscilloscope';
import { MobileRobotOscilloscope } from '../../components/Dynamics/MobileRobotOscilloscope';
import {
  Play,
  Pause,
  RotateCcw,
  Repeat,
  ChevronUp,
  ChevronDown,
  Activity,
  Zap,
  GripHorizontal,
  ExternalLink,
} from 'lucide-react';

interface BottomDockProps {
  onOpenOscilloscopeDialog?: () => void;
}

export const BottomDock: React.FC<BottomDockProps> = ({ onOpenOscilloscopeDialog }) => {
  const { t } = useTranslation();
  const {
    activeDomain,
    activeTrajectory,
    playbackState,
    playTrajectory,
    pauseTrajectory,
    seekTrajectoryTime,
    setPlaybackSpeed,
    togglePlaybackLoop,
    waypoints,
    isBottomDockExpanded,
    toggleBottomDockExpanded,
    bottomDockTab,
    setBottomDockTab,
    activeWorkspaceMode,
    dynamicsSettings,
    activeDynamicState,
    startDynamicsSimulation,
    stopDynamicsSimulation,
    resetDynamicsSimulation,
  } = useRobotStore();

  const {
    isSimRunning: isMobileSimRunning,
    toggleSimRunning: toggleMobileSimRunning,
    resetPose: resetMobilePose,
    clearTrace: clearMobileTrace,
    velocity: mobileVelocity,
    isNavigating: isMobileNavigating,
    plannedPath: mobilePlannedPath,
    currentWaypointIndex: mobileWpIndex,
    agvState,
  } = useMobileRobotStore();

  const [panelHeight, setPanelHeight] = useState<number>(440);
  const isDraggingRef = useRef(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(440);

  const totalDuration = activeTrajectory?.totalDuration || 0;
  const isDynamicsRunning = dynamicsSettings.isRunning;
  const currentTime = isDynamicsRunning && activeDynamicState
    ? (activeDynamicState.time % (totalDuration || 1))
    : playbackState.currentTime;

  const isPlayingOrRunning = activeWorkspaceMode === 'dynamics'
    ? isDynamicsRunning
    : playbackState.isPlaying;

  const handlePlayPause = () => {
    if (activeWorkspaceMode === 'dynamics') {
      if (isDynamicsRunning) {
        stopDynamicsSimulation();
      } else {
        startDynamicsSimulation();
      }
    } else {
      if (playbackState.isPlaying) {
        pauseTrajectory();
      } else {
        playTrajectory();
      }
    }
  };

  const handleResetOrRewind = () => {
    if (activeWorkspaceMode === 'dynamics') {
      resetDynamicsSimulation();
    } else {
      seekTrajectoryTime(0);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    seekTrajectoryTime(time);
  };

  const speeds = [0.25, 0.5, 1.0, 2.0];

  // Drag-to-resize logic
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDraggingRef.current = true;
    startYRef.current = e.clientY;
    startHeightRef.current = panelHeight;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const deltaY = startYRef.current - moveEvent.clientY; // Dragging UP increases height
      const newHeight = Math.max(220, Math.min(window.innerHeight * 0.85, startHeightRef.current + deltaY));
      setPanelHeight(newHeight);
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [panelHeight]);

  // Only show if in Trajectory or Dynamics Mode, or if an active trajectory has points, OR if in mobile robot domain
  if (
    activeDomain !== 'mobile_robot' &&
    activeWorkspaceMode !== 'trajectory' &&
    activeWorkspaceMode !== 'dynamics' &&
    !isBottomDockExpanded &&
    (!activeTrajectory || activeTrajectory.samples.length < 2)
  ) {
    return null;
  }

  return (
    <div className="border-t border-slate-800 bg-slate-900 z-20 shrink-0 select-none flex flex-col transition-all duration-150">
      {/* Resizable Curves Drawer */}
      {isBottomDockExpanded && (
        <div
          style={{ height: `${panelHeight}px` }}
          className="flex flex-col border-b border-slate-800 bg-slate-950/95 overflow-hidden transition-[height] duration-75 relative shadow-2xl"
        >
          {/* Interactive Drag Handle */}
          <div
            onMouseDown={handleMouseDown}
            className="h-2 w-full bg-slate-900 hover:bg-sky-500/40 active:bg-sky-500 cursor-row-resize flex items-center justify-center transition-colors group shrink-0 select-none border-b border-slate-800/80"
            title={t.bottomDock.dragHeightTooltip}
          >
            <div className="w-12 h-1 rounded-full bg-slate-700 group-hover:bg-sky-300 transition-colors flex items-center justify-center">
              <GripHorizontal className="w-3 h-3 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>

          {activeDomain === 'mobile_robot' ? (
            <>
              {/* Header inside Resizable Drawer for Mobile Robot */}
              <div className="px-4 py-1.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-xs font-mono shrink-0">
                <div className="flex items-center space-x-2">
                  <div className="flex items-center space-x-1.5 text-sky-400 font-bold">
                    <Activity className="w-3.5 h-3.5" />
                    <span>AMR Multi-Physics Digital Twin Oscilloscope</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-800 hidden sm:inline">
                    Dual-PMSM • Pacejka • Caster 3D
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => onOpenOscilloscopeDialog?.()}
                    className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-sky-950/60 hover:bg-sky-600/30 text-sky-300 border border-sky-500/40 text-[11px] font-mono font-medium transition shadow-sm"
                    title={t.bottomDock.popOutTooltip}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>{t.bottomDock.popOutBtn}</span>
                  </button>
                  <span className="text-[10px] text-slate-500 hidden sm:inline">
                    {t.bottomDock.dragHeightNotice}
                  </span>
                </div>
              </div>

              <div className="p-3.5 overflow-y-auto flex-1 custom-scrollbar">
                <MobileRobotOscilloscope onOpenDialog={onOpenOscilloscopeDialog} />
              </div>
            </>
          ) : (
            <>
              {/* Sub-Tab Navigation inside Resizable Drawer for Manipulator */}
              <div className="px-4 py-1.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-xs font-mono shrink-0">
                <div className="flex items-center space-x-1.5">
                  <button
                    onClick={() => setBottomDockTab('curves')}
                    className={`flex items-center space-x-1.5 px-3 py-1 rounded-md transition ${
                      bottomDockTab !== 'torques'
                        ? 'bg-purple-600/30 text-purple-200 border border-purple-500 font-bold shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                    }`}
                  >
                    <Activity className="w-3.5 h-3.5 text-purple-400" />
                    <span>Kinematic Curves (q, v, a)</span>
                  </button>

                  <button
                    onClick={() => setBottomDockTab('torques')}
                    className={`flex items-center space-x-1.5 px-3 py-1 rounded-md transition ${
                      bottomDockTab === 'torques'
                        ? 'bg-amber-600/30 text-amber-200 border border-amber-500 font-bold shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                    }`}
                  >
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span>{t.bottomDock.torqueOscilloscope}</span>
                  </button>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => onOpenOscilloscopeDialog?.()}
                    className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-sky-950/60 hover:bg-sky-600/30 text-sky-300 border border-sky-500/40 text-[11px] font-mono font-medium transition shadow-sm"
                    title={t.bottomDock.popOutTorqueTooltip}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>{t.bottomDock.popOutBtn}</span>
                  </button>
                  <span className="text-[10px] text-slate-500 hidden sm:inline">
                    {t.bottomDock.dragHeightNotice}
                  </span>
                </div>
              </div>

              <div className="p-3.5 overflow-y-auto flex-1 custom-scrollbar">
                {bottomDockTab === 'torques' ? <TorqueOscilloscope /> : <MotionProfilePlots />}
              </div>
            </>
          )}
        </div>
      )}

      {/* Main Scrubber / Status Toolbar */}
      {activeDomain === 'mobile_robot' ? (
        <div className="h-12 px-4 flex items-center justify-between gap-4">
          {/* Left: Transport Controls */}
          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={toggleMobileSimRunning}
              className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 font-medium shadow-md transition text-xs font-mono ${
                isMobileSimRunning
                  ? 'bg-amber-600 hover:bg-amber-500 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
              title={isMobileSimRunning ? t.bottomDock.pauseTooltip : t.bottomDock.resumeTooltip}
            >
              {isMobileSimRunning ? (
                <>
                  <Pause className="w-3.5 h-3.5 fill-current" />
                  <span className="hidden sm:inline">{t.bottomDock.pause}</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span className="hidden sm:inline">{t.bottomDock.simulate}</span>
                </>
              )}
            </button>

            <button
              onClick={resetMobilePose}
              className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-750 hover:text-white border border-slate-700 transition"
              title={t.bottomDock.resetPoseTooltip}
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={clearMobileTrace}
              className="px-2 py-1 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700 transition text-[11px] font-mono hidden md:inline"
              title={t.bottomDock.clearTraceTooltip}
            >
              {t.bottomDock.clearTrace}
            </button>
          </div>

          {/* Center: Live AMR Status & Waveform Badges */}
          <div className="flex-1 flex items-center space-x-2 max-w-3xl overflow-x-auto py-1">
            {/* Navigation State */}
            <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-slate-950 border border-slate-800 shrink-0 text-xs font-mono">
              <span
                className={`w-2 h-2 rounded-full ${
                  isMobileNavigating
                    ? 'bg-emerald-500 animate-pulse'
                    : isMobileSimRunning
                    ? 'bg-sky-500'
                    : 'bg-amber-500'
                }`}
              />
              <span className="text-slate-300">
                {isMobileNavigating
                  ? `${t.bottomDock.trackingRoute} (${mobileWpIndex + 1}/${mobilePlannedPath.length})`
                  : isMobileSimRunning
                  ? t.bottomDock.simRunning
                  : t.bottomDock.simPaused}
              </span>
            </div>

            {/* Speed badge */}
            <div className="flex items-center space-x-1 px-2 py-1 rounded bg-slate-950 border border-slate-800 text-[11px] font-mono shrink-0">
              <span className="text-slate-500">v:</span>
              <span className="text-sky-400 font-bold">{mobileVelocity.v.toFixed(2)}</span>
              <span className="text-slate-500 text-[10px]">m/s</span>
            </div>

            {/* Yaw rate badge */}
            <div className="flex items-center space-x-1 px-2 py-1 rounded bg-slate-950 border border-slate-800 text-[11px] font-mono shrink-0">
              <span className="text-slate-500">ω:</span>
              <span className="text-amber-400 font-bold">{mobileVelocity.omega.toFixed(2)}</span>
              <span className="text-slate-500 text-[10px]">rad/s</span>
            </div>

            {/* Multi-physics: Currents & Bus */}
            {agvState && (
              <>
                <div className="hidden lg:flex items-center space-x-1 px-2 py-1 rounded bg-slate-950 border border-slate-800 text-[11px] font-mono shrink-0">
                  <span className="text-slate-500">Iq (L/R):</span>
                  <span className="text-purple-400 font-semibold">
                    {agvState.iq_L.toFixed(1)} / {agvState.iq_R.toFixed(1)} A
                  </span>
                </div>

                <div className="hidden lg:flex items-center space-x-1 px-2 py-1 rounded bg-slate-950 border border-slate-800 text-[11px] font-mono shrink-0">
                  <span className="text-slate-500">Vdc:</span>
                  <span className="text-rose-400 font-semibold">{agvState.Vdc.toFixed(1)} V</span>
                </div>

                <div className="hidden xl:flex items-center space-x-1 px-2 py-1 rounded bg-slate-950 border border-slate-800 text-[11px] font-mono shrink-0">
                  <span className="text-slate-500">Slip:</span>
                  <span
                    className={`font-semibold ${
                      Math.abs(agvState.slip_L) > 0.15 ? 'text-rose-400' : 'text-emerald-400'
                    }`}
                  >
                    {(agvState.slip_L * 100).toFixed(1)}%
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Right: Expand Scope Drawer & Pop-out */}
          <div className="flex items-center space-x-1.5 shrink-0">
            <button
              onClick={toggleBottomDockExpanded}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition ${
                isBottomDockExpanded
                  ? 'bg-sky-600 text-white border-sky-500 shadow-md font-bold'
                  : 'bg-slate-800 text-sky-400 border-slate-700 hover:text-white hover:bg-slate-750'
              }`}
              title={t.bottomDock.mobileOscilloscopeTooltip}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>AMR Oscilloscope</span>
              {isBottomDockExpanded ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronUp className="w-3.5 h-3.5" />
              )}
            </button>

            <button
              onClick={() => onOpenOscilloscopeDialog?.()}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium bg-sky-950/60 text-sky-300 border-sky-500/40 hover:bg-sky-600 hover:text-white transition shadow-sm"
              title={t.bottomDock.popOutTooltip}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Scope Pop-out</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="h-12 px-4 flex items-center justify-between gap-4">
          {/* Playback Transport Controls */}
          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={handlePlayPause}
              disabled={!activeTrajectory || activeTrajectory.samples.length < 2}
              className={`w-8 h-8 rounded-lg flex items-center justify-center font-medium shadow-md transition disabled:opacity-40 disabled:cursor-not-allowed ${
                isPlayingOrRunning
                  ? 'bg-amber-600 hover:bg-amber-500 text-white'
                  : 'bg-sky-600 hover:bg-sky-500 text-white'
              }`}
              title={isPlayingOrRunning ? 'Pause / Stop (Space)' : 'Play / Simulate (Space)'}
            >
              {isPlayingOrRunning ? (
                <Pause className="w-3.5 h-3.5 fill-current" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
              )}
            </button>

            <button
              onClick={handleResetOrRewind}
              disabled={!activeTrajectory}
              className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-750 hover:text-white border border-slate-700 transition disabled:opacity-40"
              title="Rewind / Reset"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={togglePlaybackLoop}
              className={`p-1.5 rounded-lg border transition ${
                playbackState.isLooping
                  ? 'bg-sky-600/20 text-sky-400 border-sky-500/50'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
              }`}
              title={playbackState.isLooping ? 'Looping: ON' : 'Looping: OFF'}
            >
              <Repeat className="w-3.5 h-3.5" />
            </button>

            {/* Speeds */}
            <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800">
              {speeds.map((s) => (
                <button
                  key={s}
                  onClick={() => setPlaybackSpeed(s)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition ${
                    playbackState.speedMultiplier === s
                      ? 'bg-sky-600 text-white font-medium'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>

          {/* Center: Progress Slider & Waypoint Ticks */}
          <div className="flex-1 flex items-center space-x-3 max-w-2xl">
            <span className="text-xs font-mono text-sky-400 font-semibold shrink-0">
              {currentTime.toFixed(2)}s
            </span>

            <div className="relative flex-1 flex items-center">
              <input
                type="range"
                min="0"
                max={totalDuration || 1}
                step="0.01"
                value={currentTime}
                onChange={handleSeek}
                disabled={!activeTrajectory || totalDuration === 0}
                className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-sky-500 disabled:opacity-40"
              />

              {totalDuration > 0 &&
                waypoints.map((wp, idx) => {
                  let wpTime = 0;
                  for (let i = 0; i < idx; i++) {
                    wpTime += waypoints[i + 1]?.segmentDuration || 2.0;
                  }
                  const leftPct = (wpTime / totalDuration) * 100;
                  return (
                    <div
                      key={wp.id}
                      style={{ left: `${leftPct}%` }}
                      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-amber-400 border border-slate-900 pointer-events-none"
                      title={`${wp.name} at ${wpTime.toFixed(1)}s`}
                    />
                  );
                })}
            </div>

            <span className="text-xs font-mono text-slate-400 shrink-0">
              {totalDuration.toFixed(2)}s
            </span>
          </div>

          {/* Right: Curves & Torques Expander Buttons */}
          <div className="flex items-center space-x-1.5 shrink-0">
            {/* 1. Kinematic Curves Button */}
            <button
              onClick={() => {
                if (!isBottomDockExpanded || bottomDockTab !== 'curves') {
                  setBottomDockTab('curves');
                } else {
                  toggleBottomDockExpanded();
                }
              }}
              className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition ${
                isBottomDockExpanded && bottomDockTab === 'curves'
                  ? 'bg-purple-600 text-white border-purple-500 shadow-md font-bold'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white hover:bg-slate-750'
              }`}
              title={t.bottomDock.kinematicPlotsTooltip}
            >
              <Activity className="w-3.5 h-3.5 text-purple-400" />
              <span className="hidden sm:inline">Curves (q,v,a)</span>
              {isBottomDockExpanded && bottomDockTab === 'curves' ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronUp className="w-3.5 h-3.5" />
              )}
            </button>

            {/* 2. Dynamic Torques Button */}
            <button
              onClick={() => {
                if (!isBottomDockExpanded || bottomDockTab !== 'torques') {
                  setBottomDockTab('torques');
                } else {
                  toggleBottomDockExpanded();
                }
              }}
              className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition ${
                isBottomDockExpanded && bottomDockTab === 'torques'
                  ? 'bg-amber-600 text-white border-amber-500 shadow-md font-bold'
                  : 'bg-slate-800 text-amber-400 border-slate-700 hover:text-white hover:bg-slate-750'
              }`}
              title={t.bottomDock.torquePlotsTooltip}
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">{t.bottomDock.torques}</span>
              {isBottomDockExpanded && bottomDockTab === 'torques' ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronUp className="w-3.5 h-3.5" />
              )}
            </button>

            {/* 3. Multi-Physics Oscilloscope Pop-out Button */}
            <button
              onClick={() => onOpenOscilloscopeDialog?.()}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium bg-sky-950/60 text-sky-300 border-sky-500/40 hover:bg-sky-600 hover:text-white transition shadow-sm"
              title={t.bottomDock.popOutTorqueTooltip}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Scope Pop-out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
