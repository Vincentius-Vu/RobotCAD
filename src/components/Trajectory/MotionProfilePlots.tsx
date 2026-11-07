import React, { useState, useRef } from 'react';
import { useRobotStore } from '../../store/robotStore';
import {
  exportTrajectoryToCSV,
  exportDynamicsToCSV,
  exportSubplotsToPNG,
  exportSubplotsToPDF,
} from '../../utils/trajectoryExport';
import {
  Activity,
  Layers,
  FileSpreadsheet,
  FileImage,
  FileText,
  Sliders,
  Palette,
  Eye,
  EyeOff,
  RotateCcw,
  Sparkles,
  Zap,
  Maximize2,
} from 'lucide-react';

export type LineStyleType = 'solid' | 'dashed' | 'dotted' | 'dash-dot';

export interface JointCurveStyle {
  color: string;
  lineWidth: number;
  lineStyle: LineStyleType;
  visible: boolean;
}

const DEFAULT_JOINT_COLORS = [
  '#38bdf8', // J1: Sky
  '#f59e0b', // J2: Amber
  '#10b981', // J3: Emerald
  '#a855f7', // J4: Purple
  '#ec4899', // J5: Pink
  '#f97316', // J6: Orange
  '#06b6d4', // J7: Cyan
];

const PRESET_COLOR_SWATCHES = [
  '#38bdf8', // Sky
  '#ef4444', // Red
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#a855f7', // Purple
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#ffffff', // White
  '#94a3b8', // Slate
];

const LINE_STYLE_DASHES: Record<LineStyleType, string | undefined> = {
  'solid': undefined,
  'dashed': '6 4',
  'dotted': '2 3',
  'dash-dot': '6 3 2 3',
};

