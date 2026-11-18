import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { useRobotStore } from '../../store/robotStore';
import { useTranslation } from '../../i18n';
import { MobileRobotOscilloscope } from './MobileRobotOscilloscope';
import {
  Activity,
  Zap,
  Cpu,
  Maximize2,
  Minimize2,
  ExternalLink,
  X,
  Play,
  Pause,
  RotateCcw,
  Gauge,
  Layers,
} from 'lucide-react';

interface MultiPhysicsOscilloscopeDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export type OscilloscopeTab = 'kinematics' | 'torques' | 'errors' | 'motors' | 'converter';

const ACADEMIC_JOINT_COLORS = [
  '#1f77b4', // J1: Deep Academic Blue
  '#d97706', // J2: Warm Amber / Ochre
  '#059669', // J3: Emerald Green
  '#7c3aed', // J4: Royal Purple
  '#db2777', // J5: Crimson / Rose
  '#ea580c', // J6: Rust Orange
  '#0891b2', // J7: Dark Cyan
];

const CYBER_JOINT_COLORS = [
  '#38bdf8', // J1: Sky
  '#f59e0b', // J2: Amber
  '#10b981', // J3: Emerald
  '#a855f7', // J4: Purple
  '#ec4899', // J5: Pink
  '#f97316', // J6: Orange
  '#06b6d4', // J7: Cyan
];

