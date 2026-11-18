import React, { useState, useRef, useEffect } from 'react';
import { useRobotStore } from '../../store/robotStore';
import { useTranslation } from '../../i18n';
import {
  exportDynamicsToCSV,
  exportSubplotsToPNG,
  exportSubplotsToPDF,
} from '../../utils/trajectoryExport';
import {
  Zap,
  FileSpreadsheet,
  FileImage,
  FileText,
  Play,
  Pause,
  RotateCcw,
  Sliders,
  Palette,
  Eye,
  EyeOff,
  Sparkles,
  Layers,
  ChevronDown,
} from 'lucide-react';

export type LineStyleType = 'solid' | 'dashed' | 'dotted' | 'dash-dot';

export interface JointCurveStyle {
  color: string;
  lineWidth: number;
  lineStyle: LineStyleType;
  visible: boolean;
}

const LINE_STYLE_DASHES: Record<LineStyleType, string | undefined> = {
  'solid': undefined,
  'dashed': '6 4',
  'dotted': '2 3',
  'dash-dot': '6 3 2 3',
};

// IEEE Transactions / Nature academic standard high-contrast palette
const ACADEMIC_JOINT_COLORS = [
  '#1f77b4', // J1: Deep Academic Blue
  '#d97706', // J2: Warm Amber / Ochre
  '#059669', // J3: Emerald Green
  '#7c3aed', // J4: Royal Purple
  '#db2777', // J5: Crimson / Rose
  '#ea580c', // J6: Rust Orange
  '#0891b2', // J7: Dark Cyan
];

// Dark mode cyber/neon palette
const CYBER_JOINT_COLORS = [
  '#38bdf8', // J1: Sky
  '#f59e0b', // J2: Amber
  '#10b981', // J3: Emerald
  '#a855f7', // J4: Purple
  '#ec4899', // J5: Pink
  '#f97316', // J6: Orange
  '#06b6d4', // J7: Cyan
];

const MONOCHROME_COLORS = [
  '#0f172a',
  '#334155',
  '#475569',
  '#64748b',
  '#94a3b8',
  '#1e293b',
  '#000000',
];

const PRESET_COLOR_SWATCHES = [
  '#1f77b4',
  '#d97706',
  '#059669',
  '#7c3aed',
  '#db2777',
  '#ea580c',
  '#0891b2',
  '#38bdf8',
  '#ef4444',
  '#10b981',
  '#f59e0b',
  '#0f172a',
  '#64748b',
  '#ffffff',
];

