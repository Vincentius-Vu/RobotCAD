import React from 'react';
import { useMobileRobotStore, BENCHMARK_SCENARIOS } from '../../store/mobileRobotStore';
import { useTranslation } from '../../i18n';
import {
  X,
  Zap,
  TrendingDown,
  ShieldCheck,
  Download,
  Play,
  RotateCcw,
  Layers,
  Cpu,
  Flame,
  Gauge,
  CheckCircle2,
  Route,
  Activity,
} from 'lucide-react';
import { TrajectoryAlgorithm } from '../../kinematics/TrajectoryProfileGenerators';

export const MultiPhysicsBatchModal: React.FC = () => {
  const { language } = useTranslation();
  const isVi = language === 'vi';
  const {
    isBatchBenchmarkModalOpen,
    setBatchBenchmarkModalOpen,
    batchBenchmarkReport,
    isBatchBenchmarkRunning,
    batchBenchmarkProgress,
    batchBenchmarkStatusText,
    runMultiPhysicsBatchBenchmark,
    exportBatchBenchmarkCSV,
    setKDSSelectedAlgorithm,
    playKDSTrajectory,
    activeScenarioId,
    loadBenchmarkScenario,
  } = useMobileRobotStore();

  if (!isBatchBenchmarkModalOpen) return null;

  const handleSelectScenario = async (scId: number) => {
    if (isBatchBenchmarkRunning) return;
    loadBenchmarkScenario(scId);
    const sc = BENCHMARK_SCENARIOS.find((s) => s.id === scId);
    await runMultiPhysicsBatchBenchmark(sc?.name);
  };

  const handleDownloadCSV = () => {
    try {
      const csv = exportBatchBenchmarkCSV();
      if (!csv) return;
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `multiphysics_benchmark_report_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export batch benchmark CSV:', err);
    }
  };

  const handleApplyAndPlay = (algo: TrajectoryAlgorithm) => {
    setKDSSelectedAlgorithm(algo);
    setBatchBenchmarkModalOpen(false);
    playKDSTrajectory();
  };

  const res = batchBenchmarkReport?.results;
  const kds = res?.kds_scurve;
  const trap = res?.trapezoidal;
  const cubic = res?.cubic;
  const quintic = res?.quintic;

  // Max energy for comparative bar scaling
  const maxEnergy = Math.max(
    trap?.totalEnergyElecJ || 1,
    cubic?.totalEnergyElecJ || 1,
    quintic?.totalEnergyElecJ || 1,
    kds?.totalEnergyElecJ || 1
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md">
      <div className="relative w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-100">
                  {isVi ? 'Đối Chuẩn Khoa Học SOTA & Đo Kiểm Đa Vật Lý FOC' : 'SOTA Scientific Benchmark & Multi-Physics FOC Telemetry'}
                </h2>
                <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Dual-PMSM 48V • FOC 20 kHz • ZOH 20 Hz
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {isVi ? 'Tích phân vi mô trên bộ nhân Đa vật lý nội tại: Biến tần nghịch lưu, tổn hao nhiệt Joule, lốp đàn hồi vi trượt & điều khiển vòng kín Lyapunov' : 'Sub-millisecond multi-physics simulation: Inverter dynamics, copper thermal loss, tire slip, and closed-loop Lyapunov tracking'}
              </p>
            </div>
          </div>

          <button
            onClick={() => setBatchBenchmarkModalOpen(false)}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Scenario Selection Header */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Route className="w-4 h-4 text-cyan-400" /> {isVi ? 'Kịch Bản Thử Nghiệm Chuẩn Hóa (Benchmark Scenarios)' : 'Standardized Benchmark Scenarios'}
              </span>
              <span className="text-[11px] text-cyan-400 font-mono">
                {isVi ? 'Chọn kịch bản để tự động chạy đối chuẩn 4 giải thuật' : 'Select scenario to benchmark 4 trajectory planning algorithms'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
              {BENCHMARK_SCENARIOS.map((sc) => {
                const isActive = activeScenarioId === sc.id;
                return (
                  <button
                    key={sc.id}
                    onClick={() => handleSelectScenario(sc.id)}
                    disabled={isBatchBenchmarkRunning}
                    className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                      isActive
                        ? 'bg-cyan-500/15 border-cyan-500/50 shadow-md shadow-cyan-950/40 text-cyan-200'
                        : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                          isActive ? 'bg-cyan-500/20 text-cyan-300' : 'bg-slate-800 text-slate-400'
                        }`}>
                          #{sc.id} • {sc.distanceM}m
                        </span>
                        {isActive && <Activity className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />}
                      </div>
                      <div className="text-xs font-bold leading-tight line-clamp-1">{sc.name.split(':')[1] || sc.name}</div>
                    </div>
                    <div className="text-[10px] text-slate-500 line-clamp-1 mt-1">{sc.category}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Running Progress Bar */}
          {isBatchBenchmarkRunning && (
            <div className="p-4 rounded-xl bg-slate-950 border border-cyan-500/40 space-y-2.5 animate-pulse">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-cyan-300 flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 animate-spin text-cyan-400" />
                  {batchBenchmarkStatusText}
                </span>
                <span className="font-mono text-cyan-400 font-bold">{batchBenchmarkProgress}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 via-sky-400 to-emerald-400 transition-all duration-300 rounded-full"
                  style={{ width: `${batchBenchmarkProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Top Metric Highlights */}
          {kds && trap && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30">
                <div className="flex items-center space-x-2 text-emerald-400 text-xs font-semibold mb-1">
                  <Zap className="w-4 h-4" />
                  <span>{isVi ? 'Tiết Kiệm Điện Năng Tổng' : 'Total Electrical Energy Saved'}</span>
                </div>
                <div className="text-2xl font-black text-emerald-400 font-mono">
                  -{kds.energySavedVsTrapezoidPercent}%
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  {isVi ? 'KDS:' : 'Proposed KDS:'} <b className="text-emerald-300">{kds.totalEnergyElecJ} J</b> vs {isVi ? 'Hình thang:' : 'Trapezoidal:'} <b className="text-rose-400">{trap.totalEnergyElecJ} J</b>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-500/30">
                <div className="flex items-center space-x-2 text-amber-400 text-xs font-semibold mb-1">
                  <Flame className="w-4 h-4" />
                  <span>{isVi ? 'Giảm Tổn Hao Cuộn Dây Cu' : 'Copper Heat Loss Reduction'}</span>
                </div>
                <div className="text-2xl font-black text-amber-400 font-mono">
                  -{(((trap.copperLossJ - kds.copperLossJ) / Math.max(1e-3, trap.copperLossJ)) * 100).toFixed(1)}%
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  {isVi ? 'Triệt tiêu dòng đỉnh FOC, bảo vệ nhiệt động cơ PMSM' : 'Peak stator current suppression, thermal motor protection'}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-cyan-950/30 border border-cyan-500/30">
                <div className="flex items-center space-x-2 text-cyan-400 text-xs font-semibold mb-1">
                  <TrendingDown className="w-4 h-4" />
                  <span>{isVi ? 'Triệt Tiêu Rung Giật (Jerk)' : 'Jerk & Shock Suppression'}</span>
                </div>
                <div className="text-2xl font-black text-cyan-400 font-mono">
                  -{(((trap.rmsJerkMps3 - kds.rmsJerkMps3) / Math.max(1e-3, trap.rmsJerkMps3)) * 100).toFixed(1)}%
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  Jerk RMS: <b className="text-cyan-300">{kds.rmsJerkMps3}</b> vs <b className="text-rose-400">{trap.rmsJerkMps3} m/s³</b>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-purple-950/30 border border-purple-500/30">
                <div className="flex items-center space-x-2 text-purple-400 text-xs font-semibold mb-1">
                  <ShieldCheck className="w-4 h-4" />
                  <span>{isVi ? 'Hành Lang Kệ Hàng Aisle' : 'Aisle Boundary Containment'}</span>
                </div>
                <div className="text-2xl font-black text-purple-400 font-mono">
                  {kds.maxCorridorDeviationMm} mm
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  {isVi ? 'Dưới hạn mức an toàn' : 'Strictly bounded'} <b className="text-purple-300">&lt; 100 mm</b>
                </div>
              </div>
            </div>
          )}

          {/* SOTA Multi-Physics Comparison Table */}
          {res && (
            <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-950/60">
              <div className="px-4 py-3 bg-slate-900/80 border-b border-slate-800 flex justify-between items-center">
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-cyan-400" /> {isVi ? 'Bảng Số Liệu Đo Kiểm Đa Vật Lý FOC' : 'Multi-Physics Numerical Dataset'}
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  {isVi ? 'Hành trình:' : 'Path Length:'} {batchBenchmarkReport.totalDistanceM} m • {batchBenchmarkReport.nodeCount} {isVi ? 'Nút' : 'Waypoints'}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800/80 bg-slate-900/40 text-slate-400 font-mono text-[11px]">
                      <th className="py-2.5 px-3">{isVi ? 'Thuật toán' : 'Algorithm'}</th>
                      <th className="py-2.5 px-2">{isVi ? 'Thời gian (s)' : 'Duration (s)'}</th>
                      <th className="py-2.5 px-2">{isVi ? 'Điện năng E_elec (J)' : 'Energy E_elec (J)'}</th>
                      <th className="py-2.5 px-2">{isVi ? 'Nhiệt Cuộn dây Cu (J)' : 'Copper Loss (J)'}</th>
                      <th className="py-2.5 px-2">{isVi ? 'Dòng đỉnh I_peak (A)' : 'Peak Current (A)'}</th>
                      <th className="py-2.5 px-2">{isVi ? 'Jerk RMS (m/s³)' : 'Jerk RMS (m/s³)'}</th>
                      <th className="py-2.5 px-2">{isVi ? 'Sai số RMS (mm)' : 'Tracking RMS (mm)'}</th>
                      <th className="py-2.5 px-2">{isVi ? 'Độ lệch Aisle (mm)' : 'Aisle Error (mm)'}</th>
                      <th className="py-2.5 px-3 text-center">{isVi ? 'Thao tác' : 'Action'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                    {/* 1. Trapezoidal */}
                    {trap && (
                      <tr className="hover:bg-slate-900/30 transition text-slate-300">
                        <td className="py-3 px-3 font-sans">
                          <div className="flex items-center space-x-2">
                            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                            <span className="font-semibold text-rose-300">{trap.shortName}</span>
                          </div>
                          <div className="text-[9px] text-slate-400 font-mono">{trap.orderDesc}</div>
                        </td>
                        <td className="py-3 px-2">{trap.durationSec} s</td>
                        <td className="py-3 px-2 text-rose-400 font-bold">{trap.totalEnergyElecJ} J</td>
                        <td className="py-3 px-2 text-rose-400">{trap.copperLossJ} J</td>
                        <td className="py-3 px-2 text-rose-400 font-bold">{trap.peakCurrentA} A</td>
                        <td className="py-3 px-2 text-rose-400">{trap.rmsJerkMps3}</td>
                        <td className="py-3 px-2">{trap.rmsTrackingErrorMm} mm</td>
                        <td className="py-3 px-2">{trap.maxCorridorDeviationMm} mm</td>
                        <td className="py-3 px-3 text-center">
                          <button
                            onClick={() => handleApplyAndPlay('trapezoidal')}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-sans border border-slate-700 transition"
                          >
                            {isVi ? 'Phát 3D' : 'Play 3D'}
                          </button>
                        </td>
                      </tr>
                    )}

                    {/* 2. Cubic Spline */}
                    {cubic && (
                      <tr className="hover:bg-slate-900/30 transition text-slate-300">
                        <td className="py-3 px-3 font-sans">
                          <div className="flex items-center space-x-2">
                            <span className="w-2 h-2 rounded-full bg-sky-400"></span>
                            <span className="font-semibold text-sky-300">{cubic.shortName}</span>
                          </div>
                          <div className="text-[9px] text-slate-400 font-mono">{cubic.orderDesc}</div>
                        </td>
                        <td className="py-3 px-2">{cubic.durationSec} s</td>
                        <td className="py-3 px-2 text-sky-400 font-bold">{cubic.totalEnergyElecJ} J</td>
                        <td className="py-3 px-2 text-sky-300">{cubic.copperLossJ} J</td>
                        <td className="py-3 px-2 text-slate-300">{cubic.peakCurrentA} A</td>
                        <td className="py-3 px-2 text-sky-300">{cubic.rmsJerkMps3}</td>
                        <td className="py-3 px-2">{cubic.rmsTrackingErrorMm} mm</td>
                        <td className="py-3 px-2">{cubic.maxCorridorDeviationMm} mm</td>
                        <td className="py-3 px-3 text-center">
                          <button
                            onClick={() => handleApplyAndPlay('cubic')}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-sans border border-slate-700 transition"
                          >
                            {isVi ? 'Phát 3D' : 'Play 3D'}
                          </button>
                        </td>
                      </tr>
                    )}

                    {/* 3. Quintic Spline */}
                    {quintic && (
                      <tr className="hover:bg-slate-900/30 transition text-slate-300">
                        <td className="py-3 px-3 font-sans">
                          <div className="flex items-center space-x-2">
                            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                            <span className="font-semibold text-amber-300">{quintic.shortName}</span>
                          </div>
                          <div className="text-[9px] text-slate-400 font-mono">{quintic.orderDesc}</div>
                        </td>
                        <td className="py-3 px-2">{quintic.durationSec} s</td>
                        <td className="py-3 px-2 text-amber-400 font-bold">{quintic.totalEnergyElecJ} J</td>
                        <td className="py-3 px-2 text-amber-300">{quintic.copperLossJ} J</td>
                        <td className="py-3 px-2 text-slate-300">{quintic.peakCurrentA} A</td>
                        <td className="py-3 px-2 text-amber-300">{quintic.rmsJerkMps3}</td>
                        <td className="py-3 px-2">{quintic.rmsTrackingErrorMm} mm</td>
                        <td className="py-3 px-2">{quintic.maxCorridorDeviationMm} mm</td>
                        <td className="py-3 px-3 text-center">
                          <button
                            onClick={() => handleApplyAndPlay('quintic')}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-sans border border-slate-700 transition"
                          >
                            {isVi ? 'Phát 3D' : 'Play 3D'}
                          </button>
                        </td>
                      </tr>
                    )}

                    {/* 4. Proposed KDS S-Curve */}
                    {kds && (
                      <tr className="bg-emerald-950/20 hover:bg-emerald-950/30 transition text-slate-200 font-bold">
                        <td className="py-3 px-3 font-sans">
                          <div className="flex items-center space-x-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                            <span className="text-emerald-300">{kds.shortName} {isVi ? '(Đề xuất)' : '(Proposed)'}</span>
                          </div>
                          <div className="text-[9px] text-emerald-400/80 font-mono">{kds.orderDesc}</div>
                        </td>
                        <td className="py-3 px-2 text-emerald-300">{kds.durationSec} s</td>
                        <td className="py-3 px-2 text-emerald-400 text-sm font-black">{kds.totalEnergyElecJ} J</td>
                        <td className="py-3 px-2 text-emerald-400">{kds.copperLossJ} J</td>
                        <td className="py-3 px-2 text-emerald-300">{kds.peakCurrentA} A</td>
                        <td className="py-3 px-2 text-emerald-300">{kds.rmsJerkMps3}</td>
                        <td className="py-3 px-2 text-emerald-300">{kds.rmsTrackingErrorMm} mm</td>
                        <td className="py-3 px-2 text-emerald-300">{kds.maxCorridorDeviationMm} mm</td>
                        <td className="py-3 px-3 text-center">
                          <button
                            onClick={() => handleApplyAndPlay('kds_scurve')}
                            className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-sans font-bold shadow-md shadow-emerald-900/30 transition flex items-center justify-center gap-1 mx-auto"
                          >
                            <Play className="w-3 h-3" />
                            <span>{isVi ? 'Phát 3D' : 'Play 3D'}</span>
                          </button>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Visual Comparative Energy Bars */}
          {res && (
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <h4 className="text-xs font-bold text-slate-200 flex items-center gap-2">
                <Gauge className="w-4 h-4 text-emerald-400" />
                {isVi ? 'So Sánh Trực Quan Tiêu Thụ Điện Năng Toàn Chu Trình (E_elec)' : 'Comparative Total Electrical Energy Consumption (E_elec)'}
              </h4>
              <div className="space-y-2">
                {[trap, cubic, quintic, kds].filter(Boolean).map((item) => {
                  if (!item) return null;
                  const pct = Math.min(100, (item.totalEnergyElecJ / maxEnergy) * 100);
                  const isKds = item.algorithm === 'kds_scurve';
                  return (
                    <div key={item.algorithm} className="space-y-1 text-xs">
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="font-semibold text-slate-300 flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: item.color }}
                          />
                          {item.name}
                        </span>
                        <span className="font-mono font-bold" style={{ color: item.color }}>
                          {item.totalEnergyElecJ} J
                          {isKds && trap && (
                            <span className="ml-1.5 text-emerald-300 font-sans text-[10px]">
                              (-{item.energySavedVsTrapezoidPercent}%)
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: item.color,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Scientific Insights Box */}
          {batchBenchmarkReport && (
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs text-slate-300">
              <h4 className="font-bold text-slate-100 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                {isVi ? 'Kết Luận & Nhận Định Khoa Học Từ Bộ Nhân Đa Vật Lý:' : 'Scientific Insights & Multi-Physics Findings:'}
              </h4>
              <ul className="list-disc list-inside space-y-1.5 text-slate-400 text-[11px] leading-relaxed">
                {batchBenchmarkReport.summaryInsights.map((insight, idx) => (
                  <li key={idx}>
                    <span className="text-slate-300">{insight}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/90 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-400 font-mono">
            {isVi ? 'Trạng thái Bộ nhân:' : 'Engine Status:'} <span className="text-cyan-400 font-semibold">{isVi ? 'Tích phân Euler tiến 1 kHz + ZOH Lyapunov 20 Hz' : 'Forward Euler 1 kHz + ZOH Lyapunov 20 Hz'}</span>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => runMultiPhysicsBatchBenchmark()}
              disabled={isBatchBenchmarkRunning}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 border border-slate-700 font-medium text-xs flex items-center space-x-1.5 transition"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isBatchBenchmarkRunning ? 'animate-spin' : ''}`} />
              <span>{isVi ? 'Chạy Lại Chuỗi Đo Kiểm' : 'Rerun Benchmark Suite'}</span>
            </button>

            <button
              onClick={handleDownloadCSV}
              disabled={!batchBenchmarkReport}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 border border-slate-700 font-medium text-xs flex items-center space-x-1.5 transition"
            >
              <Download className="w-3.5 h-3.5 text-slate-300" />
              <span>{isVi ? 'Xuất Báo Cáo CSV' : 'Export CSV Dataset'}</span>
            </button>

            <button
              onClick={() => handleApplyAndPlay('kds_scurve')}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-medium text-xs flex items-center space-x-1.5 shadow-lg shadow-emerald-900/30 transition"
            >
              <Play className="w-3.5 h-3.5 text-white" />
              <span>{isVi ? 'Phát KDS S-Curve trên 3D' : 'Play Proposed KDS on 3D Viewport'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
