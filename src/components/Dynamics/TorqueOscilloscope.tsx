import React, { useState, useRef, useEffect } from 'react';
import { useRobotStore } from '../../store/robotStore';
import { useTranslation } from '../../i18n';
import {
  Zap,
  FileSpreadsheet,
  Play,
  Pause,
  RotateCcw,
} from 'lucide-react';

export const TorqueOscilloscope: React.FC = () => {
  const { t, language } = useTranslation();
  const {
    robotModel,
    trajectoryTorques,
    activeTrajectory,
    dynamicSamples,
    activeDynamicState,
    inertialParameters,
    dynamicsSettings,
    startDynamicsSimulation,
    stopDynamicsSimulation,
    resetDynamicsSimulation,
    playbackState,
    seekTrajectoryTime,
  } = useRobotStore();

  const [displayMode, setDisplayMode] = useState<'trajectory' | 'live'>('trajectory');
  const [selectedJoint, setSelectedJoint] = useState<number | 'all'>('all');

  const svgRef = useRef<SVGSVGElement | null>(null);

  // Auto-calculate trajectory torques if empty
  useEffect(() => {
    if (!trajectoryTorques || trajectoryTorques.length < 2) {
      const store = useRobotStore.getState();
      if (!store.activeTrajectory || store.activeTrajectory.samples.length < 2) {
        store.loadPresetTrajectory('pick-and-place');
      } else {
        store.calculateTrajectoryTorques();
      }
    }
  }, [trajectoryTorques]);

  if (!robotModel) return null;

  const dof = robotModel.dof;
  const inertias =
    inertialParameters.length > 0 ? inertialParameters : [];

  const jointColors = [
    '#38bdf8', // J1: Sky
    '#f59e0b', // J2: Amber
    '#10b981', // J3: Emerald
    '#a855f7', // J4: Purple
    '#ec4899', // J5: Pink
    '#f97316', // J6: Orange
    '#06b6d4', // J7: Cyan
  ];

  // SVG dimensions
  const width = 840;
  const height = 180;
  const padL = 55;
  const padR = 30;
  const padT = 20;
  const padB = 25;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  // 1. Data selection: either from planned trajectory or live physics simulation
  const hasTrajectory = trajectoryTorques && trajectoryTorques.length > 1;
  const hasLiveSamples = dynamicSamples && dynamicSamples.length > 1;

  // Determine bounds
  let minVal = 0;
  let maxVal = 0;
  let timeMax = 1.0;

  if (displayMode === 'trajectory' && hasTrajectory) {
    timeMax = trajectoryTorques[trajectoryTorques.length - 1].time || 1.0;
    trajectoryTorques.forEach((item) => {
      item.tau.forEach((val, j) => {
        if (selectedJoint === 'all' || selectedJoint === j) {
          if (val < minVal) minVal = val;
          if (val > maxVal) maxVal = val;
        }
      });
    });
  } else if (displayMode === 'live' && hasLiveSamples) {
    timeMax = dynamicSamples[dynamicSamples.length - 1].time;
    dynamicSamples.forEach((item) => {
      item.tau.forEach((val, j) => {
        if (selectedJoint === 'all' || selectedJoint === j) {
          if (val < minVal) minVal = val;
          if (val > maxVal) maxVal = val;
        }
      });
    });
  }

  // Ensure headroom
  const range = Math.max(5, maxVal - minVal);
  const yMin = minVal - range * 0.15;
  const yMax = maxVal + range * 0.15;

  const getX = (t: number) => {
    if (displayMode === 'trajectory') {
      return padL + (Math.max(0, Math.min(timeMax, t)) / (timeMax || 1)) * plotW;
    } else {
      const startTime = dynamicSamples[0]?.time || 0;
      const span = Math.max(1, timeMax - startTime);
      return padL + ((t - startTime) / span) * plotW;
    }
  };

  const getY = (val: number) =>
    padT + (1 - (val - yMin) / (yMax - yMin || 1)) * plotH;

  const zeroY = getY(0);

  // Export CSV of Torques
  const handleExportCSV = () => {
    if (!trajectoryTorques) return;
    const headers = ['time_s'];
    for (let i = 0; i < dof; i++) headers.push(`tau_j${i + 1}_Nm`);
    for (let i = 0; i < dof; i++) headers.push(`tau_gravity_j${i + 1}_Nm`);
    for (let i = 0; i < dof; i++) headers.push(`tau_inertia_j${i + 1}_Nm`);

    const rows = [headers.join(',')];
    trajectoryTorques.forEach((item) => {
      const r = [
        item.time.toFixed(4),
        ...item.tau.map((v) => v.toFixed(3)),
        ...item.tauGravity.map((v) => v.toFixed(3)),
        ...item.tauInertia.map((v) => v.toFixed(3)),
      ];
      rows.push(r.join(','));
    });

    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${robotModel.id}_joint_torques_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3 font-sans text-slate-200">
      {/* Oscilloscope Header & Control Ribbon */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
        <div className="flex items-center space-x-2">
          <Zap className="w-4 h-4 text-amber-400" />
          <h4 className="text-xs font-mono font-bold text-slate-100 uppercase tracking-wider">
            {language === 'vi' ? 'Torque Dynamics Oscilloscope (Mô-men Khớp τ)' : 'Dynamic Joint Torque Oscilloscope τ(t)'}
          </h4>
        </div>

        {/* Display Mode: Trajectory vs Live Simulation */}
        <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-mono">
          <button
            onClick={() => setDisplayMode('trajectory')}
            className={`px-2.5 py-1 rounded transition ${
              displayMode === 'trajectory'
                ? 'bg-amber-600 text-white font-bold shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {language === 'vi' ? 'Quỹ đạo τ(t)' : 'Torque Trajectory τ(t)'}
          </button>
          <button
            onClick={() => setDisplayMode('live')}
            className={`px-2.5 py-1 rounded transition flex items-center space-x-1 ${
              displayMode === 'live'
                ? 'bg-emerald-600 text-white font-bold shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${dynamicsSettings.isRunning ? 'bg-emerald-300 animate-ping' : 'bg-slate-500'}`} />
            <span>Live Physics RK4</span>
          </button>
        </div>

        {/* Joint Filter */}
        <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-mono">
          <button
            onClick={() => setSelectedJoint('all')}
            className={`px-2 py-0.5 rounded transition ${
              selectedJoint === 'all'
                ? 'bg-slate-700 text-white font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All
          </button>
          {Array.from({ length: dof }).map((_, j) => (
            <button
              key={j}
              onClick={() => setSelectedJoint(j)}
              style={{
                borderColor: selectedJoint === j ? jointColors[j % jointColors.length] : 'transparent',
              }}
              className={`px-2 py-0.5 rounded border transition ${
                selectedJoint === j ? 'bg-slate-800 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span style={{ color: jointColors[j % jointColors.length] }}>J{j + 1}</span>
            </button>
          ))}
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2">
          {displayMode === 'live' && (
            <div className="flex items-center space-x-1">
              <button
                onClick={() =>
                  dynamicsSettings.isRunning
                    ? stopDynamicsSimulation()
                    : startDynamicsSimulation()
                }
                className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition shadow ${
                  dynamicsSettings.isRunning
                    ? 'bg-rose-600 hover:bg-rose-500 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                }`}
              >
                {dynamicsSettings.isRunning ? (
                  <>
                    <Pause className="w-3.5 h-3.5 fill-current" />
                    <span>{t.common.pause}</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>{t.common.run}</span>
                  </>
                )}
              </button>
              <button
                onClick={resetDynamicsSimulation}
                className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white border border-slate-700"
                title={t.common.reset}
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <button
            onClick={handleExportCSV}
            disabled={!hasTrajectory}
            className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 text-xs font-mono transition disabled:opacity-40"
            title={t.common.export}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* Main Torque Oscilloscope SVG Canvas */}
      <div className="relative bg-slate-950/80 border border-slate-800 rounded-xl p-3 shadow-inner">
        <div className="flex items-center justify-between mb-1 px-2">
          <span className="text-[11px] font-mono font-bold text-amber-300">
            {language === 'vi' ? 'Mô-men Khớp Động cơ τ_i(t) [N·m]' : 'Actuated Joint Dynamic Torques τ_i(t) [N·m]'}
          </span>
          {activeDynamicState && displayMode === 'live' && (
            <span className="text-[10px] font-mono text-cyan-400">
              {language === 'vi' ? 'Công suất cơ học / Năng lượng:' : 'Mechanical Work / Energy:'} T = {activeDynamicState.kineticEnergy.toFixed(2)} J | V = {activeDynamicState.potentialEnergy.toFixed(2)} J
            </span>
          )}
        </div>

        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto select-none block cursor-crosshair"
          onClick={(e) => {
            if (displayMode === 'trajectory' && activeTrajectory) {
              const rect = e.currentTarget.getBoundingClientRect();
              const clickX = e.clientX - rect.left;
              const normX = (clickX / rect.width) * width;
              const clamped = Math.max(padL, Math.min(padL + plotW, normX));
              const t = ((clamped - padL) / plotW) * (activeTrajectory.totalDuration || 1);
              seekTrajectoryTime(t);
            }
          }}
        >
          {/* Background Grid */}
          <rect x={padL} y={padT} width={plotW} height={plotH} fill="#070a13" rx={4} />

          {/* Zero Torque Baseline */}
          {zeroY >= padT && zeroY <= padT + plotH && (
            <line x1={padL} y1={zeroY} x2={padL + plotW} y2={zeroY} stroke="#334155" strokeWidth="1.2" />
          )}

          {/* Rated Motor Limits Boundary Lines */}
          {selectedJoint !== 'all' && inertias[selectedJoint] && (
            <>
              {(() => {
                const maxT = inertias[selectedJoint].maxTorque;
                const yPos = getY(maxT);
                const yNeg = getY(-maxT);
                return (
                  <>
                    {yPos >= padT && yPos <= padT + plotH && (
                      <line x1={padL} y1={yPos} x2={padL + plotW} y2={yPos} stroke="#ef4444" strokeWidth="1" strokeDasharray="4 4" opacity="0.7" />
                    )}
                    {yNeg >= padT && yNeg <= padT + plotH && (
                      <line x1={padL} y1={yNeg} x2={padL + plotW} y2={yNeg} stroke="#ef4444" strokeWidth="1" strokeDasharray="4 4" opacity="0.7" />
                    )}
                  </>
                );
              })()}
            </>
          )}

          {/* Horizontal Grid Ticks */}
          {[-1, -0.5, 0, 0.5, 1].map((frac, idx) => {
            const val = yMin + ((frac + 1) / 2) * (yMax - yMin);
            const y = getY(val);
            if (y < padT || y > padT + plotH) return null;
            return (
              <g key={idx}>
                <line x1={padL} y1={y} x2={padL + plotW} y2={y} stroke="#1e293b" strokeDasharray="2 3" />
                <text x={padL - 6} y={y + 3} textAnchor="end" fill="#64748b" fontSize="9" fontFamily="monospace">
                  {val.toFixed(1)}
                </text>
              </g>
            );
          })}

          {/* Torques Waveforms */}
          {displayMode === 'trajectory' && hasTrajectory && (
            <>
              {Array.from({ length: dof }).map((_, j) => {
                if (selectedJoint !== 'all' && selectedJoint !== j) return null;

                const pathPoints = trajectoryTorques
                  .map((item) => `${getX(item.time).toFixed(1)},${getY(item.tau[j] || 0).toFixed(1)}`)
                  .join(' L ');

                return (
                  <path
                    key={j}
                    d={`M ${pathPoints}`}
                    fill="none"
                    stroke={jointColors[j % jointColors.length]}
                    strokeWidth={selectedJoint === j ? '2.5' : '1.8'}
                    opacity={selectedJoint === 'all' || selectedJoint === j ? '0.9' : '0.2'}
                  />
                );
              })}

              {/* Scrub line */}
              {(() => {
                const curX = getX(playbackState.currentTime);
                return (
                  <line x1={curX} y1={padT} x2={curX} y2={padT + plotH} stroke="#ef4444" strokeWidth="1.8" />
                );
              })()}
            </>
          )}

          {displayMode === 'live' && hasLiveSamples && (
            <>
              {Array.from({ length: dof }).map((_, j) => {
                if (selectedJoint !== 'all' && selectedJoint !== j) return null;

                const pathPoints = dynamicSamples
                  .map((item) => `${getX(item.time).toFixed(1)},${getY(item.tau[j] || 0).toFixed(1)}`)
                  .join(' L ');

                return (
                  <path
                    key={j}
                    d={`M ${pathPoints}`}
                    fill="none"
                    stroke={jointColors[j % jointColors.length]}
                    strokeWidth={selectedJoint === j ? '2.5' : '1.8'}
                  />
                );
              })}
            </>
          )}

          {/* Empty State Overlay when no trajectory data */}
          {displayMode === 'trajectory' && !hasTrajectory && (
            <text x={padL + plotW / 2} y={padT + plotH / 2} textAnchor="middle" fill="#94a3b8" fontSize="12" fontFamily="monospace">
              {language === 'vi' ? 'Đang tính toán mô-men RNE cho quỹ đạo hiện tại...' : 'Computing Recursive Newton-Euler dynamic torques for current trajectory...'}
            </text>
          )}

          {/* Empty State Overlay when live simulation paused */}
          {displayMode === 'live' && !hasLiveSamples && (
            <text x={padL + plotW / 2} y={padT + plotH / 2} textAnchor="middle" fill="#94a3b8" fontSize="12" fontFamily="monospace">
              {language === 'vi' ? 'Nhấn nút [Mô phỏng] ở góc trên để bắt đầu vẽ dao động ký thời gian thực' : 'Click [Simulate] above to stream real-time multi-physics waveforms'}
            </text>
          )}
        </svg>
      </div>

      {/* Live Torque Gauges with Motor Thermal / Limit Bars */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {Array.from({ length: dof }).map((_, j) => {
          let currentTau = 0;
          if (displayMode === 'trajectory' && hasTrajectory) {
            const curTime = playbackState.currentTime;
            const idx = Math.min(
              trajectoryTorques.length - 1,
              Math.max(0, Math.floor((curTime / (activeTrajectory?.totalDuration || 1)) * trajectoryTorques.length))
            );
            currentTau = trajectoryTorques[idx]?.tau[j] || 0;
          } else if (activeDynamicState) {
            currentTau = activeDynamicState.tau[j] || 0;
          }

          const maxT = inertias[j]?.maxTorque || 100;
          const pct = Math.min(100, (Math.abs(currentTau) / maxT) * 100);

          return (
            <div key={j} className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-2.5 space-y-1.5 font-mono">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold" style={{ color: jointColors[j % jointColors.length] }}>
                  J{j + 1} Torque
                </span>
                <span className="text-[10px] text-slate-500">Max: {maxT.toFixed(0)} N·m</span>
              </div>

              <div className="flex items-baseline justify-between">
                <span className="text-sm font-bold text-slate-100">
                  {currentTau.toFixed(1)} <span className="text-[10px] text-slate-400 font-normal">N·m</span>
                </span>
                <span className={`text-[10px] font-bold ${pct > 90 ? 'text-rose-400' : pct > 65 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {pct.toFixed(0)}%
                </span>
              </div>

              {/* Progress limit bar */}
              <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                <div
                  style={{ width: `${pct}%` }}
                  className={`h-full transition-all duration-75 ${
                    pct > 90 ? 'bg-rose-500' : pct > 65 ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
