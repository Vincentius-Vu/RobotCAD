import React, { useEffect, useRef } from 'react';
import { useMobileRobotStore } from '../../store/mobileRobotStore';
import { useTranslation } from '../../i18n';
import { Compass, Gauge, Radio, AlertOctagon, Zap, Activity, Waves, Cpu } from 'lucide-react';

export const MobileRobotTelemetry: React.FC = () => {
  const { specs, pose, velocity, wheelState, lidarScan, lidarConfig, physicsFidelity, agvState } = useMobileRobotStore();
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Draw 2D Polar LIDAR Radar Scope
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const cx = width / 2;
    const cy = height / 2;
    const maxR = Math.min(cx, cy) - 15;

    // Clear background
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, width, height);

    // Draw range rings (2m, 4m, 6m)
    const ringRanges = [2.0, 4.0, 6.0];
    ctx.lineWidth = 1;
    for (const rM of ringRanges) {
      const rPx = (rM / lidarConfig.maxRangeM) * maxR;
      ctx.beginPath();
      ctx.arc(cx, cy, rPx, 0, 2 * Math.PI);
      ctx.strokeStyle = '#1e293b';
      ctx.stroke();

      // Range labels
      ctx.fillStyle = '#475569';
      ctx.font = '9px monospace';
      ctx.fillText(`${rM}m`, cx + 3, cy - rPx + 10);
    }

    // Crosshairs
    ctx.strokeStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(cx, 10);
    ctx.lineTo(cx, height - 10);
    ctx.moveTo(10, cy);
    ctx.lineTo(width - 10, cy);
    ctx.stroke();

    // Center Vehicle Marker (Cyan triangle facing UP)
    ctx.fillStyle = '#06b6d4';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 10);
    ctx.lineTo(cx - 7, cy + 8);
    ctx.lineTo(cx + 7, cy + 8);
    ctx.closePath();
    ctx.fill();

    // Draw LIDAR hits
    if (lidarScan && lidarScan.length > 0) {
      for (const pt of lidarScan) {
        if (!pt.hasHit) continue;
        const normR = Math.min(1.0, pt.distanceM / lidarConfig.maxRangeM);
        const rPx = normR * maxR;

        // In body coordinates: angle 0 is forward (+Y on screen = -pi/2), angle > 0 is left (-X on screen)
        const screenAngle = pt.angleRad - Math.PI / 2;
        const hx = cx + rPx * Math.cos(screenAngle);
        const hy = cy + rPx * Math.sin(screenAngle);

        ctx.beginPath();
        ctx.arc(hx, hy, 2.5, 0, 2 * Math.PI);

        // Warning color if obstacle is within 0.8m
        if (pt.distanceM < 0.8) {
          ctx.fillStyle = '#ef4444'; // Red alarm
        } else if (pt.distanceM < 1.8) {
          ctx.fillStyle = '#f59e0b'; // Amber caution
        } else {
          ctx.fillStyle = '#10b981'; // Emerald safe
        }
        ctx.fill();
      }
    }
  }, [lidarScan, lidarConfig]);

  const thetaDeg = Number(((pose.thetaRad * 180) / Math.PI).toFixed(1));
  const isTooClose = lidarScan.some((pt) => pt.hasHit && pt.distanceM < 0.6);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs font-sans">
      {/* 1. Proximity Hazard Alert Banner if obstacle is too close */}
      {isTooClose && (
        <div className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 flex items-center space-x-2 animate-pulse">
          <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0" />
          <span className="font-semibold text-[11px]">{t.inspector.obstacleWarning}</span>
        </div>
      )}

      {/* 2. Polar LIDAR Radar Scope */}
      <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Radio className="w-4 h-4 text-emerald-400" />
            <span className="font-semibold text-slate-200">{t.inspector.lidarRadar}</span>
          </div>
          <span className="text-[10px] font-mono text-slate-400">{t.inspector.lidarRange} {lidarConfig.maxRangeM}m</span>
        </div>

        <div className="flex justify-center py-1">
          <canvas
            ref={canvasRef}
            width={240}
            height={240}
            className="rounded-full border border-slate-800 shadow-inner bg-slate-950"
          />
        </div>

        <div className="flex justify-between items-center text-[10px] font-mono text-slate-500 pt-1">
          <div className="flex items-center space-x-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>{t.inspector.lidarSafe}</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span>{t.inspector.lidarCaution}</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <span>{t.inspector.lidarDanger}</span>
          </div>
        </div>
      </div>

      {/* 3. Live Odometry & Kinematics State */}
      <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3 font-mono">
        <div className="flex items-center space-x-2">
          <Compass className="w-4 h-4 text-sky-400" />
          <span className="font-semibold text-slate-200 font-sans text-xs">{t.inspector.odometryTitle}</span>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
            <span className="text-[10px] text-slate-500 block">{t.inspector.coordX}</span>
            <span className="text-slate-100 font-bold">{pose.x.toFixed(2)}m</span>
          </div>
          <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
            <span className="text-[10px] text-slate-500 block">{t.inspector.coordY}</span>
            <span className="text-slate-100 font-bold">{pose.y.toFixed(2)}m</span>
          </div>
          <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
            <span className="text-[10px] text-slate-500 block">{t.inspector.headingTheta}</span>
            <span className="text-amber-400 font-bold">{thetaDeg}°</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
            <span className="text-[10px] text-slate-500 block">{t.inspector.linearVel}</span>
            <span className="text-emerald-400 font-bold">{velocity.v.toFixed(2)} m/s</span>
          </div>
          <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
            <span className="text-[10px] text-slate-500 block">{t.inspector.angularVel}</span>
            <span className="text-sky-400 font-bold">{velocity.omega.toFixed(2)} rad/s</span>
          </div>
        </div>
      </div>

      {/* 4. Wheel Motor Speeds (RPM) */}
      <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2 font-mono">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Gauge className="w-4 h-4 text-yellow-400" />
            <span className="font-semibold text-slate-200 font-sans text-xs">{t.inspector.wheelRpm}</span>
          </div>
        </div>

        <div className="space-y-1.5 pt-1">
          {wheelState.speedsRadps.map((speedRadps, idx) => {
            const rpm = Number(((speedRadps * 60) / (2 * Math.PI)).toFixed(1));
            const wheelLabel = specs.driveType === 'differential'
              ? idx === 0 ? t.inspector.wheelLeft : t.inspector.wheelRight
              : `${t.inspector.wheelIndex} ${idx + 1} (${['FL', 'FR', 'RL', 'RR'][idx]})`;

            return (
              <div key={idx} className="flex justify-between items-center p-1.5 rounded bg-slate-900/60 border border-slate-800/80 text-[11px]">
                <span className="text-slate-400">{wheelLabel}:</span>
                <span className="text-yellow-400 font-bold">{rpm} RPM ({speedRadps.toFixed(2)} rad/s)</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. Multi-Physics Dual-PMSM & Inverter Telemetry */}
      {physicsFidelity === 'multiphysics' && agvState && (
        <div className="p-3.5 rounded-xl bg-indigo-950/30 border border-indigo-500/30 space-y-3 font-mono">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <span className="font-semibold text-slate-200 font-sans text-xs">{t.inspector.powerElectronics}</span>
            </div>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              20 kHz SPWM
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
              <span className="text-[10px] text-slate-500 block">{t.inspector.dcLinkBus}</span>
              <span className="text-amber-400 font-bold text-sm">{agvState.Vdc.toFixed(2)} V</span>
              <span className="text-[9px] text-slate-500 block">{t.inspector.batteryCurrent} {agvState.Ibatt.toFixed(2)} A</span>
            </div>
            <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
              <span className="text-[10px] text-slate-500 block">{t.inspector.emTorque}</span>
              <span className="text-emerald-400 font-bold text-sm">
                L: {agvState.Te_L.toFixed(2)} / R: {agvState.Te_R.toFixed(2)}
              </span>
              <span className="text-[9px] text-slate-500 block">{t.inspector.torqueUnit}</span>
            </div>
          </div>

          <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 space-y-1 text-[11px]">
            <div className="flex justify-between text-slate-400">
              <span>{t.inspector.statorIq}</span>
              <span className="text-sky-300 font-bold">L: {agvState.iq_L.toFixed(2)}A | R: {agvState.iq_R.toFixed(2)}A</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>{t.inspector.statorId}</span>
              <span className="text-slate-300">L: {agvState.id_L.toFixed(2)}A | R: {agvState.id_R.toFixed(2)}A</span>
            </div>
          </div>
        </div>
      )}

      {/* 6. Pacejka Tire Slip & Dynamic Normal Load Transfer */}
      {physicsFidelity === 'multiphysics' && agvState && (
        <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3 font-mono">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              <span className="font-semibold text-slate-200 font-sans text-xs">{t.inspector.pacejkaTire}</span>
            </div>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Magic Formula
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
              <span className="text-[10px] text-slate-500 block">{t.inspector.tireSlip}</span>
              <div className="flex justify-between text-[11px] pt-0.5">
                <span className="text-slate-400">{t.inspector.leftLabel}</span>
                <span className={`font-bold ${Math.abs(agvState.slip_L) > 0.1 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {(agvState.slip_L * 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">{t.inspector.rightLabel}</span>
                <span className={`font-bold ${Math.abs(agvState.slip_R) > 0.1 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {(agvState.slip_R * 100).toFixed(1)}%
                </span>
              </div>
            </div>

            <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
              <span className="text-[10px] text-slate-500 block">{t.inspector.pacejkaTraction}</span>
              <div className="flex justify-between text-[11px] pt-0.5">
                <span className="text-slate-400">{t.inspector.leftLabel}</span>
                <span className="text-sky-400 font-bold">{agvState.Fx_L.toFixed(1)} N</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">{t.inspector.rightLabel}</span>
                <span className="text-sky-400 font-bold">{agvState.Fx_R.toFixed(1)} N</span>
              </div>
            </div>
          </div>

          <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 space-y-1.5">
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-400">{t.inspector.driveWheelLoads}</span>
              <span className="text-yellow-400 font-bold">
                {agvState.Fz_L.toFixed(1)}N / {agvState.Fz_R.toFixed(1)}N
              </span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-400">{t.inspector.casterWheelLoads}</span>
              <span className="text-amber-300 font-bold">
                {agvState.Fz_cF.toFixed(1)}N / {agvState.Fz_cR.toFixed(1)}N
              </span>
            </div>
            <div className="flex justify-between text-[10px] text-slate-500 pt-0.5 border-t border-slate-800">
              <span>{t.inspector.dynamicLoadTransfer}</span>
              <span className="text-slate-300 font-bold">
                ΔFz,lat: {Math.abs(agvState.Fz_R - agvState.Fz_L).toFixed(1)} N
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 7. Dual Caster Swivel Flutter & 3D Chassis Attitude */}
      {physicsFidelity === 'multiphysics' && agvState && (
        <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2 font-mono">
          <div className="flex items-center space-x-2">
            <Waves className="w-4 h-4 text-cyan-400" />
            <span className="font-semibold text-slate-200 font-sans text-xs">{t.inspector.swivelCaster3D}</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-center text-[11px]">
            <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
              <span className="text-[10px] text-slate-500 block">{t.inspector.frontCasterAngle}</span>
              <span className="text-cyan-400 font-bold">{((agvState.psi_cF * 180) / Math.PI).toFixed(1)}°</span>
            </div>
            <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
              <span className="text-[10px] text-slate-500 block">{t.inspector.rearCasterAngle}</span>
              <span className="text-cyan-400 font-bold">{((agvState.psi_cR * 180) / Math.PI).toFixed(1)}°</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-center text-[11px] pt-1">
            <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
              <span className="text-[10px] text-slate-500 block">{t.inspector.pitchAttitude}</span>
              <span className="text-purple-400 font-bold">{agvState.pitchDeg.toFixed(2)}°</span>
            </div>
            <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
              <span className="text-[10px] text-slate-500 block">{t.inspector.rollAttitude}</span>
              <span className="text-purple-400 font-bold">{agvState.rollDeg.toFixed(2)}°</span>
            </div>
          </div>
        </div>
      )}

      {/* 8. Advanced Closed-Loop FOC / MTPA / Field-Weakening / CCC Telemetry */}
      {physicsFidelity === 'multiphysics' && agvState && (
        <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3 font-mono">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Cpu className="w-4 h-4 text-rose-400" />
              <span className="font-semibold text-slate-200 font-sans text-xs">{t.inspector.focControlStatus}</span>
            </div>
            <span className={`text-[9px] px-1.5 py-0.5 rounded border font-sans ${
              agvState.S_fw_L === 1 || agvState.S_fw_R === 1
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
            }`}>
              {agvState.S_fw_L === 1 || agvState.S_fw_R === 1 ? t.inspector.fieldWeakening : t.inspector.mtpaOptimal}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
              <span className="text-[10px] text-slate-500 block">{t.inspector.syncCompensation}</span>
              <span className="text-emerald-400 font-bold">{agvState.u_sync.toFixed(3)} Nm</span>
            </div>
            <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
              <span className="text-[10px] text-slate-500 block">{t.inspector.syncError}</span>
              <span className={`font-bold ${Math.abs(agvState.epsilon_ccc) > 0.05 ? 'text-amber-400' : 'text-sky-400'}`}>
                {agvState.epsilon_ccc.toFixed(4)} rad/s
              </span>
            </div>
          </div>

          <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 space-y-1.5 text-[10px]">
            <div className="flex justify-between">
              <span className="text-slate-400">{t.inspector.vectorVoltage}</span>
              <span className="text-rose-300 font-bold">
                {agvState.Vmag_L.toFixed(1)}V / {agvState.Vmag_R.toFixed(1)}V
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">{t.inspector.currentCmdId}</span>
              <span className="text-sky-300 font-bold">
                L: {agvState.id_ref_L.toFixed(2)}A | R: {agvState.id_ref_R.toFixed(2)}A
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">{t.inspector.currentCmdIq}</span>
              <span className="text-amber-300 font-bold">
                L: {agvState.iq_ref_L.toFixed(2)}A | R: {agvState.iq_ref_R.toFixed(2)}A
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
