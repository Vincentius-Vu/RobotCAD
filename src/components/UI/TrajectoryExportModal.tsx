import React, { useState } from 'react';
import { useRobotStore } from '../../store/robotStore';
import {
  X,
  Camera,
  Download,
  Check,
  Layers,
  FileImage,
} from 'lucide-react';

interface TrajectoryExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TrajectoryExportModal: React.FC<TrajectoryExportModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    currentRobotId,
    triggerCapture,
    interpolationType,
    waypoints,
  } = useRobotStore();

  const [format, setFormat] = useState<'white' | 'transparent' | 'current'>('white');
  const [dpi, setDpi] = useState<number>(300);

  if (!isOpen) return null;

  const dpiOptions = [
    {
      value: 96,
      label: '96 DPI',
      desc: 'Standard Screen (~1920 × 1080 px) - Fast export for web & slides',
      badge: 'Screen',
    },
    {
      value: 150,
      label: '150 DPI',
      desc: 'High Definition (~3000 × 1680 px) - Excellent for PDF lecture handouts',
      badge: 'HD Print',
    },
    {
      value: 300,
      label: '300 DPI',
      desc: 'Publication Grade (~6000 × 3375 px) - Crisp IEEE/Springer textbook standard',
      badge: 'Textbook Std',
    },
    {
      value: 600,
      label: '600 DPI',
      desc: 'Ultra High Definition (~12000 × 6750 px) - Archival vector-grade print',
      badge: 'Ultra Crisp',
    },
  ];

  const formatOptions: { id: 'white' | 'transparent' | 'current'; label: string; desc: string }[] = [
    {
      id: 'white',
      label: 'Academic Paper White (#FFFFFF)',
      desc: 'Pure clean white background with soft floor contact shadow, ready for LaTeX insertion.',
    },
    {
      id: 'transparent',
      label: 'Transparent PNG Alpha',
      desc: 'Transparent background without floor plane, perfect for layering onto presentation slides.',
    },
    {
      id: 'current',
      label: 'Current Viewport Dark Theme',
      desc: 'Keeps current dark studio lighting, reflection floor grid, and coordinate frames.',
    },
  ];

  const handleExport = () => {
    triggerCapture({
      format,
      dpi,
      customFileName: `${currentRobotId}_Trajectory_${interpolationType}_${waypoints.length}pts`,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-400">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">
                Export Trajectory Figure (PNG)
              </h3>
              <p className="text-[11px] text-slate-400 font-mono">
                High-Resolution Publication-Ready Render
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
        <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
          {/* DPI Selection */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span className="flex items-center space-x-1.5">
                <FileImage className="w-3.5 h-3.5 text-sky-400" />
                <span>Print Resolution (DPI)</span>
              </span>
              <span className="text-[10px] font-mono text-sky-400">
                Scale: {(dpi / 96).toFixed(1)}x
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

          {/* Background Format Selection */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 flex items-center space-x-1.5">
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              <span>Background Style</span>
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

          {/* Metadata preview */}
          <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-400 space-y-1">
            <div className="flex justify-between">
              <span>Robot Model:</span>
              <span className="text-slate-200">{currentRobotId}</span>
            </div>
            <div className="flex justify-between">
              <span>Trajectory:</span>
              <span className="text-sky-400">{interpolationType.toUpperCase()} ({waypoints.length} waypoints)</span>
            </div>
            <div className="flex justify-between">
              <span>Effective DPI:</span>
              <span className="text-amber-400">{dpi} DPI (Publication Standard)</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950 flex items-center justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            className="flex items-center space-x-2 px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-lg shadow-sky-600/30 transition"
          >
            <Download className="w-4 h-4" />
            <span>Export {dpi} DPI PNG</span>
          </button>
        </div>
      </div>
    </div>
  );
};
