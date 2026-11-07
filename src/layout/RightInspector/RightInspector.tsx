import React from 'react';
import { useRobotStore } from '../../store/robotStore';
import { RightInspectorTab } from '../../types/ui';
import { DHTable } from '../../components/UI/DHTable';
import { MobileRobotTelemetry } from '../RightSidebar/MobileRobotTelemetry';
import {
  X,
  TableProperties,
  Layers,
  Scale,
  Sparkles,
  AlertTriangle,
  FileSpreadsheet,
  Radio,
  Info,
} from 'lucide-react';

export const RightInspector: React.FC = () => {
  const {
    activeDomain,
    isRightInspectorOpen,
    toggleRightInspector,
    rightInspectorTab,
    setRightInspectorTab,
    robotModel,
    jacobianMatrix,
    manipulabilityInfo,
    overlays,
    toggleOverlay,
    setSkeletonMode,
  } = useRobotStore();

  if (!isRightInspectorOpen) return null;

  if (activeDomain === 'mobile_robot') {
    return (
      <aside className="w-96 bg-slate-900 border-l border-slate-800 flex flex-col z-20 shrink-0 h-full shadow-2xl animate-in slide-in-from-right duration-150">
        <div className="px-4 py-3 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Radio className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-300">
              AMR Telemetry & LIDAR Radar
            </span>
          </div>
          <button
            onClick={() => toggleRightInspector()}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title="Close Inspector"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <MobileRobotTelemetry />
      </aside>
    );
  }

  if (!robotModel) return null;

  const tabs: { id: RightInspectorTab; label: string; icon: React.ReactNode }[] = [
    { id: 'dh', label: 'DH Parameters', icon: <TableProperties className="w-3.5 h-3.5" /> },
    { id: 'jacobian', label: 'Jacobian & Singularity', icon: <Layers className="w-3.5 h-3.5" /> },
    { id: 'specs', label: 'Specs & Passport', icon: <Scale className="w-3.5 h-3.5" /> },
  ];

  const massRatio =
    robotModel.totalWeightKg > 0
      ? ((robotModel.payloadKg / robotModel.totalWeightKg) * 100).toFixed(1)
      : '0.0';

  return (
    <aside className="w-96 bg-slate-900 border-l border-slate-800 flex flex-col z-20 shrink-0 h-full shadow-2xl animate-in slide-in-from-right duration-150">
      {/* Inspector Header */}
      <div className="px-4 py-3 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <FileSpreadsheet className="w-4 h-4 text-sky-400" />
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
            Inspector & Analytics
          </span>
        </div>
        <button
          onClick={() => toggleRightInspector()}
          className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
          title="Close Inspector (Ctrl+B)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tab Switcher */}
      <div className="flex border-b border-slate-800 bg-slate-950/40 p-1 gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setRightInspectorTab(tab.id)}
            className={`flex-1 flex items-center justify-center space-x-1.5 py-1.5 px-2 rounded-md text-xs font-mono font-medium transition ${
              rightInspectorTab === tab.id
                ? 'bg-sky-600 text-white font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            {tab.icon}
            <span className="truncate">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-slate-300 custom-scrollbar">
        {/* TAB 1: DH PARAMETERS */}
        {rightInspectorTab === 'dh' && (
          <div className="space-y-4">
            <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/80">
              <DHTable />
            </div>

            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 space-y-2">
              <span className="text-[11px] font-mono font-semibold text-slate-300 block">
                Standard Denavit-Hartenberg Transformation:
              </span>
              <p className="text-[11px] text-slate-400 font-mono leading-relaxed">
                T = Rot_z(θ) · Trans_z(d) · Trans_x(a) · Rot_x(α)
              </p>
              <div className="text-[10px] text-slate-500 space-y-1 font-mono pt-1 border-t border-slate-800">
                <p>• <b>θ</b>: Góc quay quanh trục Z_(i-1) (Góc khớp biến thiên)</p>
                <p>• <b>d</b>: Khoảng cách dịch chuyển dọc Z_(i-1) (Link offset)</p>
                <p>• <b>a</b>: Khoảng cách giữa Z_(i-1) và Z_i dọc X_i (Link length)</p>
                <p>• <b>α</b>: Góc xoay giữa Z_(i-1) và Z_i quanh X_i (Link twist)</p>
              </div>
            </div>

            {/* SKELETON DISPLAY MODE */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono font-semibold text-slate-300 flex items-center space-x-1.5">
                  <Info className="w-3.5 h-3.5 text-sky-400" />
                  <span>Chế độ Khung xương (Skeleton Mode):</span>
                </span>
                <button
                  onClick={() => toggleOverlay('showSkeleton')}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono transition border ${
                    overlays.showSkeleton
                      ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                  }`}
                >
                  {overlays.showSkeleton ? 'BẬT' : 'TẮT'}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-lg">
                <button
                  onClick={() => setSkeletonMode('physical')}
                  className={`py-1 px-2 rounded text-[11px] font-mono font-medium transition ${
                    overlays.skeletonMode === 'physical'
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Cơ học (Physical)
                </button>
                <button
                  onClick={() => setSkeletonMode('dh')}
                  className={`py-1 px-2 rounded text-[11px] font-mono font-medium transition ${
                    overlays.skeletonMode === 'dh'
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Toán học (D-H)
                </button>
              </div>

              {robotModel.id === 'Puma560' && (
                <div className="text-[10px] leading-relaxed text-slate-400 bg-sky-950/30 border border-sky-900/50 rounded-lg p-2.5 space-y-1.5 font-mono">
                  <div className="text-sky-300 font-semibold flex items-center space-x-1">
                    <span>💡 Phân tích sư phạm cấu trúc PUMA 560:</span>
                  </div>
                  <p>
                    • <b>Bảng D-H toán học</b>: Khâu 2 có d₂ = 0, Khâu 3 có d₃ = 150 mm. Do đó gốc {'{2}'} nằm ở mặt phẳng trung tâm (y = 0), gây cảm giác xương Khâu 2 bị trôi ra khỏi thân 3D và có thanh ngang ảo ở cùi chỏ.
                  </p>
                  <p>
                    • <b>Cơ học chế tạo thực tế</b>: Khớp vai của thân robot đã vươn ngang ra y = 150 mm (cần vươn shoulder boom của Khâu 1). Cánh tay trên (Link 2) chạy thẳng dọc theo thân mesh 3D từ vai đến cùi chỏ.
                  </p>
                  <p className="text-emerald-400">
                    ➔ <i>Chế độ <b>Cơ học</b> giúp người học hình dung chính xác đường truyền lực cơ khí.</i>
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: JACOBIAN & SINGULARITY */}
        {rightInspectorTab === 'jacobian' && (
          <div className="space-y-4">
            {/* Manipulability Info */}
            {manipulabilityInfo && (
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-cyan-400 flex items-center space-x-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Yoshikawa Index w(q)</span>
                  </span>
                  <button
                    onClick={() => toggleOverlay('showManipulabilityEllipsoid')}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono transition border ${
                      overlays.showManipulabilityEllipsoid
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                    }`}
                  >
                    {overlays.showManipulabilityEllipsoid ? 'Ellipsoid: ON' : 'Ellipsoid: OFF'}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-2.5">
                    <span className="text-[10px] text-slate-400 block">Index w(q)</span>
                    <span className="text-sm font-bold text-cyan-400">
                      {manipulabilityInfo.yoshikawaIndex}
                    </span>
                  </div>
                  <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-2.5">
                    <span className="text-[10px] text-slate-400 block">Singular Values</span>
                    <span className="text-[11px] font-semibold text-slate-200">
                      [{manipulabilityInfo.singularValues.join(', ')}]
                    </span>
                  </div>
                </div>

                {manipulabilityInfo.isNearSingularity && (
                  <div className="flex items-center space-x-2 bg-rose-500/15 border border-rose-500/30 rounded-lg p-2.5 text-rose-300 text-xs font-mono">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-400" />
                    <span>Singularity Detected! w(q) gần 0. Tránh di chuyển theo vector vận tốc Cartesian này.</span>
                  </div>
                )}
              </div>
            )}

            {/* Geometric Jacobian Matrix */}
            {jacobianMatrix && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold">
                    Ma trận Jacobian [6 × {robotModel.dof}]
                  </span>
                  <span className="text-[10px] font-mono text-sky-400">Thời gian thực</span>
                </div>

                <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/80 p-2">
                  <table className="w-full text-right text-[11px] font-mono">
                    <thead>
                      <tr className="text-slate-500 border-b border-slate-800 text-[10px]">
                        <th className="py-1 px-1.5 text-left">Row</th>
                        {robotModel.joints.map((_, i) => (
                          <th key={i} className="py-1 px-1.5">J{i + 1}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40 text-slate-300">
                      {['vx', 'vy', 'vz', 'ωx', 'ωy', 'ωz'].map((rowLabel, rIdx) => (
                        <tr key={rIdx} className={rIdx === 2 ? 'border-b border-sky-500/30' : ''}>
                          <td className="py-1 px-1.5 text-left font-bold text-sky-400">{rowLabel}</td>
                          {jacobianMatrix[rIdx]?.map((val, cIdx) => (
                            <td
                              key={cIdx}
                              className={`py-1 px-1.5 ${
                                Math.abs(val) > 100
                                  ? 'text-amber-300 font-semibold'
                                  : Math.abs(val) < 1e-4
                                  ? 'text-slate-600'
                                  : 'text-slate-300'
                              }`}
                            >
                              {val.toFixed(2)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-[10px] text-slate-500 font-mono">
                  3 dòng đầu: Vận tốc dài J_v; 3 dòng cuối: Vận tốc góc J_ω.
                </p>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: SPECS & PASSPORT */}
        {rightInspectorTab === 'specs' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2.5 text-xs font-mono">
              <div className="bg-slate-950/80 border border-slate-800/80 rounded-lg p-2.5">
                <span className="text-[10px] text-slate-500 block">Rated Payload</span>
                <span className="text-sm text-sky-400 font-bold">{robotModel.payloadKg} kg</span>
              </div>
              <div className="bg-slate-950/80 border border-slate-800/80 rounded-lg p-2.5">
                <span className="text-[10px] text-slate-500 block">Total Mass</span>
                <span className="text-sm text-slate-200 font-bold">{robotModel.totalWeightKg} kg</span>
              </div>
              <div className="bg-slate-950/80 border border-slate-800/80 rounded-lg p-2.5">
                <span className="text-[10px] text-slate-500 block">Max Reach</span>
                <span className="text-sm text-emerald-400 font-bold">~{Math.round(robotModel.reachMm)} mm</span>
              </div>
              <div className="bg-slate-950/80 border border-slate-800/80 rounded-lg p-2.5">
                <span className="text-[10px] text-slate-500 block">Rigid Links</span>
                <span className="text-sm text-amber-400 font-bold">{robotModel.links.length} Segments</span>
              </div>
            </div>

            <div className="bg-slate-950/80 border border-slate-800/80 rounded-lg p-3 space-y-1.5 font-mono text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Degrees of Freedom:</span>
                <span className="text-white font-bold">{robotModel.dof} Axes (Articulated)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Model Scale:</span>
                <span className="text-white font-bold">{robotModel.scale}x</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Payload / Mass Ratio:</span>
                <span className="text-sky-300 font-bold">{massRatio}%</span>
              </div>
            </div>

            <div className="border border-slate-800 rounded-lg p-3 bg-slate-950/60 text-xs space-y-2">
              <span className="text-[11px] font-mono font-semibold text-slate-300 block">
                Tổng quan kiến trúc:
              </span>
              <p className="text-slate-400 leading-relaxed text-[11px]">
                {robotModel.manufacturer} {robotModel.modelName} là dòng robot công nghiệp phổ biến trong giảng dạy và nghiên cứu động lực học.
                Cấu trúc cổ tay hình cầu (Spherical Wrist) cho phép tách rời bài toán vị trí (Position Decoupling) và hướng (Orientation).
              </p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
