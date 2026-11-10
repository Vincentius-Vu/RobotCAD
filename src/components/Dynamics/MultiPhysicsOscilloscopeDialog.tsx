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
  } = useRobotStore();

  const [activeTab, setActiveTab] = useState<OscilloscopeTab>('motors');
  const [selectedJoint, setSelectedJoint] = useState<number | 'all'>('all');
  const [isMaximized, setIsMaximized] = useState<boolean>(false);
  const [isPopoutActive, setIsPopoutActive] = useState<boolean>(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);

  const popoutWindowRef = useRef<Window | null>(null);
  const [popoutContainer, setPopoutContainer] = useState<HTMLElement | null>(null);

  const jointColors = [
    '#38bdf8', // J1: Sky
    '#f59e0b', // J2: Amber
    '#10b981', // J3: Emerald
    '#a855f7', // J4: Purple
    '#ec4899', // J5: Pink
    '#f97316', // J6: Orange
    '#06b6d4', // J7: Cyan
  ];

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
      alert(language === 'vi' ? 'Trình duyệt đã chặn cửa sổ pop-up. Vui lòng cho phép pop-up để mở đồ thị trên màn hình thứ hai.' : 'Browser blocked pop-up window. Please allow pop-ups to open oscilloscope on secondary monitor.');
      return;
    }

    popout.document.title = language === 'vi' ? 'RoboCAD 3D • Multi-Physics Telemetry Oscilloscope (Đa Màn Hình)' : 'RoboCAD 3D • Multi-Physics Telemetry Oscilloscope (Pop-out Window)';

    // Copy all parent stylesheets into child window for full Tailwind support
    document.querySelectorAll('link[rel="stylesheet"], style').forEach((node) => {
      popout.document.head.appendChild(node.cloneNode(true));
    });

    // Dark background container
    popout.document.body.className = 'bg-slate-950 text-slate-100 font-sans select-none overflow-hidden m-0 p-0';
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
  }, []);

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
        <div className="w-full h-48 flex items-center justify-center bg-slate-950/80 rounded-xl border border-slate-800 text-slate-500 font-mono text-xs">
          {language === 'vi' ? 'Chưa có dữ liệu chuỗi thời gian. Hãy nhấn "Mô phỏng" hoặc "Phát quỹ đạo" để ghi nhận tín hiệu.' : 'No time-series data recorded. Press "Simulate" or "Play Trajectory" to capture waveforms.'}
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
      <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3 shadow-md flex flex-col mb-3">
        <div className="flex items-center justify-between mb-1.5 px-2">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-mono font-bold text-slate-200">{title}</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
              {unit}
            </span>
          </div>

          <div className="flex items-center space-x-3 text-[11px] font-mono">
            {selectedJoint !== 'all' ? (
              <span className="text-sky-300 font-bold">
                J{selectedJoint + 1} hiện thời: {extractValues(samples[Math.min(samples.length - 1, Math.floor((currentTime / tMax) * (samples.length - 1)))], selectedJoint)?.toFixed(3)} {unit}
              </span>
            ) : (
              <span className="text-slate-400">
                Hiển thị tất cả 6 khớp
              </span>
            )}
          </div>
        </div>

        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto select-none block cursor-crosshair rounded-lg overflow-hidden bg-[#060810]"
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
          <rect x={padL} y={padT} width={plotW} height={plotH} fill="#070a13" />

          {/* Grid lines */}
          <line x1={padL} y1={padT} x2={padL + plotW} y2={padT} stroke="#1e293b" strokeDasharray="3 3" />
          <line x1={padL} y1={padT + plotH / 2} x2={padL + plotW} y2={padT + plotH / 2} stroke="#1e293b" strokeDasharray="3 3" />
          <line x1={padL} y1={padT + plotH} x2={padL + plotW} y2={padT + plotH} stroke="#1e293b" strokeDasharray="3 3" />

          {/* Zero baseline */}
          {zeroY >= padT && zeroY <= padT + plotH && (
            <line x1={padL} y1={zeroY} x2={padL + plotW} y2={zeroY} stroke="#334155" strokeWidth="1.2" />
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
                fontFamily="monospace"
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
              fill="#ffffff"
              opacity="0.04"
            />
          )}

          {/* Dynamic Curve Lines */}
          {linesToDraw.map((line) => (
            <path
              key={line.joint}
              d={line.path}
              fill="none"
              stroke={line.color}
              strokeWidth="1.8"
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
            stroke="#ef4444"
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
              stroke="#38bdf8"
              strokeWidth="1.0"
              strokeDasharray="2 2"
              opacity="0.7"
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
                  fill="#64748b"
                  fontSize="9"
                  fontFamily="monospace"
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
            fill="#94a3b8"
            fontSize="9.5"
            fontFamily="monospace"
            fontWeight="bold"
          >
            {yLabel}
          </text>

          <text
            x={padL + plotW}
            y={padT + plotH + 18}
            textAnchor="end"
            fill="#64748b"
            fontSize="9"
            fontFamily="monospace"
          >
            Thời gian t [s] (Tổng: {tMax.toFixed(2)}s)
          </text>
        </svg>
      </div>
    );
  };

  // Content Body of the Oscilloscope
  const dialogContent = (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 select-none overflow-hidden border border-slate-800 rounded-2xl shadow-2xl">
      {/* Top Header Bar */}
      <div className="h-13 px-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-400 shadow-sm">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-bold text-slate-100">
                {language === 'vi' ? 'Bộ Dao Động Ký & Phân Tích Vật Lý Đa Miền' : 'Multi-Physics Telemetry & Oscilloscope Studio'}
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-semibold">
                Multi-Physics Scope (500 Hz RK4 + 10 kHz FOC)
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              {language === 'vi' ? 'Quan sát thời gian thực: Động học, Mô-men RNE, Dòng điện Stator Iq, Điện áp Bus DC & Nhiệt độ Biến tần' : 'Real-time observation: Kinematics, RNE Torques, Stator Current Iq, DC-Bus Voltage & Inverter Dynamics'}
            </p>
          </div>
        </div>

        {/* Window Action Buttons */}
        <div className="flex items-center space-x-2">
          {/* Pop-out to Separate Window (Multi-Monitor) Button */}
          {!isPopoutActive ? (
            <button
              onClick={handleOpenPopout}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/30 text-xs font-mono font-medium transition shadow-sm"
              title={language === 'vi' ? 'Mở cửa sổ đồ thị rời ra màn hình thứ hai (Multi-Monitor Pop-out)' : 'Pop-out to separate window for multi-monitor inspection'}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>{language === 'vi' ? 'Mở Cửa Sổ Rời (Đa Màn Hình)' : 'Pop-out Window'}</span>
            </button>
          ) : (
            <button
              onClick={handleClosePopout}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-mono font-medium transition shadow-sm"
              title={language === 'vi' ? 'Thu về cửa sổ chính' : 'Dock back to main window'}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>{language === 'vi' ? 'Gắn lại Cửa Sổ Chính' : 'Dock to Main'}</span>
            </button>
          )}

          {/* Maximize Toggle */}
          <button
            onClick={() => setIsMaximized(!isMaximized)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
            title={isMaximized ? 'Thu nhỏ kích thước' : 'Phóng to toàn màn hình'}
          >
            {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Close Dialog */}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
            title={t.common.close}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Navigation Tabs & Filter Bar */}
      <div className="px-4 py-2 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between text-xs font-mono shrink-0 gap-3">
        {/* Category Tabs */}
        <div className="flex items-center space-x-1.5 overflow-x-auto">
          <button
            onClick={() => setActiveTab('motors')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition ${
              activeTab === 'motors'
                ? 'bg-purple-600/30 text-purple-200 border border-purple-500 font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Cpu className="w-3.5 h-3.5 text-purple-400" />
            <span>{language === 'vi' ? 'Động Cơ & Dòng Điện (I_q, RPM, P)' : 'Motor Currents & Power (I_q, RPM, P)'}</span>
          </button>

          <button
            onClick={() => setActiveTab('converter')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition ${
              activeTab === 'converter'
                ? 'bg-amber-600/30 text-amber-200 border border-amber-500 font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Biến Tần & Bus DC (V_dc, T_j, P_net)</span>
          </button>

          <button
            onClick={() => setActiveTab('torques')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition ${
              activeTab === 'torques'
                ? 'bg-sky-600/30 text-sky-200 border border-sky-500 font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Gauge className="w-3.5 h-3.5 text-sky-400" />
            <span>Mô-men Khớp (τ_act, τ_g, τ_inert)</span>
          </button>

          <button
            onClick={() => setActiveTab('kinematics')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition ${
              activeTab === 'kinematics'
                ? 'bg-emerald-600/30 text-emerald-200 border border-emerald-500 font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            <span>{isVi ? 'Động Học (Góc q, Vận tốc, Gia tốc)' : 'Kinematics (Position q, Velocity, Accel)'}</span>
          </button>

          <button
            onClick={() => setActiveTab('errors')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition ${
              activeTab === 'errors'
                ? 'bg-rose-600/30 text-rose-200 border border-rose-500 font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-rose-400" />
            <span>Sai Số Bám Quỹ Đạo e(t)</span>
          </button>
        </div>

        {/* Joint Selector Pills */}
        <div className="flex items-center space-x-1 shrink-0">
          <span className="text-[10px] text-slate-500 mr-1 hidden sm:inline">Khớp:</span>
          <button
            onClick={() => setSelectedJoint('all')}
            className={`px-2 py-0.5 rounded text-[11px] transition ${
              selectedJoint === 'all'
                ? 'bg-slate-700 text-white font-bold border border-slate-500'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            Tất cả
          </button>
          {Array.from({ length: dof }).map((_, j) => (
            <button
              key={j}
              onClick={() => setSelectedJoint(j)}
              style={{
                borderColor: selectedJoint === j ? jointColors[j % jointColors.length] : 'transparent',
              }}
              className={`px-2 py-0.5 rounded border text-[11px] transition ${
                selectedJoint === j ? 'bg-slate-800 font-bold' : 'text-slate-400 hover:text-slate-200'
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
            <div className="p-3 bg-purple-950/20 border border-purple-500/20 rounded-xl flex items-center justify-between text-xs text-purple-200 font-mono">
              <div className="flex items-center space-x-2">
                <Cpu className="w-4 h-4 text-purple-400 shrink-0" />
                <span>
                  Đặc tính dòng điện động cơ PMSM FOC: Dòng Iq sinh mô-men trục, tốc độ RPM và phân bố công suất điện/cơ qua từng khớp.
                </span>
              </div>
              <span className="text-[10px] text-purple-400">
                Phân cỡ: J1-J2 ILM 70x18 | J3 ILM 70x10 | J4-J6 ILM 38
              </span>
            </div>

            {renderSVGChart(
              isVi ? 'Dòng điện Pha Stator I_q(t) [A] (Dòng tạo mô-men từ)' : 'Stator Phase Current I_q(t) [A] (Torque Producing Current)',
              'A',
              'I_q [A]',
              (s, j) => s.motorStates?.[j]?.currentA || (s.tau?.[j] ? s.tau[j] / 12.0 : 0)
            )}

            {renderSVGChart(
              'Tốc độ Cơ học Rotor Động cơ [RPM]',
              'RPM',
              'Speed [RPM]',
              (s, j) => s.motorStates?.[j]?.rotorSpeedRpm || ((s.qdDeg?.[j] || 0) * (100 / 6))
            )}

            {renderSVGChart(
              'Công suất Điện Tiêu thụ Động cơ P_elec [W]',
              'W',
              'Power [W]',
              (s, j) => s.motorStates?.[j]?.powerElectricalW || 0
            )}
          </div>
        )}

        {/* TAB 2: POWER CONVERTER & SHARED DC BUS */}
        {activeTab === 'converter' && (
          <div className="space-y-4">
            <div className="p-3 bg-amber-950/20 border border-amber-500/20 rounded-xl flex items-center justify-between text-xs text-amber-200 font-mono">
              <div className="flex items-center space-x-2">
                <Zap className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  Động thái Điện tử Công suất Bus DC 48V: Sụt áp khi tăng tốc mang tải, dâng áp khi hãm tái sinh & nhiệt độ mối nối IGBT/MOSFET.
                </span>
              </div>
              <span className="text-[10px] text-amber-400">
                Bộ xả hãm Chopper: 4.7 Ω (Kích hoạt khi V_dc &gt; 56V)
              </span>
            </div>

            {renderSVGChart(
              isVi ? 'Điện áp Bus DC Dùng chung V_dc(t) [V] (Tụ bù 4700 µF)' : 'Shared DC-Bus Voltage V_dc(t) [V] (4700 µF Cap Bank)',
              'V',
              'V_dc [V]',
              (s) => s.dcBusState?.voltageV || 48.0,
              { val: 48.0, label: 'Nominal 48V', color: '#10b981' },
              [46.0, 50.0]
            )}

            {renderSVGChart(
              'Công suất Toàn hệ thống Inverter & Hãm tái sinh [W]',
              'W',
              'Power [W]',
              (s) => s.dcBusState?.totalPowerW || 0
            )}

            {renderSVGChart(
              'Nhiệt độ Mối nối Bán dẫn Inverter T_j [°C] (Trục vai J2 mang tải)',
              '°C',
              'Temp [°C]',
              (s, j) => s.dcBusState?.axisStates?.[j]?.junctionTemperatureC || (45.0 + ((s.tau?.[j] || 0) ** 2) * 0.002),
              { val: 85.0, label: 'Ngưỡng Cảnh báo 85°C', color: '#ef4444' }
            )}
          </div>
        )}

        {/* TAB 3: TORQUES & DYNAMICS */}
        {activeTab === 'torques' && (
          <div className="space-y-4">
            <div className="p-3 bg-sky-950/20 border border-sky-500/20 rounded-xl flex items-center justify-between text-xs text-sky-200 font-mono">
              <div className="flex items-center space-x-2">
                <Gauge className="w-4 h-4 text-sky-400 shrink-0" />
                <span>
                  Phân rã Mô-men động học RNE: Mô-men tác động thực tế τ_act đối chiếu với thành phần trọng trường τ_g và quán tính τ_inert.
                </span>
              </div>
              <span className="text-[10px] text-sky-400">
                Bao gồm quán tính quy đổi rotor N^2*J_m
              </span>
            </div>

            {renderSVGChart(
              'Mô-men Điều khiển Trục Khớp τ_act(t) [N·m]',
              'N·m',
              'Torque [N·m]',
              (s, j) => s.tau?.[j] || 0
            )}

            {renderSVGChart(
              'Thành phần Trọng lực Bù trừ g_i(q) [N·m]',
              'N·m',
              'Gravity [N·m]',
              (s, j) => s.tauGravity?.[j] || 0
            )}

            {renderSVGChart(
              'Thành phần Quán tính Gia tốc M_ij * qdd [N·m]',
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
              'Góc Khớp q_i(t) [deg]',
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
              'Gia tốc Góc Khớp qddot_i(t) [deg/s²]',
              '°/s²',
              'Accel [°/s²]',
              (s, j) => s.qddDeg?.[j] || 0
            )}
          </div>
        )}

        {/* TAB 5: ERRORS */}
        {activeTab === 'errors' && (
          <div className="space-y-4">
            <div className="p-3 bg-rose-950/20 border border-rose-500/20 rounded-xl flex items-center justify-between text-xs text-rose-200 font-mono">
              <div className="flex items-center space-x-2">
                <Layers className="w-4 h-4 text-rose-400 shrink-0" />
                <span>
                  Sai số bám quỹ đạo e_i(t) = q_des - q_act: Quan sát độ võng tĩnh khi mang tải 3.5 kg tại t ∈ [3.5s, 7.5s].
                </span>
              </div>
            </div>

            {renderSVGChart(
              'Sai số Bám Vị trí Góc Khớp e(t) [deg]',
              '°',
              'Error [°]',
              (s, j) => s.errorDeg?.[j] || 0
            )}

            {renderSVGChart(
              'Mặt Trượt / Biến Trạng Thái Suy Rộng s(t) = e_dot + λ*e',
              'rad/s',
              'Sliding [rad/s]',
              (s, j) => s.slidingSurface?.[j] || 0
            )}
          </div>
        )}
      </div>

      {/* Synchronized Timeline Scrubber & Transport Footer */}
      <div className="h-14 px-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between shrink-0 gap-4">
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
                <span>Tạm dừng</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Mô phỏng</span>
              </>
            )}
          </button>

          <button
            onClick={() => {
              if (activeWorkspaceMode === 'dynamics') resetDynamicsSimulation();
              else seekTrajectoryTime(0);
            }}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white border border-slate-700 transition"
            title="Khôi phục trạng thái ban đầu"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Real-time Scrubber Slider */}
        <div className="flex-1 flex items-center space-x-3">
          <span className="text-xs font-mono text-slate-400 shrink-0">
            {currentTime.toFixed(2)}s / {totalDuration.toFixed(2)}s
          </span>
          <input
            type="range"
            min={0}
            max={totalDuration}
            step={0.01}
            value={currentTime}
            onChange={(e) => seekTrajectoryTime(parseFloat(e.target.value))}
            className="flex-1 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
          />
        </div>

        {/* Status Indicators */}
        <div className="hidden md:flex items-center space-x-3 text-[11px] font-mono text-slate-400 shrink-0">
          <span className="flex items-center space-x-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>500 Hz RK4</span>
          </span>
          <span>•</span>
          <span className="text-purple-300">FOC 10 kHz</span>
          <span>•</span>
          <span className="text-amber-300">DC 48V</span>
        </div>
      </div>
    </div>
  );

  const mobileDialogContent = (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 select-none overflow-hidden border border-slate-800 rounded-2xl shadow-2xl">
      {/* Top Header Bar */}
      <div className="h-14 px-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-400 shadow-sm">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-bold text-slate-100">
                Bộ Dao Động Ký AMR & Hệ Đa Vật Lý AGV
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30 font-semibold">
                Multi-Physics Scope (20 kHz SPWM + Pacejka Tire + Dual Caster)
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              {isVi ? 'Quan sát thời gian thực: Vận tốc Thân xe, Dual-PMSM dq, Lực kéo Lốp Pacejka, Tải trọng Pháp tuyến Fz, Bánh Caster & Tư thế 3D' : 'Real-time observation: Chassis Velocities, Dual-PMSM dq, Pacejka Traction, Dynamic Normal Loads Fz, Caster Dynamics & 3D Attitude'}
            </p>
          </div>
        </div>

        {/* Window Action Buttons */}
        <div className="flex items-center space-x-2">
          {!isPopoutActive ? (
            <button
              onClick={handleOpenPopout}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/30 text-xs font-mono font-medium transition shadow-sm"
              title={language === 'vi' ? 'Mở cửa sổ đồ thị rời ra màn hình thứ hai (Multi-Monitor Pop-out)' : 'Pop-out to separate window for multi-monitor inspection'}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>{language === 'vi' ? 'Mở Cửa Sổ Rời (Đa Màn Hình)' : 'Pop-out Window'}</span>
            </button>
          ) : (
            <button
              onClick={handleClosePopout}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-mono font-medium transition shadow-sm"
              title={language === 'vi' ? 'Thu về cửa sổ chính' : 'Dock back to main window'}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>{language === 'vi' ? 'Gắn lại Cửa Sổ Chính' : 'Dock to Main'}</span>
            </button>
          )}

          {/* Maximize Toggle */}
          <button
            onClick={() => setIsMaximized(!isMaximized)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
            title={isMaximized ? 'Thu nhỏ kích thước' : 'Phóng to toàn màn hình'}
          >
            {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Close Dialog */}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
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
      className={`fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 transition-all ${
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
