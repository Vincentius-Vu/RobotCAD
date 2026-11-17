import React, { useState } from 'react';
import { useRobotStore } from '../../store/robotStore';
import { useTranslation } from '../../i18n';
import {
  X,
  Camera,
  Download,
  Check,
  Layers,
  FileImage,
  Monitor,
  Box,
} from 'lucide-react';

interface TrajectoryExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TrajectoryExportModal: React.FC<TrajectoryExportModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { language } = useTranslation();
  const isVi = language === 'vi';

  const {
    currentRobotId,
    triggerCapture,
    interpolationType,
    waypoints,
  } = useRobotStore();

  const [scope, setScope] = useState<'workspace' | 'fullscreen'>('workspace');
  const [format, setFormat] = useState<'white' | 'transparent' | 'current'>('white');
  const [dpi, setDpi] = useState<number>(300);

  if (!isOpen) return null;

  const dpiOptions = [
    {
      value: 96,
      label: '96 DPI',
      desc: isVi ? 'Màn hình chuẩn (~1920 × 1080) - Nhanh cho web & slide' : 'Standard Screen (~1920 × 1080 px) - Fast export for web & slides',
      badge: 'Screen',
    },
    {
      value: 150,
      label: '150 DPI',
      desc: isVi ? 'Độ nét cao (~3000 × 1680) - Cho tài liệu bài giảng PDF' : 'High Definition (~3000 × 1680 px) - Excellent for PDF lecture handouts',
      badge: 'HD Print',
    },
    {
      value: 300,
      label: '300 DPI',
      desc: isVi ? 'Chuẩn xuất bản (~6000 × 3375) - Chuẩn bài báo IEEE/Springer' : 'Publication Grade (~6000 × 3375 px) - Crisp IEEE/Springer textbook standard',
      badge: 'Textbook Std',
    },
    {
      value: 600,
      label: '600 DPI',
      desc: isVi ? 'Siêu nét (~12000 × 6750) - In poster khổ lớn & vector lưu trữ' : 'Ultra High Definition (~12000 × 6750 px) - Archival vector-grade print',
      badge: 'Ultra Crisp',
    },
  ];

  const formatOptions: { id: 'white' | 'transparent' | 'current'; label: string; desc: string }[] = [
    {
      id: 'white',
      label: isVi ? 'Nền trắng học thuật (#FFFFFF)' : 'Academic Paper White (#FFFFFF)',
      desc: isVi
        ? 'Nền trắng tinh khiết có bóng tiếp xúc sàn mềm mại, sẵn sàng chèn vào văn bản LaTeX/Word.'
        : 'Pure clean white background with soft floor contact shadow, ready for LaTeX insertion.',
    },
    {
      id: 'transparent',
      label: isVi ? 'Nền trong suốt (Alpha PNG)' : 'Transparent PNG Alpha',
      desc: isVi
        ? 'Nền trong suốt không có mặt sàn, lý tưởng để chèn ghép lên các slide thuyết trình Canva/PowerPoint.'
        : 'Transparent background without floor plane, perfect for layering onto presentation slides.',
    },
    {
      id: 'current',
      label: isVi ? 'Nền tối Studio hiện tại' : 'Current Viewport Dark Theme',
      desc: isVi
        ? 'Giữ nguyên ánh sáng studio tối, lưới sàn phản chiếu và các hệ trục tọa độ.'
        : 'Keeps current dark studio lighting, reflection floor grid, and coordinate frames.',
    },
  ];

  const handleExport = () => {
    triggerCapture({
      format,
      dpi,
      scope,
      customFileName: `${currentRobotId}_${scope === 'fullscreen' ? 'Studio' : 'Trajectory'}_${interpolationType}_${waypoints.length}pts`,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-400">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">
                {isVi ? 'Chụp & Xuất Ảnh Mô Phỏng (PNG Snapshot)' : 'Export Simulation Snapshot (PNG)'}
              </h3>
              <p className="text-[11px] text-slate-400 font-mono">
                {isVi ? 'Tùy chọn Phạm vi: Không UI (Workspace) hoặc Toàn bộ Giao diện (With UI)' : 'High-Resolution Publication-Ready Render Options'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* 1. Scope Selection: Workspace (No UI) vs Fullscreen (With UI) */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span className="flex items-center space-x-1.5">
                <Camera className="w-3.5 h-3.5 text-sky-400" />
                <span>{isVi ? 'Phạm vi chụp hình (Capture Scope)' : 'Capture Scope'}</span>
              </span>
              <span className="text-[10px] font-mono text-amber-400">
                {scope === 'workspace' ? (isVi ? 'Không kèm UI' : 'No UI') : (isVi ? 'Toàn màn hình' : 'With UI')}
              </span>
            </label>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setScope('workspace')}
                className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                  scope === 'workspace'
                    ? 'bg-sky-600/20 border-sky-500 text-white shadow-md shadow-sky-600/10'
                    : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center space-x-1.5">
                    <Box className="w-4 h-4 text-sky-400" />
                    <span className="text-xs font-bold font-mono">
                      {isVi ? 'Chỉ Workspace 3D' : '3D Workspace Only'}
                    </span>
                  </div>
                  <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-700/60 font-mono">
                    No UI
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  {isVi
                    ? 'Chỉ chụp mô hình robot 3D không kèm thanh công cụ. Phù hợp chèn vào sách, bài báo LaTeX, poster.'
                    : 'Clean 3D robot scene without sidebars or toolbars. Ideal for textbooks, LaTeX papers, and posters.'}
                </p>
              </button>

              <button
                type="button"
                onClick={() => setScope('fullscreen')}
                className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                  scope === 'fullscreen'
                    ? 'bg-sky-600/20 border-sky-500 text-white shadow-md shadow-sky-600/10'
                    : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center space-x-1.5">
                    <Monitor className="w-4 h-4 text-purple-400" />
                    <span className="text-xs font-bold font-mono">
                      {isVi ? 'Toàn màn hình Studio' : 'Full Application'}
                    </span>
                  </div>
                  <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-purple-950/80 text-purple-400 border border-purple-700/60 font-mono">
                    With UI
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  {isVi
                    ? 'Chụp toàn bộ giao diện làm việc bao gồm thanh Ribbon trên, Sidebar, đồ thị dao động ký và telemetry.'
                    : 'Full studio screenshot including top ribbon, sidebars, oscilloscope waveforms, and telemetry HUDs.'}
                </p>
              </button>
            </div>
          </div>

          {/* 2. Print Resolution (DPI) Selection - Available for BOTH Workspace and Fullscreen modes */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span className="flex items-center space-x-1.5">
                <FileImage className="w-3.5 h-3.5 text-sky-400" />
                <span>{isVi ? 'Độ phân giải chụp ảnh (DPI Resolution)' : 'Capture Resolution (DPI)'}</span>
              </span>
              <span className="text-[10px] font-mono text-sky-400">
                Scale: {(dpi / 96).toFixed(1)}x {scope === 'fullscreen' && '(Retina Scale)'}
              </span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {dpiOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setDpi(opt.value)}
                  className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                    dpi === opt.value
                      ? 'bg-sky-600/20 border-sky-500 text-white shadow-md shadow-sky-600/10'
                      : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold font-mono">{opt.label}</span>
                    <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                      {opt.badge}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1 line-clamp-2">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Conditional Options: If Workspace Only -> Show Background options; If Fullscreen -> Show Full UI Guide */}
          {scope === 'workspace' ? (
            /* Background Format Selection */
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 flex items-center space-x-1.5">
                <Layers className="w-3.5 h-3.5 text-amber-400" />
                <span>{isVi ? 'Màu nền không gian 3D' : 'Background Style'}</span>
              </label>

              <div className="space-y-1.5">
                {formatOptions.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setFormat(opt.id)}
                    className={`w-full p-2.5 rounded-xl border text-left transition flex items-center justify-between ${
                      format === opt.id
                        ? 'bg-sky-600/20 border-sky-500 text-white'
                        : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="pr-4">
                      <h4 className="text-xs font-medium text-slate-200">{opt.label}</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">{opt.desc}</p>
                    </div>
                    {format === opt.id && (
                      <div className="w-5 h-5 rounded-full bg-sky-500 text-white flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Fullscreen with UI Guide Banner */
            <div className="p-3.5 bg-slate-950/90 rounded-xl border border-purple-500/30 text-xs text-slate-300 space-y-2">
              <div className="flex items-center space-x-2 text-purple-400 font-mono font-bold">
                <Monitor className="w-4 h-4" />
                <span>{isVi ? 'Chế độ chụp toàn màn hình ứng dụng (With UI)' : 'Full Application Screen Mode (With UI)'}</span>
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                {isVi
                  ? `Hệ thống sẽ render lại toàn bộ màn hình ứng dụng với độ nét ${dpi} DPI (Scale: ${(dpi / 96).toFixed(1)}x). Hãy đảm bảo các cửa sổ dao động ký hoặc thanh công cụ cần chụp đều đang mở.`
                  : `Captures the entire studio layout rendered at ${dpi} DPI (${(dpi / 96).toFixed(1)}x scale factor). Ensure desired sidebars or oscilloscope waveforms are open.`}
              </p>
            </div>
          )}

          {/* Metadata preview */}
          <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-400 space-y-1">
            <div className="flex justify-between">
              <span>{isVi ? 'Mô hình Robot:' : 'Robot Model:'}</span>
              <span className="text-slate-200">{currentRobotId}</span>
            </div>
            <div className="flex justify-between">
              <span>{isVi ? 'Phạm vi xuất:' : 'Capture Mode:'}</span>
              <span className="text-sky-400 font-bold">
                {scope === 'workspace' ? (isVi ? 'Workspace 3D (No UI)' : '3D Workspace (No UI)') : (isVi ? 'Toàn màn hình Studio (With UI)' : 'Full Studio (With UI)')}
              </span>
            </div>
            <div className="flex justify-between">
              <span>{isVi ? 'Độ phân giải:' : 'Effective Resolution:'}</span>
              <span className="text-amber-400">{dpi} DPI ({(dpi / 96).toFixed(1)}x Scale)</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950 flex items-center justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            {isVi ? 'Hủy bỏ' : 'Cancel'}
          </button>
          <button
            onClick={handleExport}
            className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-purple-600 hover:from-sky-500 hover:to-purple-500 text-white text-xs font-bold shadow-lg shadow-sky-600/30 transition"
          >
            <Download className="w-4 h-4" />
            <span>
              {scope === 'fullscreen'
                ? (isVi ? `Chụp Toàn Màn Hình ${dpi} DPI (With UI)` : `Capture Full Screen ${dpi} DPI (With UI)`)
                : (isVi ? `Xuất ảnh Workspace ${dpi} DPI (No UI)` : `Export Workspace ${dpi} DPI (No UI)`)}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
