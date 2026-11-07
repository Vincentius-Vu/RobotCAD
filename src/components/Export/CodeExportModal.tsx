import React, { useState, useMemo } from 'react';
import {
  Code,
  Copy,
  Check,
  Download,
  X,
  FileCode,
  Settings,
  Terminal,
  Cpu,
  Boxes,
} from 'lucide-react';
import { useRobotStore } from '../../store/robotStore';
import { CodeExportTarget, CodeExportOptions } from '../../types/codeExport';
import { generateRobotCode } from '../../services/codeGenerators';

interface CodeExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CodeExportModal: React.FC<CodeExportModalProps> = ({ isOpen, onClose }) => {
  const { robotModel, jointAngles } = useRobotStore();

  const [target, setTarget] = useState<CodeExportTarget>('python-rtb');
  const [includeKinematics, setIncludeKinematics] = useState(true);
  const [includeJacobian, setIncludeJacobian] = useState(true);
  const [includeDynamics, setIncludeDynamics] = useState(true);
  const [includeVisualization, setIncludeVisualization] = useState(true);
  const [useCurrentAngles, setUseCurrentAngles] = useState(true);
  const [copied, setCopied] = useState(false);

  const options: CodeExportOptions = useMemo(
    () => ({
      target,
      includeKinematics,
      includeJacobian,
      includeDynamics,
      includeVisualization,
      useCurrentAngles,
    }),
    [
      target,
      includeKinematics,
      includeJacobian,
      includeDynamics,
      includeVisualization,
      useCurrentAngles,
    ]
  );

  const result = useMemo(() => {
    if (!robotModel) return null;
    return generateRobotCode(robotModel, jointAngles, options);
  }, [robotModel, jointAngles, options]);

