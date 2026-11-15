import React, { useEffect, useState } from 'react';
import { useMobileRobotStore, BENCHMARK_SCENARIOS } from '../../store/mobileRobotStore';
import { useRobotStore } from '../../store/robotStore';
import { useTranslation } from '../../i18n';
import {
  Navigation,
  Play,
  Square,
  RotateCcw,
  Plus,
  Trash2,
  Box,
  Cpu,
  MapPin,
  Activity,
  Layers,
  Download,
  Move,
  Zap,
  Rocket,
  FlaskConical,
  ShieldCheck,
} from 'lucide-react';


export const MobileRobotSidebar: React.FC = () => {
  const { t, language } = useTranslation();
  const { openAddPoseModal } = useRobotStore();
  const {
    specs,
    velocity,
    navGoal,
    isNavigating,
    physicsFidelity,
    agvState,
    setPhysicsFidelity,
    exportBenchmarkCSV,
    exportSCurveCSV,
    playSCurveManeuver,
    setTargetVelocity,
    setNavGoal,
    resetPose,
    addObstacle,
    clearObstacles,
    resetObstacles,
    clearTrace,
    poseWaypoints,
    addPoseFromCurrent,
    removePoseWaypoint,
    clearPoseWaypoints,
    executeMissionPose,
    executeMultiPoseMission,
    isMissionRunning,
    currentMissionIndex,
    // KDS State & Actions
    kdsNodes,
    kdsPlanResult,
    kdsSelectedAlgorithm,
    setKDSSelectedAlgorithm,
    kdsUseOptimalScaling,
    kdsIsPlaying,
    criticalDistanceM,
    setKDSUseOptimalScaling,
    generateKDSPlan,
    playKDSTrajectory,
    stopKDSTrajectory,
    runMultiPhysicsBatchBenchmark,
    toggleKDSNodeType,
    removeKDSNode,
    exportKDSResultsCSV,
    activeScenarioId,
    loadBenchmarkScenario,
    kdsTrackingMode,
    kdsTrackingError,
    setKDSTrackingMode,
    kdsEnableDisturbance,
    setKDSEnableDisturbance,
    systemMode,
    setSystemMode,
    researchSubTab,
    setResearchSubTab,
    startIndustrialAutonomousMission,
    stopIndustrialMission,
  } = useMobileRobotStore();



  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const handleExportBenchmark = () => {
    setIsExporting(true);
    setTimeout(() => {
      try {
        const csvContent = exportBenchmarkCSV();
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `agv_digital_twin_benchmark_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error('Export benchmark failed:', err);
      } finally {
        setIsExporting(false);
      }
    }, 50);
  };

  const handleExportSCurve = () => {
    setIsExporting(true);
    setTimeout(() => {
      try {
        const csvContent = exportSCurveCSV();
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `agv_scurve_benchmark_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error('Export S-Curve benchmark failed:', err);
      } finally {
        setIsExporting(false);
      }
    }, 50);
  };

  // Keyboard WASD listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      const key = e.key.toLowerCase();
      if (['w', 's', 'a', 'd', 'q', 'e', ' '].includes(key)) {
        e.preventDefault();
        setActiveKey(key);

        const vMax = specs.maxLinearSpeedMps;
        const wMax = specs.maxAngularSpeedRadps;

        if (key === 'w') setTargetVelocity(vMax * 0.7, 0);
        else if (key === 's') setTargetVelocity(-vMax * 0.6, 0);
        else if (key === 'a') setTargetVelocity(0, wMax * 0.7);
        else if (key === 'd') setTargetVelocity(0, -wMax * 0.7);
        else if (key === 'q' && specs.driveType === 'mecanum') setTargetVelocity(0, 0, vMax * 0.7);
        else if (key === 'e' && specs.driveType === 'mecanum') setTargetVelocity(0, 0, -vMax * 0.7);
        else if (key === ' ') setTargetVelocity(0, 0, 0);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (['w', 's', 'a', 'd', 'q', 'e'].includes(key)) {
        setActiveKey(null);
        setTargetVelocity(0, 0, 0);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [specs, setTargetVelocity]);

  const handleAddCylinderObstacle = () => {
    const newId = `obs_cyl_${Date.now()}`;
    const x = Number(((Math.random() - 0.5) * 6).toFixed(1));
    const y = Number(((Math.random() - 0.5) * 6).toFixed(1));
    addObstacle({
      id: newId,
      name: t.mobile.cylinderObstacle,
      type: 'cylinder',
      position: { x, y, z: 0.8 },
      dimensions: { radius: 0.35, height: 1.6 },
      color: '#eab308',
    });
  };

  const handleAddBoxObstacle = () => {
    const newId = `obs_box_${Date.now()}`;
    const x = Number(((Math.random() - 0.5) * 6).toFixed(1));
    const y = Number(((Math.random() - 0.5) * 6).toFixed(1));
    addObstacle({
      id: newId,
      name: t.mobile.palletObstacle,
      type: 'box',
      position: { x, y, z: 0.5 },
      dimensions: { width: 1.0, depth: 0.8, height: 1.0 },
      color: '#d97706',
    });
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs font-sans">
      {/* 0. Top System Mode Switcher (Dual-Mode: Industrial End-User vs Academic Lab R&D) */}
      <div className="p-1 rounded-xl bg-slate-900 border border-slate-800 grid grid-cols-2 gap-1 select-none">
        <button
          onClick={() => setSystemMode('industrial')}
          className={`py-2 px-2 rounded-lg font-bold text-[11px] transition flex items-center justify-center space-x-1.5 ${
            systemMode === 'industrial'
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-900/40 border border-emerald-400/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
          title={t.mobile.industrialPipelineDesc}
        >
          <Rocket className="w-3.5 h-3.5 text-emerald-300" />
          <span>{t.mobile.industrialPipelineTab}</span>
        </button>

        <button
          onClick={() => setSystemMode('research')}
          className={`py-2 px-2 rounded-lg font-bold text-[11px] transition flex items-center justify-center space-x-1.5 ${
            systemMode === 'research'
              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-900/40 border border-indigo-400/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
          title={t.mobile.rdLabDesc}
        >
          <FlaskConical className="w-3.5 h-3.5 text-purple-300" />
          <span>{t.mobile.rdLabTab}</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* MODE 1: INDUSTRIAL END-USER MODE (INTEGRATED AUTONOMOUS PIPELINE)          */}
      {/* ========================================================================= */}
      {systemMode === 'industrial' && (
        <>
          {/* Industrial Mission Dispatch Panel */}
          <div className="p-3.5 rounded-xl bg-gradient-to-b from-slate-900/90 to-slate-950/90 border border-emerald-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Navigation className="w-4 h-4 text-emerald-400" />
                <span className="font-semibold text-slate-100 text-xs">{t.mobile.autonomousDispatch}</span>
              </div>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                kdsIsPlaying || isNavigating
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}>
                {kdsIsPlaying || isNavigating ? t.mobile.runningRoute : t.mobile.ready}
              </span>
            </div>

            {/* Quick Station Targets */}
            <div className="space-y-1.5">
              <span className="text-[10px] text-slate-400 font-medium">{t.mobile.quickStations}</span>
              <div className="grid grid-cols-3 gap-1.5 text-[10px] font-mono font-medium">
                <button
                  onClick={() => setNavGoal({ x: -2.5, y: 2.0, thetaRad: Math.PI / 2 })}
                  className={`p-1.5 rounded-lg border text-left transition ${
                    navGoal?.x === -2.5 && navGoal?.y === 2.0
                      ? 'bg-emerald-600/30 border-emerald-500/50 text-emerald-200'
                      : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <span className="block text-slate-400 text-[9px]">{t.mobile.stationA1}</span>
                  <span>{t.mobile.pickup}</span>
                </button>
                <button
                  onClick={() => setNavGoal({ x: 2.5, y: 1.5, thetaRad: 0 })}
                  className={`p-1.5 rounded-lg border text-left transition ${
                    navGoal?.x === 2.5 && navGoal?.y === 1.5
                      ? 'bg-emerald-600/30 border-emerald-500/50 text-emerald-200'
                      : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <span className="block text-slate-400 text-[9px]">{t.mobile.stationB2}</span>
                  <span>{t.mobile.transfer}</span>
                </button>
                <button
                  onClick={() => setNavGoal({ x: 0.0, y: -3.8, thetaRad: Math.PI / 2 })}
                  className={`p-1.5 rounded-lg border text-left transition ${
                    navGoal?.x === 0.0 && navGoal?.y === -3.8
                      ? 'bg-emerald-600/30 border-emerald-500/50 text-emerald-200'
                      : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <span className="block text-slate-400 text-[9px]">{t.mobile.stationHome}</span>
                  <span>{t.mobile.recharge}</span>
                </button>
              </div>
            </div>

            {/* Target Coordinates */}
            <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
              <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-slate-500 block text-[10px]">{t.mobile.goalX}</span>
                <input
                  type="number"
                  step={0.5}
                  value={navGoal?.x ?? 0}
                  onChange={(e) => setNavGoal({ x: parseFloat(e.target.value) || 0, y: navGoal?.y ?? 0 })}
                  className="w-full bg-transparent font-bold text-slate-100 outline-none"
                />
              </div>
              <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-slate-500 block text-[10px]">{t.mobile.goalY}</span>
                <input
                  type="number"
                  step={0.5}
                  value={navGoal?.y ?? 0}
                  onChange={(e) => setNavGoal({ x: navGoal?.x ?? 0, y: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-transparent font-bold text-slate-100 outline-none"
                />
              </div>
            </div>

            {/* Master Dispatch Button (Seamless 4-Layer Pipeline) */}
            <div className="pt-1">
              {!(kdsIsPlaying || isNavigating) ? (
                <button
                  onClick={() => startIndustrialAutonomousMission()}
                  className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-950 flex items-center justify-center space-x-2 transition"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>{t.mobile.runAutonomous}</span>
                </button>
              ) : (
                <button
                  onClick={() => stopIndustrialMission()}
                  className="w-full py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-950 flex items-center justify-center space-x-2 transition animate-pulse"
                >
                  <Square className="w-4 h-4 fill-current" />
                  <span>{t.mobile.emergencyStop}</span>
                </button>
              )}
            </div>

            {/* Industrial Energy & Mission Metrics */}
            <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 space-y-1.5 text-[10px] font-mono">
              <div className="flex justify-between text-slate-400">
                <span>{t.mobile.trajectoryAlgorithm}</span>
                <span className="text-emerald-400 font-semibold">A* String-Pulling ➔ Continuous S-Curve</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>{t.mobile.corneringMode}</span>
                <span className="text-teal-300 font-semibold">{t.mobile.tangentArc}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>{t.mobile.linearVelocity}</span>
                <span className="text-slate-200 font-bold">{velocity.v.toFixed(2)} m/s (max {specs.maxLinearSpeedMps} m/s)</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>{t.mobile.closedLoopTracking}</span>
                <span className="text-indigo-300 font-semibold">Discrete Lyapunov (Ts = 50ms)</span>
              </div>
            </div>
          </div>

          {/* Teleoperation Override */}
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-300 text-xs flex items-center gap-1.5">
                <Move className="w-3.5 h-3.5 text-slate-400" />
                {t.mobile.manualOverride}
              </span>
              <span className="text-[9px] font-mono text-slate-500">{t.mobile.wasdKeys}</span>
            </div>

            {/* D-Pad Button Cluster */}
            <div className="flex flex-col items-center justify-center py-1 select-none">
              <button
                onMouseDown={() => setTargetVelocity(specs.maxLinearSpeedMps * 0.7, 0)}
                onMouseUp={() => setTargetVelocity(0, 0)}
                className={`w-10 h-7 rounded-t-lg bg-slate-800 hover:bg-slate-700 active:bg-emerald-600 border border-slate-700 flex items-center justify-center font-bold font-mono transition text-[10px] ${
                  activeKey === 'w' ? 'bg-emerald-600 text-white' : 'text-slate-300'
                }`}
              >
                ▲ W
              </button>
              <div className="flex items-center space-x-1 my-0.5">
                <button
                  onMouseDown={() => setTargetVelocity(0, specs.maxAngularSpeedRadps * 0.7)}
                  onMouseUp={() => setTargetVelocity(0, 0)}
                  className={`w-10 h-7 rounded-l-lg bg-slate-800 hover:bg-slate-700 active:bg-emerald-600 border border-slate-700 flex items-center justify-center font-bold font-mono transition text-[10px] ${
                    activeKey === 'a' ? 'bg-emerald-600 text-white' : 'text-slate-300'
                  }`}
                >
                  ◀ A
                </button>
                <button
                  onClick={() => setTargetVelocity(0, 0, 0)}
                  className="w-10 h-7 bg-rose-600/30 hover:bg-rose-600 active:bg-rose-700 border border-rose-500/50 flex items-center justify-center font-bold text-rose-300 hover:text-white transition text-[9px]"
                  title={t.common.eStop}
                >
                  STOP
                </button>
                <button
                  onMouseDown={() => setTargetVelocity(0, -specs.maxAngularSpeedRadps * 0.7)}
                  onMouseUp={() => setTargetVelocity(0, 0)}
                  className={`w-10 h-7 rounded-r-lg bg-slate-800 hover:bg-slate-700 active:bg-emerald-600 border border-slate-700 flex items-center justify-center font-bold font-mono transition text-[10px] ${
                    activeKey === 'd' ? 'bg-emerald-600 text-white' : 'text-slate-300'
                  }`}
                >
                  D ▶
                </button>
              </div>
              <button
                onMouseDown={() => setTargetVelocity(-specs.maxLinearSpeedMps * 0.6, 0)}
                onMouseUp={() => setTargetVelocity(0, 0)}
                className={`w-10 h-7 rounded-b-lg bg-slate-800 hover:bg-slate-700 active:bg-emerald-600 border border-slate-700 flex items-center justify-center font-bold font-mono transition text-[10px] ${
                  activeKey === 's' ? 'bg-emerald-600 text-white' : 'text-slate-300'
                }`}
              >
                ▼ S
              </button>
            </div>

            <div className="flex items-center justify-between font-mono text-[10px] text-slate-400 pt-1 border-t border-slate-850">
              <span>{t.mobile.setSpeed}</span>
              <span className="text-emerald-400 font-bold">{velocity.v.toFixed(2)} m/s</span>
            </div>
            <input
              type="range"
              min={-specs.maxLinearSpeedMps}
              max={specs.maxLinearSpeedMps}
              step={0.05}
              value={velocity.v}
              onChange={(e) => setTargetVelocity(parseFloat(e.target.value), velocity.omega, velocity.vY)}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
          </div>

          {/* Warehouse Layout Manager */}
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-300 text-xs flex items-center gap-1.5">
                <Box className="w-3.5 h-3.5 text-amber-400" />
                {t.mobile.obstacles}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={handleAddCylinderObstacle}
                className="py-1 px-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-medium text-[10px] flex items-center justify-center space-x-1 transition"
              >
                <Plus className="w-3 h-3 text-yellow-400" />
                <span>{t.mobile.addCylinder}</span>
              </button>
              <button
                onClick={handleAddBoxObstacle}
                className="py-1 px-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-medium text-[10px] flex items-center justify-center space-x-1 transition"
              >
                <Plus className="w-3 h-3 text-amber-500" />
                <span>{t.mobile.addPallet}</span>
              </button>
            </div>
            <div className="flex justify-between pt-1 border-t border-slate-850 text-[10px]">
              <button onClick={resetPose} className="text-slate-400 hover:text-white transition flex items-center gap-1">
                <RotateCcw className="w-3 h-3 text-emerald-400" /> {t.mobile.resetObstacles}
              </button>
              <button onClick={resetObstacles} className="text-slate-400 hover:text-white transition">
                {t.mobile.defaultObstacles}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ========================================================================= */}
      {/* MODE 2: ACADEMIC & RESEARCH LAB MODE (3 DECOUPLED MODULES)                 */}
      {/* ========================================================================= */}
      {systemMode === 'research' && (
        <>
          {/* Research Sub-Tab Switcher */}
          <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-slate-900 border border-slate-800 text-[10px] font-bold select-none">
            <button
              onClick={() => setResearchSubTab('trajectory_planning')}
              className={`py-1.5 px-1 rounded transition text-center flex flex-col items-center gap-0.5 ${
                researchSubTab === 'trajectory_planning'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>{t.topRibbon.trajectoryTab}</span>
              <span className="text-[8px] opacity-75 font-mono">{t.mobile.tier2KDS}</span>
            </button>

            <button
              onClick={() => setResearchSubTab('tracking_control')}
              className={`py-1.5 px-1 rounded transition text-center flex flex-col items-center gap-0.5 ${
                researchSubTab === 'tracking_control'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>{t.mobile.closedLoopTracking}</span>
              <span className="text-[8px] opacity-75 font-mono">{t.mobile.tier1Lyapunov}</span>
            </button>

            <button
              onClick={() => setResearchSubTab('plant_physics')}
              className={`py-1.5 px-1 rounded transition text-center flex flex-col items-center gap-0.5 ${
                researchSubTab === 'plant_physics'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>{t.mobile.multiPhysicsSubTitle}</span>
              <span className="text-[8px] opacity-75 font-mono">{t.mobile.tier0Twin}</span>
            </button>
          </div>

          {/* --------------------------------------------------------------------- */}
          {/* MODULE A: TRAJECTORY PLANNING (LAYER 2)                               */}
          {/* --------------------------------------------------------------------- */}
          {researchSubTab === 'trajectory_planning' && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Zap className="w-4 h-4 text-emerald-400" />
                    <span className="font-semibold text-slate-200 text-xs">{t.mobile.kdsTitle}</span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Zero-Jerk
                  </span>
                </div>

                {/* Benchmark Scenario Selector */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-slate-400 font-medium">{t.mobile.standardLogisticsBenchmark}</span>
                    <span className="font-mono text-[9px] text-cyan-400">{t.mobile.fiveRoutes}</span>
                  </div>
                  <div className="grid grid-cols-1 gap-1 text-[10px] font-medium max-h-36 overflow-y-auto pr-0.5">
                    {BENCHMARK_SCENARIOS.map((sc) => {
                      const isActive = activeScenarioId === sc.id;
                      return (
                        <button
                          key={sc.id}
                          onClick={() => loadBenchmarkScenario(sc.id)}
                          className={`py-1.5 px-2 rounded-lg border text-left transition flex items-center justify-between ${
                            isActive
                              ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-200 font-semibold shadow-sm shadow-cyan-950'
                              : 'bg-slate-900/80 hover:bg-slate-800 border-slate-800 text-slate-300'
                          }`}
                          title={sc.description}
                        >
                          <div className="flex items-center space-x-1.5 truncate">
                            <span className="font-mono text-[9px] opacity-75">#{sc.id}</span>
                            <span className="truncate">{sc.name.split(':')[1] || sc.name}</span>
                          </div>
                          <span className="font-mono text-[9px] text-slate-400 shrink-0">{sc.distanceM}m</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Trajectory Generation Algorithm Selector */}
                <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-200">{t.mobile.trajectoryGenTitle}</span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-300 border border-sky-500/20">
                      Multi-Order Suite
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                    <button
                      onClick={() => setKDSSelectedAlgorithm('kds_scurve')}
                      className={`p-1.5 rounded-lg border text-left transition ${
                        kdsSelectedAlgorithm === 'kds_scurve'
                          ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300 font-semibold shadow-sm shadow-emerald-500/20'
                          : 'bg-slate-950 hover:bg-slate-900 border-slate-800 text-slate-400'
                      }`}
                    >
                      <div className="font-bold flex items-center justify-between">
                        <span>★ KDS S-Curve</span>
                        <span className="text-[9px] opacity-75">7-Pha</span>
                      </div>
                      <div className="text-[9px] opacity-70">{t.mobile.zeroJerkOpt}</div>
                    </button>

                    <button
                      onClick={() => setKDSSelectedAlgorithm('quintic')}
                      className={`p-1.5 rounded-lg border text-left transition ${
                        kdsSelectedAlgorithm === 'quintic'
                          ? 'bg-amber-500/20 border-amber-500/60 text-amber-300 font-semibold shadow-sm shadow-amber-500/20'
                          : 'bg-slate-950 hover:bg-slate-900 border-slate-800 text-slate-400'
                      }`}
                    >
                      <div className="font-bold flex items-center justify-between">
                        <span>Quintic Spline</span>
                        <span className="text-[9px] opacity-75">{t.mobile.quinticPolynomial}</span>
                      </div>
                      <div className="text-[9px] opacity-70">{t.mobile.quinticDesc}</div>
                    </button>

                    <button
                      onClick={() => setKDSSelectedAlgorithm('cubic')}
                      className={`p-1.5 rounded-lg border text-left transition ${
                        kdsSelectedAlgorithm === 'cubic'
                          ? 'bg-sky-500/20 border-sky-500/60 text-sky-300 font-semibold shadow-sm shadow-sky-500/20'
                          : 'bg-slate-950 hover:bg-slate-900 border-slate-800 text-slate-400'
                      }`}
                    >
                      <div className="font-bold flex items-center justify-between">
                        <span>Cubic Spline</span>
                        <span className="text-[9px] opacity-75">{t.mobile.cubicPolynomial}</span>
                      </div>
                      <div className="text-[9px] opacity-70">{t.mobile.cubicDesc}</div>
                    </button>

                    <button
                      onClick={() => setKDSSelectedAlgorithm('trapezoidal')}
                      className={`p-1.5 rounded-lg border text-left transition ${
                        kdsSelectedAlgorithm === 'trapezoidal'
                          ? 'bg-rose-500/20 border-rose-500/60 text-rose-300 font-semibold shadow-sm shadow-rose-500/20'
                          : 'bg-slate-950 hover:bg-slate-900 border-slate-800 text-slate-400'
                      }`}
                    >
                      <div className="font-bold flex items-center justify-between">
                        <span>Trapezoidal</span>
                        <span className="text-[9px] opacity-75">{t.mobile.trapezoidalProfile}</span>
                      </div>
                      <div className="text-[9px] opacity-70">{t.mobile.trapezoidalDesc}</div>
                    </button>
                  </div>

                  {/* Profile Mathematical Continuity Badge */}
                  <div className="p-1.5 rounded bg-slate-950 border border-slate-800/80 text-[10px] font-mono flex items-center justify-between text-slate-400">
                    <span>{t.common.status}:</span>
                    {kdsSelectedAlgorithm === 'kds_scurve' && (
                      <span className="text-emerald-400">{t.mobile.charZeroJerk}</span>
                    )}
                    {kdsSelectedAlgorithm === 'quintic' && (
                      <span className="text-amber-400">{t.mobile.charQuintic}</span>
                    )}
                    {kdsSelectedAlgorithm === 'cubic' && (
                      <span className="text-sky-400">{t.mobile.charCubic}</span>
                    )}
                    {kdsSelectedAlgorithm === 'trapezoidal' && (
                      <span className="text-rose-400">{t.mobile.charTrapezoidal}</span>
                    )}
                  </div>
                </div>

                {/* Optimal Scaling Toggle & Metrics */}
                <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80 space-y-2 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300 font-medium">{t.mobile.spatioTemporalOpt}</span>
                    <button
                      onClick={() => {
                        setKDSUseOptimalScaling(!kdsUseOptimalScaling);
                        generateKDSPlan();
                      }}
                      className={`px-2.5 py-0.5 rounded font-mono text-[10px] font-bold transition border ${
                        kdsUseOptimalScaling
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      {kdsUseOptimalScaling ? t.mobile.optEnabled : t.mobile.optDisabled}
                    </button>
                  </div>

                  <div className="flex justify-between font-mono text-[10px] text-slate-400">
                    <span>{t.mobile.criticalLength}</span>
                    <span className="text-slate-200 font-semibold">{criticalDistanceM.toFixed(1)} m</span>
                  </div>

                  {kdsPlanResult && (
                    <div className="flex justify-between font-mono text-[10px] text-slate-400 pt-1 border-t border-slate-800">
                      <span>{t.mobile.energyTotal} <b className="text-emerald-400">{kdsPlanResult.totalEnergyJ.toFixed(1)} J</b></span>
                      <span>{t.mobile.energySaved} <b className="text-emerald-300">{kdsPlanResult.energySavedPercent > 0 ? `-${kdsPlanResult.energySavedPercent.toFixed(1)}%` : '0%'}</b></span>
                    </div>
                  )}
                </div>

                {/* Nodes List */}
                <div className="space-y-1.5 max-h-36 overflow-y-auto custom-scrollbar">
                  {kdsNodes.map((n, idx) => {
                    const isTarget = n.type === 'Target';
                    return (
                      <div
                        key={n.id}
                        className={`p-1.5 rounded-lg border text-[11px] font-mono flex items-center justify-between transition ${
                          isTarget
                            ? 'bg-purple-950/40 border-purple-500/40 text-purple-200'
                            : 'bg-amber-950/30 border-amber-500/30 text-amber-200'
                        }`}
                      >
                        <div className="flex items-center space-x-1.5">
                          <span className="text-[10px] font-bold">{idx + 1}.</span>
                          <button
                            onClick={() => {
                              toggleKDSNodeType(n.id);
                              generateKDSPlan();
                            }}
                            className={`px-1.5 py-0.5 rounded text-[9px] font-sans font-bold border transition ${
                              isTarget
                                ? 'bg-purple-600/30 text-purple-300 border-purple-500/40'
                                : 'bg-amber-600/30 text-amber-300 border-amber-500/40'
                            }`}
                            title={t.mobile.togglePoseType}
                          >
                            {isTarget ? 'Target' : 'Waypoint'}
                          </button>
                          <span className="text-[10px] text-slate-300">
                            ({n.x.toFixed(1)}, {n.y.toFixed(1)})
                          </span>
                        </div>

                        <div className="flex items-center space-x-1">
                          {isTarget && (
                            <span className="text-[9px] text-purple-300 font-mono">
                              {((n.theta * 180) / Math.PI).toFixed(0)}°
                            </span>
                          )}
                          {kdsNodes.length > 2 && (
                            <button
                              onClick={() => {
                                removeKDSNode(n.id);
                                generateKDSPlan();
                              }}
                              className="text-slate-400 hover:text-rose-400 transition p-0.5"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Planning Action Buttons */}
                <div className="space-y-1.5 pt-1">
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => generateKDSPlan()}
                      className="py-2 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-medium flex items-center justify-center space-x-1.5 transition text-[10px]"
                      title={t.mobile.computeTrajectory}
                    >
                      <Activity className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{t.mobile.computeTrajectory}</span>
                    </button>

                    <button
                      onClick={() => {
                        const csv = exportKDSResultsCSV();
                        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.setAttribute('download', `kds_trajectory_${Date.now()}.csv`);
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        URL.revokeObjectURL(url);
                      }}
                      className="py-2 px-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-medium flex items-center justify-center space-x-1.5 transition text-[10px]"
                      title={t.mobile.exportTrajCsv}
                    >
                      <Download className="w-3.5 h-3.5 text-slate-400" />
                      <span>{t.mobile.exportTrajCsv}</span>
                    </button>
                  </div>

                  <button
                    onClick={() => runMultiPhysicsBatchBenchmark()}
                    className="w-full py-2.5 px-3 rounded-lg bg-gradient-to-r from-cyan-600/30 via-sky-600/30 to-emerald-600/30 hover:from-cyan-600/50 hover:to-emerald-600/50 border border-cyan-500/40 text-cyan-200 font-semibold flex items-center justify-center space-x-2 transition text-[11px] shadow-sm shadow-cyan-950"
                    title={t.mobile.sotaBenchmarkBtn}
                  >
                    <Cpu className="w-4 h-4 text-cyan-400" />
                    <span>{t.mobile.sotaBenchmarkBtn}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* --------------------------------------------------------------------- */}
          {/* MODULE B: TRACKING CONTROL & LYAPUNOV STABILITY (LAYER 1)             */}
          {/* --------------------------------------------------------------------- */}
          {researchSubTab === 'tracking_control' && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <ShieldCheck className="w-4 h-4 text-sky-400" />
                    <span className="font-semibold text-slate-200 text-xs">{t.mobile.lyapunovTitle}</span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
                    ZOH Ts=50ms
                  </span>
                </div>

                {/* Tracking Mode Selection */}
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 border border-slate-800/80 text-[11px]">
                  <span className="text-slate-300 font-medium">{t.mobile.execMode}</span>
                  <button
                    onClick={() => setKDSTrackingMode(kdsTrackingMode === 'closed_loop' ? 'open_loop' : 'closed_loop')}
                    className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold transition border ${
                      kdsTrackingMode === 'closed_loop'
                        ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                        : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    }`}
                  >
                    {kdsTrackingMode === 'closed_loop' ? t.mobile.closedLoopMode : t.mobile.openLoopMode}
                  </button>
                </div>

                {/* Disturbance & Initial Perturbation Toggle */}
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 border border-slate-800/80 text-[11px]">
                  <div className="flex flex-col">
                    <span className="text-slate-300 font-medium">{t.mobile.disturbanceNoise}</span>
                    <span className="text-[9px] text-slate-500">{language === 'vi' ? 'Δx=-12cm, Δy=+15cm, Δθ=+6°, trượt 1.8%' : 'Δx=-12cm, Δy=+15cm, Δθ=+6°, slip 1.8%'}</span>
                  </div>
                  <button
                    onClick={() => setKDSEnableDisturbance(!kdsEnableDisturbance)}
                    className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold transition border ${
                      kdsEnableDisturbance
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {kdsEnableDisturbance ? t.mobile.disturbanceEnabled : t.mobile.disturbanceDisabled}
                  </button>
                </div>

                {/* Live Closed-Loop Tracking Telemetry */}
                {kdsTrackingError && (
                  <div className={`p-2.5 rounded-lg border space-y-1.5 text-[10px] font-mono transition ${
                    kdsTrackingMode === 'closed_loop'
                      ? 'bg-sky-950/30 border-sky-500/40'
                      : 'bg-amber-950/30 border-amber-500/40'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="font-sans font-bold flex items-center gap-1 text-slate-200">
                        <span className={`w-2 h-2 rounded-full ${
                          kdsTrackingMode === 'closed_loop' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400 animate-ping'
                        }`}></span>
                        {kdsTrackingMode === 'closed_loop' ? t.mobile.closedLoopMode : t.mobile.openLoopMode}
                      </span>
                      <span className={`text-[9px] px-1.5 py-0.2 rounded border ${
                        kdsTrackingMode === 'closed_loop'
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                      }`}>
                        {kdsTrackingMode === 'closed_loop' ? t.mobile.ispsProperty : t.mobile.driftProperty}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800">
                      <div>
                        <span className="text-slate-400">{t.mobile.posError}</span>
                        <div className={`text-xs font-bold ${kdsTrackingError.ePosMm < 50 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {kdsTrackingError.ePosMm.toFixed(1)} mm
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-400">{t.mobile.thetaError}</span>
                        <div className={`text-xs font-bold ${Math.abs(kdsTrackingError.eThetaDeg) < 3.0 ? 'text-sky-300' : 'text-amber-400'}`}>
                          {kdsTrackingError.eThetaDeg.toFixed(2)}°
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-between text-[9px] text-slate-400 pt-0.5">
                      <span>e_x: {kdsTrackingError.ex.toFixed(3)}m</span>
                      <span>e_y: {kdsTrackingError.ey.toFixed(3)}m</span>
                      <span>V(e): {kdsTrackingError.lyapunovV.toFixed(4)}</span>
                    </div>
                  </div>
                )}

                {/* Tracking Playback Actions */}
                <div className="pt-1">
                  <button
                    onClick={() => {
                      if (kdsIsPlaying) {
                        stopKDSTrajectory();
                      } else {
                        playKDSTrajectory();
                      }
                    }}
                    className={`w-full py-2 px-3 rounded-lg font-bold flex items-center justify-center space-x-1.5 transition text-[11px] shadow ${
                      kdsIsPlaying
                        ? 'bg-rose-600 hover:bg-rose-500 text-white'
                        : 'bg-sky-600 hover:bg-sky-500 text-white'
                    }`}
                  >
                    {kdsIsPlaying ? (
                      <>
                        <Square className="w-3.5 h-3.5 text-white" />
                        <span>{t.mobile.stopTrackingTest}</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>{t.mobile.playTrackingTest}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* --------------------------------------------------------------------- */}
          {/* MODULE C: PLANT PHYSICS & DIGITAL TWIN (LAYER 0)                      */}
          {/* --------------------------------------------------------------------- */}
          {researchSubTab === 'plant_physics' && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-gradient-to-b from-indigo-950/40 to-slate-950/80 border border-indigo-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Cpu className="w-4 h-4 text-indigo-400" />
                    <span className="font-semibold text-slate-100">{t.mobile.digitalTwinTitle}</span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                    {t.mobile.multiPhysicsSubTitle}
                  </span>
                </div>

                {/* Fidelity Switcher */}
                <div className="grid grid-cols-2 gap-1.5 p-1 rounded-lg bg-slate-900 border border-slate-800">
                  <button
                    onClick={() => setPhysicsFidelity('multiphysics')}
                    className={`py-1.5 px-2 rounded-md font-medium text-[11px] transition flex items-center justify-center space-x-1 ${
                      physicsFidelity === 'multiphysics'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    <Activity className="w-3 h-3" />
                    <span>{t.mobile.multiPhysicsFull}</span>
                  </button>
                  <button
                    onClick={() => setPhysicsFidelity('kinematic')}
                    className={`py-1.5 px-2 rounded-md font-medium text-[11px] transition flex items-center justify-center space-x-1 ${
                      physicsFidelity === 'kinematic'
                        ? 'bg-slate-700 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    <Layers className="w-3 h-3" />
                    <span>{t.mobile.kinematicIdeal}</span>
                  </button>
                </div>

                {/* Real-time Sub-systems Status */}
                {physicsFidelity === 'multiphysics' && agvState && (
                  <div className="grid grid-cols-3 gap-1.5 text-center font-mono text-[10px] pt-0.5">
                    <div className="p-1.5 rounded bg-slate-900/90 border border-slate-800">
                      <span className="text-slate-500 block text-[9px]">V_dc Bus</span>
                      <span className="text-indigo-400 font-bold">{agvState.Vdc.toFixed(1)}V</span>
                    </div>
                    <div className="p-1.5 rounded bg-slate-900/90 border border-slate-800">
                      <span className="text-slate-500 block text-[9px]">{t.mobile.motorTorqueTe}</span>
                      <span className="text-emerald-400 font-bold">{((agvState.Te_L + agvState.Te_R) / 2).toFixed(1)}Nm</span>
                    </div>
                    <div className="p-1.5 rounded bg-slate-900/90 border border-slate-800">
                      <span className="text-slate-500 block text-[9px]">{t.mobile.slipRatioKappa}</span>
                      <span className={`font-bold ${Math.abs(agvState.slip_L) > 0.1 ? 'text-amber-400' : 'text-slate-300'}`}>
                        {(Math.abs(agvState.slip_L) * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                )}

                {/* Benchmark CSV Export & S-Curve Controls */}
                <div className="space-y-1.5 pt-1">
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={handleExportBenchmark}
                      disabled={isExporting}
                      className="py-1.5 px-2 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 active:bg-indigo-600 border border-indigo-500/40 text-indigo-200 font-medium flex items-center justify-center space-x-1.5 transition text-[10px]"
                      title={t.mobile.exportMotorCsv1s}
                    >
                      <Download className="w-3 h-3 text-indigo-400" />
                      <span>{isExporting ? t.mobile.solveProgress : t.mobile.exportMotorCsv1s}</span>
                    </button>
                    <button
                      onClick={handleExportSCurve}
                      disabled={isExporting}
                      className="py-1.5 px-2 rounded-lg bg-purple-600/30 hover:bg-purple-600/50 active:bg-purple-600 border border-purple-500/40 text-purple-200 font-medium flex items-center justify-center space-x-1.5 transition text-[10px]"
                      title={t.mobile.exportScurveCsv5s}
                    >
                      <Download className="w-3 h-3 text-purple-400" />
                      <span>{isExporting ? t.mobile.solveProgress : t.mobile.exportScurveCsv5s}</span>
                    </button>
                  </div>
                  <button
                    onClick={playSCurveManeuver}
                    className="w-full py-1.5 px-3 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 active:bg-emerald-600 border border-emerald-500/40 text-emerald-200 font-medium flex items-center justify-center space-x-2 transition text-[11px]"
                    title={t.mobile.playScurve3D}
                  >
                    <Play className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{t.mobile.playScurve3D}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* SHARED TOOLS IN RESEARCH MODE (Poses & Environment) */}
          {/* Mission Pose Waypoints */}
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <MapPin className="w-4 h-4 text-emerald-400" />
                <span className="font-semibold text-slate-200">{t.mobile.multiPoseMission}</span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold">
                {poseWaypoints.length} Poses
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => openAddPoseModal()}
                className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-[11px] flex items-center justify-center space-x-1.5 transition shadow"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t.mobile.addPose}</span>
              </button>

              <button
                onClick={() => addPoseFromCurrent()}
                className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-850 text-slate-300 hover:text-white border border-slate-800 text-[11px] flex items-center justify-center space-x-1 transition"
              >
                <span>{t.mobile.getCurrentPose}</span>
              </button>
            </div>

            {poseWaypoints.length > 0 && (
              <div className="flex items-center space-x-2 pt-1 border-t border-slate-850">
                <button
                  onClick={() => executeMultiPoseMission()}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold font-mono transition flex items-center justify-center space-x-1.5 shadow ${
                    isMissionRunning
                      ? 'bg-amber-600 hover:bg-amber-500 text-white animate-pulse'
                      : 'bg-sky-600 hover:bg-sky-500 text-white'
                  }`}
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>
                    {isMissionRunning
                      ? `${t.mobile.runningPose} ${currentMissionIndex + 1}/${poseWaypoints.length}`
                      : t.mobile.runEntireMission}
                  </span>
                </button>

                <button
                  onClick={() => clearPoseWaypoints()}
                  className="p-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-rose-500/20 transition"
                  title={t.mobile.clearAllPoses}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Poses Sequence List */}
            {poseWaypoints.length > 0 && (
              <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar pt-1">
                {poseWaypoints.map((wp, idx) => {
                  const isTarget = isMissionRunning && currentMissionIndex === idx;
                  return (
                    <div
                      key={wp.id}
                      className={`p-1.5 rounded-lg border text-[11px] font-mono transition flex items-center justify-between ${
                        isTarget
                          ? 'bg-sky-950/60 border-sky-500/50 text-sky-200'
                          : 'bg-slate-900/70 border-slate-800/80 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center space-x-1.5 truncate">
                        <span className="w-4 h-4 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center text-[9px] font-bold shrink-0">
                          {idx + 1}
                        </span>
                        <span className="font-semibold text-slate-200 truncate">{wp.name}</span>
                        <span className="text-[10px] text-sky-400">({wp.x}, {wp.y})</span>
                      </div>
                      <div className="flex items-center space-x-1 shrink-0">
                        <button
                          onClick={() => executeMissionPose(wp.id)}
                          className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[9px] font-medium"
                        >
                          {t.mobile.goToPose}
                        </button>
                        <button
                          onClick={() => removePoseWaypoint(wp.id)}
                          className="p-1 rounded text-slate-500 hover:text-rose-400 transition"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Obstacle Manager */}
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Box className="w-4 h-4 text-yellow-400" />
                <span className="font-semibold text-slate-200">{t.mobile.envManager}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleAddCylinderObstacle}
                className="p-2 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 font-medium flex items-center justify-center space-x-1.5 transition"
              >
                <Plus className="w-3.5 h-3.5 text-yellow-400" />
                <span>{t.mobile.addCylinder}</span>
              </button>
              <button
                onClick={handleAddBoxObstacle}
                className="p-2 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 font-medium flex items-center justify-center space-x-1.5 transition"
              >
                <Plus className="w-3.5 h-3.5 text-amber-500" />
                <span>{t.mobile.addPallet}</span>
              </button>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-850">
              <div className="flex items-center space-x-1.5">
                <button
                  onClick={resetPose}
                  className="px-2 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-900 border border-slate-800 flex items-center space-x-1 transition text-[11px]"
                >
                  <RotateCcw className="w-3 h-3 text-emerald-400" />
                  <span>Reset Xe</span>
                </button>
                <button
                  onClick={clearTrace}
                  className="px-2 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-slate-800 transition text-[11px]"
                >
                  {t.mobile.clearTrace}
                </button>
              </div>
              <div className="flex items-center space-x-1.5">
                <button
                  onClick={resetObstacles}
                  className="px-2 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-slate-800 transition text-[11px]"
                >
                  {t.common.default}
                </button>
                <button
                  onClick={clearObstacles}
                  className="px-2 py-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-rose-500/30 flex items-center space-x-1 transition text-[11px]"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>{t.common.clear}</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
