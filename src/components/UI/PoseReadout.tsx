import React from 'react';
import { useRobotStore } from '../../store/robotStore';
import { Crosshair, AlertCircle } from 'lucide-react';

export const PoseReadout: React.FC = () => {
  const { tcpPose, robotModel, jointAngles } = useRobotStore();

  if (!tcpPose || !robotModel) return null;

  const { position, orientationEuler } = tcpPose;

  // Simple singularity detection
  const isWristSingular = Math.abs(jointAngles[4] || 0) < 1.0; // q5 near 0

  return (
    <div className="absolute top-20 right-6 w-72 bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl shadow-2xl z-20 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
        <div className="flex items-center space-x-2">
          <Crosshair className="w-4 h-4 text-amber-400" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            End-Effector (TCP) Pose
          </h2>
        </div>
        <div className="flex items-center space-x-1">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] font-mono text-emerald-400">FK LIVE</span>
        </div>
      </div>

      <div className="p-4 space-y-3 font-mono">
        {/* Cartesian Coordinates X, Y, Z */}
        <div>
          <span className="text-[10px] uppercase text-slate-400 tracking-wider">
            Cartesian Position [mm]
          </span>
          <div className="grid grid-cols-3 gap-2 mt-1.5">
            <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-2 text-center">
              <span className="text-[10px] text-rose-400 font-bold block">X</span>
              <span className="text-xs text-slate-100 font-semibold">{position.x}</span>
            </div>
            <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-2 text-center">
              <span className="text-[10px] text-emerald-400 font-bold block">Y</span>
              <span className="text-xs text-slate-100 font-semibold">{position.y}</span>
            </div>
            <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-2 text-center">
              <span className="text-[10px] text-sky-400 font-bold block">Z</span>
              <span className="text-xs text-slate-100 font-semibold">{position.z}</span>
            </div>
          </div>
        </div>

        {/* Orientation Roll, Pitch, Yaw */}
        <div>
          <span className="text-[10px] uppercase text-slate-400 tracking-wider">
            Orientation Euler (Z-Y-X) [deg]
          </span>
          <div className="grid grid-cols-3 gap-2 mt-1.5">
            <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-2 text-center">
              <span className="text-[10px] text-slate-400 block">Roll</span>
              <span className="text-xs text-slate-100 font-semibold">{orientationEuler.roll}°</span>
            </div>
            <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-2 text-center">
              <span className="text-[10px] text-slate-400 block">Pitch</span>
              <span className="text-xs text-slate-100 font-semibold">{orientationEuler.pitch}°</span>
            </div>
            <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-2 text-center">
              <span className="text-[10px] text-slate-400 block">Yaw</span>
              <span className="text-xs text-slate-100 font-semibold">{orientationEuler.yaw}°</span>
            </div>
          </div>
        </div>

        {/* Singularity Alert Banner */}
        {isWristSingular && (
          <div className="flex items-center space-x-2 bg-amber-500/15 border border-amber-500/30 rounded-lg p-2.5 text-amber-300 text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>Wrist Singularity detected (Joint 5 near 0°)! Wrist alignment reduces DOFs.</span>
          </div>
        )}
      </div>
    </div>
  );
};
