import React, { useEffect, useState } from 'react';
import { useMobileRobotStore } from '../../store/mobileRobotStore';
import { useRobotStore } from '../../store/robotStore';
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
  Clock,
  Compass,
  Activity,
  Layers,
  Download,
  Move,
} from 'lucide-react';

export const MobileRobotSidebar: React.FC = () => {
  const { openAddPoseModal } = useRobotStore();
  const {
    specs,
    velocity,
    navGoal,
    plannedPath,
    isNavigating,
    navCrossTrackError,
    physicsFidelity,
    agvState,
    setPhysicsFidelity,
    exportBenchmarkCSV,
    exportSCurveCSV,
    playSCurveManeuver,
    setTargetVelocity,
    setNavGoal,
    planPathToGoal,
    startAutonomousNavigation,
    stopAutonomousNavigation,
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
      name: `Vật cản trụ tròn`,
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
      name: `Kiện hàng Pallet`,
      type: 'box',
      position: { x, y, z: 0.5 },
      dimensions: { width: 1.0, depth: 0.8, height: 1.0 },
      color: '#d97706',
    });
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs font-sans">
      {/* 0. Multi-Physics Digital Twin Fidelity & Benchmark Panel */}
      <div className="p-3.5 rounded-xl bg-gradient-to-b from-indigo-950/40 to-slate-950/80 border border-indigo-500/30 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Cpu className="w-4 h-4 text-indigo-400" />
            <span className="font-semibold text-slate-100">Bản sao Số (Digital Twin)</span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
            Hệ Đa Vật Lý
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
            <span>Đa vật lý (Full)</span>
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
            <span>Động học (Lý tưởng)</span>
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
              <span className="text-slate-500 block text-[9px]">Mô men Te</span>
              <span className="text-emerald-400 font-bold">{((agvState.Te_L + agvState.Te_R) / 2).toFixed(1)}Nm</span>
            </div>
            <div className="p-1.5 rounded bg-slate-900/90 border border-slate-800">
              <span className="text-slate-500 block text-[9px]">Độ trượt κ</span>
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
              title="Chạy mô phỏng 1.0s (1.000.000 bước explicit dt=1µs) và xuất CSV đối chuẩn với C++, Python, MATLAB"
            >
              <Download className="w-3 h-3 text-indigo-400" />
              <span>{isExporting ? 'Đang giải...' : 'CSV Thẳng (1.0s)'}</span>
            </button>
            <button
              onClick={handleExportSCurve}
              disabled={isExporting}
              className="py-1.5 px-2 rounded-lg bg-purple-600/30 hover:bg-purple-600/50 active:bg-purple-600 border border-purple-500/40 text-purple-200 font-medium flex items-center justify-center space-x-1.5 transition text-[10px]"
              title="Chạy mô phỏng 5.5s quỹ đạo cua chữ S (5.500.000 bước explicit dt=1µs) đối chuẩn Quad-Platform"
            >
              <Download className="w-3 h-3 text-purple-400" />
              <span>{isExporting ? 'Đang giải...' : 'CSV Chữ S (5.5s)'}</span>
            </button>
          </div>
          <button
            onClick={playSCurveManeuver}
            className="w-full py-1.5 px-3 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 active:bg-emerald-600 border border-emerald-500/40 text-emerald-200 font-medium flex items-center justify-center space-x-2 transition text-[11px]"
            title="Phát chuyển động động lực học cua chữ S (5.5s, 5 pha: Tăng tốc -> Rẽ trái gắt -> Rẽ phải -> Phanh tái sinh -> Dừng đỗ) trực tiếp trên 3D Viewport"
          >
            <Play className="w-3.5 h-3.5 text-emerald-400" />
            <span>Phát Mô Phỏng Quỹ Đạo Chữ S (3D S-Curve)</span>
          </button>
        </div>
      </div>

      {/* 1. Virtual Joystick & Teleoperation */}
      <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Move className="w-4 h-4 text-emerald-400" />
            <span className="font-semibold text-slate-200">Điều khiển Trực tiếp (Teleop)</span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            Phím W,A,S,D
          </span>
        </div>

        {/* D-Pad Button Cluster */}
        <div className="flex flex-col items-center justify-center py-2 select-none">
          {/* Forward */}
          <button
            onMouseDown={() => setTargetVelocity(specs.maxLinearSpeedMps * 0.7, 0)}
            onMouseUp={() => setTargetVelocity(0, 0)}
            onTouchStart={() => setTargetVelocity(specs.maxLinearSpeedMps * 0.7, 0)}
            onTouchEnd={() => setTargetVelocity(0, 0)}
            className={`w-12 h-10 rounded-t-xl bg-slate-800 hover:bg-slate-700 active:bg-emerald-600 border border-slate-700 flex items-center justify-center font-bold font-mono transition ${
              activeKey === 'w' ? 'bg-emerald-600 text-white' : 'text-slate-300'
            }`}
          >
            ▲ W
          </button>

          {/* Left, Stop, Right */}
          <div className="flex items-center space-x-1 my-1">
            <button
              onMouseDown={() => setTargetVelocity(0, specs.maxAngularSpeedRadps * 0.7)}
              onMouseUp={() => setTargetVelocity(0, 0)}
              onTouchStart={() => setTargetVelocity(0, specs.maxAngularSpeedRadps * 0.7)}
              onTouchEnd={() => setTargetVelocity(0, 0)}
              className={`w-12 h-10 rounded-l-xl bg-slate-800 hover:bg-slate-700 active:bg-emerald-600 border border-slate-700 flex items-center justify-center font-bold font-mono transition ${
                activeKey === 'a' ? 'bg-emerald-600 text-white' : 'text-slate-300'
              }`}
            >
              ◀ A
            </button>
            <button
              onClick={() => setTargetVelocity(0, 0, 0)}
              className="w-12 h-10 bg-rose-600/30 hover:bg-rose-600 active:bg-rose-700 border border-rose-500/50 flex items-center justify-center font-bold text-rose-300 hover:text-white transition"
              title="Dừng khẩn cấp (Space)"
            >
              STOP
            </button>
            <button
              onMouseDown={() => setTargetVelocity(0, -specs.maxAngularSpeedRadps * 0.7)}
              onMouseUp={() => setTargetVelocity(0, 0)}
              onTouchStart={() => setTargetVelocity(0, -specs.maxAngularSpeedRadps * 0.7)}
              onTouchEnd={() => setTargetVelocity(0, 0)}
              className={`w-12 h-10 rounded-r-xl bg-slate-800 hover:bg-slate-700 active:bg-emerald-600 border border-slate-700 flex items-center justify-center font-bold font-mono transition ${
                activeKey === 'd' ? 'bg-emerald-600 text-white' : 'text-slate-300'
              }`}
            >
              D ▶
            </button>
          </div>

          {/* Backward */}
          <button
            onMouseDown={() => setTargetVelocity(-specs.maxLinearSpeedMps * 0.6, 0)}
            onMouseUp={() => setTargetVelocity(0, 0)}
            onTouchStart={() => setTargetVelocity(-specs.maxLinearSpeedMps * 0.6, 0)}
            onTouchEnd={() => setTargetVelocity(0, 0)}
            className={`w-12 h-10 rounded-b-xl bg-slate-800 hover:bg-slate-700 active:bg-emerald-600 border border-slate-700 flex items-center justify-center font-bold font-mono transition ${
              activeKey === 's' ? 'bg-emerald-600 text-white' : 'text-slate-300'
            }`}
          >
            ▼ S
          </button>
        </div>

        {/* Speed Sliders */}
        <div className="space-y-2 pt-2 border-t border-slate-850">
          <div className="flex justify-between font-mono text-[11px]">
            <span className="text-slate-400">Vận tốc tiến v:</span>
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

          <div className="flex justify-between font-mono text-[11px] pt-1">
            <span className="text-slate-400">Vận tốc góc ω:</span>
            <span className="text-sky-400 font-bold">{velocity.omega.toFixed(2)} rad/s</span>
          </div>
          <input
            type="range"
            min={-specs.maxAngularSpeedRadps}
            max={specs.maxAngularSpeedRadps}
            step={0.05}
            value={velocity.omega}
            onChange={(e) => setTargetVelocity(velocity.v, parseFloat(e.target.value), velocity.vY)}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
          />
        </div>
      </div>

      {/* 2. Autonomous Navigation (A* & Pure Pursuit) */}
      <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Navigation className="w-4 h-4 text-amber-400" />
            <span className="font-semibold text-slate-200">Điều hướng Tự hành (A* & Pure Pursuit)</span>
          </div>
          {isNavigating && (
            <span className="flex items-center space-x-1 text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 animate-pulse">
              <span>Đang bám đường</span>
            </span>
          )}
        </div>

        {/* Goal Coordinates */}
        <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
          <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
            <span className="text-slate-500 block text-[10px]">Tọa độ Goal X (m)</span>
            <input
              type="number"
              step={0.5}
              value={navGoal?.x ?? 0}
              onChange={(e) => setNavGoal({ x: parseFloat(e.target.value) || 0, y: navGoal?.y ?? 0 })}
              className="w-full bg-transparent font-bold text-slate-100 outline-none"
            />
          </div>
          <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
            <span className="text-slate-500 block text-[10px]">Tọa độ Goal Y (m)</span>
            <input
              type="number"
              step={0.5}
              value={navGoal?.y ?? 0}
              onChange={(e) => setNavGoal({ x: navGoal?.x ?? 0, y: parseFloat(e.target.value) || 0 })}
              className="w-full bg-transparent font-bold text-slate-100 outline-none"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            onClick={() => planPathToGoal()}
            className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition border border-slate-700 flex items-center justify-center space-x-1.5"
          >
            <span>Tìm đường A*</span>
          </button>

          {!isNavigating ? (
            <button
              onClick={() => startAutonomousNavigation()}
              className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition shadow-md shadow-emerald-600/30 flex items-center justify-center space-x-1.5"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Thực thi</span>
            </button>
          ) : (
            <button
              onClick={() => stopAutonomousNavigation()}
              className="px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold transition shadow-md shadow-rose-600/30 flex items-center justify-center space-x-1.5"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Dừng lại</span>
            </button>
          )}
        </div>

        {plannedPath.length > 0 && (
          <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800/80 font-mono text-[11px] text-slate-400 flex justify-between items-center">
            <span>Tổng Waypoints: <strong className="text-amber-400">{plannedPath.length} điểm</strong></span>
            <span>Lệch làn: <strong className="text-sky-400">{(navCrossTrackError * 100).toFixed(1)} cm</strong></span>
          </div>
        )}
      </div>

      {/* 2.5. Mission Pose Waypoints (Vị trí, Hướng θ, Thời gian dự kiến T) */}
      <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <MapPin className="w-4 h-4 text-emerald-400" />
            <span className="font-semibold text-slate-200">Hành Trình Pose (Multi-Pose Mission)</span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold">
            {poseWaypoints.length} Poses
          </span>
        </div>

        {/* Action Toolbar */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => openAddPoseModal()}
            className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-[11px] flex items-center justify-center space-x-1.5 transition shadow"
            title="Thêm Pose mới với Vị trí X/Y, Hướng theta và Thời gian dự kiến T"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Add Pose</span>
          </button>

          <button
            onClick={() => addPoseFromCurrent()}
            className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-850 text-slate-300 hover:text-white border border-slate-800 text-[11px] flex items-center justify-center space-x-1 transition"
            title="Lấy ngay vị trí và hướng hiện tại của xe thêm vào danh sách"
          >
            <span>Lấy Pose hiện tại</span>
          </button>
        </div>

        {/* Multi-Pose Mission Runner */}
        {poseWaypoints.length > 0 && (
          <div className="flex items-center space-x-2 pt-1 border-t border-slate-850">
            <button
              onClick={() => executeMultiPoseMission()}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold font-mono transition flex items-center justify-center space-x-1.5 shadow ${
                isMissionRunning
                  ? 'bg-amber-600 hover:bg-amber-500 text-white animate-pulse'
                  : 'bg-sky-600 hover:bg-sky-500 text-white'
              }`}
              title="Tự động lập kế hoạch và chạy tuần tự qua tất cả các điểm Pose theo thời gian dự kiến"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>
                {isMissionRunning
                  ? `Đang chạy Pose ${currentMissionIndex + 1}/${poseWaypoints.length}`
                  : 'Chạy toàn bộ lộ trình'}
              </span>
            </button>

            <button
              onClick={() => clearPoseWaypoints()}
              className="p-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-rose-500/20 transition"
              title="Xóa toàn bộ danh sách Pose"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Poses Sequence List */}
        <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
          {poseWaypoints.map((wp, idx) => {
            const isTarget = isMissionRunning && currentMissionIndex === idx;
            return (
              <div
                key={wp.id}
                className={`p-2 rounded-lg border text-xs font-mono transition flex items-center justify-between ${
                  isTarget
                    ? 'bg-sky-950/60 border-sky-500/50 text-sky-200'
                    : 'bg-slate-900/70 border-slate-800/80 text-slate-300'
                }`}
              >
                <div className="flex-1 min-w-0 pr-2">
                  <div className="flex items-center space-x-1.5">
                    <span className="w-4 h-4 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center text-[10px] font-bold shrink-0">
                      {idx + 1}
                    </span>
                    <span className="font-semibold text-slate-100 truncate text-[11px]">{wp.name}</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[10px] text-slate-400">
                    <span className="text-sky-300">({wp.x}m, {wp.y}m)</span>
                    <span>•</span>
                    <span className="text-amber-300 flex items-center space-x-0.5">
                      <Compass className="w-2.5 h-2.5 inline" />
                      <span>{wp.thetaDeg}°</span>
                    </span>
                    <span>•</span>
                    <span className="text-purple-300 flex items-center space-x-0.5">
                      <Clock className="w-2.5 h-2.5 inline" />
                      <span>{wp.segmentDuration}s</span>
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-1 shrink-0">
                  <button
                    onClick={() => executeMissionPose(wp.id)}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-[10px] transition font-sans font-medium"
                    title="Đi tới Pose này"
                  >
                    Đi tới
                  </button>
                  <button
                    onClick={() => removePoseWaypoint(wp.id)}
                    className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                    title="Xóa Pose này"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Obstacle & Environment Manager */}
      <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Box className="w-4 h-4 text-yellow-400" />
            <span className="font-semibold text-slate-200">Quản lý Vật cản Nhà xưởng</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleAddCylinderObstacle}
            className="p-2 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 font-medium flex items-center justify-center space-x-1.5 transition"
          >
            <Plus className="w-3.5 h-3.5 text-yellow-400" />
            <span>+ Cột trụ tròn</span>
          </button>
          <button
            onClick={handleAddBoxObstacle}
            className="p-2 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 font-medium flex items-center justify-center space-x-1.5 transition"
          >
            <Plus className="w-3.5 h-3.5 text-amber-500" />
            <span>+ Kiện Pallet</span>
          </button>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-850">
          <div className="flex items-center space-x-1.5">
            <button
              onClick={resetPose}
              className="px-2 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-900 border border-slate-800 flex items-center space-x-1 transition text-[11px]"
              title="Đặt lại vị trí xuất phát"
            >
              <RotateCcw className="w-3 h-3 text-emerald-400" />
              <span>Reset Xe</span>
            </button>
            <button
              onClick={clearTrace}
              className="px-2 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-slate-800 transition text-[11px]"
              title="Xóa vệt vết bánh xe"
            >
              Xóa vết
            </button>
          </div>
          <div className="flex items-center space-x-1.5">
            <button
              onClick={resetObstacles}
              className="px-2 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-slate-800 transition text-[11px]"
              title="Khôi phục vật cản mặc định"
            >
              Mặc định
            </button>
            <button
              onClick={clearObstacles}
              className="px-2 py-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-rose-500/30 flex items-center space-x-1 transition text-[11px]"
              title="Xóa tất cả vật cản trừ tường biên"
            >
              <Trash2 className="w-3 h-3" />
              <span>Xóa</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
