import React from 'react';
import { useRobotStore } from '../../store/robotStore';
import { Compass, AlertTriangle } from 'lucide-react';

export const CompactPoseHUD: React.FC = () => {
  const { tcpPose, manipulabilityInfo } = useRobotStore();

  if (!tcpPose) return null;

  const isSingular = manipulabilityInfo?.isNearSingularity;

  return (
    <div className="absolute top-3 left-3 z-10 pointer-events-auto bg-slate-900/85 backdrop-blur-md border border-slate-800 rounded-xl px-3.5 py-2 shadow-xl flex items-center space-x-3 text-xs font-mono">
      <div className="flex items-center space-x-1.5 text-slate-400">
        <Compass className="w-3.5 h-3.5 text-sky-400" />
        <span className="font-semibold text-slate-200">TCP</span>
      </div>

      <div className="h-3.5 w-px bg-slate-800" />

      {/* Cartesian Position */}
      <div className="flex items-center space-x-2">
        <span>
          <strong className="text-rose-400 font-semibold">X:</strong>{' '}
          <span className="text-slate-100">{tcpPose.position.x.toFixed(1)}</span>
        </span>
        <span>
          <strong className="text-emerald-400 font-semibold">Y:</strong>{' '}
          <span className="text-slate-100">{tcpPose.position.y.toFixed(1)}</span>
        </span>
        <span>
          <strong className="text-sky-400 font-semibold">Z:</strong>{' '}
          <span className="text-slate-100">{tcpPose.position.z.toFixed(1)}</span>
        </span>
      </div>

      <div className="h-3.5 w-px bg-slate-800 hidden sm:block" />

      {/* Orientation Angles */}
      <div className="hidden sm:flex items-center space-x-2 text-slate-400">
        <span>R: <span className="text-slate-200">{tcpPose.orientationEuler.roll.toFixed(1)}°</span></span>
        <span>P: <span className="text-slate-200">{tcpPose.orientationEuler.pitch.toFixed(1)}°</span></span>
        <span>Y: <span className="text-slate-200">{tcpPose.orientationEuler.yaw.toFixed(1)}°</span></span>
      </div>

      {isSingular && (
        <>
          <div className="h-3.5 w-px bg-slate-800" />
          <div className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] animate-pulse">
            <AlertTriangle className="w-3 h-3 text-rose-400" />
            <span>Singularity</span>
          </div>
        </>
      )}
    </div>
  );
};
