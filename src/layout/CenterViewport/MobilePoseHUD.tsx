import React from 'react';
import { useMobileRobotStore } from '../../store/mobileRobotStore';
import { useTranslation } from '../../i18n';
import { Compass, Navigation } from 'lucide-react';

export const MobilePoseHUD: React.FC = () => {
  const { pose, velocity, isNavigating, specs } = useMobileRobotStore();
  const { t } = useTranslation();

  const thetaDeg = Number(((pose.thetaRad * 180) / Math.PI).toFixed(1));

  return (
    <div className="absolute top-3 left-3 z-10 pointer-events-auto bg-slate-900/85 backdrop-blur-md border border-slate-800 rounded-xl px-3.5 py-2 shadow-xl flex items-center space-x-3 text-xs font-mono">
      <div className="flex items-center space-x-1.5 text-slate-400">
        <Compass className="w-3.5 h-3.5 text-emerald-400" />
        <span className="font-semibold text-slate-200">{specs.name}</span>
      </div>

      <div className="h-3.5 w-px bg-slate-800" />

      {/* 2D Pose */}
      <div className="flex items-center space-x-2.5">
        <span>
          <strong className="text-emerald-400 font-semibold">X:</strong>{' '}
          <span className="text-slate-100">{pose.x.toFixed(2)}m</span>
        </span>
        <span>
          <strong className="text-sky-400 font-semibold">Y:</strong>{' '}
          <span className="text-slate-100">{pose.y.toFixed(2)}m</span>
        </span>
        <span>
          <strong className="text-amber-400 font-semibold">θ:</strong>{' '}
          <span className="text-slate-100">{thetaDeg}°</span>
        </span>
      </div>

      <div className="h-3.5 w-px bg-slate-800 hidden sm:block" />

      {/* Speed */}
      <div className="hidden sm:flex items-center space-x-2 text-slate-400">
        <span>v: <strong className="text-slate-200">{velocity.v.toFixed(2)} m/s</strong></span>
        <span>ω: <strong className="text-slate-200">{velocity.omega.toFixed(2)} rad/s</strong></span>
      </div>

      {isNavigating && (
        <>
          <div className="h-3.5 w-px bg-slate-800" />
          <div className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] animate-pulse">
            <Navigation className="w-3 h-3 text-emerald-400" />
            <span>{t.modals.autonomousAStar}</span>
          </div>
        </>
      )}
    </div>
  );
};