  if (!isOpen || !robotModel || !result) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(result.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([result.code], { type: result.mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = result.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const platforms: { id: CodeExportTarget; name: string; tag: string; icon: React.ReactNode }[] = [
    {
      id: 'python-rtb',
      name: 'Python',
      tag: 'Robotics Toolbox',
      icon: <Terminal className="w-4 h-4 text-emerald-400" />,
    },
    {
      id: 'cpp-eigen',
      name: 'C++17',
      tag: 'cppnb / Eigen3',
      icon: <Cpu className="w-4 h-4 text-sky-400" />,
    },
    {
      id: 'matlab-rst',
      name: 'MATLAB',
      tag: 'System Toolbox',
      icon: <FileCode className="w-4 h-4 text-amber-400" />,
    },
    {
      id: 'ros2-urdf',
      name: 'ROS 2 URDF',
      tag: 'RViz2 & Gazebo',
      icon: <Boxes className="w-4 h-4 text-rose-400" />,
    },
  ];

  const lines = result.code.split('\n');

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl max-w-5xl w-full h-[88vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-400/30 text-sky-400">
              <Code className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-sm font-bold text-white tracking-wide">
                  Multi-Platform Code Exporter
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-mono bg-sky-500/20 text-sky-300 border border-sky-500/30 rounded-full">
                  {robotModel.name} ({robotModel.dof} DOF)
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {result.description}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title="Close dialog (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Platform Selection Tabs */}
        <div className="px-5 pt-3 pb-2 bg-slate-900/90 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center space-x-2">
            {platforms.map((p) => {
              const active = target === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setTarget(p.id)}
                  className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl border text-xs font-medium transition ${
                    active
                      ? 'bg-sky-600/20 border-sky-500 text-sky-300 shadow-sm shadow-sky-500/20'
                      : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  {p.icon}
                  <span className="font-semibold">{p.name}</span>
                  <span className="text-[10px] text-slate-400 hidden sm:inline">({p.tag})</span>
                </button>
              );
            })}
          </div>

          {/* Quick Actions (Copy & Download) */}
          <div className="flex items-center space-x-2">
            <button
              onClick={handleCopy}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold font-mono transition ${
                copied
                  ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300'
                  : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-750 hover:text-white'
              }`}
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied!' : 'Copy Code'}</span>
            </button>

            <button
              onClick={handleDownload}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs font-mono shadow-md shadow-sky-600/30 transition"
              title={`Download ${result.fileName}`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download {result.fileName}</span>
            </button>
          </div>
        </div>

        {/* Configuration Options Bar */}
        <div className="px-5 py-2 bg-slate-950/60 border-b border-slate-800/80 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium text-slate-300 shrink-0">
          <div className="flex items-center space-x-1.5 text-slate-400">
            <Settings className="w-3.5 h-3.5" />
            <span className="text-[11px] uppercase tracking-wider font-semibold">Options:</span>
          </div>

          <label className="flex items-center space-x-1.5 cursor-pointer hover:text-white transition">
            <input
              type="checkbox"
              checked={useCurrentAngles}
              onChange={(e) => setUseCurrentAngles(e.target.checked)}
              className="rounded bg-slate-800 border-slate-700 text-sky-500 focus:ring-0 focus:ring-offset-0"
            />
            <span>Inject Current Posture q [{jointAngles.map((a) => a.toFixed(0) + '°').join(', ')}]</span>
          </label>

          <label className="flex items-center space-x-1.5 cursor-pointer hover:text-white transition">
            <input
              type="checkbox"
              checked={includeKinematics}
              onChange={(e) => setIncludeKinematics(e.target.checked)}
              className="rounded bg-slate-800 border-slate-700 text-sky-500 focus:ring-0 focus:ring-offset-0"
            />
            <span>Include Kinematics (FK / IK)</span>
          </label>

          <label className="flex items-center space-x-1.5 cursor-pointer hover:text-white transition">
            <input
              type="checkbox"
              checked={includeJacobian}
              onChange={(e) => setIncludeJacobian(e.target.checked)}
              className="rounded bg-slate-800 border-slate-700 text-sky-500 focus:ring-0 focus:ring-offset-0"
            />
            <span>Include Geometric Jacobian</span>
          </label>

          <label className="flex items-center space-x-1.5 cursor-pointer hover:text-white transition">
            <input
              type="checkbox"
              checked={includeDynamics}
              onChange={(e) => setIncludeDynamics(e.target.checked)}
              className="rounded bg-slate-800 border-slate-700 text-sky-500 focus:ring-0 focus:ring-offset-0"
            />
            <span>Include Dynamics (RNE / Inertia)</span>
          </label>

          {target !== 'ros2-urdf' && (
            <label className="flex items-center space-x-1.5 cursor-pointer hover:text-white transition">
              <input
                type="checkbox"
                checked={includeVisualization}
                onChange={(e) => setIncludeVisualization(e.target.checked)}
                className="rounded bg-slate-800 border-slate-700 text-sky-500 focus:ring-0 focus:ring-offset-0"
              />
              <span>Include 3D Visualizer Script</span>
            </label>
          )}
        </div>

        {/* Code Viewport with Line Numbers */}
        <div className="flex-1 overflow-auto bg-slate-950 font-mono text-xs flex">
          {/* Line Numbers Gutter */}
          <div className="py-4 px-3 bg-slate-900/60 text-slate-500 text-right select-none border-r border-slate-800/80 shrink-0">
            {lines.map((_, i) => (
              <div key={i} className="leading-5 h-5 text-[11px]">
                {i + 1}
              </div>
            ))}
          </div>

          {/* Actual Code View */}
          <div className="py-4 px-4 flex-1 text-slate-200 overflow-x-auto selection:bg-sky-500/30">
            <pre className="font-mono leading-5 text-[11.5px] whitespace-pre">
              {result.code}
            </pre>
          </div>
        </div>

        {/* Instructions Footer */}
        <div className="px-5 py-2.5 bg-slate-950 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <div className="flex items-center space-x-2">
            <Terminal className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span className="font-mono text-[11px] text-slate-300">
              {result.instructions}
            </span>
          </div>

          <span className="text-[11px] text-slate-400 font-mono">
            {lines.length} lines • {(result.code.length / 1024).toFixed(1)} KB
          </span>
        </div>
      </div>
    </div>
  );
};