export const MultiPhysicsOscilloscopeDialog: React.FC<MultiPhysicsOscilloscopeDialogProps> = ({
  isOpen,
  onClose,
}) => {
  const { t, language } = useTranslation();
  const isVi = language === 'vi';
  const {
    activeDomain,
    robotModel,
    activeTrajectory,
    dynamicSamples,
    activeDynamicState,
    trajectoryTorques,
    playbackState,
    seekTrajectoryTime,
    dynamicsSettings,
    startDynamicsSimulation,
    stopDynamicsSimulation,
    resetDynamicsSimulation,
    activeWorkspaceMode,
    uiTheme,
  } = useRobotStore();

  const isLight = uiTheme === 'light';

  const [activeTab, setActiveTab] = useState<OscilloscopeTab>('motors');
  const [selectedJoint, setSelectedJoint] = useState<number | 'all'>('all');
  const [isMaximized, setIsMaximized] = useState<boolean>(false);
  const [isPopoutActive, setIsPopoutActive] = useState<boolean>(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);

  const popoutWindowRef = useRef<Window | null>(null);
  const [popoutContainer, setPopoutContainer] = useState<HTMLElement | null>(null);

  const jointColors = isLight ? ACADEMIC_JOINT_COLORS : CYBER_JOINT_COLORS;

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

  // Synchronize Pop-out child window body class and title when theme or language changes
  useEffect(() => {
    if (popoutWindowRef.current && !popoutWindowRef.current.closed) {
      popoutWindowRef.current.document.documentElement.setAttribute('data-theme', isLight ? 'light' : 'dark');
      popoutWindowRef.current.document.body.className =
        'bg-slate-950 text-slate-100 font-sans select-none overflow-hidden m-0 p-0';
      popoutWindowRef.current.document.title = isVi
        ? 'RoboCAD 3D • Dao Động Ký Đa Miền (Đa Màn Hình)'
        : 'RoboCAD 3D • Multi-Physics Telemetry Oscilloscope (Pop-out Window)';
    }
  }, [isLight, isVi]);

  // Handle Pop-out to Separate Browser Window (Multi-Monitor support)
  const handleOpenPopout = useCallback(() => {
    if (popoutWindowRef.current && !popoutWindowRef.current.closed) {
      popoutWindowRef.current.focus();
      return;
    }

    const popout = window.open(
      '',
      'RoboticsMultiPhysicsOscilloscope',
      'width=1280,height=820,left=120,top=80,resizable=yes,scrollbars=yes'
    );

    if (!popout) {
      alert(
        isVi
          ? 'Trình duyệt đã chặn cửa sổ pop-up. Vui lòng cho phép pop-up để mở đồ thị trên màn hình thứ hai.'
          : 'Browser blocked pop-up window. Please allow pop-ups to open oscilloscope on secondary monitor.'
      );
      return;
    }

    popout.document.documentElement.setAttribute('data-theme', isLight ? 'light' : 'dark');
    popout.document.title = isVi
      ? 'RoboCAD 3D • Dao Động Ký Đa Miền (Đa Màn Hình)'
      : 'RoboCAD 3D • Multi-Physics Telemetry Oscilloscope (Pop-out Window)';

    // Copy all parent stylesheets into child window for full Tailwind support
    document.querySelectorAll('link[rel="stylesheet"], style').forEach((node) => {
      popout.document.head.appendChild(node.cloneNode(true));
    });

    // Theme-sensitive background container (inherits data-theme via index.css)
    popout.document.body.className =
      'bg-slate-950 text-slate-100 font-sans select-none overflow-hidden m-0 p-0';

    const container = popout.document.createElement('div');
    container.id = 'popout-oscilloscope-root';
    container.className = 'w-full h-full';
    popout.document.body.appendChild(container);

    popout.addEventListener('beforeunload', () => {
      setIsPopoutActive(false);
      setPopoutContainer(null);
      popoutWindowRef.current = null;
    });

    popoutWindowRef.current = popout;
    setPopoutContainer(container);
    setIsPopoutActive(true);
  }, [isLight, isVi]);

  const handleClosePopout = useCallback(() => {
    if (popoutWindowRef.current && !popoutWindowRef.current.closed) {
      popoutWindowRef.current.close();
    }
    setIsPopoutActive(false);
    setPopoutContainer(null);
    popoutWindowRef.current = null;
  }, []);

  // Close external window if component unmounts
  useEffect(() => {
    return () => {
      if (popoutWindowRef.current && !popoutWindowRef.current.closed) {
        popoutWindowRef.current.close();
      }
    };
  }, []);

  if (!isOpen) return null;
  if (!robotModel && activeDomain !== 'mobile_robot') return null;

  const dof = robotModel?.dof || 6;
  const totalDuration = activeTrajectory?.totalDuration || 10.0;
  const isDynamicsRunning = dynamicsSettings.isRunning;
  const currentTime =
    isDynamicsRunning && activeDynamicState
      ? activeDynamicState.time % (totalDuration || 1)
      : playbackState.currentTime;

  // Use dynamic samples if available, otherwise reconstruct from trajectory
  const samples =
    dynamicSamples && dynamicSamples.length > 1
      ? dynamicSamples
      : activeTrajectory?.samples.map((s) => ({
          time: s.time,
          qDeg: s.jointAngles,
          qdDeg: s.jointVelocities,
          qddDeg: s.jointAccelerations,
          qDesiredDeg: s.jointAngles,
          errorDeg: new Array(dof).fill(0),
          tau: new Array(dof).fill(0),
          tauGravity: new Array(dof).fill(0),
          tauInertia: new Array(dof).fill(0),
          tauCoriolis: new Array(dof).fill(0),
          kineticEnergy: 0,
          potentialEnergy: 0,
          totalEnergy: 0,
        })) || [];

  const hasData = samples.length > 1;

  // Render SVG Time-Series Chart Component
  const renderSVGChart = (
    title: string,
    unit: string,
    yLabel: string,
    extractValues: (s: any, jointIndex: number) => number,
    referenceLine?: { val: number; label: string; color: string },
    yRangeManual?: [number, number]
  ) => {
    const width = 960;
    const height = 220;
    const padL = 65;
    const padR = 30;
    const padT = 25;
    const padB = 30;
    const plotW = width - padL - padR;
    const plotH = height - padT - padB;

    if (!hasData) {
      return (
        <div className="w-full h-48 flex items-center justify-center rounded-xl border font-mono text-xs bg-slate-900 border-slate-800 text-slate-400">
          {isVi
            ? 'Chưa có dữ liệu chuỗi thời gian. Hãy nhấn "Mô phỏng" hoặc "Phát quỹ đạo" để ghi nhận tín hiệu.'
            : 'No time-series data recorded. Press "Simulate" or "Play Trajectory" to capture waveforms.'}
        </div>
      );
    }

    const tMax = Math.max(0.1, samples[samples.length - 1].time || totalDuration);

    // Compute min / max
    let minVal = Infinity;
    let maxVal = -Infinity;

    for (let k = 0; k < samples.length; k++) {
      const s = samples[k];
      if (selectedJoint === 'all') {
        for (let j = 0; j < dof; j++) {
          const v = extractValues(s, j);
          if (!isNaN(v)) {
            if (v < minVal) minVal = v;
            if (v > maxVal) maxVal = v;
          }
        }
      } else {
        const v = extractValues(s, selectedJoint);
        if (!isNaN(v)) {
          if (v < minVal) minVal = v;
          if (v > maxVal) maxVal = v;
        }
      }
    }

    if (referenceLine) {
      if (referenceLine.val < minVal) minVal = referenceLine.val;
      if (referenceLine.val > maxVal) maxVal = referenceLine.val;
    }

    if (yRangeManual) {
      minVal = Math.min(minVal, yRangeManual[0]);
      maxVal = Math.max(maxVal, yRangeManual[1]);
    }

    if (minVal === Infinity || maxVal === -Infinity) {
      minVal = -1;
      maxVal = 1;
    }

    const span = Math.max(0.01, maxVal - minVal);
    const yMinPadded = minVal - 0.12 * span;
    const yMaxPadded = maxVal + 0.12 * span;
    const ySpanPadded = Math.max(0.01, yMaxPadded - yMinPadded);

    const getX = (t: number) => padL + (Math.max(0, Math.min(tMax, t)) / tMax) * plotW;
    const getY = (val: number) => padT + plotH - ((val - yMinPadded) / ySpanPadded) * plotH;

    const zeroY = getY(0);
    const cursorX = getX(currentTime);

    // Generate paths
    const linesToDraw: { joint: number; path: string; color: string }[] = [];
    if (selectedJoint === 'all') {
      for (let j = 0; j < dof; j++) {
        let d = '';
        for (let k = 0; k < samples.length; k++) {
          const s = samples[k];
          const v = extractValues(s, j);
          const x = getX(s.time);
          const y = getY(isNaN(v) ? 0 : v);
          d += k === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
        }
        linesToDraw.push({ joint: j, path: d, color: jointColors[j % jointColors.length] });
      }
    } else {
      let d = '';
      for (let k = 0; k < samples.length; k++) {
        const s = samples[k];
        const v = extractValues(s, selectedJoint);
        const x = getX(s.time);
        const y = getY(isNaN(v) ? 0 : v);
        d += k === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
      }
      linesToDraw.push({ joint: selectedJoint, path: d, color: jointColors[selectedJoint % jointColors.length] });
    }

    // Y ticks
    const yTicks = [
      yMaxPadded - 0.12 * span,
      (yMinPadded + yMaxPadded) / 2,
      yMinPadded + 0.12 * span,
    ];

    return (
      <div className="border rounded-xl p-3 shadow-sm flex flex-col mb-3 transition-colors bg-slate-950 border-slate-800 text-slate-100">
        <div className="flex items-center justify-between mb-1.5 px-2">
          <div className="flex items-center space-x-2">
            <span
              className={`text-xs font-bold ${
                isLight ? 'text-slate-100 font-serif' : 'text-slate-100 font-mono'
              }`}
            >
              {title}
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border bg-slate-800 text-slate-300 border-slate-700">
              {unit}
            </span>
          </div>

          <div className="flex items-center space-x-3 text-[11px] font-mono">
            {selectedJoint !== 'all' ? (
              <span className={`font-bold ${isLight ? 'text-sky-600' : 'text-sky-300'}`}>
                {isVi ? `J${selectedJoint + 1} hiện thời:` : `Current J${selectedJoint + 1}:`}{' '}
                {extractValues(
                  samples[Math.min(samples.length - 1, Math.floor((currentTime / tMax) * (samples.length - 1)))],
                  selectedJoint
                )?.toFixed(3)}{' '}
                {unit}
              </span>
            ) : (
              <span className="text-slate-400">
                {isVi ? `Hiển thị tất cả ${dof} khớp` : `Displaying all ${dof} joints`}
              </span>
            )}
          </div>
        </div>

        <svg
          viewBox={`0 0 ${width} ${height}`}
          className={`w-full h-auto select-none block cursor-crosshair rounded-lg overflow-hidden border ${
            isLight ? 'bg-white border-slate-200' : 'bg-[#060810] border-slate-800'
          }`}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const normX = (clickX / rect.width) * width;
            const clamped = Math.max(padL, Math.min(padL + plotW, normX));
            const t = ((clamped - padL) / plotW) * tMax;
            seekTrajectoryTime(t);
          }}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const normX = (clickX / rect.width) * width;
            const clamped = Math.max(padL, Math.min(padL + plotW, normX));
            const t = ((clamped - padL) / plotW) * tMax;
            setHoverTime(t);
          }}
          onMouseLeave={() => setHoverTime(null)}
        >
          {/* Plot Background */}
          <rect
            x={padL}
            y={padT}
            width={plotW}
            height={plotH}
            fill={isLight ? '#ffffff' : '#070a13'}
            stroke={isLight ? '#cbd5e1' : 'none'}
            strokeWidth={isLight ? '1' : '0'}
          />

          {/* Grid lines */}
          <line
            x1={padL}
            y1={padT}
            x2={padL + plotW}
            y2={padT}
            stroke={isLight ? '#e2e8f0' : '#1e293b'}
            strokeDasharray="2 3"
          />
          <line
            x1={padL}
            y1={padT + plotH / 2}
            x2={padL + plotW}
            y2={padT + plotH / 2}
            stroke={isLight ? '#e2e8f0' : '#1e293b'}
            strokeDasharray="2 3"
          />
          <line
            x1={padL}
            y1={padT + plotH}
            x2={padL + plotW}
            y2={padT + plotH}
            stroke={isLight ? '#e2e8f0' : '#1e293b'}
            strokeDasharray="2 3"
          />

          {/* Zero baseline */}
          {zeroY >= padT && zeroY <= padT + plotH && (
            <line
              x1={padL}
              y1={zeroY}
              x2={padL + plotW}
              y2={zeroY}
              stroke={isLight ? '#475569' : '#334155'}
              strokeWidth="1.2"
            />
          )}

          {/* Reference line */}
          {referenceLine && (
            <g>
              <line
                x1={padL}
                y1={getY(referenceLine.val)}
                x2={padL + plotW}
                y2={getY(referenceLine.val)}
                stroke={referenceLine.color}
                strokeWidth="1.5"
                strokeDasharray="4 3"
              />
              <text
                x={padL + plotW - 6}
                y={getY(referenceLine.val) - 4}
                textAnchor="end"
                fill={referenceLine.color}
                fontSize="9"
                fontFamily={isLight ? "'Times New Roman', Times, serif" : 'monospace'}
                fontWeight="bold"
              >
                {referenceLine.label} ({referenceLine.val})
              </text>
            </g>
          )}

          {/* Payload Zone Shading (3.5s to 7.5s) */}
          {tMax >= 3.5 && (
            <rect
              x={getX(3.5)}
              y={padT}
              width={Math.max(0, getX(Math.min(tMax, 7.5)) - getX(3.5))}
              height={plotH}
              fill={isLight ? '#000000' : '#ffffff'}
              opacity={isLight ? '0.03' : '0.04'}
            />
          )}

          {/* Dynamic Curve Lines */}
          {linesToDraw.map((line) => (
            <path
              key={line.joint}
              d={line.path}
              fill="none"
              stroke={line.color}
              strokeWidth="2.0"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}

          {/* Current Time Cursor Line */}
          <line
            x1={cursorX}
            y1={padT}
            x2={cursorX}
            y2={padT + plotH}
            stroke="#dc2626"
            strokeWidth="1.8"
            strokeDasharray="4 2"
          />

          {/* Hover Time Cursor Line */}
          {hoverTime !== null && (
            <line
              x1={getX(hoverTime)}
              y1={padT}
              x2={getX(hoverTime)}
              y2={padT + plotH}
              stroke="#0284c7"
              strokeWidth="1.0"
              strokeDasharray="2 2"
              opacity="0.8"
            />
          )}

          {/* Axis Labels & Y Ticks */}
          {yTicks.map((val, idx) => {
            const yPos = getY(val);
            if (yPos < padT - 5 || yPos > padT + plotH + 5) return null;
            return (
              <g key={idx}>
                <text
                  x={padL - 8}
                  y={yPos + 3.5}
                  textAnchor="end"
                  fill={isLight ? '#0f172a' : '#64748b'}
                  fontSize="9"
                  fontFamily={isLight ? "'Times New Roman', Times, serif" : 'monospace'}
                  fontWeight={isLight ? '600' : 'normal'}
                >
                  {val.toFixed(Math.abs(val) < 1 ? 2 : 1)}
                </text>
              </g>
            );
          })}

          <text
            x={padL - 10}
            y={padT - 8}
            textAnchor="start"
            fill={isLight ? '#0f172a' : '#94a3b8'}
            fontSize="9.5"
            fontFamily={isLight ? "'Times New Roman', Times, serif" : 'monospace'}
            fontWeight="bold"
          >
            {yLabel}
          </text>

          <text
            x={padL + plotW}
            y={padT + plotH + 18}
            textAnchor="end"
            fill={isLight ? '#0f172a' : '#64748b'}
            fontSize="9"
            fontFamily={isLight ? "'Times New Roman', Times, serif" : 'monospace'}
            fontWeight={isLight ? '600' : 'normal'}
          >
            {isVi
              ? `Thời gian t [s] (Tổng: ${tMax.toFixed(2)}s)`
              : `Time t [s] (Total: ${tMax.toFixed(2)}s)`}
          </text>
        </svg>
      </div>
    );
  };

  // Content Body of the Oscilloscope
  const dialogContent = (
    <div className="flex flex-col h-full select-none overflow-hidden border rounded-2xl shadow-2xl transition-colors bg-slate-950 text-slate-100 border-slate-800">
      {/* Top Header Bar */}
      <div className="h-13 px-4 border-b flex items-center justify-between shrink-0 bg-slate-900 border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-500 shadow-sm">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-bold text-slate-100">
                {isVi ? 'Bộ Dao Động Ký & Phân Tích Vật Lý Đa Miền' : 'Multi-Physics Telemetry & Oscilloscope Studio'}
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border font-semibold bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-500/30">
                Multi-Physics Scope (500 Hz RK4 + 10 kHz FOC)
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              {isVi
                ? 'Quan sát thời gian thực: Động học, Mô-men RNE, Dòng điện Stator Iq, Điện áp Bus DC & Nhiệt độ Biến tần'
                : 'Real-time telemetry: Kinematics, RNE Torques, Stator Current Iq, DC-Bus Voltage & Inverter Thermal Dynamics'}
            </p>
          </div>
        </div>

        {/* Window Action Buttons */}
        <div className="flex items-center space-x-2">
          {/* Pop-out to Separate Window (Multi-Monitor) Button */}
          {!isPopoutActive ? (
            <button
              onClick={handleOpenPopout}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono font-medium transition shadow-sm bg-sky-600/20 hover:bg-sky-600/30 text-sky-600 dark:text-sky-300 border-sky-500/30"
              title={
                isVi
                  ? 'Mở cửa sổ đồ thị rời ra màn hình thứ hai (Multi-Monitor Pop-out)'
                  : 'Pop-out to separate window for multi-monitor inspection'
              }
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>{isVi ? 'Mở Cửa Sổ Rời (Đa Màn Hình)' : 'Pop-out Window'}</span>
            </button>
          ) : (
            <button
              onClick={handleClosePopout}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono font-medium transition shadow-sm bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-600 dark:text-emerald-300 border-emerald-500/30"
              title={isVi ? 'Thu về cửa sổ chính' : 'Dock back to main window'}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>{isVi ? 'Gắn lại Cửa Sổ Chính' : 'Dock to Main'}</span>
            </button>
          )}

          {/* Maximize Toggle */}
          <button
            onClick={() => setIsMaximized(!isMaximized)}
            className="p-1.5 rounded-lg transition text-slate-400 hover:text-slate-100 hover:bg-slate-800"
            title={
              isMaximized
                ? isVi
                  ? 'Thu nhỏ kích thước'
                  : 'Restore size'
                : isVi
                ? 'Phóng to toàn màn hình'
                : 'Maximize window'
            }
          >
            {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Close Dialog */}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition text-slate-400 hover:text-rose-500 hover:bg-rose-500/10"
            title={t.common.close}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Navigation Tabs & Filter Bar */}
      <div className="px-4 py-2 border-b flex items-center justify-between text-xs font-mono shrink-0 gap-3 bg-slate-900 border-slate-800">
        {/* Category Tabs */}
        <div className="flex items-center space-x-1.5 overflow-x-auto">
          <button
            onClick={() => setActiveTab('motors')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition ${
              activeTab === 'motors'
                ? 'bg-purple-600/30 text-purple-700 dark:text-purple-200 border border-purple-500 font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
            }`}
          >
            <Cpu className="w-3.5 h-3.5 text-purple-500" />
            <span>{isVi ? 'Động Cơ & Dòng Điện (I_q, RPM, P)' : 'Motor Currents & Power (I_q, RPM, P)'}</span>
          </button>

          <button
            onClick={() => setActiveTab('converter')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition ${
              activeTab === 'converter'
                ? 'bg-amber-600/30 text-amber-700 dark:text-amber-200 border border-amber-500 font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span>{isVi ? 'Biến Tần & Bus DC (V_dc, T_j, P_net)' : 'Inverter & DC Bus (V_dc, T_j, P_net)'}</span>
          </button>

          <button
            onClick={() => setActiveTab('torques')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition ${
              activeTab === 'torques'
                ? 'bg-sky-600/30 text-sky-700 dark:text-sky-200 border border-sky-500 font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
            }`}
          >
            <Gauge className="w-3.5 h-3.5 text-sky-500" />
            <span>{isVi ? 'Mô-men Khớp (τ_act, τ_g, τ_inert)' : 'Joint Torques (τ_act, τ_g, τ_inert)'}</span>
          </button>

          <button
            onClick={() => setActiveTab('kinematics')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition ${
              activeTab === 'kinematics'
                ? 'bg-emerald-600/30 text-emerald-700 dark:text-emerald-200 border border-emerald-500 font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-emerald-500" />
            <span>{isVi ? 'Động Học (Góc q, Vận tốc, Gia tốc)' : 'Kinematics (Position q, Velocity, Accel)'}</span>
          </button>

          <button
            onClick={() => setActiveTab('errors')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition ${
              activeTab === 'errors'
                ? 'bg-rose-600/30 text-rose-700 dark:text-rose-200 border border-rose-500 font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-rose-500" />
            <span>{isVi ? 'Sai Số Bám Quỹ Đạo e(t)' : 'Trajectory Tracking Errors e(t)'}</span>
          </button>
        </div>

        {/* Joint Selector Pills */}
        <div className="flex items-center space-x-1 shrink-0">
          <span className="text-[10px] mr-1 hidden sm:inline text-slate-400">
            {isVi ? 'Khớp:' : 'Joint:'}
          </span>
          <button
            onClick={() => setSelectedJoint('all')}
            className={`px-2 py-0.5 rounded text-[11px] transition ${
              selectedJoint === 'all'
                ? 'bg-sky-600 text-white font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
            }`}
          >
            {isVi ? 'Tất cả' : 'All'}
          </button>
          {Array.from({ length: dof }).map((_, j) => (
            <button
              key={j}
              onClick={() => setSelectedJoint(j)}
              style={{
                borderColor: selectedJoint === j ? jointColors[j % jointColors.length] : 'transparent',
              }}
              className={`px-2 py-0.5 rounded border text-[11px] transition ${
                selectedJoint === j
                  ? 'bg-slate-800 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800 border-transparent'
              }`}
            >
              <span style={{ color: jointColors[j % jointColors.length] }}>J{j + 1}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Plot Scrollable Area */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-4">
        {/* TAB 1: MOTORS (DÒNG ĐIỆN VÀ TRUYỀN ĐỘNG ĐỘNG CƠ) */}
        {activeTab === 'motors' && (
          <div className="space-y-4">
            <div
              className={`p-3 rounded-xl flex items-center justify-between text-xs font-mono border ${
                isLight
                  ? 'bg-purple-50 border-purple-200 text-purple-900'
                  : 'bg-purple-950/20 border-purple-500/20 text-purple-200'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Cpu className="w-4 h-4 text-purple-500 shrink-0" />
                <span>
                  {isVi
                    ? 'Đặc tính dòng điện động cơ PMSM FOC: Dòng Iq sinh mô-men trục, tốc độ RPM và phân bố công suất điện/cơ qua từng khớp.'
                    : 'PMSM FOC Motor Dynamics: Torque-producing Iq current, rotor mechanical speed, and power distribution across joints.'}
                </span>
              </div>
              <span className={`text-[10px] ${isLight ? 'text-purple-700' : 'text-purple-400'}`}>
                {isVi
                  ? 'Phân cỡ: J1-J2 ILM 70x18 | J3 ILM 70x10 | J4-J6 ILM 38'
                  : 'Sizing: J1-J2 ILM 70x18 | J3 ILM 70x10 | J4-J6 ILM 38'}
              </span>
            </div>

            {renderSVGChart(
              isVi
                ? 'Dòng điện Pha Stator I_q(t) [A] (Dòng tạo mô-men từ)'
                : 'Stator Phase Current I_q(t) [A] (Torque-Producing Current)',
              'A',
              'I_q [A]',
              (s, j) => s.motorStates?.[j]?.currentA || (s.tau?.[j] ? s.tau[j] / 12.0 : 0)
            )}

            {renderSVGChart(
              isVi ? 'Tốc độ Cơ học Rotor Động cơ [RPM]' : 'Motor Rotor Mechanical Speed [RPM]',
              'RPM',
              'Speed [RPM]',
              (s, j) => s.motorStates?.[j]?.rotorSpeedRpm || ((s.qdDeg?.[j] || 0) * (100 / 6))
            )}

            {renderSVGChart(
              isVi
                ? 'Công suất Điện Tiêu thụ Động cơ P_elec [W]'
                : 'Motor Electrical Power Consumption P_elec [W]',
              'W',
              'Power [W]',
              (s, j) => s.motorStates?.[j]?.powerElectricalW || 0
            )}
          </div>
        )}

        {/* TAB 2: POWER CONVERTER & SHARED DC BUS */}
        {activeTab === 'converter' && (
          <div className="space-y-4">
            <div
              className={`p-3 rounded-xl flex items-center justify-between text-xs font-mono border ${
                isLight
                  ? 'bg-amber-50 border-amber-200 text-amber-900'
                  : 'bg-amber-950/20 border-amber-500/20 text-amber-200'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Zap className="w-4 h-4 text-amber-500 shrink-0" />
                <span>
                  {isVi
                    ? 'Động thái Điện tử Công suất Bus DC 48V: Sụt áp khi tăng tốc mang tải, dâng áp khi hãm tái sinh & nhiệt độ mối nối IGBT/MOSFET.'
                    : '48V DC-Bus Power Electronics: Voltage sag during acceleration, regenerative boost & IGBT/MOSFET junction temperature.'}
                </span>
              </div>
              <span className={`text-[10px] ${isLight ? 'text-amber-700' : 'text-amber-400'}`}>
                {isVi
                  ? 'Bộ xả hãm Chopper: 4.7 Ω (Kích hoạt khi V_dc > 56V)'
                  : 'Braking Chopper: 4.7 Ω (Fires when V_dc > 56V)'}
              </span>
            </div>

            {renderSVGChart(
              isVi
                ? 'Điện áp Bus DC Dùng chung V_dc(t) [V] (Tụ bù 4700 µF)'
                : 'Shared DC-Bus Voltage V_dc(t) [V] (4700 µF Cap Bank)',
              'V',
              'V_dc [V]',
              (s) => s.dcBusState?.voltageV || 48.0,
              { val: 48.0, label: 'Nominal 48V', color: '#10b981' },
              [46.0, 50.0]
            )}

            {renderSVGChart(
              isVi
                ? 'Công suất Toàn hệ thống Inverter & Hãm tái sinh [W]'
                : 'Total Inverter System & Regenerative Braking Power [W]',
              'W',
              'Power [W]',
              (s) => s.dcBusState?.totalPowerW || 0
            )}

            {renderSVGChart(
              isVi
                ? 'Nhiệt độ Mối nối Bán dẫn Inverter T_j [°C] (Trục vai J2 mang tải)'
                : 'Inverter Semiconductor Junction Temp T_j [°C] (Loaded Shoulder J2)',
              '°C',
              'Temp [°C]',
              (s, j) => s.dcBusState?.axisStates?.[j]?.junctionTemperatureC || (45.0 + ((s.tau?.[j] || 0) ** 2) * 0.002),
              { val: 85.0, label: isVi ? 'Ngưỡng Cảnh báo 85°C' : 'Warning Threshold 85°C', color: '#ef4444' }
            )}
          </div>
        )}

        {/* TAB 3: TORQUES & DYNAMICS */}
        {activeTab === 'torques' && (
          <div className="space-y-4">
            <div
              className={`p-3 rounded-xl flex items-center justify-between text-xs font-mono border ${
                isLight
                  ? 'bg-sky-50 border-sky-200 text-sky-900'
                  : 'bg-sky-950/20 border-sky-500/20 text-sky-200'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Gauge className="w-4 h-4 text-sky-500 shrink-0" />
                <span>
                  {isVi
                    ? 'Phân rã Mô-men động học RNE: Mô-men tác động thực tế τ_act đối chiếu với thành phần trọng trường τ_g và quán tính τ_inert.'
                    : 'RNE Dynamic Torque Decomposition: Actuated torque τ_act compared against gravity compensation g(q) and inertial acceleration M(q)·qdd.'}
                </span>
              </div>
              <span className={`text-[10px] ${isLight ? 'text-sky-700' : 'text-sky-400'}`}>
                {isVi ? 'Bao gồm quán tính quy đổi rotor N^2*J_m' : 'Includes reflected rotor inertia N²·J_m'}
              </span>
            </div>

            {renderSVGChart(
              isVi ? 'Mô-men Điều khiển Trục Khớp τ_act(t) [N·m]' : 'Actuated Joint Dynamic Torques τ_act(t) [N·m]',
              'N·m',
              'Torque [N·m]',
              (s, j) => s.tau?.[j] || 0
            )}

            {renderSVGChart(
              isVi ? 'Thành phần Trọng lực Bù trừ g_i(q) [N·m]' : 'Gravity Compensation Component g_i(q) [N·m]',
              'N·m',
              'Gravity [N·m]',
              (s, j) => s.tauGravity?.[j] || 0
            )}

            {renderSVGChart(
              isVi ? 'Thành phần Quán tính Gia tốc M_ij * qdd [N·m]' : 'Inertial Acceleration Component M_ij · d²q/dt² [N·m]',
              'N·m',
              'Inertia [N·m]',
              (s, j) => s.tauInertia?.[j] || 0
            )}
          </div>
        )}

        {/* TAB 4: KINEMATICS */}
        {activeTab === 'kinematics' && (
          <div className="space-y-4">
            {renderSVGChart(
              isVi ? 'Góc Khớp q_i(t) [deg]' : 'Joint Position Angle q_i(t) [deg]',
              '°',
              'Angle [°]',
              (s, j) => s.qDeg?.[j] || 0
            )}

            {renderSVGChart(
              isVi ? 'Vận tốc Góc Khớp qdot_i(t) [deg/s]' : 'Joint Angular Velocities dq/dt [deg/s]',
              '°/s',
              'Velocity [°/s]',
              (s, j) => s.qdDeg?.[j] || 0
            )}

            {renderSVGChart(
              isVi ? 'Gia tốc Góc Khớp qddot_i(t) [deg/s²]' : 'Joint Angular Acceleration d²q/dt² [deg/s²]',
              '°/s²',
              'Accel [°/s²]',
              (s, j) => s.qddDeg?.[j] || 0
            )}
          </div>
        )}

        {/* TAB 5: ERRORS */}
        {activeTab === 'errors' && (
          <div className="space-y-4">
            <div
              className={`p-3 rounded-xl flex items-center justify-between text-xs font-mono border ${
                isLight
                  ? 'bg-rose-50 border-rose-200 text-rose-900'
                  : 'bg-rose-950/20 border-rose-500/20 text-rose-200'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Layers className="w-4 h-4 text-rose-500 shrink-0" />
                <span>
                  {isVi
                    ? 'Sai số bám quỹ đạo e_i(t) = q_des - q_act: Quan sát độ võng tĩnh khi mang tải 3.5 kg tại t ∈ [3.5s, 7.5s].'
                    : 'Trajectory Tracking Error e_i(t) = q_des - q_act: Observe static deflection under 3.5 kg payload at t ∈ [3.5s, 7.5s].'}
                </span>
              </div>
            </div>

            {renderSVGChart(
              isVi ? 'Sai số Bám Vị trí Góc Khớp e(t) [deg]' : 'Joint Position Tracking Errors e(t) [deg]',
              '°',
              'Error [°]',
              (s, j) => s.errorDeg?.[j] || 0
            )}

            {renderSVGChart(
              isVi
                ? 'Mặt Trượt / Biến Trạng Thái Suy Rộng s(t) = e_dot + λ*e'
                : 'Sliding Surface / Generalized State s(t) = ė + λ·e [rad/s]',
              'rad/s',
              'Sliding [rad/s]',
              (s, j) => s.slidingSurface?.[j] || 0
            )}
          </div>
        )}
      </div>

      {/* Synchronized Timeline Scrubber & Transport Footer */}
      <div className="h-14 px-4 border-t flex items-center justify-between shrink-0 gap-4 bg-slate-900 border-slate-800 text-slate-100">
        {/* Play / Pause / Reset Transport */}
        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={() => {
              if (activeWorkspaceMode === 'dynamics') {
                if (isDynamicsRunning) stopDynamicsSimulation();
                else startDynamicsSimulation();
              } else {
                if (playbackState.isPlaying) useRobotStore.getState().pauseTrajectory();
                else useRobotStore.getState().playTrajectory();
              }
            }}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-mono font-bold shadow transition"
          >
            {isDynamicsRunning || playbackState.isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>{isVi ? 'Tạm dừng' : 'Pause'}</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{isVi ? 'Mô phỏng' : 'Simulate'}</span>
              </>
            )}
          </button>

          <button
            onClick={() => {
              if (activeWorkspaceMode === 'dynamics') resetDynamicsSimulation();
              else seekTrajectoryTime(0);
            }}
            className="p-1.5 rounded-lg border transition bg-slate-800 text-slate-300 hover:text-slate-100 border-slate-700"
            title={isVi ? 'Khôi phục trạng thái ban đầu' : 'Reset to initial state'}
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Real-time Scrubber Slider */}
        <div className="flex-1 flex items-center space-x-3">
          <span className="text-xs font-mono shrink-0 text-slate-400">
            {currentTime.toFixed(2)}s / {totalDuration.toFixed(2)}s
          </span>
          <input
            type="range"
            min={0}
            max={totalDuration}
            step={0.01}
            value={currentTime}
            onChange={(e) => seekTrajectoryTime(parseFloat(e.target.value))}
            className="flex-1 h-1.5 rounded-lg appearance-none cursor-pointer bg-slate-800 accent-sky-500"
          />
        </div>

        {/* Status Indicators */}
        <div className="hidden md:flex items-center space-x-3 text-[11px] font-mono shrink-0 text-slate-400">
          <span className="flex items-center space-x-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>500 Hz RK4</span>
          </span>
          <span>•</span>
          <span className="text-purple-600 dark:text-purple-300 font-bold">FOC 10 kHz</span>
          <span>•</span>
          <span className="text-amber-600 dark:text-amber-300 font-bold">DC 48V</span>
        </div>
      </div>
    </div>
  );

  const mobileDialogContent = (
    <div className="flex flex-col h-full select-none overflow-hidden border rounded-2xl shadow-2xl transition-colors bg-slate-950 text-slate-100 border-slate-800">
      {/* Top Header Bar */}
      <div className="h-14 px-4 border-b flex items-center justify-between shrink-0 bg-slate-900 border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-500 shadow-sm">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-bold text-slate-100">
                {isVi ? 'Bộ Dao Động Ký AMR & Hệ Đa Vật Lý AGV' : 'AMR & AGV Multi-Physics Telemetry Oscilloscope'}
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border font-semibold bg-sky-500/20 text-sky-700 dark:text-sky-300 border-sky-500/30">
                Multi-Physics Scope (20 kHz SPWM + Pacejka Tire + Dual Caster)
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              {isVi
                ? 'Quan sát thời gian thực: Vận tốc Thân xe, Dual-PMSM dq, Lực kéo Lốp Pacejka, Tải trọng Pháp tuyến Fz, Bánh Caster & Tư thế 3D'
                : 'Real-time observation: Chassis Velocities, Dual-PMSM dq, Pacejka Traction, Dynamic Normal Loads Fz, Caster Dynamics & 3D Attitude'}
            </p>
          </div>
        </div>

        {/* Window Action Buttons */}
        <div className="flex items-center space-x-2">
          {!isPopoutActive ? (
            <button
              onClick={handleOpenPopout}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono font-medium transition shadow-sm bg-sky-600/20 hover:bg-sky-600/30 text-sky-600 dark:text-sky-300 border-sky-500/30"
              title={
                isVi
                  ? 'Mở cửa sổ đồ thị rời ra màn hình thứ hai (Multi-Monitor Pop-out)'
                  : 'Pop-out to separate window for multi-monitor inspection'
              }
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>{isVi ? 'Mở Cửa Sổ Rời (Đa Màn Hình)' : 'Pop-out Window'}</span>
            </button>
          ) : (
            <button
              onClick={handleClosePopout}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono font-medium transition shadow-sm bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-600 dark:text-emerald-300 border-emerald-500/30"
              title={isVi ? 'Thu về cửa sổ chính' : 'Dock back to main window'}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>{isVi ? 'Gắn lại Cửa Sổ Chính' : 'Dock to Main'}</span>
            </button>
          )}

          {/* Maximize Toggle */}
          <button
            onClick={() => setIsMaximized(!isMaximized)}
            className="p-1.5 rounded-lg transition text-slate-400 hover:text-slate-100 hover:bg-slate-800"
            title={
              isMaximized
                ? isVi
                  ? 'Thu nhỏ kích thước'
                  : 'Restore size'
                : isVi
                ? 'Phóng to toàn màn hình'
                : 'Maximize window'
            }
          >
            {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Close Dialog */}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition text-slate-400 hover:text-rose-500 hover:bg-rose-500/10"
            title={t.common.close}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mobile Oscilloscope Body */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        <MobileRobotOscilloscope />
      </div>
    </div>
  );

  const activeContent = activeDomain === 'mobile_robot' ? mobileDialogContent : dialogContent;

  // If pop-out is active to external multi-monitor window, render via React Portal into child window body
  if (isPopoutActive && popoutContainer) {
    return ReactDOM.createPortal(activeContent, popoutContainer);
  }

  // Normal In-App Modal / Dialog
  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 transition-all ${
        isMaximized ? 'p-0' : 'p-4 md:p-8'
      }`}
    >
      <div
        className={`w-full h-full transition-all duration-150 ${
          isMaximized ? 'max-w-none max-h-none rounded-none' : 'max-w-6xl max-h-[90vh]'
        }`}
      >
        {activeContent}
      </div>
    </div>
  );
};
