import React from 'react';
import { useRobotStore } from '../../store/robotStore';
import { useTranslation } from '../../i18n';
import {
  Activity,
  X,
  Compass,
  Move,
  RotateCw,
  Layers,
  Sparkles,
  Check,
  AlertTriangle,
} from 'lucide-react';

interface IKJacobianDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSetGizmoMode?: (mode: 'translate' | 'rotate') => void;
}

export const IKJacobianDrawer: React.FC<IKJacobianDrawerProps> = ({
  isOpen,
  onClose,
  onSetGizmoMode,
}) => {
  const { language } = useTranslation();
  const isVi = language === 'vi';
  const {
    robotModel,
    jacobianMatrix,
    manipulabilityInfo,
    ikConfigurations,
    activeIKIndex,
    applyIKConfiguration,
    overlays,
    toggleOverlay,
    gizmoMode,
    setGizmoMode,
  } = useRobotStore();

  if (!isOpen || !robotModel) return null;

  const handleModeChange = (mode: 'translate' | 'rotate') => {
    setGizmoMode(mode);
    onSetGizmoMode?.(mode);
  };

  const isPuma = robotModel.id === 'Puma560';

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-[560px] bg-slate-900/95 backdrop-blur-2xl border-l border-slate-800 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
        <div className="flex items-center space-x-2.5">
          <Activity className="w-5 h-5 text-emerald-400" />
          <div>
            <h2 className="text-sm font-bold text-slate-100">
              Inverse Kinematics & Velocity Jacobian
            </h2>
            <p className="text-xs text-slate-400 font-mono">
              Analytical 8-Posture Solver & Manipulability
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6 overflow-y-auto flex-1 text-slate-300">
        {/* 1. Interactive 3D TCP Gizmo */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Move className="w-4 h-4 text-sky-400" />
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
                3D Interactive TCP Gizmo
              </span>
            </div>
            <button
              onClick={() => toggleOverlay('showIKGizmo')}
              className={`px-3 py-1 rounded-md text-xs font-mono font-semibold transition border ${
                overlays.showIKGizmo
                  ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
              }`}
            >
              {overlays.showIKGizmo ? 'Gizmo: ON' : 'Gizmo: OFF'}
            </button>
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed">
            {isVi ? 'Kéo các mũi tên hoặc vòng xoay trực tiếp trên đầu gắp (TCP) trong không gian 3D.' : 'Drag gizmo handles directly on the Tool Center Point (TCP) in 3D.'}
            {isVi ? 'Bộ giải IK sẽ tự động tính toán các góc khớp thời gian thực ở 60 FPS.' : 'The IK solver computes joint configurations in real time at 60 FPS.'}
          </p>

          {overlays.showIKGizmo && (
            <div className="flex items-center space-x-2 pt-1">
              <span className="text-xs font-mono text-slate-400">{isVi ? "Chế độ Gizmo:" : "Gizmo Mode:"}</span>
              <button
                onClick={() => handleModeChange('translate')}
                className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-mono transition ${
                  gizmoMode === 'translate'
                    ? 'bg-sky-600 text-white font-bold'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-750'
                }`}
              >
                <Move className="w-3.5 h-3.5" />
                <span>{isVi ? 'Tịnh tiến (Translate)' : 'Translate'}</span>
              </button>
              <button
                onClick={() => handleModeChange('rotate')}
                className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-mono transition ${
                  gizmoMode === 'rotate'
                    ? 'bg-sky-600 text-white font-bold'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-750'
                }`}
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>{language === 'vi' ? 'Xoay góc (Rotate)' : 'Rotate Mode'}</span>
              </button>
            </div>
          )}
        </div>

        {/* 2. PUMA 560 8 Analytical Postures Grid */}
        {isPuma && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                <Compass className="w-4 h-4 text-amber-400" />
                <span>{language === 'vi' ? 'PUMA 560: 8 Cấu hình Động học ngược' : 'PUMA 560: 8 Inverse Kinematic Postures'}</span>
              </h3>
              <span className="text-[10px] font-mono text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                Analytical Closed-Form
              </span>
            </div>

            <p className="text-[11px] text-slate-400">
              {language === 'vi' ? 'Cùng một tọa độ TCP đích, robot có tới 8 nghiệm giải tích độc lập:' : 'For a given Cartesian TCP target, the spherical-wrist manipulator admits 8 closed-form postures:'}
              <b className="text-slate-300"> (Shoulder Left/Right) × (Elbow Down/Up) × (Wrist Flip/No-Flip)</b>.
              {language === 'vi' ? 'Bấm vào từng cấu hình bên dưới để chuyển tư thế ngay lập tức:' : 'Select any posture below for instantaneous posture switching:'}
            </p>

            <div className="grid grid-cols-2 gap-2">
              {ikConfigurations.length > 0 ? (
                ikConfigurations.map((cfg) => {
                  const isActive = activeIKIndex === cfg.index;
                  return (
                    <button
                      key={cfg.index}
                      onClick={() => applyIKConfiguration(cfg)}
                      className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between relative ${
                        isActive
                          ? 'border-amber-400 bg-amber-500/10 ring-2 ring-amber-400/20 shadow-md'
                          : 'border-slate-800 bg-slate-950/70 hover:border-slate-700 hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-1">
                        <span className="text-xs font-mono font-bold text-amber-300 flex items-center space-x-1.5">
                          <span>#{cfg.index}</span>
                          <span className="text-slate-200">{cfg.name}</span>
                        </span>
                        {isActive && <Check className="w-3.5 h-3.5 text-amber-400" />}
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 truncate">
                        q: [{cfg.anglesDeg.map((a) => Math.round(a)).join(', ')}°]
                      </span>
                    </button>
                  );
                })
              ) : (
                <div className="col-span-2 p-3 text-center text-xs font-mono text-amber-400/80 bg-amber-500/10 rounded-lg border border-amber-500/20">
                  {language === 'vi' ? 'Tọa độ mục tiêu nằm ngoài tầm với hoặc rơi vào vùng kỳ dị vai.' : 'Target pose is outside workspace reach or in shoulder boundary singularity.'}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 3. Manipulability Ellipsoid & Yoshikawa Index */}
        {manipulabilityInfo && (
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
                  {language === 'vi' ? 'Khả năng thao tác (Manipulability)' : 'Kinematic Manipulability'}
                </span>
              </div>
              <button
                onClick={() => toggleOverlay('showManipulabilityEllipsoid')}
                className={`px-2.5 py-1 rounded-md text-xs font-mono font-semibold transition border ${
                  overlays.showManipulabilityEllipsoid
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                }`}
              >
                {overlays.showManipulabilityEllipsoid ? '3D Ellipsoid: ON' : '3D Ellipsoid: OFF'}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 font-mono text-xs">
              <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-2.5">
                <span className="text-[10px] text-slate-400 block">Yoshikawa Index w(q)</span>
                <span className="text-base font-bold text-cyan-400">
                  {manipulabilityInfo.yoshikawaIndex}
                </span>
              </div>
              <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-2.5">
                <span className="text-[10px] text-slate-400 block">{language === 'vi' ? 'Trị dị thường (Singular Values)' : 'Singular Values'}</span>
                <span className="text-xs font-semibold text-slate-200">
                  [{manipulabilityInfo.singularValues.join(', ')}]
                </span>
              </div>
            </div>

            {manipulabilityInfo.isNearSingularity && (
              <div className="flex items-center space-x-2 bg-rose-500/15 border border-rose-500/30 rounded-lg p-2.5 text-rose-300 text-xs font-mono">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-400" />
                <span>{language === 'vi' ? 'Cảnh báo: Robot đang ở trạng thái suy biến động học (Singularity)! w(q) tiến về 0.' : 'Warning: Kinematic Singularity detected! Manipulability w(q) approaches zero.'}</span>
              </div>
            )}
          </div>
        )}

        {/* 4. Live Geometric Jacobian Matrix (6x6) */}
        {jacobianMatrix && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                <Layers className="w-4 h-4 text-sky-400" />
                <span>{language === 'vi' ? `Ma trận Geometric Jacobian J(q) [6 × ${robotModel.dof}]` : `Geometric Jacobian Matrix J(q) [6 × ${robotModel.dof}]`}</span>
              </h3>
              <span className="text-[10px] font-mono text-sky-400">{language === 'vi' ? 'Thời gian thực' : 'Real-Time'}</span>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/70 p-2">
              <table className="w-full text-right text-[11px] font-mono">
                <thead>
                  <tr className="text-slate-500 border-b border-slate-800 text-[10px]">
                    <th className="py-1 px-2 text-left">Row</th>
                    {robotModel.joints.map((_, i) => (
                      <th key={i} className="py-1 px-2">J{i + 1}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40 text-slate-300">
                  {['vx', 'vy', 'vz', 'ωx', 'ωy', 'ωz'].map((rowLabel, rIdx) => (
                    <tr key={rIdx} className={rIdx === 2 ? 'border-b border-sky-500/30' : ''}>
                      <td className="py-1 px-2 text-left font-bold text-sky-400">{rowLabel}</td>
                      {jacobianMatrix[rIdx]?.map((val, cIdx) => (
                        <td
                          key={cIdx}
                          className={`py-1 px-2 ${
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
              {language === 'vi' ? '3 hàng đầu: Jacobian vận tốc dài J_v; 3 hàng cuối: Jacobian vận tốc góc J_ω.' : 'Top 3 rows: Linear velocity J_v; Bottom 3 rows: Angular velocity J_ω.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
