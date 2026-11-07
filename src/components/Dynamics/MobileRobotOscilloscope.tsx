import React, { useState, useRef } from 'react';
import { useMobileRobotStore, AGVHistoryPoint } from '../../store/mobileRobotStore';
import {
  Activity,
  Zap,
  Gauge,
  Waves,
  Play,
  RotateCcw,
  Download,
  Cpu,
} from 'lucide-react';

export type MobileOscilloscopeTab = 'kinematics' | 'pmsm' | 'pacejka' | 'chassis' | 'foc_ccc';

interface MobileRobotOscilloscopeProps {
  onOpenDialog?: () => void;
}

export const MobileRobotOscilloscope: React.FC<MobileRobotOscilloscopeProps> = () => {
  const {
    agvHistory,
    isLiveRecording,
    setIsLiveRecording,
    clearAgvHistory,
    physicsFidelity,
  } = useMobileRobotStore();

  const [activeTab, setActiveTab] = useState<MobileOscilloscopeTab>('kinematics');
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const history = agvHistory;
  const hasData = history.length > 1;

  // Time window bounds
  const tMin = hasData ? history[0].time : 0;
  const tMax = hasData ? history[history.length - 1].time : 1.0;
  const tSpan = Math.max(0.1, tMax - tMin);

  // SVG dimensions
  const svgWidth = 820;
  const svgHeight = 160;
  const padL = 60;
  const padR = 25;
  const padT = 20;
  const padB = 25;
  const plotW = svgWidth - padL - padR;
  const plotH = svgHeight - padT - padB;

  // Helper to compute scale and path
  const renderMultiLinePlot = (
    traces: {
      id: string;
      label: string;
      unit: string;
      color: string;
      dash?: string;
      getValue: (pt: AGVHistoryPoint) => number;
    }[],
    title: string,
    minFixed?: number,
    maxFixed?: number
  ) => {
    let yMin = minFixed !== undefined ? minFixed : Infinity;
    let yMax = maxFixed !== undefined ? maxFixed : -Infinity;

    if (hasData) {
      history.forEach((pt) => {
        traces.forEach((tr) => {
          const val = tr.getValue(pt);
          if (minFixed === undefined && val < yMin) yMin = val;
          if (maxFixed === undefined && val > yMax) yMax = val;
        });
      });
    }

    if (yMin === Infinity || yMax === -Infinity || yMin === yMax) {
      yMin = -1;
      yMax = 1;
    }

    // Add 10% breathing padding
    const yMargin = (yMax - yMin) * 0.1 || 0.1;
    if (minFixed === undefined) yMin -= yMargin;
    if (maxFixed === undefined) yMax += yMargin;
    const ySpan = Math.max(0.0001, yMax - yMin);

    const getX = (t: number) => padL + ((t - tMin) / tSpan) * plotW;
    const getY = (v: number) => padT + (1 - (v - yMin) / ySpan) * plotH;

    // Generate SVG path for each trace
    const paths = traces.map((tr) => {
      if (!hasData) return '';
      return history.reduce((acc, pt, idx) => {
        const x = getX(pt.time).toFixed(1);
        const y = getY(tr.getValue(pt)).toFixed(1);
        return idx === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
      }, '');
    });

    const hoveredPt = hoverIdx !== null && history[hoverIdx] ? history[hoverIdx] : history[history.length - 1];

    return (
      <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
        <div className="flex justify-between items-center text-xs">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-slate-200">{title}</span>
          </div>

          {/* Trace Legend with current/hovered values */}
          <div className="flex items-center space-x-3 text-[11px] font-mono">
            {traces.map((tr) => {
              const val = hoveredPt ? tr.getValue(hoveredPt) : 0;
              return (
                <div key={tr.id} className="flex items-center space-x-1.5">
                  <span
                    className="w-2.5 h-1 rounded-full"
                    style={{ backgroundColor: tr.color }}
                  />
                  <span className="text-slate-400">{tr.label}:</span>
                  <span className="font-bold text-slate-100" style={{ color: tr.color }}>
                    {val.toFixed(2)} {tr.unit}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* SVG Waveform Area */}
        <div className="relative overflow-hidden rounded-lg bg-slate-950 border border-slate-850">
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full h-auto select-none"
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const relX = (e.clientX - rect.left) / rect.width;
              const targetX = padL + relX * plotW;
              const ratio = Math.max(0, Math.min(1, (targetX - padL) / plotW));
              const idx = Math.round(ratio * (history.length - 1));
              setHoverIdx(idx);
            }}
            onMouseLeave={() => setHoverIdx(null)}
          >
            {/* Grid Lines */}
            <line x1={padL} y1={padT} x2={padL + plotW} y2={padT} stroke="#1e293b" strokeDasharray="3 3" />
            <line x1={padL} y1={padT + plotH * 0.5} x2={padL + plotW} y2={padT + plotH * 0.5} stroke="#334155" strokeDasharray="2 2" />
            <line x1={padL} y1={padT + plotH} x2={padL + plotW} y2={padT + plotH} stroke="#1e293b" strokeDasharray="3 3" />

            {/* Zero Axis if in range */}
            {yMin < 0 && yMax > 0 && (
              <line
                x1={padL}
                y1={getY(0)}
                x2={padL + plotW}
                y2={getY(0)}
                stroke="#475569"
                strokeWidth="1.2"
                strokeDasharray="4 4"
              />
            )}

            {/* Y Axis Tick Labels */}
            <text x={padL - 6} y={padT + 4} fill="#64748b" fontSize="9" textAnchor="end" fontFamily="monospace">
              {yMax.toFixed(1)}
            </text>
            <text x={padL - 6} y={padT + plotH * 0.5 + 3} fill="#64748b" fontSize="9" textAnchor="end" fontFamily="monospace">
              {((yMax + yMin) / 2).toFixed(1)}
            </text>
            <text x={padL - 6} y={padT + plotH} fill="#64748b" fontSize="9" textAnchor="end" fontFamily="monospace">
              {yMin.toFixed(1)}
            </text>

            {/* Traces */}
            {paths.map((d, i) => (
              <path
                key={traces[i].id}
                d={d}
                fill="none"
                stroke={traces[i].color}
                strokeWidth="1.8"
                strokeDasharray={traces[i].dash}
              />
            ))}

            {/* Hover guideline cursor */}
            {hoverIdx !== null && hoveredPt && (
              <g>
                <line
                  x1={getX(hoveredPt.time)}
                  y1={padT}
                  x2={getX(hoveredPt.time)}
                  y2={padT + plotH}
                  stroke="#38bdf8"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                />
                <circle
                  cx={getX(hoveredPt.time)}
                  cy={getY(traces[0].getValue(hoveredPt))}
                  r="3.5"
                  fill={traces[0].color}
                />
              </g>
            )}

            {/* X-Axis Time Bounds */}
            <text x={padL} y={svgHeight - 8} fill="#64748b" fontSize="9" fontFamily="monospace">
              t = {tMin.toFixed(1)}s
            </text>
            <text x={padL + plotW} y={svgHeight - 8} fill="#64748b" fontSize="9" textAnchor="end" fontFamily="monospace">
              t = {tMax.toFixed(1)}s (Δt = {tSpan.toFixed(1)}s)
            </text>
          </svg>
        </div>
      </div>
    );
  };

  const handleDownloadCSV = () => {
    try {
      if (!history || history.length === 0) return;
      const headers = ['time', 'vx', 'wz', 'vL', 'vR', 'Te_L', 'Te_R', 'Vdc', 'Ibatt', 'slip_L', 'slip_R'];
      const rows = history.map((pt) => [
        pt.time.toFixed(4),
        pt.vx.toFixed(4),
        pt.wz.toFixed(4),
        pt.vL.toFixed(4),
        pt.vR.toFixed(4),
        pt.Te_L.toFixed(2),
        pt.Te_R.toFixed(2),
        pt.Vdc.toFixed(2),
        pt.Ibatt.toFixed(2),
        pt.slip_L.toFixed(4),
        pt.slip_R.toFixed(4),
      ].join(','));
      const csv = [headers.join(','), ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mobile_robot_telemetry_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div ref={containerRef} className="space-y-3 font-sans">
      {/* Oscilloscope Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-1 border-b border-slate-800">
        {/* Domain Tabs */}
        <div className="flex items-center space-x-1 p-0.5 rounded-lg bg-slate-900 border border-slate-800">
          <button
            onClick={() => setActiveTab('kinematics')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition flex items-center space-x-1.5 ${
              activeTab === 'kinematics'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Gauge className="w-3.5 h-3.5 text-sky-400" />
            <span>Vận tốc & Bánh xe</span>
          </button>

          <button
            onClick={() => setActiveTab('pmsm')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition flex items-center space-x-1.5 ${
              activeTab === 'pmsm'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Dual-PMSM & Biến tần</span>
          </button>

          <button
            onClick={() => setActiveTab('pacejka')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition flex items-center space-x-1.5 ${
              activeTab === 'pacejka'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            <span>Lốp Pacejka & Tải Fz</span>
          </button>

          <button
            onClick={() => setActiveTab('chassis')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition flex items-center space-x-1.5 ${
              activeTab === 'chassis'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Waves className="w-3.5 h-3.5 text-purple-400" />
            <span>Bánh Caster & Tư thế 3D</span>
          </button>

          <button
            onClick={() => setActiveTab('foc_ccc')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition flex items-center space-x-1.5 ${
              activeTab === 'foc_ccc'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Cpu className="w-3.5 h-3.5 text-rose-400" />
            <span>Điều khiển FOC & CCC</span>
          </button>
        </div>

        {/* Live Stream & Action Controls */}
        <div className="flex items-center space-x-2">
          {/* Physics Fidelity Badge */}
          <div className="px-2 py-0.5 rounded text-[10px] font-mono border hidden sm:flex items-center space-x-1 bg-slate-900 border-slate-750 text-slate-300">
            <span className="text-slate-500">Mô hình:</span>
            <span className="text-sky-300 font-semibold">
              {physicsFidelity === 'multiphysics' ? 'Đa Vật Lý 1µs' : 'Động Học'}
            </span>
          </div>

          {/* Live indicator */}
          <div
            onClick={() => setIsLiveRecording(!isLiveRecording)}
            className={`px-2.5 py-1 rounded-lg border flex items-center space-x-1.5 text-[11px] font-mono cursor-pointer transition ${
              isLiveRecording
                ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
            }`}
            title="Nhấn để Tạm dừng / Tiếp tục ghi sóng thời gian thực"
          >
            {isLiveRecording ? (
              <>
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                <span>LIVE RECORDING</span>
              </>
            ) : (
              <>
                <Play className="w-3 h-3 text-amber-400 fill-current" />
                <span>ĐÃ DỪNG (FROZEN)</span>
              </>
            )}
          </div>

          <button
            onClick={clearAgvHistory}
            className="p-1.5 rounded-lg bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800 transition"
            title="Xóa bộ đệm sóng"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleDownloadCSV}
            className="px-2.5 py-1 rounded-lg bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800 flex items-center space-x-1 transition text-[11px]"
            title="Xuất dữ liệu sóng ra file CSV"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Xuất CSV</span>
          </button>
        </div>
      </div>

      {/* Plots Area */}
      <div className="space-y-3">
        {/* TAB 1: KINEMATICS */}
        {activeTab === 'kinematics' && (
          <>
            {renderMultiLinePlot(
              [
                { id: 'vx', label: 'Vận tốc tiến vx', unit: 'm/s', color: '#38bdf8', getValue: (p) => p.vx },
                { id: 'wz', label: 'Vận tốc góc wz', unit: 'rad/s', color: '#f59e0b', getValue: (p) => p.wz },
              ],
              '1. Vận tốc Thân xe (Chassis Forward & Angular Velocity)'
            )}

            {renderMultiLinePlot(
              [
                { id: 'vL', label: 'Bánh Trái vL', unit: 'm/s', color: '#3b82f6', getValue: (p) => p.vL },
                { id: 'vR', label: 'Bánh Phải vR', unit: 'm/s', color: '#06b6d4', getValue: (p) => p.vR },
              ],
              '2. Vận tốc Dài Mặt Lốp (Left vs Right Wheel Surface Velocity)'
            )}

            {renderMultiLinePlot(
              [
                { id: 'wL_rpm', label: 'Tốc độ Trái wL', unit: 'RPM', color: '#eab308', getValue: (p) => (p.omega_wL * 60) / (2 * Math.PI) },
                { id: 'wR_rpm', label: 'Tốc độ Phải wR', unit: 'RPM', color: '#f97316', getValue: (p) => (p.omega_wR * 60) / (2 * Math.PI) },
              ],
              '3. Tốc độ Góc Động cơ Bánh xe (Wheel Revolutions Per Minute)'
            )}
          </>
        )}

        {/* TAB 2: DUAL-PMSM & INVERTER */}
        {activeTab === 'pmsm' && (
          <>
            {renderMultiLinePlot(
              [
                { id: 'iq_L', label: 'Dòng iq Trái (Mô men)', unit: 'A', color: '#38bdf8', getValue: (p) => p.iq_L },
                { id: 'iq_R', label: 'Dòng iq Phải (Mô men)', unit: 'A', color: '#06b6d4', getValue: (p) => p.iq_R },
                { id: 'id_L', label: 'Dòng id Trái (Từ hóa)', unit: 'A', color: '#94a3b8', dash: '3 3', getValue: (p) => p.id_L },
                { id: 'id_R', label: 'Dòng id Phải (Từ hóa)', unit: 'A', color: '#64748b', dash: '3 3', getValue: (p) => p.id_R },
              ],
              '1. Dòng điện Stator Hệ tọa độ Quay d-q (Dual PMSM Stator Currents)'
            )}

            {renderMultiLinePlot(
              [
                { id: 'Te_L', label: 'Mô men Trái Te_L', unit: 'Nm', color: '#10b981', getValue: (p) => p.Te_L },
                { id: 'Te_R', label: 'Mô men Phải Te_R', unit: 'Nm', color: '#f59e0b', getValue: (p) => p.Te_R },
              ],
              '2. Mô men Điện từ Trục Động cơ (Electromagnetic Drive Torques)'
            )}

            {renderMultiLinePlot(
              [
                { id: 'Vdc', label: 'Điện áp Bus Vdc', unit: 'V', color: '#ec4899', getValue: (p) => p.Vdc },
                { id: 'Ibatt', label: 'Dòng Pin Ibatt', unit: 'A', color: '#a855f7', getValue: (p) => p.Ibatt },
              ],
              '3. Nguồn Cấp DC-Link & Dòng Pin (Capacitor Bus Voltage & Battery Current)'
            )}
          </>
        )}

        {/* TAB 3: PACEJKA & CONTACT */}
        {activeTab === 'pacejka' && (
          <>
            {renderMultiLinePlot(
              [
                { id: 'slip_L', label: 'Hệ số trượt Trái κ_L', unit: '%', color: '#38bdf8', getValue: (p) => p.slip_L * 100 },
                { id: 'slip_R', label: 'Hệ số trượt Phải κ_R', unit: '%', color: '#f59e0b', getValue: (p) => p.slip_R * 100 },
              ],
              '1. Độ Trượt Tiếp xúc Bánh xe (Pacejka Longitudinal Slip Ratio - Safe < 15%)'
            )}

            {renderMultiLinePlot(
              [
                { id: 'Fx_L', label: 'Lực bám Trái Fx_L', unit: 'N', color: '#06b6d4', getValue: (p) => p.Fx_L },
                { id: 'Fx_R', label: 'Lực bám Phải Fx_R', unit: 'N', color: '#f97316', getValue: (p) => p.Fx_R },
              ],
              '2. Lực Kéo Tiếp xúc Tiếp tuyến (Pacejka Longitudinal Tractive Forces)'
            )}

            {renderMultiLinePlot(
              [
                { id: 'Fz_L', label: 'Tải Bánh Trái Fz_L', unit: 'N', color: '#10b981', getValue: (p) => p.Fz_L },
                { id: 'Fz_R', label: 'Tải Bánh Phải Fz_R', unit: 'N', color: '#eab308', getValue: (p) => p.Fz_R },
                { id: 'Fz_cF', label: 'Tải Caster Trước Fz_cF', unit: 'N', color: '#06b6d4', getValue: (p) => p.Fz_cF },
                { id: 'Fz_cR', label: 'Tải Caster Sau Fz_cR', unit: 'N', color: '#ec4899', getValue: (p) => p.Fz_cR },
              ],
              '3. Tải trọng Pháp tuyến Động 4 Điểm (SSoT 4-Point Lateral & Longitudinal Normal Loads)'
            )}
          </>
        )}

        {/* TAB 4: CASTERS & 3D CHASSIS ATTITUDE */}
        {activeTab === 'chassis' && (
          <>
            {renderMultiLinePlot(
              [
                { id: 'psi_cF', label: 'Góc Caster Trước ψ_cF', unit: '°', color: '#06b6d4', getValue: (p) => (p.psi_cF * 180) / Math.PI },
                { id: 'psi_cR', label: 'Góc Caster Sau ψ_cR', unit: '°', color: '#38bdf8', getValue: (p) => (p.psi_cR * 180) / Math.PI },
              ],
              '1. Góc Xoay Tự định hướng Bánh xe Tự lựa (Dual Caster Swivel Angles)'
            )}

            {renderMultiLinePlot(
              [
                { id: 'omega_cF', label: 'Vận tốc góc Caster Trước ω_cF', unit: 'rad/s', color: '#06b6d4', getValue: (p) => p.omega_cF },
                { id: 'omega_cR', label: 'Vận tốc góc Caster Sau ω_cR', unit: 'rad/s', color: '#38bdf8', getValue: (p) => p.omega_cR },
              ],
              '2. Vận tốc Xoay Cụm Caster Bậc 2 (2nd-Order Swivel Rotational Rates: Ifork * d²ψ/dt²)'
            )}

            {renderMultiLinePlot(
              [
                { id: 'pitch', label: 'Độ nhún Pitch (Dọc)', unit: '°', color: '#a855f7', getValue: (p) => p.pitchDeg },
                { id: 'roll', label: 'Độ nghiêng Roll (Ngang)', unit: '°', color: '#ec4899', getValue: (p) => p.rollDeg },
              ],
              '2. Tư thế Dao động Động lực học Thân xe 3D (Chassis Pitch & Roll Attitude)'
            )}

            {renderMultiLinePlot(
              [
                { id: 'ax', label: 'Gia tốc tiến ax', unit: 'm/s²', color: '#10b981', getValue: (p) => p.ax },
                { id: 'ay', label: 'Gia tốc hướng tâm ay', unit: 'm/s²', color: '#f59e0b', getValue: (p) => p.ay },
              ],
              '3. Gia tốc Quán tính Đa trục Khung xe (Longitudinal & Lateral Accelerations)'
            )}
          </>
        )}

        {/* TAB 5: ADVANCED CONTROLLERS (FOC / MTPA / FIELD-WEAKENING / CCC) */}
        {activeTab === 'foc_ccc' && (
          <>
            {renderMultiLinePlot(
              [
                { id: 'id_L', label: 'Dòng id Trái (đo)', unit: 'A', color: '#38bdf8', getValue: (p) => p.id_L },
                { id: 'id_ref_L', label: 'Dòng id* Đặt (MTPA+FW)', unit: 'A', color: '#0284c7', getValue: (p) => p.id_ref_L },
                { id: 'iq_L', label: 'Dòng iq Trái (đo)', unit: 'A', color: '#fbbf24', getValue: (p) => p.iq_L },
                { id: 'iq_ref_L', label: 'Dòng iq* Đặt (Torque)', unit: 'A', color: '#d97706', getValue: (p) => p.iq_ref_L },
              ],
              '1. Bám Vector Dòng Điện Trực giao FOC / MTPA (d-q Stator Current Tracking: id, id*, iq, iq*)'
            )}

            {renderMultiLinePlot(
              [
                { id: 'Vmag_L', label: 'Biên độ áp |Vs,L|', unit: 'V', color: '#ec4899', getValue: (p) => p.Vmag_L },
                { id: 'S_fw_L', label: 'Trạng thái Suy giảm từ S_fw (x25)', unit: '', color: '#f43f5e', getValue: (p) => p.S_fw_L * 25.0 },
                { id: 'id_fw_L', label: 'Dòng Khử từ id,fw', unit: 'A', color: '#a855f7', getValue: (p) => p.id_fw_L },
              ],
              '2. Bộ Giám Sát Giảm Từ Thông Schmitt-Trigger (Field-Weakening Supervisor & Demagnetization)'
            )}

            {renderMultiLinePlot(
              [
                { id: 'epsilon_ccc', label: 'Sai lệch contouring ε(t) = CL·ewR - CR·ewL', unit: 'rad/s', color: '#ef4444', getValue: (p) => p.epsilon_ccc },
                { id: 'u_sync', label: 'Mô-men bù đồng bộ chéo u_sync', unit: 'Nm', color: '#10b981', getValue: (p) => p.u_sync },
                { id: 'Te_cmd_L', label: 'Mô-men đặt Trái Te_L*', unit: 'Nm', color: '#3b82f6', getValue: (p) => p.Te_cmd_L },
                { id: 'Te_cmd_R', label: 'Mô-men đặt Phải Te_R*', unit: 'Nm', color: '#f97316', getValue: (p) => p.Te_cmd_R },
              ],
              '3. Đồng Bộ Chéo Quỹ Đạo Phẳng CCC (Lyapunov Contouring Synchronization Error ε(t) & Torque Coordination)'
            )}
          </>
        )}
      </div>
    </div>
  );
};
