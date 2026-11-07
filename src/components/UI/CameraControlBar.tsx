import React from 'react';
import { useRobotStore } from '../../store/robotStore';
import { CameraPreset } from '../../types/robot';
import { Compass } from 'lucide-react';

export const CameraControlBar: React.FC = () => {
  const { cameraPreset, setCameraPreset } = useRobotStore();

  const presets: { id: CameraPreset; label: string; tooltip: string }[] = [
    { id: 'isometric', label: 'Iso 3D', tooltip: 'Isometric Default View' },
    { id: 'front', label: 'Front (X-Z)', tooltip: 'Front Elevation View' },
    { id: 'top', label: 'Top (X-Y)', tooltip: 'Overhead Plan View' },
    { id: 'side', label: 'Side (Y-Z)', tooltip: 'Side Profile View' },
    { id: 'tcp', label: 'Focus TCP', tooltip: 'Focus on End-Effector Flange' },
  ];

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-full px-3 py-1.5 shadow-2xl z-20 flex items-center space-x-1">
      <div className="flex items-center text-slate-400 pl-1 pr-2">
        <Compass className="w-4 h-4 text-sky-400" />
      </div>

      {presets.map((p) => {
        const isActive = cameraPreset === p.id;
        return (
          <button
            key={p.id}
            onClick={() => setCameraPreset(p.id)}
            title={p.tooltip}
            className={`px-3 py-1 rounded-full text-xs font-mono font-medium transition ${
              isActive
                ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
            }`}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
};