export const MotionProfilePlots: React.FC = () => {
  const {
    activeTrajectory,
    playbackState,
    robotModel,
    seekTrajectoryTime,
    waypoints,
    interpolationType,
    activeWorkspaceMode,
    dynamicsSettings,
    dynamicSamples,
    activeDynamicState,
  } = useRobotStore();

  const [layoutMode, setLayoutMode] = useState<
    'subplots' | 'positions' | 'velocities' | 'accelerations' | 'phase-plane'
  >('subplots');
  const [selectedJoint, setSelectedJoint] = useState<number | 'all'>('all');
  const [plotSource, setPlotSource] = useState<'kinematic' | 'tracking-compare' | 'dynamic'>(() =>
    activeWorkspaceMode === 'dynamics' ? 'tracking-compare' : 'kinematic'
  );

  // Curve Styling State (Color, Linewidth, Linestyle, Visibility for each Joint)
  const [isStyleEditorOpen, setIsStyleEditorOpen] = useState(false);
  const [curveStyles, setCurveStyles] = useState<Record<number, JointCurveStyle>>(() => {
    const initial: Record<number, JointCurveStyle> = {};
    for (let i = 0; i < 7; i++) {
      initial[i] = {
        color: DEFAULT_JOINT_COLORS[i % DEFAULT_JOINT_COLORS.length],
        lineWidth: 2.0,
        lineStyle: 'solid',
        visible: true,
      };
    }
    return initial;
  });

  // Hover state for synchronized crosshair
  const [hoverTime, setHoverTime] = useState<number | null>(null);

  // High DPI PNG menu state
  const [isPngMenuOpen, setIsPngMenuOpen] = useState(false);

  // Tracking error Y-Lim scaling state (Autoscale vs Manual ±deg or Custom Min/Max)
  const [errorScaleMode, setErrorScaleMode] = useState<'auto' | 'manual'>('auto');
  const [errorCustomMin, setErrorCustomMin] = useState<number>(-1.0);
  const [errorCustomMax, setErrorCustomMax] = useState<number>(1.0);

  // Refs for SVGs to export
  const svgPosRef = useRef<SVGSVGElement | null>(null);
  const svgVelRef = useRef<SVGSVGElement | null>(null);
  const svgAccRef = useRef<SVGSVGElement | null>(null);
  const svgPhaseRef = useRef<SVGSVGElement | null>(null);

  if (!activeTrajectory || activeTrajectory.samples.length < 2 || !robotModel) {
    return (
      <div className="p-6 bg-slate-900/60 rounded-xl border border-slate-800 text-center text-xs text-slate-400 font-mono flex flex-col items-center justify-center space-y-2">
        <Activity className="w-6 h-6 text-slate-600" />
        <p>Chưa có dữ liệu quỹ đạo chuyển động. Hãy tạo ít nhất 2 Waypoints để hiển thị hệ thống đồ thị.</p>
      </div>
    );
  }

  const { samples, totalDuration } = activeTrajectory;
  const dof = robotModel.dof;

  // SVG dimensions for each subplot
  const width = 800;
  const height = 150;
  const padL = 50;
  const padR = 25;
  const padT = 18;
  const padB = 25;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  // Compute waypoint timestamp boundaries
  const waypointTimes: { id: string; name: string; time: number }[] = [];
  let cumTime = 0;
  waypoints.forEach((wp, idx) => {
    if (idx > 0) cumTime += wp.segmentDuration || 2.0;
    waypointTimes.push({ id: wp.id, name: wp.name, time: cumTime });
  });

  // Helper: Value min/max computation taking into account visibility
  const getBounds = (mode: 'positions' | 'velocities' | 'accelerations') => {
    let min = 0;
    let max = 0;

    // Kinematic reference bounds
    samples.forEach((s) => {
      const arr =
        mode === 'positions'
          ? s.jointAngles
          : mode === 'velocities'
          ? s.jointVelocities
          : s.jointAccelerations;
      arr.forEach((v, j) => {
        const style = curveStyles[j] || { visible: true };
        if (style.visible && (selectedJoint === 'all' || selectedJoint === j)) {
          if (v < min) min = v;
          if (v > max) max = v;
        }
      });
    });

    // If viewing dynamic actuals or tracking comparisons, also encompass dynamic samples
    if (plotSource !== 'kinematic' && dynamicSamples && dynamicSamples.length > 0) {
      dynamicSamples.forEach((ds) => {
        const arr =
          mode === 'positions'
            ? ds.qDeg
            : mode === 'velocities'
            ? ds.qdDeg
            : ds.errorDeg; // in dynamic/compare mode, subplot 3 is tracking error!
        arr.forEach((v, j) => {
          const style = curveStyles[j] || { visible: true };
          if (style.visible && (selectedJoint === 'all' || selectedJoint === j)) {
            if (v < min) min = v;
            if (v > max) max = v;
          }
        });
      });
    }

    const range = Math.max(1, max - min);
    return {
      yMin: min - range * 0.12,
      yMax: max + range * 0.12,
    };
  };

  const posBounds = getBounds('positions');
  const velBounds = getBounds('velocities');
  const rawAccBounds = getBounds('accelerations');

  // Cho phép can thiệp Y-Lim thủ công hoặc Auto-scale cho đồ thị Tracking Error
  const accBounds =
    plotSource !== 'kinematic' && errorScaleMode === 'manual'
      ? {
          yMin: Math.min(errorCustomMin, errorCustomMax - 0.001),
          yMax: Math.max(errorCustomMax, errorCustomMin + 0.001),
        }
      : rawAccBounds;

  const getX = (t: number) => padL + (Math.max(0, Math.min(totalDuration, t)) / (totalDuration || 1)) * plotW;
  const getY = (val: number, b: { yMin: number; yMax: number }) =>
    padT + (1 - (val - b.yMin) / (b.yMax - b.yMin || 1)) * plotH;

  // Real-time synchronization with active dynamic simulation or kinematic player
  const isDynamicsRunning = dynamicsSettings.isRunning;
  const effectiveTime = isDynamicsRunning && activeDynamicState
    ? (activeDynamicState.time % (totalDuration || 1))
    : playbackState.currentTime;

  // Time conversion from SVG mouse click
  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const normX = (clickX / rect.width) * width;
    const clampedPlotX = Math.max(padL, Math.min(padL + plotW, normX));
    const clickTime = ((clampedPlotX - padL) / plotW) * totalDuration;
    seekTrajectoryTime(clickTime);
  };

  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const normX = (mouseX / rect.width) * width;
    const clampedPlotX = Math.max(padL, Math.min(padL + plotW, normX));
    const time = ((clampedPlotX - padL) / plotW) * totalDuration;
    setHoverTime(time);
  };

  // Find sample closest to hover time (either kinematic or dynamic)
  const hoverSample = hoverTime !== null
    ? samples.reduce((prev, curr) => (Math.abs(curr.time - hoverTime) < Math.abs(prev.time - hoverTime) ? curr : prev), samples[0])
    : null;

  const hoverDynamicSample = hoverTime !== null && dynamicSamples && dynamicSamples.length > 0
    ? dynamicSamples.reduce((prev, curr) => (Math.abs((curr.time % (totalDuration || 1)) - hoverTime) < Math.abs((prev.time % (totalDuration || 1)) - hoverTime) ? curr : prev), dynamicSamples[0])
    : null;

  // Update curve style for a specific joint
  const updateJointStyle = (jointIndex: number, updates: Partial<JointCurveStyle>) => {
    setCurveStyles((prev) => ({
      ...prev,
      [jointIndex]: {
        ...prev[jointIndex],
        ...updates,
      },
    }));
  };

  // Preset: Reset all to standard colors
  const resetToDefaultStyles = () => {
    const res: Record<number, JointCurveStyle> = {};
    for (let i = 0; i < 7; i++) {
      res[i] = {
        color: DEFAULT_JOINT_COLORS[i % DEFAULT_JOINT_COLORS.length],
        lineWidth: 2.0,
        lineStyle: 'solid',
        visible: true,
      };
    }
    setCurveStyles(res);
  };

  // Preset: Academic Monochrome / Grayscale (Distinct line patterns for B&W paper printing)
  const applyMonochromePreset = () => {
    const styles: LineStyleType[] = ['solid', 'dashed', 'dash-dot', 'dotted', 'solid', 'dashed', 'dotted'];
    const widths = [2.2, 2.0, 2.0, 2.2, 1.5, 1.5, 1.5];
    const shades = ['#ffffff', '#e2e8f0', '#cbd5e1', '#94a3b8', '#64748b', '#475569', '#334155'];
    const res: Record<number, JointCurveStyle> = {};
    for (let i = 0; i < 7; i++) {
      res[i] = {
        color: shades[i % shades.length],
        lineWidth: widths[i % widths.length],
        lineStyle: styles[i % styles.length],
        visible: true,
      };
    }
    setCurveStyles(res);
  };

  // Render a single curve SVG
  const renderSubplotSVG = (
    mode: 'positions' | 'velocities' | 'accelerations',
    title: string,
    unit: string,
    bounds: { yMin: number; yMax: number },
    svgRef: React.RefObject<SVGSVGElement | null>
  ) => {
    const zeroY = getY(0, bounds);
    const cursorX = getX(effectiveTime);
    const hoverX = hoverTime !== null ? getX(hoverTime) : null;

    const effectiveTitle =
      mode === 'accelerations' && plotSource !== 'kinematic'
        ? 'Tracking Error e(t) = q_des - q_act'
        : mode === 'positions' && plotSource === 'tracking-compare'
        ? 'Joint Position Response q(t) vs Reference q_d(t)'
        : mode === 'velocities' && plotSource === 'tracking-compare'
        ? 'Joint Velocity Response dq/dt vs Reference'
        : title;

    const effectiveUnit =
      mode === 'accelerations' && plotSource !== 'kinematic'
        ? 'deg'
        : unit;

    // Y ticks with dynamic precision
    const ticksCount = 4;
    const yTicks = [];
    const isErrorPlot = mode === 'accelerations' && plotSource !== 'kinematic';
    const range = bounds.yMax - bounds.yMin;
    const decimals = range < 1.0 ? 3 : range < 4.0 ? 2 : 1;

    for (let i = 0; i <= ticksCount; i++) {
      const val = bounds.yMin + (i / ticksCount) * range;
      yTicks.push(val);
    }

    return (
      <div className="relative bg-slate-950/70 border border-slate-800/80 rounded-xl p-2.5 shadow-inner">
        {/* Subplot Title Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-1 px-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-mono font-bold text-slate-300">
              {effectiveTitle} <span className="text-slate-500 font-normal">[{effectiveUnit}]</span>
            </span>
            {plotSource === 'tracking-compare' && mode === 'positions' && (
              <span className="text-[9px] font-mono text-slate-400">
                (Nét đứt: Kế hoạch q_d | Nét liền: Thực tế q)
              </span>
            )}

            {/* Tracking Error Y-Lim & Autoscale Controls */}
            {isErrorPlot && (
              <div className="flex items-center space-x-1 bg-slate-900 border border-slate-700/80 rounded-md px-1.5 py-0.5 text-[10px] font-mono shadow-sm">
                <span className="text-slate-400 font-semibold flex items-center gap-1">
                  <Maximize2 className="w-2.5 h-2.5 text-sky-400" />
                  Y-Lim:
                </span>

                {/* Auto Scale Button */}
                <button
                  onClick={() => setErrorScaleMode('auto')}
                  className={`px-1.5 py-0.5 rounded transition ${
                    errorScaleMode === 'auto'
                      ? 'bg-sky-600 text-white font-bold shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Tự động căn chỉnh dải đo theo sai số bám thực tế (Autoscale)"
                >
                  Auto
                </button>

                {/* Quick Presets */}
                {[0.2, 0.5, 1.0, 2.0, 5.0].map((val) => {
                  const isActive =
                    errorScaleMode === 'manual' &&
                    Math.abs(errorCustomMin - -val) < 0.001 &&
                    Math.abs(errorCustomMax - val) < 0.001;
                  return (
                    <button
                      key={val}
                      onClick={() => {
                        setErrorScaleMode('manual');
                        setErrorCustomMin(-val);
                        setErrorCustomMax(val);
                      }}
                      className={`px-1.5 py-0.5 rounded transition ${
                        isActive
                          ? 'bg-amber-600 text-white font-bold shadow'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                      title={`Khóa dải đo đối xứng từ -${val}° đến +${val}°`}
                    >
                      ±{val}°
                    </button>
                  );
                })}

                {/* Direct Min / Max Inputs */}
                <div className="flex items-center space-x-1 pl-1.5 ml-1 border-l border-slate-700">
                  <span className="text-slate-500">Min:</span>
                  <input
                    type="number"
                    step="0.1"
                    value={errorCustomMin}
                    onChange={(e) => {
                      setErrorScaleMode('manual');
                      setErrorCustomMin(parseFloat(e.target.value) || 0);
                    }}
                    className="w-12 bg-slate-950 border border-slate-700 focus:border-amber-500 rounded px-1 py-0.2 text-center text-slate-200 font-mono text-[10px] outline-none"
                    title="Nhập giới hạn dưới trục Y (deg)"
                  />
                  <span className="text-slate-500">Max:</span>
                  <input
                    type="number"
                    step="0.1"
                    value={errorCustomMax}
                    onChange={(e) => {
                      setErrorScaleMode('manual');
                      setErrorCustomMax(parseFloat(e.target.value) || 0);
                    }}
                    className="w-12 bg-slate-950 border border-slate-700 focus:border-amber-500 rounded px-1 py-0.2 text-center text-slate-200 font-mono text-[10px] outline-none"
                    title="Nhập giới hạn trên trục Y (deg)"
                  />
                </div>
              </div>
            )}
          </div>

          {hoverTime !== null && (
            <span className="text-[10px] font-mono text-sky-400">
              {plotSource !== 'kinematic' && hoverDynamicSample ? (
                mode === 'positions'
                  ? `t = ${hoverDynamicSample.time.toFixed(2)}s | q_act: [${hoverDynamicSample.qDeg.slice(0, dof).map((v) => v.toFixed(1)).join('°, ')}°]`
                  : mode === 'velocities'
                  ? `t = ${hoverDynamicSample.time.toFixed(2)}s | dq_act: [${hoverDynamicSample.qdDeg.slice(0, dof).map((v) => v.toFixed(1)).join(', ')}]`
                  : `t = ${hoverDynamicSample.time.toFixed(2)}s | Error: [${hoverDynamicSample.errorDeg.slice(0, dof).map((v) => (v >= 0 ? `+${v.toFixed(2)}` : v.toFixed(2))).join('°, ')}°]`
              ) : hoverSample ? (
                mode === 'positions'
                  ? `t = ${hoverSample.time.toFixed(2)}s | q: [${hoverSample.jointAngles.slice(0, dof).map((v) => v.toFixed(1)).join('°, ')}°]`
                  : mode === 'velocities'
                  ? `t = ${hoverSample.time.toFixed(2)}s | v: [${hoverSample.jointVelocities.slice(0, dof).map((v) => v.toFixed(1)).join(', ')}]`
                  : `t = ${hoverSample.time.toFixed(2)}s | a: [${hoverSample.jointAccelerations.slice(0, dof).map((v) => v.toFixed(1)).join(', ')}]`
              ) : null}
            </span>
          )}
        </div>

        {/* SVG Curve Plot */}
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto cursor-crosshair select-none block"
          onClick={handleSvgClick}
          onMouseMove={handleSvgMouseMove}
          onMouseLeave={() => setHoverTime(null)}
        >
          {/* Plot clipping mask for manual zoom and tight Y-Lim */}
          <defs>
            <clipPath id={`plot-clip-${mode}`}>
              <rect x={padL} y={padT} width={plotW} height={plotH} />
            </clipPath>
          </defs>

          {/* Background Grid */}
          <rect x={padL} y={padT} width={plotW} height={plotH} fill="#090d16" rx={4} />

          {/* Horizontal Grid lines */}
          {yTicks.map((val, idx) => {
            const y = getY(val, bounds);
            return (
              <g key={idx}>
                <line x1={padL} y1={y} x2={padL + plotW} y2={y} stroke="#1e293b" strokeDasharray="3 3" />
                <text x={padL - 6} y={y + 3} textAnchor="end" fill="#64748b" fontSize="9" fontFamily="monospace">
                  {val.toFixed(decimals)}
                </text>
              </g>
            );
          })}

          {/* Zero baseline */}
          {zeroY >= padT && zeroY <= padT + plotH && (
            <line x1={padL} y1={zeroY} x2={padL + plotW} y2={zeroY} stroke="#334155" strokeWidth="1.2" />
          )}

          {/* Time axis ticks */}
          {[0, 0.25, 0.5, 0.75, 1.0].map((frac, idx) => {
            const t = frac * totalDuration;
            const x = getX(t);
            return (
              <g key={idx}>
                <line x1={x} y1={padT + plotH} x2={x} y2={padT + plotH + 4} stroke="#475569" />
                <text x={x} y={padT + plotH + 14} textAnchor="middle" fill="#64748b" fontSize="9" fontFamily="monospace">
                  {t.toFixed(1)}s
                </text>
              </g>
            );
          })}

          {/* Waypoint time boundaries */}
          {waypointTimes.map((wpInfo, idx) => {
            const x = getX(wpInfo.time);
            return (
              <g key={wpInfo.id}>
                <line x1={x} y1={padT} x2={x} y2={padT + plotH} stroke="#f59e0b" strokeWidth="1" strokeDasharray="2 2" opacity="0.6" />
                <text x={x + 3} y={padT + 12} fill="#d97706" fontSize="8" fontFamily="monospace" fontWeight="bold">
                  W{idx + 1}
                </text>
              </g>
            );
          })}

          {/* Joint Kinematic & Dynamic Curves (Clipped within plot area) */}
          <g clipPath={`url(#plot-clip-${mode})`}>
          {Array.from({ length: dof }).map((_, j) => {
            const style = curveStyles[j] || {
              color: DEFAULT_JOINT_COLORS[j % DEFAULT_JOINT_COLORS.length],
              lineWidth: 2.0,
              lineStyle: 'solid',
              visible: true,
            };

            // Respect visibility and selectedJoint filter
            if (!style.visible) return null;
            if (selectedJoint !== 'all' && selectedJoint !== j) return null;

            // 1. Reference Kinematic Path
            const showRef = plotSource === 'kinematic' || plotSource === 'tracking-compare';
            const refPoints = showRef
              ? samples
                  .map((s) => {
                    const arr =
                      mode === 'positions'
                        ? s.jointAngles
                        : mode === 'velocities'
                        ? s.jointVelocities
                        : s.jointAccelerations;
                    return `${getX(s.time).toFixed(1)},${getY(arr[j] || 0, bounds).toFixed(1)}`;
                  })
                  .join(' L ')
              : '';

            // 2. Dynamic Actual Response Path (from live simulation samples)
            const showDynamic =
              (plotSource === 'dynamic' || plotSource === 'tracking-compare') &&
              dynamicSamples &&
              dynamicSamples.length > 1;

            const dynPoints = showDynamic
              ? dynamicSamples
                  .map((ds) => {
                    const tWrapped = ds.time % (totalDuration || 1);
                    const arr =
                      mode === 'positions'
                        ? ds.qDeg
                        : mode === 'velocities'
                        ? ds.qdDeg
                        : ds.errorDeg; // Tracking error in degrees!
                    return `${getX(tWrapped).toFixed(1)},${getY(arr[j] || 0, bounds).toFixed(1)}`;
                  })
                  .join(' L ')
              : '';

            const strokeDash = LINE_STYLE_DASHES[style.lineStyle];

            return (
              <g key={j}>
                {/* Reference Path: in comparison mode it's dashed slate reference */}
                {showRef && mode !== 'accelerations' && (
                  <path
                    d={`M ${refPoints}`}
                    fill="none"
                    stroke={plotSource === 'tracking-compare' ? '#64748b' : style.color}
                    strokeWidth={plotSource === 'tracking-compare' ? '1.5' : (selectedJoint === j ? Math.max(2.5, style.lineWidth + 0.8) : style.lineWidth)}
                    strokeDasharray={plotSource === 'tracking-compare' ? '4 3' : strokeDash}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={plotSource === 'tracking-compare' ? '0.6' : (selectedJoint === 'all' || selectedJoint === j ? '0.95' : '0.2')}
                  />
                )}

                {/* For kinematic mode accelerations */}
                {showRef && mode === 'accelerations' && plotSource === 'kinematic' && (
                  <path
                    d={`M ${refPoints}`}
                    fill="none"
                    stroke={style.color}
                    strokeWidth={selectedJoint === j ? Math.max(2.5, style.lineWidth + 0.8) : style.lineWidth}
                    strokeDasharray={strokeDash}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={selectedJoint === 'all' || selectedJoint === j ? '0.95' : '0.2'}
                  />
                )}

                {/* Dynamic Actual Path: in comparison mode it's bright solid line */}
                {showDynamic && (
                  <path
                    d={`M ${dynPoints}`}
                    fill="none"
                    stroke={style.color}
                    strokeWidth={selectedJoint === j ? Math.max(2.8, style.lineWidth + 1.0) : Math.max(2.0, style.lineWidth)}
                    strokeDasharray={plotSource === 'tracking-compare' ? undefined : strokeDash}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={selectedJoint === 'all' || selectedJoint === j ? '1.0' : '0.25'}
                  />
                )}
              </g>
            );
          })}
          </g>

          {/* Hover crosshair line */}
          {hoverX !== null && (
            <line x1={hoverX} y1={padT} x2={hoverX} y2={padT + plotH} stroke="#38bdf8" strokeWidth="1" strokeDasharray="4 2" />
          )}

          {/* Playback time cursor */}
          <line x1={cursorX} y1={padT} x2={cursorX} y2={padT + plotH} stroke="#ef4444" strokeWidth="1.8" />
          <polygon
            points={`${cursorX - 4},${padT - 1} ${cursorX + 4},${padT - 1} ${cursorX},${padT + 5}`}
            fill="#ef4444"
          />
        </svg>
      </div>
    );
  };

  // Render Phase Plane (e vs e_dot) with Sliding Surface s = e_dot + lambda * e = 0
  const renderPhasePlaneSVG = () => {
    const activeJoint = selectedJoint === 'all' ? 0 : selectedJoint;
    const style = curveStyles[activeJoint] || {
      color: DEFAULT_JOINT_COLORS[activeJoint % DEFAULT_JOINT_COLORS.length],
      lineWidth: 2.5,
    };

    const phaseW = 800;
    const phaseH = 320;
    const pad = 48;
    const innerW = phaseW - pad * 2;
    const innerH = phaseH - pad * 2;
    const centerX = pad + innerW / 2;
    const centerY = pad + innerH / 2;

    const lambdaVal = dynamicsSettings.smcSettings?.lambda[activeJoint] || 20;
    const phiVal = dynamicsSettings.smcSettings?.boundaryLayer[activeJoint] || 0.05;
    const phiDeg = (phiVal * 180) / Math.PI;

    // Collect (e, e_dot) points from dynamic samples
    let maxE = 1.0;
    let maxEdot = 10.0;

    const points: { e: number; edot: number }[] = [];
    if (dynamicSamples && dynamicSamples.length > 0) {
      for (let i = 0; i < dynamicSamples.length; i++) {
        const ds = dynamicSamples[i];
        const e = ds.errorDeg[activeJoint] || 0;
        let edot = ds.errorDotDeg ? (ds.errorDotDeg[activeJoint] || 0) : 0;
        if (!ds.errorDotDeg && i > 0) {
          const prev = dynamicSamples[i - 1];
          const dt = Math.max(0.0001, ds.time - prev.time);
          edot = (e - (prev.errorDeg[activeJoint] || 0)) / dt;
        }

        if (Math.abs(e) > maxE) maxE = Math.abs(e);
        if (Math.abs(edot) > maxEdot) maxEdot = Math.abs(edot);
        points.push({ e, edot });
      }
    }

    maxE = Math.max(0.5, maxE * 1.25);
    maxEdot = Math.max(5.0, maxEdot * 1.25);

    const mapX = (eVal: number) => centerX + (eVal / maxE) * (innerW / 2);
    const mapY = (edotVal: number) => centerY - (edotVal / maxEdot) * (innerH / 2);

    // Coordinates of sliding line: edot = -lambda * e
    const pSlidingLeft = { x: mapX(-maxE), y: mapY(lambdaVal * maxE) };
    const pSlidingRight = { x: mapX(maxE), y: mapY(-lambdaVal * maxE) };

    // Boundary layer lines: edot = -lambda * e +/- phiDeg
    const bTopLeft = { x: mapX(-maxE), y: mapY(lambdaVal * maxE + phiDeg) };
    const bTopRight = { x: mapX(maxE), y: mapY(-lambdaVal * maxE + phiDeg) };
    const bBotRight = { x: mapX(maxE), y: mapY(-lambdaVal * maxE - phiDeg) };
    const bBotLeft = { x: mapX(-maxE), y: mapY(lambdaVal * maxE - phiDeg) };

    const pathData = points
      .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${mapX(p.e).toFixed(1)},${mapY(p.edot).toFixed(1)}`)
      .join(' ');

    const currentPt = points[points.length - 1];

    return (
      <div className="relative bg-slate-950/80 border border-purple-500/30 rounded-xl p-3 shadow-2xl space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1 border-b border-slate-800 pb-2">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-mono font-bold text-purple-300 flex items-center space-x-1.5">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>Mặt Phẳng Pha SMC (Phase Portrait Plane: ė vs e) - Khớp J{activeJoint + 1}</span>
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              Mặt trượt s = ė + {lambdaVal}e = 0
            </span>
          </div>

          <div className="flex items-center space-x-2 text-[10px] font-mono">
            <span className="flex items-center space-x-1 text-amber-300">
              <span className="w-2.5 h-0.5 bg-amber-400 inline-block border-dashed" />
              <span>Đường trượt s = 0</span>
            </span>
            <span className="flex items-center space-x-1 text-purple-300">
              <span className="w-2.5 h-2 bg-purple-500/20 inline-block border border-purple-400/40 rounded-sm" />
              <span>Dải biên |s| ≤ Φ ({phiVal})</span>
            </span>
          </div>
        </div>

        <svg
          ref={svgPhaseRef}
          viewBox={`0 0 ${phaseW} ${phaseH}`}
          className="w-full h-auto select-none block bg-[#080c14] rounded-lg border border-slate-850"
        >
          <defs>
            <clipPath id="phase-clip">
              <rect x={pad} y={pad} width={innerW} height={innerH} />
            </clipPath>
          </defs>

          {/* Grid lines */}
          {[-0.75, -0.5, -0.25, 0.25, 0.5, 0.75].map((f, i) => (
            <g key={i}>
              <line
                x1={centerX + f * (innerW / 2)}
                y1={pad}
                x2={centerX + f * (innerW / 2)}
                y2={pad + innerH}
                stroke="#172033"
                strokeDasharray="2 3"
              />
              <line
                x1={pad}
                y1={centerY + f * (innerH / 2)}
                x2={pad + innerW}
                y2={centerY + f * (innerH / 2)}
                stroke="#172033"
                strokeDasharray="2 3"
              />
            </g>
          ))}

          {/* Center Crosshair Axes (e = 0, edot = 0) */}
          <line x1={pad} y1={centerY} x2={pad + innerW} y2={centerY} stroke="#334155" strokeWidth="1.5" />
          <line x1={centerX} y1={pad} x2={centerX} y2={pad + innerH} stroke="#334155" strokeWidth="1.5" />

          {/* Axis Labels */}
          <text x={pad + innerW - 10} y={centerY - 6} fill="#94a3b8" fontSize="10" fontFamily="monospace" textAnchor="end">
            Sai số e (deg) →
          </text>
          <text x={centerX + 8} y={pad + 12} fill="#94a3b8" fontSize="10" fontFamily="monospace">
            ↑ Đạo hàm sai số ė (deg/s)
          </text>
          <text x={centerX + 6} y={centerY + 14} fill="#64748b" fontSize="9" fontFamily="monospace">
            (0, 0)
          </text>

          {/* Numeric Axis Extents */}
          <text x={pad + 5} y={centerY + 14} fill="#64748b" fontSize="9" fontFamily="monospace">
            {-maxE.toFixed(1)}°
          </text>
          <text x={pad + innerW - 5} y={centerY + 14} fill="#64748b" fontSize="9" fontFamily="monospace" textAnchor="end">
            {maxE.toFixed(1)}°
          </text>
          <text x={centerX - 8} y={pad + innerH - 4} fill="#64748b" fontSize="9" fontFamily="monospace" textAnchor="end">
            {-maxEdot.toFixed(1)}°/s
          </text>
          <text x={centerX - 8} y={pad + 12} fill="#64748b" fontSize="9" fontFamily="monospace" textAnchor="end">
            {maxEdot.toFixed(1)}°/s
          </text>

          {/* Clipped Dynamic Elements */}
          <g clipPath="url(#phase-clip)">
            {/* Boundary Layer Shaded Polygon */}
            <polygon
              points={`${bTopLeft.x},${bTopLeft.y} ${bTopRight.x},${bTopRight.y} ${bBotRight.x},${bBotRight.y} ${bBotLeft.x},${bBotLeft.y}`}
              fill="#a855f7"
              fillOpacity="0.12"
              stroke="#a855f7"
              strokeWidth="0.8"
              strokeDasharray="4 2"
            />

            {/* Ideal Sliding Surface Line s = 0 */}
            <line
              x1={pSlidingLeft.x}
              y1={pSlidingLeft.y}
              x2={pSlidingRight.x}
              y2={pSlidingRight.y}
              stroke="#f59e0b"
              strokeWidth="2.0"
              strokeDasharray="6 3"
            />

            {/* State Trajectory Path (e(t), edot(t)) */}
            {points.length > 1 && (
              <path
                d={pathData}
                fill="none"
                stroke={style.color}
                strokeWidth={style.lineWidth || 2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.9"
              />
            )}

            {/* Current Real-time State Point */}
            {currentPt && (
              <g>
                <circle
                  cx={mapX(currentPt.e)}
                  cy={mapY(currentPt.edot)}
                  r="7"
                  fill="#38bdf8"
                  fillOpacity="0.3"
                  className="animate-ping"
                />
                <circle
                  cx={mapX(currentPt.e)}
                  cy={mapY(currentPt.edot)}
                  r="4.5"
                  fill="#38bdf8"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />
              </g>
            )}
          </g>
        </svg>

        <div className="flex flex-wrap items-center justify-between text-[10px] font-mono text-slate-400 px-1 pt-1">
          <span>• Điểm trạng thái (e, ė) xuất phát từ xa, tiến vào mặt trượt (Reaching Phase) và trượt về (0,0) (Sliding Phase).</span>
          <span>• Chuyển sang hàm Sign để quan sát hiện tượng Chattering rung chấn quanh đường s = 0.</span>
        </div>
      </div>
    );
  };

  // Trigger high DPI PNG export
  const handleExportPNG = (dpi: number) => {
    setIsPngMenuOpen(false);
    const svgs: SVGSVGElement[] = [];
    const titles: string[] = [];

    if (layoutMode === 'subplots') {
      if (svgPosRef.current) { svgs.push(svgPosRef.current); titles.push('Joint Position q(t) [deg]'); }
      if (svgVelRef.current) { svgs.push(svgVelRef.current); titles.push('Joint Velocity dq/dt [deg/s]'); }
      if (svgAccRef.current) { svgs.push(svgAccRef.current); titles.push('Joint Acceleration d²q/dt² [deg/s²]'); }
    } else if (layoutMode === 'positions' && svgPosRef.current) {
      svgs.push(svgPosRef.current); titles.push('Joint Position q(t)');
    } else if (layoutMode === 'velocities' && svgVelRef.current) {
      svgs.push(svgVelRef.current); titles.push('Joint Velocity dq/dt');
    } else if (layoutMode === 'accelerations' && svgAccRef.current) {
      svgs.push(svgAccRef.current); titles.push('Joint Acceleration d²q/dt²');
    }

    exportSubplotsToPNG(svgs, titles, {
      dpi,
      theme: 'dark',
      robotName: `${robotModel.manufacturer} ${robotModel.modelName}`,
      interpolationType,
      totalDuration,
    });
  };

  // Trigger vector PDF report export
  const handleExportPDF = () => {
    const svgs: SVGSVGElement[] = [];
    const titles: string[] = [];

    if (svgPosRef.current) { svgs.push(svgPosRef.current); titles.push('Joint Position q(t)'); }
    if (svgVelRef.current) { svgs.push(svgVelRef.current); titles.push('Joint Velocity dq/dt'); }
    if (svgAccRef.current) { svgs.push(svgAccRef.current); titles.push('Joint Acceleration d²q/dt²'); }

    exportSubplotsToPDF(svgs, titles, {
      robotName: `${robotModel.manufacturer} ${robotModel.modelName}`,
      interpolationType,
      totalDuration,
      waypointsCount: waypoints.length,
    });
  };

  // CSV Export: Cho phép xuất cả kinematic hoặc dynamic actual samples
  const handleExportCSV = () => {
    if (plotSource !== 'kinematic' && dynamicSamples && dynamicSamples.length > 0) {
      exportDynamicsToCSV(dynamicSamples, robotModel.id, dynamicsSettings.controllerType);
    } else {
      exportTrajectoryToCSV(activeTrajectory, robotModel.id);
    }
  };

  return (
    <div className="space-y-3 font-sans text-slate-200">
      {/* Top Command Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
        {/* Plot Data Source Selector: Kinematic vs Tracking vs Dynamic */}
        <div className="flex items-center space-x-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-mono">
          <span className="text-[11px] text-slate-500 uppercase px-1 font-semibold">Mode:</span>
          <button
            onClick={() => setPlotSource('kinematic')}
            className={`px-2 py-0.5 rounded transition ${
              plotSource === 'kinematic'
                ? 'bg-blue-600 text-white font-bold shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Đồ thị quỹ đạo tham chiếu động học q_d(t)"
          >
            Kinematic (q_d)
          </button>
          <button
            onClick={() => setPlotSource('tracking-compare')}
            className={`px-2 py-0.5 rounded transition ${
              plotSource === 'tracking-compare'
                ? 'bg-amber-600 text-white font-bold shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="So sánh đáp ứng thực tế q(t) với tham chiếu q_d(t) & sai số bám e(t)"
          >
            Tracking (q vs q_d)
          </button>
          <button
            onClick={() => setPlotSource('dynamic')}
            className={`px-2 py-0.5 rounded transition ${
              plotSource === 'dynamic'
                ? 'bg-emerald-600 text-white font-bold shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Đồ thị phản hồi động lực học thực tế q_act(t) & sai số bám e(t)"
          >
            Dynamic (q_act)
          </button>

          {/* Live Dynamics Simulation Active Indicator */}
          {dynamicsSettings.isRunning && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] animate-pulse">
              <Zap className="w-3 h-3 text-emerald-400" />
              <span>500Hz: {dynamicsSettings.controllerType}</span>
            </span>
          )}
        </div>

        {/* Subplot vs Single Switcher */}
        <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-mono">
          <button
            onClick={() => setLayoutMode('subplots')}
            className={`flex items-center space-x-1 px-2.5 py-1 rounded transition ${
              layoutMode === 'subplots'
                ? 'bg-purple-600 text-white font-bold shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>3 Subplots</span>
          </button>
          <button
            onClick={() => setLayoutMode('positions')}
            className={`px-2 py-1 rounded transition ${
              layoutMode === 'positions' ? 'bg-sky-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Position (q)
          </button>
          <button
            onClick={() => setLayoutMode('velocities')}
            className={`px-2 py-1 rounded transition ${
              layoutMode === 'velocities' ? 'bg-sky-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Velocity (v)
          </button>
          <button
            onClick={() => setLayoutMode('accelerations')}
            className={`px-2 py-1 rounded transition ${
              layoutMode === 'accelerations' ? 'bg-sky-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {plotSource !== 'kinematic' ? 'Error e(t)' : 'Accel (a)'}
          </button>
          <button
            onClick={() => setLayoutMode('phase-plane')}
            className={`flex items-center space-x-1 px-2.5 py-1 rounded transition ${
              layoutMode === 'phase-plane'
                ? 'bg-purple-600 text-white font-bold shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Đồ thị mặt phẳng pha (Phase Plane: ė theo e) & mặt trượt SMC s = 0"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-300" />
            <span>Phase Plane (ė vs e)</span>
          </button>
        </div>

        {/* Joint Filter Selector */}
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
          {Array.from({ length: dof }).map((_, j) => {
            const style = curveStyles[j] || { color: DEFAULT_JOINT_COLORS[j] };
            return (
              <button
                key={j}
                onClick={() => setSelectedJoint(j)}
                style={{
                  borderColor: selectedJoint === j ? style.color : 'transparent',
                }}
                className={`px-2 py-0.5 rounded border transition ${
                  selectedJoint === j
                    ? 'bg-slate-800 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span style={{ color: style.color }}>J{j + 1}</span>
              </button>
            );
          })}
        </div>

        {/* Action Buttons: Edit Style, CSV, High-DPI PNG, PDF */}
        <div className="flex items-center space-x-2">
          {/* Plot Series Style Editor Button */}
          <button
            onClick={() => setIsStyleEditorOpen(!isStyleEditorOpen)}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg border text-xs font-mono font-medium transition ${
              isStyleEditorOpen
                ? 'bg-sky-500/20 text-sky-300 border-sky-500/50 shadow'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
            }`}
            title="Mở bảng chỉnh sửa Color, Linewidth, Linestyle của từng đường đồ thị"
          >
            <Palette className="w-3.5 h-3.5 text-sky-400" />
            <span>{isStyleEditorOpen ? 'Edit Style: ON' : 'Edit Style'}</span>
          </button>

          {/* Export CSV */}
          <button
            onClick={handleExportCSV}
            className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg border text-xs font-mono transition ${
              plotSource !== 'kinematic' && dynamicSamples && dynamicSamples.length > 0
                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-600/50 hover:bg-emerald-900/60'
                : 'bg-slate-800 hover:bg-slate-750 text-slate-200 border-slate-700'
            }`}
            title={
              plotSource !== 'kinematic' && dynamicSamples && dynamicSamples.length > 0
                ? 'Xuất dữ liệu động học & động lực học thực tế (q, q_des, error, torques, energy) dạng CSV'
                : 'Xuất bảng dữ liệu đầy đủ dạng file CSV để vẽ lại bằng MATLAB/Python'
            }
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>{plotSource !== 'kinematic' && dynamicSamples && dynamicSamples.length > 0 ? 'CSV (Dyn)' : 'CSV'}</span>
          </button>

          {/* Export High-DPI PNG Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsPngMenuOpen(!isPngMenuOpen)}
              className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 text-xs font-mono transition"
              title="Xuất ảnh PNG độ nét cao (96, 150, 300, 600 DPI)"
            >
              <FileImage className="w-3.5 h-3.5 text-sky-400" />
              <span>PNG DPI</span>
            </button>

            {isPngMenuOpen && (
              <div className="absolute right-0 top-full mt-1 w-32 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl p-1 z-30 font-mono text-xs">
                {[96, 150, 300, 600].map((dpi) => (
                  <button
                    key={dpi}
                    onClick={() => handleExportPNG(dpi)}
                    className="w-full text-left px-2 py-1 rounded hover:bg-sky-600 hover:text-white transition"
                  >
                    {dpi} DPI {dpi >= 300 ? '(Journal)' : ''}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Export PDF */}
          <button
            onClick={handleExportPDF}
            className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-rose-600/30 hover:bg-rose-600/40 text-rose-300 border border-rose-500/40 text-xs font-mono transition"
            title="Xuất báo cáo khoa học dạng tài liệu PDF chất lượng cao"
          >
            <FileText className="w-3.5 h-3.5 text-rose-400" />
            <span>PDF</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* PLOT CURVE STYLE EDITOR PANEL (Color, Linewidth, Linestyle) */}
      {/* ======================================================== */}
      {isStyleEditorOpen && (
        <div className="p-3.5 bg-slate-950/95 border border-sky-500/40 rounded-xl space-y-3 shadow-2xl animate-in slide-in-from-top-2 duration-150">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center space-x-2">
              <Sliders className="w-4 h-4 text-sky-400" />
              <span className="text-xs font-mono font-bold text-sky-300">
                Tùy biến Đường đồ thị (Curve Series Style Editor)
              </span>
            </div>

            {/* Presets */}
            <div className="flex items-center space-x-2 text-xs font-mono">
              <button
                onClick={resetToDefaultStyles}
                className="flex items-center space-x-1 px-2 py-0.5 rounded bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition"
                title="Khôi phục bảng màu chuẩn CAE mặc định"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Mặc định</span>
              </button>
              <button
                onClick={applyMonochromePreset}
                className="flex items-center space-x-1 px-2 py-0.5 rounded bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition"
                title="Áp dụng kiểu nét đen trắng cho bài báo in ấn (Solid, Dashed, Dotted)"
              >
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span>Báo chí Trắng Đen</span>
              </button>
            </div>
          </div>

          {/* Series Config Table */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {Array.from({ length: dof }).map((_, j) => {
              const style = curveStyles[j] || {
                color: DEFAULT_JOINT_COLORS[j],
                lineWidth: 2.0,
                lineStyle: 'solid',
                visible: true,
              };

              return (
                <div
                  key={j}
                  className={`p-2.5 rounded-lg border transition space-y-2 ${
                    style.visible
                      ? 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                      : 'bg-slate-950/50 border-slate-900 opacity-60'
                  }`}
                >
                  {/* Joint Header & Visibility */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => updateJointStyle(j, { visible: !style.visible })}
                        className="p-1 rounded hover:bg-slate-800 transition"
                        title={style.visible ? 'Ẩn đường này' : 'Hiện đường này'}
                      >
                        {style.visible ? (
                          <Eye className="w-3.5 h-3.5 text-sky-400" />
                        ) : (
                          <EyeOff className="w-3.5 h-3.5 text-slate-500" />
                        )}
                      </button>
                      <span className="text-xs font-mono font-bold" style={{ color: style.color }}>
                        Khớp J{j + 1}
                      </span>
                    </div>

                    {/* Preview Stroke Line */}
                    <svg width="60" height="12" className="overflow-visible">
                      <line
                        x1="0"
                        y1="6"
                        x2="60"
                        y2="6"
                        stroke={style.color}
                        strokeWidth={style.lineWidth}
                        strokeDasharray={LINE_STYLE_DASHES[style.lineStyle]}
                      />
                    </svg>
                  </div>

                  {/* Color Picker & Swatches */}
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] font-mono text-slate-400 shrink-0">Màu:</span>
                    <input
                      type="color"
                      value={style.color}
                      onChange={(e) => updateJointStyle(j, { color: e.target.value })}
                      className="w-6 h-6 rounded cursor-pointer border border-slate-700 bg-transparent p-0"
                      title="Chọn màu tự do"
                    />
                    <div className="flex items-center space-x-1 overflow-x-auto py-0.5">
                      {PRESET_COLOR_SWATCHES.slice(0, 6).map((c) => (
                        <button
                          key={c}
                          onClick={() => updateJointStyle(j, { color: c })}
                          style={{ backgroundColor: c }}
                          className={`w-3.5 h-3.5 rounded-full border ${
                            style.color.toLowerCase() === c.toLowerCase()
                              ? 'ring-2 ring-white border-transparent'
                              : 'border-slate-800 hover:scale-110'
                          } transition-transform`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Linewidth and Linestyle Controls */}
                  <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                    {/* Linewidth Stepper */}
                    <div>
                      <span className="text-slate-400 block mb-0.5">Nét ({style.lineWidth}px):</span>
                      <select
                        value={style.lineWidth}
                        onChange={(e) => updateJointStyle(j, { lineWidth: parseFloat(e.target.value) })}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-1.5 py-1 text-slate-200 font-mono text-[11px]"
                      >
                        <option value="1">1.0 px (Mảnh)</option>
                        <option value="1.5">1.5 px</option>
                        <option value="2">2.0 px (Chuẩn)</option>
                        <option value="2.5">2.5 px</option>
                        <option value="3">3.0 px (Đậm)</option>
                        <option value="4">4.0 px (Dày)</option>
                      </select>
                    </div>

                    {/* Linestyle Selector */}
                    <div>
                      <span className="text-slate-400 block mb-0.5">Kiểu nét:</span>
                      <select
                        value={style.lineStyle}
                        onChange={(e) => updateJointStyle(j, { lineStyle: e.target.value as LineStyleType })}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-1.5 py-1 text-slate-200 font-mono text-[11px]"
                      >
                        <option value="solid">Solid (Liền)</option>
                        <option value="dashed">Dashed (Đứt nét)</option>
                        <option value="dotted">Dotted (Chấm bi)</option>
                        <option value="dash-dot">Dash-Dot (Gạch chấm)</option>
                      </select>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Subplots Display Area */}
      <div className="space-y-2.5">
        {layoutMode === 'phase-plane' && renderPhasePlaneSVG()}

        {(layoutMode === 'subplots' || layoutMode === 'positions') &&
          renderSubplotSVG('positions', 'Góc Khớp q(t) - Joint Position', 'deg', posBounds, svgPosRef)}

        {(layoutMode === 'subplots' || layoutMode === 'velocities') &&
          renderSubplotSVG('velocities', 'Vận Tốc Khớp dq/dt - Joint Velocity', 'deg/s', velBounds, svgVelRef)}

        {(layoutMode === 'subplots' || layoutMode === 'accelerations') &&
          renderSubplotSVG('accelerations', 'Gia Tốc Khớp d²q/dt² - Joint Acceleration', 'deg/s²', accBounds, svgAccRef)}
      </div>

      {/* Bottom Legend with Custom Styles */}
      <div className="flex flex-wrap items-center justify-between text-[11px] font-mono text-slate-400 pt-1 border-t border-slate-800">
        <div className="flex items-center space-x-3">
          {Array.from({ length: dof }).map((_, j) => {
            const style = curveStyles[j] || { color: DEFAULT_JOINT_COLORS[j], lineStyle: 'solid', visible: true };
            if (!style.visible) return null;

            return (
              <div key={j} className="flex items-center space-x-1.5">
                <svg width="18" height="6" className="overflow-visible">
                  <line
                    x1="0"
                    y1="3"
                    x2="18"
                    y2="3"
                    stroke={style.color}
                    strokeWidth="2"
                    strokeDasharray={LINE_STYLE_DASHES[style.lineStyle]}
                  />
                </svg>
                <span className="text-slate-300 font-medium">J{j + 1}</span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center space-x-2 text-slate-500">
          <span>• Click trên đồ thị để tua nhanh đến thời điểm t</span>
          <span>• Bấm "Edit Style" để đổi màu, kiểu nét (Solid, Dashed, Dotted) và độ dày</span>
        </div>
      </div>
    </div>
  );
};
