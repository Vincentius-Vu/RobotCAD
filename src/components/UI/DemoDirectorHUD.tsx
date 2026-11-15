import React from 'react';
import { useRobotStore } from '../../store/robotStore';
import { useTranslation } from '../../i18n';
import { DemoDirector } from '../../services/demoDirector';
import { Film, Square } from 'lucide-react';

export const DemoDirectorHUD: React.FC = () => {
  const { demoState, isRecording, recordingSeconds } = useRobotStore();
  const { language } = useTranslation();
  const isVi = language === 'vi';

  if (!demoState.isRunning) return null;

  const caption = isVi ? demoState.captionVi : demoState.captionEn;
  const pct = Math.round((demoState.stepIndex / Math.max(1, demoState.totalSteps)) * 100);

  const fmtSec = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 w-[92%] max-w-2xl pointer-events-auto">
      <div className="bg-slate-950/90 backdrop-blur-md border border-sky-500/40 rounded-2xl shadow-2xl shadow-sky-950/50 px-4 py-2.5 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-sky-500/20 border border-sky-400/30 text-sky-300 text-[10px] font-mono font-bold uppercase tracking-wider">
              <Film className="w-3 h-3" />
              AUTO DEMO
            </span>

            {isRecording && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-rose-500/20 border border-rose-500/40 text-rose-300 text-[10px] font-mono font-bold">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                REC {fmtSec(recordingSeconds)} ({demoState.recordMode === 'tab' ? 'Full UI' : '3D Canvas'})
              </span>
            )}
          </div>

          <button
            onClick={() => DemoDirector.stopDemo()}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-600/80 hover:bg-rose-500 text-white text-[11px] font-mono font-semibold transition shadow-sm"
            title={isVi ? 'Dừng Demo & Lưu Video' : 'Stop Demo & Save Video'}
          >
            <Square className="w-3 h-3 fill-current" />
            <span>{isVi ? 'Dừng & Lưu' : 'Stop & Save'}</span>
          </button>
        </div>

        {/* Bilingual Caption Text */}
        <div className="text-xs sm:text-sm font-medium text-slate-100 leading-snug">
          {caption}
        </div>

        {/* Step Progress Bar */}
        <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-sky-500 via-cyan-400 to-emerald-400 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
};
