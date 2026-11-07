import React, { useState, useMemo } from 'react';
import * as THREE from 'three';
import {
  Ruler,
  X,
  Crosshair,
  Info,
  Maximize2,
} from 'lucide-react';
import { useRobotStore } from '../../store/robotStore';
import { RobotKinematics } from '../../kinematics/RobotKinematics';

interface VirtualCaliperModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VirtualCaliperModal: React.FC<VirtualCaliperModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { robotModel, jointAngles } = useRobotStore();

  // Compute forward kinematics frames for each joint
  const frames = useMemo(() => {
    if (!robotModel) return [];
    return RobotKinematics.computeForwardKinematics(
      robotModel.joints,
      jointAngles
    );
  }, [robotModel, jointAngles]);

  const namedPoints = useMemo(() => {
    if (!robotModel || frames.length === 0) return [];

    const pts: { id: string; name: string; x: number; y: number; z: number }[] = [
      { id: 'origin_0', name: 'Base Origin O_0 [0, 0, 0]', x: 0, y: 0, z: 0 },
    ];

    frames.slice(1).forEach((mat: THREE.Matrix4, idx: number) => {
      const e = mat.elements;
      // In Three.js Column-Major matrix: translation is at indices 12, 13, 14
      pts.push({
        id: `joint_${idx + 1}`,
        name: `Joint ${idx + 1} Frame Origin O_${idx + 1}`,
        x: parseFloat(e[12].toFixed(1)),
        y: parseFloat(e[13].toFixed(1)),
        z: parseFloat(e[14].toFixed(1)),
      });
    });

    const tcpMat = frames[frames.length - 1];
    pts.push({
      id: 'tcp',
      name: 'End-Effector TCP Tool Point',
      x: parseFloat(tcpMat.elements[12].toFixed(1)),
      y: parseFloat(tcpMat.elements[13].toFixed(1)),
      z: parseFloat(tcpMat.elements[14].toFixed(1)),
    });

    return pts;
  }, [robotModel, frames]);

  const [ptAIndex, setPtAIndex] = useState(0);
  const [ptBIndex, setPtBIndex] = useState(1);

  if (!isOpen || !robotModel || namedPoints.length === 0) return null;

  const ptA = namedPoints[Math.min(ptAIndex, namedPoints.length - 1)] || namedPoints[0];
  const ptB = namedPoints[Math.min(ptBIndex, namedPoints.length - 1)] || namedPoints[namedPoints.length - 1];

  const dx = ptB.x - ptA.x;
  const dy = ptB.y - ptA.y;
  const dz = ptB.z - ptA.z;
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl max-w-2xl w-full flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-400/30 text-emerald-400">
              <Ruler className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-sm font-bold text-white tracking-wide">
                  Virtual 3D Caliper & Dimension Inspector
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full">
                  {robotModel.name}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Đo lường chính xác khoảng cách 3D Euclid và thành phần Descartes giữa các điểm mốc
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title="Đóng (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5">
          {/* Point Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Point A */}
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
              <label className="flex items-center space-x-2 text-xs font-semibold text-emerald-400 mb-2">
                <Crosshair className="w-4 h-4" />
                <span>Điểm mốc A (Điểm đầu)</span>
              </label>
              <select
                value={ptAIndex}
                onChange={(e) => setPtAIndex(parseInt(e.target.value, 10))}
                className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-2 font-mono focus:outline-none focus:border-emerald-500"
              >
                {namedPoints.map((pt, idx) => (
                  <option key={pt.id} value={idx}>
                    {pt.name}
                  </option>
                ))}
              </select>
              <div className="mt-2 text-[11px] font-mono text-slate-400 flex justify-between">
                <span>X: {ptA.x.toFixed(1)}</span>
                <span>Y: {ptA.y.toFixed(1)}</span>
                <span>Z: {ptA.z.toFixed(1)} mm</span>
              </div>
            </div>

            {/* Point B */}
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
              <label className="flex items-center space-x-2 text-xs font-semibold text-sky-400 mb-2">
                <Crosshair className="w-4 h-4" />
                <span>Điểm mốc B (Điểm cuối)</span>
              </label>
              <select
                value={ptBIndex}
                onChange={(e) => setPtBIndex(parseInt(e.target.value, 10))}
                className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-2 font-mono focus:outline-none focus:border-sky-500"
              >
                {namedPoints.map((pt, idx) => (
                  <option key={pt.id} value={idx}>
                    {pt.name}
                  </option>
                ))}
              </select>
              <div className="mt-2 text-[11px] font-mono text-slate-400 flex justify-between">
                <span>X: {ptB.x.toFixed(1)}</span>
                <span>Y: {ptB.y.toFixed(1)}</span>
                <span>Z: {ptB.z.toFixed(1)} mm</span>
              </div>
            </div>
          </div>

          {/* Large Caliper Measurement Card */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">
                Khoảng cách không gian 3D Euclid (d_Euclid):
              </span>
              <div className="flex items-baseline space-x-3 mt-1">
                <span className="text-2xl font-bold font-mono text-emerald-400">
                  {dist.toFixed(2)} mm
                </span>
                <span className="text-sm font-mono text-slate-400">
                  ({(dist / 1000).toFixed(4)} m)
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-2 text-xs font-mono bg-slate-900/80 px-3.5 py-2 rounded-xl border border-slate-800">
              <Maximize2 className="w-4 h-4 text-sky-400" />
              <span>Reach tối đa danh định: <strong>{robotModel.reachMm} mm</strong></span>
            </div>
          </div>

          {/* Component Deltas */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
              <span className="text-[10px] uppercase font-mono text-slate-400">ΔX (Độ lệch trục X)</span>
              <p className="text-sm font-mono font-bold text-rose-400 mt-1">
                {dx >= 0 ? `+${dx.toFixed(1)}` : dx.toFixed(1)} mm
              </p>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
              <span className="text-[10px] uppercase font-mono text-slate-400">ΔY (Độ lệch trục Y)</span>
              <p className="text-sm font-mono font-bold text-emerald-400 mt-1">
                {dy >= 0 ? `+${dy.toFixed(1)}` : dy.toFixed(1)} mm
              </p>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
              <span className="text-[10px] uppercase font-mono text-slate-400">ΔZ (Độ lệch chiều cao Z)</span>
              <p className="text-sm font-mono font-bold text-sky-400 mt-1">
                {dz >= 0 ? `+${dz.toFixed(1)}` : dz.toFixed(1)} mm
              </p>
            </div>
          </div>

          {/* Pedagogical Note */}
          <div className="p-3 rounded-xl bg-sky-950/20 border border-sky-800/40 text-xs text-slate-300 flex items-start space-x-2">
            <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong>Ứng dụng kiểm chứng D-H:</strong> Khi đo khoảng cách giữa hai gốc tọa độ liền kề O_(i-1) và O_i tại vị trí ban đầu θ = 0, khoảng cách chiếu theo trục z_(i-1) chính là độ dịch chuyển d_i, và khoảng cách chiếu theo trục x_i chính là chiều dài khâu a_i.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 text-xs font-semibold transition"
          >
            Đóng thước đo
          </button>
        </div>
      </div>
    </div>
  );
};
