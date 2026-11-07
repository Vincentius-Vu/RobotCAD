import React from 'react';
import { useRobotStore } from '../../store/robotStore';
import { DEFAULT_LINK_PALETTE } from '../../services/robotLoader';

export const DHTable: React.FC = () => {
  const { robotModel, jointAngles } = useRobotStore();

  if (!robotModel) return null;

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-mono">
          <thead className="bg-slate-950/70 text-slate-400 border-b border-slate-800">
            <tr>
              <th className="py-2 px-3 font-semibold text-center">Khớp / Khâu</th>
              <th className="py-2 px-3 font-semibold text-amber-300/90" title="Thông số Khớp (Joint Variable)">
                θ (deg) <span className="text-[9px] text-amber-400/60 block font-normal">Joint</span>
              </th>
              <th className="py-2 px-3 font-semibold text-amber-300/90" title="Độ dịch chuyển khớp (Joint Offset)">
                d (mm) <span className="text-[9px] text-amber-400/60 block font-normal">Joint</span>
              </th>
              <th className="py-2 px-3 font-semibold text-sky-300/90" title="Chiều dài khâu (Link Length)">
                a (mm) <span className="text-[9px] text-sky-400/60 block font-normal">Link</span>
              </th>
              <th className="py-2 px-3 font-semibold text-sky-300/90" title="Góc xoắn khâu (Link Twist)">
                α (deg) <span className="text-[9px] text-sky-400/60 block font-normal">Link</span>
              </th>
              <th className="py-2 px-3 font-semibold text-slate-400">Giới hạn (deg)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-300">
            {robotModel.joints.map((joint, idx) => {
              const currentQ = jointAngles[idx] !== undefined ? jointAngles[idx] : 0;
              const totalTheta = joint.thetaOffsetDeg + currentQ;
              const linkColor =
                robotModel.links[idx + 1]?.color ||
                DEFAULT_LINK_PALETTE[(idx + 1) % DEFAULT_LINK_PALETTE.length];

              return (
                <tr key={idx} className="hover:bg-slate-800/40 transition">
                  <td className="py-2 px-2.5 text-center">
                    <div className="flex items-center justify-center space-x-1 font-mono font-bold text-[11px]">
                      {/* Joint Badge (Khớp) */}
                      <span
                        className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs"
                        title={`Khớp quay J${idx + 1}`}
                      >
                        J{idx + 1}
                      </span>
                      {/* Link Badge (Khâu) */}
                      <span
                        className="px-1.5 py-0.5 rounded text-slate-100 font-semibold border shadow-xs"
                        style={{
                          backgroundColor: `${linkColor}33`,
                          borderColor: linkColor,
                          color: '#f8fafc',
                        }}
                        title={`Khâu cơ khí L${idx + 1}`}
                      >
                        L{idx + 1}
                      </span>
                    </div>
                  </td>
                  <td className="py-2 px-3 bg-amber-500/[0.02]">
                    <span className="text-amber-400 font-semibold">{totalTheta.toFixed(1)}°</span>
                    {joint.thetaOffsetDeg !== 0 && (
                      <span className="text-[10px] text-slate-500 ml-1">
                        ({joint.thetaOffsetDeg > 0 ? `+${joint.thetaOffsetDeg}` : joint.thetaOffsetDeg})
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-3 bg-amber-500/[0.02] text-amber-200/90">{joint.d}</td>
                  <td className="py-2 px-3 bg-sky-500/[0.02] text-sky-200 font-medium">{joint.a}</td>
                  <td className="py-2 px-3 bg-sky-500/[0.02] text-sky-200">{joint.alphaDeg}°</td>
                  <td className="py-2 px-3 text-slate-400 text-[11px]">
                    [{joint.qMinDeg}°, {joint.qMaxDeg}°]
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Educational Color Legend */}
      <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
        <div className="flex items-center space-x-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 border border-amber-300 shadow-xs shadow-amber-400/50" />
          <span className="text-slate-300">
            <strong className="text-amber-300">Khớp (Joint):</strong> Vị trí trục quay/chuyển động (θ, d)
          </span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-gradient-to-r from-blue-500 via-emerald-500 to-amber-500" />
          <span className="text-slate-300">
            <strong className="text-sky-300">Khâu (Link):</strong> Thanh cơ khí nối giữa 2 khớp (a, α)
          </span>
        </div>
      </div>
    </div>
  );
};
