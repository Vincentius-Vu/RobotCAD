import React from 'react';
import { useRobotStore } from '../../store/robotStore';
import { DHTable } from './DHTable';
import { X, Cpu, Info, Scale } from 'lucide-react';

interface SpecsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SpecsDrawer: React.FC<SpecsDrawerProps> = ({ isOpen, onClose }) => {
  const { robotModel } = useRobotStore();

  if (!isOpen || !robotModel) return null;

  const massRatio =
    robotModel.totalWeightKg > 0
      ? ((robotModel.payloadKg / robotModel.totalWeightKg) * 100).toFixed(1)
      : '0.0';

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-[520px] bg-slate-900/95 backdrop-blur-xl border-l border-slate-800 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-200">
      {/* Drawer Header */}
      <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
        <div className="flex items-center space-x-2.5">
          <Cpu className="w-5 h-5 text-sky-400" />
          <div>
            <h2 className="text-sm font-bold text-slate-100">{robotModel.manufacturer} {robotModel.modelName}</h2>
            <p className="text-xs text-slate-400 font-mono">Manipulator Kinematic & Dynamic Passport</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Drawer Content */}
      <div className="p-6 space-y-6 overflow-y-auto flex-1 text-slate-300">
        {/* Physical Specs Grid */}
        <div>
          <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-3 flex items-center space-x-1.5">
            <Scale className="w-3.5 h-3.5 text-sky-400" />
            <span>Technical Specifications</span>
          </h3>
          <div className="grid grid-cols-2 gap-3 text-xs font-mono">
            <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-3">
              <span className="text-[11px] text-slate-500 block">Rated Payload</span>
              <span className="text-base text-sky-400 font-bold">{robotModel.payloadKg} kg</span>
            </div>
            <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-3">
              <span className="text-[11px] text-slate-500 block">Total Mass</span>
              <span className="text-base text-slate-200 font-bold">{robotModel.totalWeightKg} kg</span>
            </div>
            <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-3">
              <span className="text-[11px] text-slate-500 block">Max Reach</span>
              <span className="text-base text-emerald-400 font-bold">~{Math.round(robotModel.reachMm)} mm</span>
            </div>
            <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-3">
              <span className="text-[11px] text-slate-500 block">Payload-to-Mass Ratio η</span>
              <span className="text-base text-amber-400 font-bold">{massRatio}%</span>
            </div>
          </div>
        </div>

        {/* Live D-H Parameters Table */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
              <Info className="w-3.5 h-3.5 text-sky-400" />
              <span>Standard Denavit–Hartenberg Table</span>
            </h3>
            <span className="text-[10px] font-mono text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
              Live Updates
            </span>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 overflow-hidden">
            <DHTable />
          </div>
        </div>

        {/* Mathematical Formulation Reference */}
        <div>
          <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-2">
            Standard D-H Transformation Formulation
          </h3>
          <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3.5 text-[11px] font-mono text-slate-300 space-y-2">
            <p className="text-slate-400">
              Homogeneous link transformation matrix from frame <code className="text-sky-300">{`{i-1}`}</code> to <code className="text-sky-300">{`{i}`}</code>:
            </p>
            <div className="bg-slate-900/90 p-2.5 rounded border border-slate-800 text-[11px] text-sky-300 overflow-x-auto leading-relaxed">
              A_i = Rot_z(θ_i) · Trans_z(d_i) · Trans_x(a_i) · Rot_x(α_i)
            </div>
            <p className="text-[11px] text-slate-400">
              Overall cumulative pose: <span className="text-amber-300">T_0^6 = A_1(q_1) · A_2(q_2) · ... · A_6(q_6)</span>
            </p>
          </div>
        </div>

        {/* Links & Mesh Hierarchy */}
        <div>
          <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-2">
            CAD Surface Meshes (STL)
          </h3>
          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            {robotModel.links.map((link) => (
              <div
                key={link.index}
                className="flex items-center space-x-2 bg-slate-950/60 border border-slate-800/80 rounded-md px-2.5 py-1.5"
              >
                <div
                  className="w-3 h-3 rounded-full border border-white/20 flex-shrink-0"
                  style={{ backgroundColor: link.color }}
                />
                <span className="text-slate-300 truncate">Link {link.index}: {link.fileName}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
