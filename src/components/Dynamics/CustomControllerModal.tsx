import React, { useState } from 'react';
import { useRobotStore } from '../../store/robotStore';
import {
  ControllerStrategyRegistry,
  CONTROLLER_TEMPLATES,
  CustomControllerDefinition,
} from '../../physics/Controllers';
import {
  X,
  Play,
  CheckCircle2,
  AlertCircle,
  Code2,
  Sparkles,
  BookOpen,
  Trash2,
  FileCode,
} from 'lucide-react';

interface CustomControllerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegistered: (newControllerId: string) => void;
  initialDefinition?: CustomControllerDefinition | null;
}

export const CustomControllerModal: React.FC<CustomControllerModalProps> = ({
  isOpen,
  onClose,
  onRegistered,
  initialDefinition,
}) => {
  const { robotModel, inertialParameters, dynamicsSettings } = useRobotStore();

  const [id, setId] = useState(initialDefinition?.id || '');
  const [name, setName] = useState(initialDefinition?.name || '');
  const [category, setCategory] = useState<'classical' | 'robust' | 'impedance' | 'optimal' | 'custom'>(
    initialDefinition?.category || 'robust'
  );
  const [description, setDescription] = useState(
    initialDefinition?.description || ''
  );
  const [scriptCode, setScriptCode] = useState(
    initialDefinition?.scriptCode || CONTROLLER_TEMPLATES[0].scriptCode
  );

  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    torques?: number[];
  } | null>(null);

  const [showCheatsheet, setShowCheatsheet] = useState(false);

  if (!isOpen) return null;

  const handleSelectTemplate = (templateId: string) => {
    const t = CONTROLLER_TEMPLATES.find((item) => item.id === templateId);
    if (!t) return;
    setName(t.name);
    setId(t.id);
    setCategory(t.category);
    setDescription(t.description);
    setScriptCode(t.scriptCode);
    setTestResult(null);
  };

  const handleDryRun = () => {
    if (!robotModel) {
      setTestResult({ success: false, message: 'Chưa có mô hình robot đang nạp để chạy thử.' });
      return;
    }

    try {
      const compileFn = ControllerStrategyRegistry.compileCustomScript(scriptCode);
      const dof = robotModel.dof;

      // Create test evaluation context
      const dummyCtx = {
        dhParams: robotModel.joints,
        inertiaList: inertialParameters,
        qRad: new Array(dof).fill(0.1),
        qdRad: new Array(dof).fill(0.05),
        qDesiredRad: new Array(dof).fill(0.2),
        qdDesiredRad: new Array(dof).fill(0.0),
        qddDesiredRad: new Array(dof).fill(0.0),
        gains: dynamicsSettings.gains,
        gravityAcc: 9.81,
        externalTorqueDisturbance: new Array(dof).fill(0),
      };

      const out = compileFn(dummyCtx);

      if (!out || !Array.isArray(out.tau) || out.tau.length !== dof) {
        setTestResult({
          success: false,
          message: `Kích thước mảng tau trả về (${out?.tau?.length || 0}) không khớp với số khớp của robot (${dof} DOF).`,
        });
        return;
      }

      const hasNaN = out.tau.some((v) => isNaN(v) || !isFinite(v));
      if (hasNaN) {
        setTestResult({
          success: false,
          message: 'Mảng tau trả về chứa giá trị không hợp lệ (NaN hoặc Infinity). Hãy kiểm tra phép chia cho 0.',
        });
        return;
      }

      setTestResult({
        success: true,
        message: `Cú pháp hợp lệ! Tính toán thành công cho ${dof} khớp.`,
        torques: out.tau,
      });
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Lỗi cú pháp hoặc runtime error trong code.',
      });
    }
  };

  const handleSaveAndRegister = () => {
    if (!name.trim()) {
      alert('Vui lòng nhập tên cho bộ điều khiển.');
      return;
    }

    const cleanId = id.trim() || `custom-${Date.now()}`;

    try {
      const def: CustomControllerDefinition = {
        id: cleanId,
        name: name.trim(),
        category,
        description: description.trim() || 'Thuật toán điều khiển tùy biến người dùng',
        scriptCode,
        createdAt: new Date().toISOString(),
      };

      ControllerStrategyRegistry.registerCustomController(def);
      onRegistered(cleanId);
      onClose();
    } catch (err: any) {
      setTestResult({
        success: false,
        message: `Không thể đăng ký: ${err.message}`,
      });
    }
  };

  const handleDelete = () => {
    if (!initialDefinition?.id) return;
    if (confirm(`Bạn có chắc muốn xóa bộ điều khiển "${initialDefinition.name}" không?`)) {
      ControllerStrategyRegistry.deleteCustomController(initialDefinition.id);
      onRegistered('computed-torque');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-750 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-slate-200 font-sans">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-purple-500/15 border border-purple-500/30 rounded-xl text-purple-400">
              <Code2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-mono font-bold text-white flex items-center space-x-2">
                <span>Trình Tạo Thuật Toán Điều Khiển (Controller Sandbox)</span>
                <span className="text-[10px] bg-sky-500/20 text-sky-300 px-2 py-0.5 rounded-full border border-sky-500/40">
                  Open-Architecture
                </span>
              </h2>
              <p className="text-[11px] text-slate-400 font-mono">
                Lập trình và nhúng trực tiếp thuật toán điều khiển tùy biến (MPC, ADRC, SMC, NPID...) vào mô phỏng 500 Hz
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Top Bar: Template Selector & Info */}
          <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-mono font-bold text-slate-300">Chọn mẫu thuật toán (Templates):</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {CONTROLLER_TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.id}
                  onClick={() => handleSelectTemplate(tmpl.id)}
                  className="px-2.5 py-1 text-xs font-mono rounded-lg bg-slate-900 hover:bg-slate-800 text-sky-300 border border-slate-750 hover:border-sky-500/50 transition"
                >
                  {tmpl.name.split(' (')[0]}
                </button>
              ))}
            </div>
          </div>

          {/* Form Fields: Name, Category, ID, Description */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-mono text-slate-400 block font-semibold">Tên bộ điều khiển:</label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!id || id.startsWith('custom-')) {
                    setId(
                      e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9]/g, '-')
                        .replace(/-+/g, '-')
                    );
                  }
                }}
                placeholder="VD: Super-Twisting SMC"
                className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-mono text-slate-400 block font-semibold">Mã định danh (ID):</label>
              <input
                type="text"
                value={id}
                onChange={(e) => setId(e.target.value)}
                placeholder="VD: super-twisting-smc"
                className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 font-mono outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-mono text-slate-400 block font-semibold">Phân loại (Category):</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 font-mono outline-none"
              >
                <option value="classical">Kinh điển (Classical)</option>
                <option value="robust">Bền vững & Phi tuyến (Robust)</option>
                <option value="optimal">Tối ưu & Thích nghi (Optimal/Adaptive)</option>
                <option value="impedance">Điều khiển mềm dẻo (Impedance)</option>
                <option value="custom">Tùy biến người dùng (Custom)</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-mono text-slate-400 block font-semibold">Mô tả / Công thức toán:</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="VD: τ = M(q)(qdd_d + Kp*e + Kd*edot) + g(q) với bù ma sát phi tuyến"
              className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 font-mono outline-none"
            />
          </div>

          {/* Script Code Editor */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-mono text-slate-300 flex items-center space-x-1.5 font-bold">
                <FileCode className="w-3.5 h-3.5 text-purple-400" />
                <span>Mã nguồn thuật toán JavaScript (compute function body):</span>
              </label>

              <button
                type="button"
                onClick={() => setShowCheatsheet(!showCheatsheet)}
                className="text-[10px] font-mono text-sky-400 hover:text-sky-300 flex items-center space-x-1"
              >
                <BookOpen className="w-3 h-3" />
                <span>{showCheatsheet ? 'Ẩn hướng dẫn API' : 'Xem danh mục biến ctx & hàm RNE/Kinematics'}</span>
              </button>
            </div>

            {/* Cheatsheet Accordion */}
            {showCheatsheet && (
              <div className="p-3 bg-slate-950/90 border border-sky-500/30 rounded-xl space-y-2 text-[10px] font-mono text-slate-300 animate-in fade-in duration-100">
                <div className="font-bold text-sky-300">Các biến và hàm có sẵn trong hàm điều khiển:</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-slate-400">
                  <div>
                    <span className="text-white font-semibold">ctx.qRad / ctx.qdRad:</span> Góc quay & vận tốc hiện tại (rad, rad/s)
                  </div>
                  <div>
                    <span className="text-white font-semibold">ctx.qDesiredRad / qdDesiredRad / qddDesiredRad:</span> Quỹ đạo tham chiếu
                  </div>
                  <div>
                    <span className="text-white font-semibold">ctx.dhParams:</span> Danh sách thông số D-H của robot
                  </div>
                  <div>
                    <span className="text-white font-semibold">ctx.inertiaList:</span> Danh sách khối lượng, quán tính và maxTorque
                  </div>
                  <div>
                    <span className="text-white font-semibold">RNE.computeMassMatrix(dh, inertia, q):</span> Tính ma trận quán tính M(q)
                  </div>
                  <div>
                    <span className="text-white font-semibold">RNE.computeInverseDynamics(dh, inertia, q, qd, qdd, g):</span> Tính τ ngược RNE
                  </div>
                  <div>
                    <span className="text-white font-semibold">Kinematics.computeForwardKinematics(dh, qDeg):</span> Ma trận thế T
                  </div>
                  <div>
                    <span className="text-white font-semibold">Kinematics.computeGeometricJacobian(dh, qDeg):</span> Ma trận Jacobian J
                  </div>
                </div>
                <div className="text-slate-400 border-t border-slate-800 pt-1">
                  Giá trị trả về bắt buộc: <code className="text-emerald-400 font-bold">return &#123; tau: number[] &#125;;</code>
                </div>
              </div>
            )}

            <div className="relative">
              <textarea
                value={scriptCode}
                onChange={(e) => setScriptCode(e.target.value)}
                rows={13}
                spellCheck={false}
                className="w-full bg-[#0a0f1d] border border-slate-800 focus:border-purple-500 rounded-xl p-3 font-mono text-xs text-sky-200 leading-relaxed outline-none shadow-inner resize-y selection:bg-purple-900/60"
              />
            </div>
          </div>

          {/* Test & Dry-Run Result Notification */}
          {testResult && (
            <div
              className={`p-3 rounded-xl border flex flex-col space-y-1.5 animate-in fade-in duration-100 ${
                testResult.success
                  ? 'bg-emerald-950/70 text-emerald-300 border-emerald-600/50'
                  : 'bg-rose-950/70 text-rose-300 border-rose-600/50'
              }`}
            >
              <div className="flex items-center space-x-2 text-xs font-mono font-bold">
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                )}
                <span>{testResult.message}</span>
              </div>
              {testResult.torques && (
                <div className="text-[10px] font-mono text-slate-400">
                  Momen thử nghiệm [J1..Jn]:{' '}
                  <span className="text-white font-semibold">
                    [{testResult.torques.map((t) => t.toFixed(2)).join(' Nm, ')} Nm]
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-800 bg-slate-950/70">
          <div>
            {initialDefinition?.id && (
              <button
                onClick={handleDelete}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-600/40 text-xs font-mono transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa bộ này</span>
              </button>
            )}
          </div>

          <div className="flex items-center space-x-2.5 font-mono text-xs">
            <button
              onClick={handleDryRun}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 transition"
              title="Chạy thử nghiệm thuật toán với tư thế robot hiện tại"
            >
              <Play className="w-3.5 h-3.5 text-sky-400 fill-current" />
              <span>Chạy Thử (Dry-Run)</span>
            </button>

            <button
              onClick={handleSaveAndRegister}
              className="flex items-center space-x-1.5 px-4 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-sky-600 hover:from-purple-500 hover:to-sky-500 text-white font-bold shadow-lg transition"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Lưu & Đăng Ký Thuật Toán</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
