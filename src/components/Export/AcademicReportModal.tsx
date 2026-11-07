import React, { useState, useMemo } from 'react';
import {
  FileText,
  Copy,
  Check,
  Printer,
  X,
  Bot,
  Sparkles,
} from 'lucide-react';
import { useRobotStore } from '../../store/robotStore';
import { PUMA560_INERTIA } from '../../physics/RNEEngine';

interface AcademicReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AcademicReportModal: React.FC<AcademicReportModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    robotModel,
    jointAngles,
    tcpPose,
    jacobianMatrix,
    manipulabilityInfo,
  } = useRobotStore();

  const [copiedLatex, setCopiedLatex] = useState(false);

  const latexCode = useMemo(() => {
    if (!robotModel) return '';

    let tex = `% ==========================================================\n`;
    tex += `% KINEMATIC & DYNAMIC REPORT FOR ${robotModel.name.toUpperCase()}\n`;
    tex += `% Generated automatically by RoboCAD 3D\n`;
    tex += `% ==========================================================\n\n`;

    tex += `\\subsection{Thông số kỹ thuật robot ${robotModel.name}}\n`;
    tex += `\\begin{itemize}\n`;
    tex += `  \\item \\textbf{Nhà sản xuất}: ${robotModel.manufacturer}\n`;
    tex += `  \\item \\textbf{Số bậc tự do (DOF)}: ${robotModel.dof}\n`;
    tex += `  \\item \\textbf{Tầm với tối đa (Reach)}: ${robotModel.reachMm} mm\n`;
    tex += `  \\item \\textbf{Tải trọng danh định (Payload)}: ${robotModel.payloadKg} kg\n`;
    tex += `  \\item \\textbf{Khối lượng tổng thể}: ${robotModel.totalWeightKg} kg\n`;
    tex += `\\end{itemize}\n\n`;

    tex += `\\subsection{Bảng thông số Denavit-Hartenberg (D-H)}\n`;
    tex += `\\begin{table}[h!]\n\\centering\n`;
    tex += `\\caption{Bảng tham số D-H của robot ${robotModel.name}}\n`;
    tex += `\\begin{tabular}{|c|c|c|c|c|c|}\n\\hline\n`;
    tex += `\\textbf{Khớp $i$} & $\\theta_i$ (deg) & $d_i$ (mm) & $a_i$ (mm) & $\\alpha_i$ (deg) & Giới hạn khớp $[q_{\\min}, q_{\\max}]$ \\\\ \\hline\n`;

    robotModel.joints.forEach((j) => {
      tex += `${j.jointIndex} & $\\theta_{${j.jointIndex}} ${j.thetaOffsetDeg >= 0 ? '+' : ''}${j.thetaOffsetDeg}^\\circ$ & ${j.d.toFixed(1)} & ${j.a.toFixed(1)} & ${j.alphaDeg}^\\circ$ & $[${j.qMinDeg}^\\circ, ${j.qMaxDeg}^\\circ]$ \\\\ \\hline\n`;
    });

    tex += `\\end{tabular}\n\\end{table}\n\n`;

    if (tcpPose) {
      tex += `\\subsection{Vị trí và hướng điểm tác động cuối (End-Effector TCP)}\n`;
      tex += `Tại cấu hình góc khớp $q = [${jointAngles.map((a) => a.toFixed(1) + '^\\circ').join(', ')}]$:\n`;
      tex += `\\begin{align*}\n`;
      tex += `  p_{TCP} &= \\begin{bmatrix} ${tcpPose.position.x.toFixed(2)} \\\\ ${tcpPose.position.y.toFixed(2)} \\\\ ${tcpPose.position.z.toFixed(2)} \\end{bmatrix} \\text{ (mm)}, \\quad `;
      tex += `  (\\text{Roll, Pitch, Yaw}) = (${tcpPose.orientationEuler.roll.toFixed(1)}^\\circ, ${tcpPose.orientationEuler.pitch.toFixed(1)}^\\circ, ${tcpPose.orientationEuler.yaw.toFixed(1)}^\\circ)\n`;
      tex += `\\end{align*}\n\n`;
    }

    if (manipulabilityInfo) {
      tex += `\\subsection{Chỉ số khéo léo Yoshikawa}\n`;
      tex += `\\begin{equation*}\n`;
      tex += `  w(q) = \\sqrt{\\det(J_v(q) J_v^T(q))} = ${manipulabilityInfo.yoshikawaIndex.toFixed(6)}\n`;
      tex += `\\end{equation*}\n`;
    }

    return tex;
  }, [robotModel, jointAngles, tcpPose, manipulabilityInfo]);

  if (!isOpen || !robotModel) return null;

  const handleCopyLatex = () => {
    navigator.clipboard.writeText(latexCode);
    setCopiedLatex(true);
    setTimeout(() => setCopiedLatex(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl max-w-4xl w-full h-[88vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-400/30 text-purple-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-sm font-bold text-white tracking-wide">
                  Academic Report & Thesis Exporter
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-mono bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-full">
                  {robotModel.name}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Báo cáo kỹ thuật tổng hợp, trích xuất bảng thông số D-H và mã nguồn LaTeX
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title="Đóng (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Bar */}
        <div className="px-5 py-2.5 bg-slate-950/60 border-b border-slate-800/80 flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center space-x-2 text-slate-300">
            <Bot className="w-4 h-4 text-purple-400" />
            <span>Hồ sơ kỹ thuật: <strong>{robotModel.name}</strong> ({robotModel.manufacturer})</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleCopyLatex}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold font-mono transition ${
                copiedLatex
                  ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300'
                  : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-750 hover:text-white'
              }`}
            >
              {copiedLatex ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedLatex ? 'Copied LaTeX!' : 'Copy LaTeX Snippet'}</span>
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs font-mono shadow-md shadow-purple-600/30 transition"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>In Báo cáo (Print/PDF)</span>
            </button>
          </div>
        </div>

        {/* Report Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-slate-200 print:text-black print:bg-white">
          {/* Section 1: Executive Specifications */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 print:border-gray-300">
            <h3 className="text-xs font-bold text-sky-400 uppercase tracking-wider mb-3 flex items-center space-x-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>1. Thông số Kỹ thuật Định mức</span>
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Số bậc tự do:</span>
                <span className="font-bold text-white text-sm">{robotModel.dof} DOF</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Tầm với tối đa:</span>
                <span className="font-bold text-white text-sm">{robotModel.reachMm} mm</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Tải trọng thao tác:</span>
                <span className="font-bold text-white text-sm">{robotModel.payloadKg} kg</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Tổng khối lượng:</span>
                <span className="font-bold text-white text-sm">{robotModel.totalWeightKg} kg</span>
              </div>
            </div>
          </div>

          {/* Section 2: D-H Parameter Table */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
            <h3 className="text-xs font-bold text-sky-400 uppercase tracking-wider mb-3">
              2. Bảng Tham số Denavit-Hartenberg (D-H Chuẩn)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-2 px-3">Khớp i</th>
                    <th className="py-2 px-3">θ_i Offset (deg)</th>
                    <th className="py-2 px-3">d_i (mm)</th>
                    <th className="py-2 px-3">a_i (mm)</th>
                    <th className="py-2 px-3">α_i (deg)</th>
                    <th className="py-2 px-3">Giới hạn [q_min, q_max]</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {robotModel.joints.map((j) => (
                    <tr key={j.jointIndex} className="hover:bg-slate-800/30">
                      <td className="py-2 px-3 font-bold text-sky-400">Joint {j.jointIndex}</td>
                      <td className="py-2 px-3">{j.thetaOffsetDeg.toFixed(1)}°</td>
                      <td className="py-2 px-3">{j.d.toFixed(1)}</td>
                      <td className="py-2 px-3">{j.a.toFixed(1)}</td>
                      <td className="py-2 px-3">{j.alphaDeg.toFixed(1)}°</td>
                      <td className="py-2 px-3 text-slate-400">[{j.qMinDeg}°, {j.qMaxDeg}°]</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 3: Current Kinematic State & Jacobian */}
          {tcpPose && (
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
              <h3 className="text-xs font-bold text-sky-400 uppercase tracking-wider mb-3">
                3. Trạng thái Động học Hiện tại
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-400 block font-sans font-semibold">Tọa độ TCP (X, Y, Z):</span>
                  <div className="text-emerald-400 font-bold">
                    X: {tcpPose.position.x.toFixed(2)} mm | Y: {tcpPose.position.y.toFixed(2)} mm | Z: {tcpPose.position.z.toFixed(2)} mm
                  </div>
                  <div className="text-slate-400 text-[11px] mt-1">
                    Roll: {tcpPose.orientationEuler.roll.toFixed(1)}° | Pitch: {tcpPose.orientationEuler.pitch.toFixed(1)}° | Yaw: {tcpPose.orientationEuler.yaw.toFixed(1)}°
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-400 block font-sans font-semibold">Chỉ số thao tác Yoshikawa:</span>
                  <div className="text-amber-400 font-bold text-base">
                    w = {manipulabilityInfo?.yoshikawaIndex.toFixed(6) ?? 'N/A'}
                  </div>
                  <span className="text-[11px] text-slate-400">
                    {manipulabilityInfo?.isNearSingularity
                      ? '⚠️ Gần vùng kỳ dị (Near Singularity)'
                      : '✅ Vùng thao tác bình thường'}
                  </span>
                </div>
              </div>

              {jacobianMatrix && (
                <div className="mt-3">
                  <span className="text-[11px] font-mono text-slate-400 block mb-1">
                    Ma trận Jacobian hình học J(q) (6x{robotModel.dof}):
                  </span>
                  <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 overflow-x-auto text-[11px] font-mono">
                    {jacobianMatrix.map((row, rIdx) => (
                      <div key={rIdx} className="leading-5">
                        [ {row.map((val) => val.toFixed(4).padStart(8, ' ')).join('  ')} ]
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Section 4: Dynamic & Inertial Parameters */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
            <h3 className="text-xs font-bold text-sky-400 uppercase tracking-wider mb-3">
              4. Thông số Động lực học & Quán tính
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-2 px-3">Khâu i</th>
                    <th className="py-2 px-3">Khối lượng m_i (kg)</th>
                    <th className="py-2 px-3">Khối tâm COM [x, y, z] (m)</th>
                    <th className="py-2 px-3">Quán tính chính I_zz (kg.m²)</th>
                    <th className="py-2 px-3">Mô-men cực đại τ_max (N.m)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {robotModel.joints.map((_, idx) => {
                    const inertia =
                      robotModel.id === 'Puma560' && PUMA560_INERTIA[idx]
                        ? PUMA560_INERTIA[idx]
                        : {
                            mass: (robotModel.totalWeightKg / robotModel.dof) * (1 - idx * 0.12),
                            com: [0, 0, 0.1],
                            inertia: [[0.05, 0, 0], [0, 0.05, 0], [0, 0, 0.05]],
                            maxTorque: 100,
                          };

                    return (
                      <tr key={idx} className="hover:bg-slate-800/30">
                        <td className="py-2 px-3 font-bold text-sky-400">Link {idx + 1}</td>
                        <td className="py-2 px-3">{inertia.mass.toFixed(2)}</td>
                        <td className="py-2 px-3">[{inertia.com.map((c) => c.toFixed(2)).join(', ')}]</td>
                        <td className="py-2 px-3">{inertia.inertia[2][2].toFixed(4)}</td>
                        <td className="py-2 px-3 text-amber-400">{inertia.maxTorque.toFixed(1)} N.m</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-400 font-mono">
            Tài liệu này được sinh tự động theo chuẩn giáo trình Động lực học & Điều khiển Robot
          </span>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 text-xs font-semibold transition"
          >
            Đóng báo cáo
          </button>
        </div>
      </div>
    </div>
  );
};
