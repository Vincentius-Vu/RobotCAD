import React from 'react';
import { useRobotStore } from '../../store/robotStore';
import { CameraPreset } from '../../types/robot';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

export const CameraPresetsHUD: React.FC = () => {
  const { cameraPreset, setCameraPreset } = useRobotStore();

  const presets: { id: CameraPreset; label: string }[] = [
    { id: 'isometric', label: 'Iso' },
    { id: 'front', label: 'Front (X-Z)' },
    { id: 'top', label: 'Top (X-Y)' },
    { id: 'side', label: 'Side (Y-Z)' },
    { id: 'tcp', label: 'TCP Track' },
  ];

  const handleZoomIn = () => {
    (window as any).__sceneManager?.zoomIn();
  };

  const handleZoomOut = () => {
    (window as any).__sceneManager?.zoomOut();
  };

  const handleFit = () => {
    (window as any).__sceneManager?.fitCameraToRobot();
  };

  return (
    <div className="absolute top-3 right-3 z-10 pointer-events-auto bg-slate-900/85 backdrop-blur-md border border-slate-800 rounded-xl p-1 shadow-xl flex items-center space-x-1 text-xs">
      {presets.map((p) => (
        <button
          key={p.id}
          onClick={() => setCameraPreset(p.id)}
          className={`px-2 py-1 rounded-lg text-[11px] font-mono transition ${
            cameraPreset === p.id
              ? 'bg-sky-600 text-white font-medium shadow-md shadow-sky-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
          title={`Switch camera to ${p.label}`}
        >
          {p.label}
        </button>
      ))}

      <div className="w-px h-4 bg-slate-800 mx-0.5" />

      {/* Quick Zoom Buttons */}
      <button
        onClick={handleZoomIn}
        className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
        title="Phóng to (Zoom In)"
      >
        <ZoomIn className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={handleZoomOut}
        className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
        title="Thu nhỏ (Zoom Out)"
      >
        <ZoomOut className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={handleFit}
        className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
        title="Vừa khung hình (Fit to Scene)"
      >
        <Maximize2 className="w-3.5 h-3.5 text-sky-400" />
      </button>
    </div>
  );
};