export const TorqueOscilloscope: React.FC = () => {
  const { t, language } = useTranslation();
  const isVi = language === 'vi';

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
    uiTheme,
  } = useRobotStore();

  const isLight = uiTheme === 'light';

  const [displayMode, setDisplayMode] = useState<'trajectory' | 'live'>('trajectory');
  const [selectedJoint, setSelectedJoint] = useState<number | 'all'>('all');
  const [viewLayout, setViewLayout] = useState<'torques' | 'errors' | '2-subplots'>('torques');

  // Curve Styling State
  const [isStyleEditorOpen, setIsStyleEditorOpen] = useState(false);
  const [isPngMenuOpen, setIsPngMenuOpen] = useState(false);
  const [curveStyles, setCurveStyles] = useState<Record<number, JointCurveStyle>>(() => {
    const palette = isLight ? ACADEMIC_JOINT_COLORS : CYBER_JOINT_COLORS;
    const initial: Record<number, JointCurveStyle> = {};
    for (let i = 0; i < 7; i++) {
      initial[i] = {
        color: palette[i % palette.length],
        lineWidth: 2.0,
        lineStyle: 'solid',
        visible: true,
      };
    }
    return initial;
  });

  // Keep colors updated if user switches theme and hasn't manually customized
  useEffect(() => {
    setCurveStyles((prev) => {
      const palette = isLight ? ACADEMIC_JOINT_COLORS : CYBER_JOINT_COLORS;
      const updated = { ...prev };
      for (let i = 0; i < 7; i++) {
        if (updated[i]) {
          // If color was using the other palette's default, switch it
          const otherPalette = isLight ? CYBER_JOINT_COLORS : ACADEMIC_JOINT_COLORS;
          if (updated[i].color === otherPalette[i % otherPalette.length]) {
            updated[i] = { ...updated[i], color: palette[i % palette.length] };
          }
        }
      }
      return updated;
    });
  }, [isLight]);

  // SVG references for high-DPI export
  const svgTorqueRef = useRef<SVGSVGElement | null>(null);
  const svgErrorRef = useRef<SVGSVGElement | null>(null);

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
  const inertias = inertialParameters.length > 0 ? inertialParameters : [];

  // Dimensions
  const width = 840;
  const height = viewLayout === '2-subplots' ? 160 : 190;
  const padL = 58;
  const padR = 30;
  const padT = 22;
  const padB = 26;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const hasTrajectory = trajectoryTorques && trajectoryTorques.length > 1;
  const hasLiveSamples = dynamicSamples && dynamicSamples.length > 1;

  // 1. Determine timeMax
  let timeMax = 1.0;
  if (displayMode === 'trajectory' && hasTrajectory) {
    timeMax = trajectoryTorques[trajectoryTorques.length - 1].time || 1.0;
  } else if (displayMode === 'live' && hasLiveSamples) {
    const startTime = dynamicSamples[0]?.time || 0;
    timeMax = Math.max(1.0, (dynamicSamples[dynamicSamples.length - 1]?.time || 1.0) - startTime);
  } else if (activeTrajectory) {
    timeMax = activeTrajectory.totalDuration || 1.0;
  }

  // Helper: X Coordinate
  const getX = (t: number) => {
    if (displayMode === 'trajectory') {
      return padL + (Math.max(0, Math.min(timeMax, t)) / (timeMax || 1)) * plotW;
    } else {
      const startTime = dynamicSamples[0]?.time || 0;
      const span = Math.max(0.1, (dynamicSamples[dynamicSamples.length - 1]?.time || 1) - startTime);
      return padL + ((t - startTime) / span) * plotW;
    }
  };

  // 2. Torque Y Bounds
  let minTau = 0;
  let maxTau = 0;
  if (displayMode === 'trajectory' && hasTrajectory) {
    trajectoryTorques.forEach((item) => {
      item.tau.forEach((val, j) => {
        const style = curveStyles[j];
        if (style && !style.visible) return;
        if (selectedJoint === 'all' || selectedJoint === j) {
          if (val < minTau) minTau = val;
          if (val > maxTau) maxTau = val;
        }
      });
    });
  } else if (displayMode === 'live' && hasLiveSamples) {
    dynamicSamples.forEach((item) => {
      item.tau.forEach((val, j) => {
        const style = curveStyles[j];
        if (style && !style.visible) return;
        if (selectedJoint === 'all' || selectedJoint === j) {
          if (val < minTau) minTau = val;
          if (val > maxTau) maxTau = val;
        }
      });
    });
  }
  const tauRange = Math.max(5, maxTau - minTau);
  const yTauMin = minTau - tauRange * 0.15;
  const yTauMax = maxTau + tauRange * 0.15;
  const getYTau = (val: number) =>
    padT + (1 - (val - yTauMin) / (yTauMax - yTauMin || 1)) * plotH;
  const zeroYTau = getYTau(0);

  // 3. Tracking Error Y Bounds
  let minErr = -0.5;
  let maxErr = 0.5;
  if (hasLiveSamples) {
    dynamicSamples.forEach((item) => {
      if (item.errorDeg) {
        item.errorDeg.forEach((val, j) => {
          const style = curveStyles[j];
          if (style && !style.visible) return;
          if (selectedJoint === 'all' || selectedJoint === j) {
            if (val < minErr) minErr = val;
            if (val > maxErr) maxErr = val;
          }
        });
      }
    });
  }
  const errRange = Math.max(0.2, maxErr - minErr);
  const yErrMin = minErr - errRange * 0.15;
  const yErrMax = maxErr + errRange * 0.15;
  const getYErr = (val: number) =>
    padT + (1 - (val - yErrMin) / (yErrMax - yErrMin || 1)) * plotH;
  const zeroYErr = getYErr(0);

  // Export CSV
  const handleExportCSV = () => {
    if (displayMode === 'live' && hasLiveSamples) {
      exportDynamicsToCSV(dynamicSamples, robotModel.id, dynamicsSettings.controllerType);
      return;
    }
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

  // Export High-DPI PNG
  const handleExportPNG = (dpi: number) => {
    setIsPngMenuOpen(false);
    const svgs: SVGSVGElement[] = [];
    const titles: string[] = [];

    if (viewLayout === '2-subplots') {
      if (svgTorqueRef.current) {
        svgs.push(svgTorqueRef.current);
        titles.push('Actuated Dynamic Torques τ_i(t) [N·m]');
      }
      if (svgErrorRef.current) {
        svgs.push(svgErrorRef.current);
        titles.push('Closed-Loop Joint Tracking Errors e_i(t) [deg]');
      }
    } else if (viewLayout === 'torques' && svgTorqueRef.current) {
      svgs.push(svgTorqueRef.current);
      titles.push('Actuated Dynamic Torques τ_i(t) [N·m]');
    } else if (viewLayout === 'errors' && svgErrorRef.current) {
      svgs.push(svgErrorRef.current);
      titles.push('Closed-Loop Joint Tracking Errors e_i(t) [deg]');
    }

    exportSubplotsToPNG(svgs, titles, {
      dpi,
      theme: isLight ? 'academic-white' : 'dark',
      robotName: `${robotModel.manufacturer} ${robotModel.modelName}`,
      category: 'dynamics',
      controllerType: dynamicsSettings.controllerType,
      totalDuration: timeMax,
    });
  };

  // Export Vector PDF
  const handleExportPDF = () => {
    const svgs: SVGSVGElement[] = [];
    const titles: string[] = [];

    if (svgTorqueRef.current) {
      svgs.push(svgTorqueRef.current);
      titles.push('Joint Torques τ_i(t) [N·m]');
    }
    if (svgErrorRef.current) {
      svgs.push(svgErrorRef.current);
      titles.push('Tracking Errors e_i(t) [deg]');
    }

    exportSubplotsToPDF(svgs, titles, {
      robotName: `${robotModel.manufacturer} ${robotModel.modelName}`,
      category: 'dynamics',
      theme: isLight ? 'academic-white' : 'dark',
      controllerType: dynamicsSettings.controllerType,
      totalDuration: timeMax,
      samplesCount: displayMode === 'live' ? dynamicSamples?.length : trajectoryTorques?.length,
    });
  };

  // Apply Palette Presets
  const applyPreset = (preset: 'academic' | 'cyber' | 'monochrome') => {
    const palette =
      preset === 'academic'
        ? ACADEMIC_JOINT_COLORS
        : preset === 'cyber'
        ? CYBER_JOINT_COLORS
        : MONOCHROME_COLORS;

    const dashes: LineStyleType[] = ['solid', 'dashed', 'dotted', 'dash-dot', 'solid', 'dashed', 'dotted'];

    setCurveStyles((prev) => {
      const next = { ...prev };
      for (let i = 0; i < 7; i++) {
        next[i] = {
          color: palette[i % palette.length],
          lineWidth: 2.0,
          lineStyle: preset === 'monochrome' ? dashes[i % dashes.length] : 'solid',
          visible: true,
        };
      }
      return next;
    });
  };

  // Render SVG Subplot: Torques
  const renderTorquePlot = () => (
    <div
      className={`relative rounded-xl p-3 shadow-sm border transition-colors ${
        isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-slate-950/80 border-slate-800 text-slate-200'
      }`}
    >
      <div className="flex items-center justify-between mb-1.5 px-2">
        <span
          className={`text-[11px] font-bold ${
            isLight ? 'text-slate-900 font-serif' : 'text-amber-300 font-mono'
          }`}
        >
          {isVi
            ? 'Mô-men Khớp Động cơ τ_i(t) [N·m]'
            : 'Actuated Joint Dynamic Torques τ_i(t) [N·m]'}
        </span>
        {activeDynamicState && displayMode === 'live' && (
          <span className={`text-[10px] font-mono ${isLight ? 'text-slate-600' : 'text-cyan-400'}`}>
            T = {activeDynamicState.kineticEnergy.toFixed(2)} J | V = {activeDynamicState.potentialEnergy.toFixed(2)} J
          </span>
        )}
      </div>

      <svg
        ref={svgTorqueRef}
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
        <defs>
          <clipPath id="clip-torque-plot">
            <rect x={padL} y={padT} width={plotW} height={plotH} />
          </clipPath>
        </defs>

        {/* Background Canvas: Pure White in Light Mode vs Dark in Dark Mode */}
        <rect
          x={padL}
          y={padT}
          width={plotW}
          height={plotH}
          fill={isLight ? '#ffffff' : '#070a13'}
          stroke={isLight ? '#cbd5e1' : 'none'}
          strokeWidth={isLight ? '1' : '0'}
          rx={4}
        />

        {/* Zero Torque Baseline */}
        {zeroYTau >= padT && zeroYTau <= padT + plotH && (
          <line
            x1={padL}
            y1={zeroYTau}
            x2={padL + plotW}
            y2={zeroYTau}
            stroke={isLight ? '#475569' : '#334155'}
            strokeWidth="1.2"
          />
        )}

        {/* Motor Rated Torque Limit Dashes */}
        {selectedJoint !== 'all' && inertias[selectedJoint] && (
          <>
            {(() => {
              const maxT = inertias[selectedJoint].maxTorque;
              const yPos = getYTau(maxT);
              const yNeg = getYTau(-maxT);
              return (
                <>
                  {yPos >= padT && yPos <= padT + plotH && (
                    <line
                      x1={padL}
                      y1={yPos}
                      x2={padL + plotW}
                      y2={yPos}
                      stroke="#dc2626"
                      strokeWidth="1"
                      strokeDasharray="4 4"
                      opacity="0.8"
                    />
                  )}
                  {yNeg >= padT && yNeg <= padT + plotH && (
                    <line
                      x1={padL}
                      y1={yNeg}
                      x2={padL + plotW}
                      y2={yNeg}
                      stroke="#dc2626"
                      strokeWidth="1"
                      strokeDasharray="4 4"
                      opacity="0.8"
                    />
                  )}
                </>
              );
            })()}
          </>
        )}

        {/* Horizontal Y Grid Ticks */}
        {[-1, -0.5, 0, 0.5, 1].map((frac, idx) => {
          const val = yTauMin + ((frac + 1) / 2) * (yTauMax - yTauMin);
          const y = getYTau(val);
          if (y < padT || y > padT + plotH) return null;
          return (
            <g key={idx}>
              <line
                x1={padL}
                y1={y}
                x2={padL + plotW}
                y2={y}
                stroke={isLight ? '#e2e8f0' : '#1e293b'}
                strokeDasharray="2 3"
              />
              <text
                x={padL - 6}
                y={y + 3}
                textAnchor="end"
                fill={isLight ? '#0f172a' : '#64748b'}
                fontSize="9"
                fontFamily={isLight ? "'Times New Roman', Times, serif" : 'monospace'}
                fontWeight={isLight ? '600' : 'normal'}
              >
                {val.toFixed(1)}
              </text>
            </g>
          );
        })}

        {/* Time Axis Ticks */}
        {[0, 0.25, 0.5, 0.75, 1.0].map((frac, idx) => {
          const tVal = frac * timeMax;
          const x = getX(tVal);
          return (
            <g key={idx}>
              <line
                x1={x}
                y1={padT + plotH}
                x2={x}
                y2={padT + plotH + 4}
                stroke={isLight ? '#94a3b8' : '#475569'}
              />
              <text
                x={x}
                y={padT + plotH + 14}
                textAnchor="middle"
                fill={isLight ? '#0f172a' : '#64748b'}
                fontSize="9"
                fontFamily={isLight ? "'Times New Roman', Times, serif" : 'monospace'}
                fontWeight={isLight ? '600' : 'normal'}
              >
                {tVal.toFixed(1)}s
              </text>
            </g>
          );
        })}

        {/* Torques Waveforms */}
        <g clipPath="url(#clip-torque-plot)">
          {displayMode === 'trajectory' && hasTrajectory && (
            <>
              {Array.from({ length: dof }).map((_, j) => {
                const style = curveStyles[j] || {
                  color: isLight ? ACADEMIC_JOINT_COLORS[j % 7] : CYBER_JOINT_COLORS[j % 7],
                  lineWidth: 2.0,
                  lineStyle: 'solid',
                  visible: true,
                };
                if (!style.visible) return null;
                if (selectedJoint !== 'all' && selectedJoint !== j) return null;

                const pathPoints = trajectoryTorques
                  .map((item) => `${getX(item.time).toFixed(1)},${getYTau(item.tau[j] || 0).toFixed(1)}`)
                  .join(' L ');

                return (
                  <path
                    key={j}
                    d={`M ${pathPoints}`}
                    fill="none"
                    stroke={style.color}
                    strokeWidth={selectedJoint === j ? String(style.lineWidth + 0.8) : String(style.lineWidth)}
                    strokeDasharray={LINE_STYLE_DASHES[style.lineStyle]}
                    opacity={selectedJoint === 'all' || selectedJoint === j ? '0.95' : '0.2'}
                  />
                );
              })}

              {/* Time scrub line */}
              {(() => {
                const curX = getX(playbackState.currentTime);
                return (
                  <line
                    x1={curX}
                    y1={padT}
                    x2={curX}
                    y2={padT + plotH}
                    stroke="#dc2626"
                    strokeWidth="1.8"
                  />
                );
              })()}
            </>
          )}

          {displayMode === 'live' && hasLiveSamples && (
            <>
              {Array.from({ length: dof }).map((_, j) => {
                const style = curveStyles[j] || {
                  color: isLight ? ACADEMIC_JOINT_COLORS[j % 7] : CYBER_JOINT_COLORS[j % 7],
                  lineWidth: 2.0,
                  lineStyle: 'solid',
                  visible: true,
                };
                if (!style.visible) return null;
                if (selectedJoint !== 'all' && selectedJoint !== j) return null;

                const pathPoints = dynamicSamples
                  .map((item) => `${getX(item.time).toFixed(1)},${getYTau(item.tau[j] || 0).toFixed(1)}`)
                  .join(' L ');

                return (
                  <path
                    key={j}
                    d={`M ${pathPoints}`}
                    fill="none"
                    stroke={style.color}
                    strokeWidth={selectedJoint === j ? String(style.lineWidth + 0.8) : String(style.lineWidth)}
                    strokeDasharray={LINE_STYLE_DASHES[style.lineStyle]}
                  />
                );
              })}
            </>
          )}
        </g>

        {/* Empty state notices */}
        {displayMode === 'trajectory' && !hasTrajectory && (
          <text
            x={padL + plotW / 2}
            y={padT + plotH / 2}
            textAnchor="middle"
            fill={isLight ? '#64748b' : '#94a3b8'}
            fontSize="12"
            fontFamily={isLight ? "'Times New Roman', Times, serif" : 'monospace'}
          >
            {isVi
              ? 'Đang tính toán mô-men RNE cho quỹ đạo hiện tại...'
              : 'Computing Recursive Newton-Euler dynamic torques for current trajectory...'}
          </text>
        )}

        {displayMode === 'live' && !hasLiveSamples && (
          <text
            x={padL + plotW / 2}
            y={padT + plotH / 2}
            textAnchor="middle"
            fill={isLight ? '#64748b' : '#94a3b8'}
            fontSize="12"
            fontFamily={isLight ? "'Times New Roman', Times, serif" : 'monospace'}
          >
            {isVi
              ? 'Nhấn nút [Mô phỏng] ở góc trên để bắt đầu vẽ dao động ký thời gian thực'
              : 'Click [Simulate] above to stream real-time multi-physics waveforms'}
          </text>
        )}
      </svg>
    </div>
  );

  // Render SVG Subplot: Closed-Loop Tracking Errors e(t)
  const renderErrorPlot = () => (
    <div
      className={`relative rounded-xl p-3 shadow-sm border transition-colors ${
        isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-slate-950/80 border-slate-800 text-slate-200'
      }`}
    >
      <div className="flex items-center justify-between mb-1.5 px-2">
        <span
          className={`text-[11px] font-bold ${
            isLight ? 'text-slate-900 font-serif' : 'text-emerald-400 font-mono'
          }`}
        >
          {isVi
            ? 'Sai số Bám Động học e_i(t) = q_{d,i}(t) - q_i(t) [deg]'
            : 'Closed-Loop Joint Tracking Errors e_i(t) = q_{d,i}(t) - q_i(t) [deg]'}
        </span>
        <span className={`text-[10px] font-mono ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
          Controller: {(dynamicsSettings.controllerType || 'Computed Torque').toUpperCase()}
        </span>
      </div>

      <svg
        ref={svgErrorRef}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto select-none block cursor-crosshair"
      >
        <defs>
          <clipPath id="clip-error-plot">
            <rect x={padL} y={padT} width={plotW} height={plotH} />
          </clipPath>
        </defs>

        {/* Background Canvas */}
        <rect
          x={padL}
          y={padT}
          width={plotW}
          height={plotH}
          fill={isLight ? '#ffffff' : '#070a13'}
          stroke={isLight ? '#cbd5e1' : 'none'}
          strokeWidth={isLight ? '1' : '0'}
          rx={4}
        />

        {/* Zero Error Baseline */}
        {zeroYErr >= padT && zeroYErr <= padT + plotH && (
          <line
            x1={padL}
            y1={zeroYErr}
            x2={padL + plotW}
            y2={zeroYErr}
            stroke={isLight ? '#059669' : '#10b981'}
            strokeWidth="1.2"
            strokeDasharray="4 2"
          />
        )}

        {/* Horizontal Y Grid Ticks */}
        {[-1, -0.5, 0, 0.5, 1].map((frac, idx) => {
          const val = yErrMin + ((frac + 1) / 2) * (yErrMax - yErrMin);
          const y = getYErr(val);
          if (y < padT || y > padT + plotH) return null;
          return (
            <g key={idx}>
              <line
                x1={padL}
                y1={y}
                x2={padL + plotW}
                y2={y}
                stroke={isLight ? '#e2e8f0' : '#1e293b'}
                strokeDasharray="2 3"
              />
              <text
                x={padL - 6}
                y={y + 3}
                textAnchor="end"
                fill={isLight ? '#0f172a' : '#64748b'}
                fontSize="9"
                fontFamily={isLight ? "'Times New Roman', Times, serif" : 'monospace'}
                fontWeight={isLight ? '600' : 'normal'}
              >
                {val.toFixed(2)}°
              </text>
            </g>
          );
        })}

        {/* Time Axis Ticks */}
        {[0, 0.25, 0.5, 0.75, 1.0].map((frac, idx) => {
          const tVal = frac * timeMax;
          const x = getX(tVal);
          return (
            <g key={idx}>
              <line
                x1={x}
                y1={padT + plotH}
                x2={x}
                y2={padT + plotH + 4}
                stroke={isLight ? '#94a3b8' : '#475569'}
              />
              <text
                x={x}
                y={padT + plotH + 14}
                textAnchor="middle"
                fill={isLight ? '#0f172a' : '#64748b'}
                fontSize="9"
                fontFamily={isLight ? "'Times New Roman', Times, serif" : 'monospace'}
                fontWeight={isLight ? '600' : 'normal'}
              >
                {tVal.toFixed(1)}s
              </text>
            </g>
          );
        })}

        {/* Tracking Error Curves */}
        <g clipPath="url(#clip-error-plot)">
          {hasLiveSamples && (
            <>
              {Array.from({ length: dof }).map((_, j) => {
                const style = curveStyles[j] || {
                  color: isLight ? ACADEMIC_JOINT_COLORS[j % 7] : CYBER_JOINT_COLORS[j % 7],
                  lineWidth: 2.0,
                  lineStyle: 'solid',
                  visible: true,
                };
                if (!style.visible) return null;
                if (selectedJoint !== 'all' && selectedJoint !== j) return null;

                const pathPoints = dynamicSamples
                  .filter((s) => s.errorDeg && s.errorDeg[j] !== undefined)
                  .map((item) => `${getX(item.time).toFixed(1)},${getYErr(item.errorDeg[j] || 0).toFixed(1)}`)
                  .join(' L ');

                if (!pathPoints) return null;

                return (
                  <path
                    key={j}
                    d={`M ${pathPoints}`}
                    fill="none"
                    stroke={style.color}
                    strokeWidth={selectedJoint === j ? String(style.lineWidth + 0.8) : String(style.lineWidth)}
                    strokeDasharray={LINE_STYLE_DASHES[style.lineStyle]}
                  />
                );
              })}
            </>
          )}

          {/* Time scrub line */}
          {(() => {
            const curX = getX(playbackState.currentTime);
            return (
              <line
                x1={curX}
                y1={padT}
                x2={curX}
                y2={padT + plotH}
                stroke="#dc2626"
                strokeWidth="1.8"
              />
            );
          })()}
        </g>

        {!hasLiveSamples && (
          <text
            x={padL + plotW / 2}
            y={padT + plotH / 2}
            textAnchor="middle"
            fill={isLight ? '#64748b' : '#94a3b8'}
            fontSize="12"
            fontFamily={isLight ? "'Times New Roman', Times, serif" : 'monospace'}
          >
            {isVi
              ? 'Nhấn [Mô phỏng] để tính toán sai số bám closed-loop thực tế thời gian thực'
              : 'Start live physics simulation to stream closed-loop tracking errors'}
          </text>
        )}
      </svg>
    </div>
  );

  return (
    <div
      className={`space-y-3 font-sans transition-colors ${
        isLight ? 'text-slate-800' : 'text-slate-200'
      }`}
    >
      {/* Oscilloscope Header & Control Ribbon */}
      <div
        className={`flex flex-wrap items-center justify-between gap-2 pb-2 border-b ${
          isLight ? 'border-slate-200' : 'border-slate-800'
        }`}
      >
        {/* Left: Title & Mode Toggle */}
        <div className="flex items-center space-x-2">
          <Zap className="w-4 h-4 text-amber-500" />
          <h4
            className={`text-xs font-bold uppercase tracking-wider ${
              isLight ? 'text-slate-900 font-serif' : 'text-slate-100 font-mono'
            }`}
          >
            {isVi ? 'Torque Dynamics Oscilloscope' : 'Dynamic Joint Torque Oscilloscope τ(t)'}
          </h4>
        </div>

        {/* Display Mode: Trajectory vs Live Simulation */}
        <div
          className={`flex items-center space-x-1 p-1 rounded-lg border text-xs font-mono ${
            isLight ? 'bg-slate-100 border-slate-300' : 'bg-slate-950 border-slate-800'
          }`}
        >
          <button
            onClick={() => setDisplayMode('trajectory')}
            className={`px-2.5 py-1 rounded transition ${
              displayMode === 'trajectory'
                ? 'bg-amber-600 text-white font-bold shadow'
                : isLight
                ? 'text-slate-600 hover:text-slate-900'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {isVi ? 'Quỹ đạo τ(t)' : 'Torque Trajectory τ(t)'}
          </button>
          <button
            onClick={() => setDisplayMode('live')}
            className={`px-2.5 py-1 rounded transition flex items-center space-x-1 ${
              displayMode === 'live'
                ? 'bg-emerald-600 text-white font-bold shadow'
                : isLight
                ? 'text-slate-600 hover:text-slate-900'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                dynamicsSettings.isRunning ? 'bg-emerald-300 animate-ping' : 'bg-slate-400'
              }`}
            />
            <span>Live Physics RK4</span>
          </button>
        </div>

        {/* Subplot Layout Toggle: τ Only vs e Only vs 2 Subplots */}
        <div
          className={`flex items-center space-x-1 p-1 rounded-lg border text-xs font-mono ${
            isLight ? 'bg-slate-100 border-slate-300' : 'bg-slate-950 border-slate-800'
          }`}
        >
          <button
            onClick={() => setViewLayout('torques')}
            className={`px-2 py-0.5 rounded transition ${
              viewLayout === 'torques'
                ? 'bg-amber-600 text-white font-bold shadow-sm'
                : isLight
                ? 'text-slate-600 hover:text-slate-900'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Hiển thị đồ thị mô-men khớp τ_i(t)"
          >
            τ Only
          </button>
          <button
            onClick={() => setViewLayout('errors')}
            className={`px-2 py-0.5 rounded transition ${
              viewLayout === 'errors'
                ? 'bg-emerald-600 text-white font-bold shadow-sm'
                : isLight
                ? 'text-slate-600 hover:text-slate-900'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Hiển thị sai số bám closed-loop e_i(t)"
          >
            e Only
          </button>
          <button
            onClick={() => setViewLayout('2-subplots')}
            className={`px-2 py-0.5 rounded transition flex items-center space-x-1 ${
              viewLayout === '2-subplots'
                ? 'bg-purple-600 text-white font-bold shadow-sm'
                : isLight
                ? 'text-slate-600 hover:text-slate-900'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Hiển thị 2 đồ thị xếp chồng: Mô-men và Sai số bám"
          >
            <Layers className="w-3 h-3" />
            <span>2 Subplots</span>
          </button>
        </div>

        {/* Joint Filter */}
        <div
          className={`flex items-center space-x-1 p-1 rounded-lg border text-xs font-mono ${
            isLight ? 'bg-slate-100 border-slate-300' : 'bg-slate-950 border-slate-800'
          }`}
        >
          <button
            onClick={() => setSelectedJoint('all')}
            className={`px-2 py-0.5 rounded transition ${
              selectedJoint === 'all'
                ? isLight
                  ? 'bg-slate-300 text-slate-900 font-bold'
                  : 'bg-slate-700 text-white font-bold'
                : isLight
                ? 'text-slate-600 hover:text-slate-900'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All
          </button>
          {Array.from({ length: dof }).map((_, j) => {
            const style = curveStyles[j] || {
              color: isLight ? ACADEMIC_JOINT_COLORS[j % 7] : CYBER_JOINT_COLORS[j % 7],
            };
            return (
              <button
                key={j}
                onClick={() => setSelectedJoint(j)}
                style={{
                  borderColor: selectedJoint === j ? style.color : 'transparent',
                }}
                className={`px-2 py-0.5 rounded border transition ${
                  selectedJoint === j
                    ? isLight
                      ? 'bg-slate-200 font-bold'
                      : 'bg-slate-800 font-bold'
                    : isLight
                    ? 'text-slate-600 hover:text-slate-900'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span style={{ color: style.color }}>J{j + 1}</span>
              </button>
            );
          })}
        </div>

        {/* Action Controls: Edit Style, CSV, PNG DPI, PDF, Simulation Run */}
        <div className="flex items-center space-x-1.5 relative">
          {displayMode === 'live' && (
            <div className="flex items-center space-x-1 mr-1">
              <button
                onClick={() =>
                  dynamicsSettings.isRunning ? stopDynamicsSimulation() : startDynamicsSimulation()
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
                className={`p-1 rounded-lg border transition ${
                  isLight
                    ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-300'
                    : 'bg-slate-800 text-slate-400 hover:text-white border-slate-700'
                }`}
                title={t.common.reset}
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* 1. Edit Style Button */}
          <button
            onClick={() => setIsStyleEditorOpen(!isStyleEditorOpen)}
            className={`flex items-center space-x-1 px-2 py-1 rounded-lg border text-xs font-mono transition ${
              isStyleEditorOpen
                ? 'bg-purple-600 text-white border-purple-500 font-bold shadow'
                : isLight
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                : 'bg-slate-800 hover:bg-slate-750 text-slate-200 border-slate-700'
            }`}
            title="Tùy chỉnh màu sắc, nét vẽ và độ dày đồ thị (IEEE Style)"
          >
            <Palette className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden sm:inline">Edit Style</span>
          </button>

          {/* 2. CSV Export */}
          <button
            onClick={handleExportCSV}
            disabled={!hasTrajectory && !hasLiveSamples}
            className={`flex items-center space-x-1 px-2 py-1 rounded-lg border text-xs font-mono transition disabled:opacity-40 ${
              isLight
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                : 'bg-slate-800 hover:bg-slate-750 text-slate-200 border-slate-700'
            }`}
            title="Xuất dữ liệu mô-men và sai số sang CSV"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
            <span>CSV</span>
          </button>

          {/* 3. PNG DPI Menu */}
          <div className="relative">
            <button
              onClick={() => setIsPngMenuOpen(!isPngMenuOpen)}
              className={`flex items-center space-x-1 px-2 py-1 rounded-lg border text-xs font-mono transition ${
                isLight
                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                  : 'bg-slate-800 hover:bg-slate-750 text-slate-200 border-slate-700'
              }`}
              title="Xuất ảnh PNG độ phân giải cao cho xuất bản (96-600 DPI)"
            >
              <FileImage className="w-3.5 h-3.5 text-sky-500" />
              <span>PNG DPI</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {isPngMenuOpen && (
              <div
                className={`absolute right-0 mt-1 w-44 rounded-xl border shadow-xl z-50 p-1 font-mono text-xs ${
                  isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-slate-900 border-slate-700 text-slate-200'
                }`}
              >
                <div className="px-2 py-1 text-[10px] text-slate-400 uppercase font-semibold border-b border-slate-700/50">
                  Select Resolution
                </div>
                {[
                  { dpi: 96, label: '96 DPI (Web Preview)' },
                  { dpi: 150, label: '150 DPI (Slide / Report)' },
                  { dpi: 300, label: '300 DPI (IEEE Standard)' },
                  { dpi: 600, label: '600 DPI (Ultra Camera-Ready)' },
                ].map(({ dpi, label }) => (
                  <button
                    key={dpi}
                    onClick={() => handleExportPNG(dpi)}
                    className={`w-full text-left px-2 py-1.5 rounded transition ${
                      isLight ? 'hover:bg-slate-100 text-slate-700' : 'hover:bg-slate-800 text-slate-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 4. PDF Vector Report Export */}
          <button
            onClick={handleExportPDF}
            className={`flex items-center space-x-1 px-2 py-1 rounded-lg border text-xs font-mono transition ${
              isLight
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                : 'bg-slate-800 hover:bg-slate-750 text-slate-200 border-slate-700'
            }`}
            title="Xuất báo cáo Vector PDF định dạng IEEE Transactions"
          >
            <FileText className="w-3.5 h-3.5 text-rose-500" />
            <span>PDF</span>
          </button>
        </div>
      </div>

      {/* Curve Style Editor Drawer */}
      {isStyleEditorOpen && (
        <div
          className={`p-3.5 rounded-xl border transition-colors shadow-lg ${
            isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-slate-900 border-slate-800 text-slate-200'
          }`}
        >
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-700/50">
            <div className="flex items-center space-x-2">
              <Sliders className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-mono font-bold uppercase">
                {isVi ? 'Tùy chỉnh Nét vẽ & Chuẩn xuất bản' : 'Oscilloscope Curve Style & IEEE Presets'}
              </span>
            </div>

            {/* Presets */}
            <div className="flex items-center space-x-1.5">
              <button
                onClick={() => applyPreset('academic')}
                className="px-2 py-1 rounded bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-500/40 text-[11px] font-mono flex items-center space-x-1"
                title="Bảng màu độ tương phản cao chuẩn IEEE T-RO / Elsevier"
              >
                <Sparkles className="w-3 h-3 text-blue-400" />
                <span>IEEE Academic</span>
              </button>
              <button
                onClick={() => applyPreset('cyber')}
                className="px-2 py-1 rounded bg-amber-600/20 text-amber-400 hover:bg-amber-600/30 border border-amber-500/40 text-[11px] font-mono"
              >
                Cyber Neon
              </button>
              <button
                onClick={() => applyPreset('monochrome')}
                className="px-2 py-1 rounded bg-slate-700/40 text-slate-300 hover:bg-slate-700/60 border border-slate-600 text-[11px] font-mono"
              >
                B&W / Grayscale
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: dof }).map((_, j) => {
              const style = curveStyles[j] || {
                color: isLight ? ACADEMIC_JOINT_COLORS[j % 7] : CYBER_JOINT_COLORS[j % 7],
                lineWidth: 2.0,
                lineStyle: 'solid',
                visible: true,
              };

              return (
                <div
                  key={j}
                  className={`p-2.5 rounded-lg border text-xs font-mono space-y-2 ${
                    isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold flex items-center space-x-1.5" style={{ color: style.color }}>
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: style.color }} />
                      <span>Joint J{j + 1}</span>
                    </span>
                    <button
                      onClick={() =>
                        setCurveStyles((prev) => ({
                          ...prev,
                          [j]: { ...prev[j], visible: !prev[j]?.visible },
                        }))
                      }
                      className="text-slate-400 hover:text-slate-200 p-1"
                      title={style.visible ? 'Hide curve' : 'Show curve'}
                    >
                      {style.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 text-rose-400" />}
                    </button>
                  </div>

                  {/* Color Swatches */}
                  <div className="flex flex-wrap gap-1">
                    {PRESET_COLOR_SWATCHES.map((hex) => (
                      <button
                        key={hex}
                        onClick={() =>
                          setCurveStyles((prev) => ({
                            ...prev,
                            [j]: { ...prev[j], color: hex },
                          }))
                        }
                        style={{ backgroundColor: hex }}
                        className={`w-4 h-4 rounded-full border transition ${
                          style.color.toLowerCase() === hex.toLowerCase()
                            ? 'ring-2 ring-purple-500 scale-110 border-white'
                            : 'border-slate-700 opacity-80 hover:opacity-100'
                        }`}
                      />
                    ))}
                  </div>

                  {/* Line Width & Style */}
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800">
                    <div className="flex items-center space-x-1">
                      <span className="text-[10px] text-slate-500">Width:</span>
                      {[1.0, 1.5, 2.0, 2.5, 3.0].map((w) => (
                        <button
                          key={w}
                          onClick={() =>
                            setCurveStyles((prev) => ({
                              ...prev,
                              [j]: { ...prev[j], lineWidth: w },
                            }))
                          }
                          className={`px-1.5 py-0.5 rounded text-[10px] ${
                            style.lineWidth === w
                              ? 'bg-purple-600 text-white font-bold'
                              : isLight
                              ? 'bg-slate-200 text-slate-700'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {w}
                        </button>
                      ))}
                    </div>

                    <select
                      value={style.lineStyle}
                      onChange={(e) =>
                        setCurveStyles((prev) => ({
                          ...prev,
                          [j]: { ...prev[j], lineStyle: e.target.value as LineStyleType },
                        }))
                      }
                      className={`px-1.5 py-0.5 rounded text-[10px] border ${
                        isLight ? 'bg-white border-slate-300 text-slate-800' : 'bg-slate-800 border-slate-700 text-slate-200'
                      }`}
                    >
                      <option value="solid">Solid ───</option>
                      <option value="dashed">Dashed ─ ─</option>
                      <option value="dotted">Dotted ····</option>
                      <option value="dash-dot">Dash-Dot ─·─</option>
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Subplots Display Area */}
      <div className="space-y-3">
        {(viewLayout === 'torques' || viewLayout === '2-subplots') && renderTorquePlot()}
        {(viewLayout === 'errors' || viewLayout === '2-subplots') && renderErrorPlot()}
      </div>

      {/* Live Torque Gauges with Motor Limits */}
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
          const style = curveStyles[j] || {
            color: isLight ? ACADEMIC_JOINT_COLORS[j % 7] : CYBER_JOINT_COLORS[j % 7],
          };

          return (
            <div
              key={j}
              className={`rounded-xl p-2.5 space-y-1.5 font-mono border transition-colors ${
                isLight ? 'bg-white border-slate-200 shadow-sm text-slate-800' : 'bg-slate-950/80 border-slate-800/80 text-slate-200'
              }`}
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold" style={{ color: style.color }}>
                  J{j + 1} Torque
                </span>
                <span className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>
                  Max: {maxT.toFixed(0)} N·m
                </span>
              </div>

              <div className="flex items-baseline justify-between">
                <span className={`text-sm font-bold ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                  {currentTau.toFixed(1)}{' '}
                  <span className={`text-[10px] font-normal ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    N·m
                  </span>
                </span>
                <span
                  className={`text-[10px] font-bold ${
                    pct > 90 ? 'text-rose-500' : pct > 65 ? 'text-amber-500' : 'text-emerald-500'
                  }`}
                >
                  {pct.toFixed(0)}%
                </span>
              </div>

              {/* Progress limit bar */}
              <div
                className={`w-full h-1.5 rounded-full overflow-hidden ${
                  isLight ? 'bg-slate-100' : 'bg-slate-900'
                }`}
              >
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
