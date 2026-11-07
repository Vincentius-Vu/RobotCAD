import React from 'react';
import { useRobotStore } from '../../store/robotStore';
import { WorkspaceSliceMode, WorkspaceColorMode } from '../../types/workspace';
import {
  X,
  Globe,
  Sparkles,
  Scissors,
  Loader2,
  Box,
  Palette,
  Check,
  ShieldCheck,
} from 'lucide-react';

export const WorkspacePanel: React.FC = () => {
  const {
    isWorkspaceDrawerOpen,
    toggleWorkspaceDrawer,
    robotModel,
    workspaceData,
    workspaceSettings,
    setWorkspaceSettings,
    isGeneratingWorkspace,
    workspaceProgressPct,
    generateWorkspaceCloud,
  } = useRobotStore();

  if (!isWorkspaceDrawerOpen) return null;

  const sliceModes: { id: WorkspaceSliceMode; label: string; desc: string }[] = [
    {
      id: 'full-3d',
      label: 'Full 3D Cloud',
      desc: 'Complete omnidirectional point cloud of reachable TCP workspace.',
    },
    {
      id: 'slice-xz',
      label: 'Side Slice (X-Z)',
      desc: 'Sagittal elevation cut showing arm extension profiles and inner dead zone.',
    },
    {
      id: 'slice-yz',
      label: 'Front Slice (Y-Z)',
      desc: 'Coronal elevation cross-section showing left-right symmetry.',
    },
    {
      id: 'slice-xy',
      label: 'Horizontal Slice (X-Y)',
      desc: 'Planar top-down slice at adjustable Z elevation.',
    },
  ];

  const colorModes: { id: WorkspaceColorMode; label: string }[] = [
    { id: 'yoshikawa', label: 'Yoshikawa Dexterity (w)' },
    { id: 'height', label: 'Z-Height Gradient' },
    { id: 'uniform', label: 'Monochrome Cyan' },
  ];

  const sampleOptions = [20000, 50000, 100000];

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-md bg-slate-900/95 backdrop-blur-xl border-l border-slate-800 shadow-2xl z-50 flex flex-col overflow-hidden">
      {/* Drawer Header */}
      <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-400">
            <Globe className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
              <span>Workspace & Reachability Cloud</span>
            </h2>
            <p className="text-[11px] text-slate-400 font-mono">
              Monte-Carlo Dexterity Sampling & 2D Slicing
            </p>
          </div>
        </div>

        <button
          onClick={toggleWorkspaceDrawer}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Drawer Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* Visibility Toggle & Generator Button */}
        <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-semibold text-slate-200">Point Cloud Display</h4>
              <p className="text-[10px] text-slate-400">
                Toggle 3D reachability cloud in the main viewport
              </p>
            </div>
            <button
              onClick={() => {
                const next = !workspaceSettings.visible;
                setWorkspaceSettings({ visible: next });
                if (next && !workspaceData) {
                  generateWorkspaceCloud();
                }
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                workspaceSettings.visible
                  ? 'bg-sky-600 text-white border-sky-500 shadow-md shadow-sky-600/20'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
              }`}
            >
              {workspaceSettings.visible ? 'Visible' : 'Hidden'}
            </button>
          </div>

          {/* Sample count selector & Re-generate */}
          <div className="pt-2 border-t border-slate-850 flex items-center justify-between gap-2">
            <div className="flex items-center space-x-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
              {sampleOptions.map((n) => (
                <button
                  key={n}
                  onClick={() => setWorkspaceSettings({ sampleCount: n })}
                  className={`px-2 py-1 rounded text-[10px] font-mono transition ${
                    workspaceSettings.sampleCount === n
                      ? 'bg-sky-600 text-white font-medium'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {(n / 1000).toFixed(0)}k pts
                </button>
              ))}
            </div>

            <button
              onClick={() => generateWorkspaceCloud(workspaceSettings.sampleCount)}
              disabled={isGeneratingWorkspace}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium shadow-md shadow-emerald-600/20 transition disabled:opacity-50"
            >
              {isGeneratingWorkspace ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{workspaceProgressPct}%</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Sample Cloud</span>
                </>
              )}
            </button>
          </div>

          {/* Progress bar */}
          {isGeneratingWorkspace && (
            <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
              <div
                style={{ width: `${workspaceProgressPct}%` }}
                className="h-full bg-emerald-500 transition-all duration-150"
              />
            </div>
          )}
        </div>

        {/* Physical Realistic Constraints & Dexterous Filtering */}
        <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800 space-y-3">
          <div className="flex items-center space-x-2 text-xs font-semibold text-slate-200">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Physical Realistic Constraints</span>
          </div>

          {/* Floor Collision Boundary */}
          <div className="flex items-center justify-between pt-1">
            <div>
              <h5 className="text-xs text-slate-200 font-medium">Floor Collision Limit (Z ≥ 0)</h5>
              <p className="text-[10px] text-slate-400">
                Disallow tool center point from penetrating the floor/table
              </p>
            </div>
            <button
              onClick={() =>
                setWorkspaceSettings({ enforceFloorLimit: !workspaceSettings.enforceFloorLimit })
              }
              className={`px-2.5 py-1 rounded text-xs font-mono transition border ${
                workspaceSettings.enforceFloorLimit
                  ? 'bg-emerald-600/30 text-emerald-300 border-emerald-500'
                  : 'bg-slate-900 text-slate-400 border-slate-800'
              }`}
            >
              {workspaceSettings.enforceFloorLimit ? 'Active' : 'Off'}
            </button>
          </div>

          {/* Dexterous Sweet Spot vs Reachable Envelope */}
          <div className="space-y-1.5 pt-2 border-t border-slate-850">
            <div className="flex justify-between text-[11px] font-mono">
              <span className="text-slate-300">Dexterous Filter (Sweet Spot w):</span>
              <span className="text-sky-400 font-semibold">
                {workspaceSettings.dexterousThreshold === 0
                  ? '0% (All Reachable)'
                  : `> ${Math.round(workspaceSettings.dexterousThreshold * 100)}% Max w`}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="0.6"
              step="0.05"
              value={workspaceSettings.dexterousThreshold}
              onChange={(e) =>
                setWorkspaceSettings({ dexterousThreshold: parseFloat(e.target.value) })
              }
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
            />
            <p className="text-[10px] text-slate-500">
              Filters out singular boundary positions where servo motors would over-torque.
            </p>
          </div>

          {/* Real Joint Limits Badges */}
          {robotModel && (
            <div className="pt-2 border-t border-slate-850 space-y-1.5">
              <span className="text-[10px] uppercase font-mono text-slate-400 tracking-wider">
                Physical Joint Rotation Limits [q_min, q_max]:
              </span>
              <div className="grid grid-cols-3 gap-1 text-[10px] font-mono">
                {robotModel.joints.map((j) => (
                  <div
                    key={j.jointIndex}
                    className="p-1 rounded bg-slate-900 border border-slate-850 text-center"
                  >
                    <span className="text-slate-400 font-semibold">J{j.jointIndex}:</span>{' '}
                    <span className="text-sky-300">
                      [{j.qMinDeg}°, {j.qMaxDeg}°]
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 2D Cross-Section Slicing Modes */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-300 flex items-center space-x-1.5">
            <Scissors className="w-3.5 h-3.5 text-amber-400" />
            <span>Interactive 2D Cross-Sections</span>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {sliceModes.map((mode) => (
              <button
                key={mode.id}
                onClick={() => setWorkspaceSettings({ sliceMode: mode.id })}
                className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                  workspaceSettings.sliceMode === mode.id
                    ? 'bg-sky-600/20 border-sky-500 text-white'
                    : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-medium">{mode.label}</h4>
                  {workspaceSettings.sliceMode === mode.id && (
                    <Check className="w-3 h-3 text-sky-400" />
                  )}
                </div>
                <p className="text-[10px] text-slate-400 mt-1 line-clamp-2">{mode.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Slicing Controls (Thickness & Elevation) */}
        {workspaceSettings.sliceMode !== 'full-3d' && (
          <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-3">
            {/* Slice Thickness */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-mono">
                <span className="text-slate-400">Slice Band Thickness (±Δ):</span>
                <span className="text-sky-400 font-semibold">{workspaceSettings.sliceThicknessMm} mm</span>
              </div>
              <input
                type="range"
                min="20"
                max="250"
                step="5"
                value={workspaceSettings.sliceThicknessMm}
                onChange={(e) =>
                  setWorkspaceSettings({ sliceThicknessMm: parseFloat(e.target.value) })
                }
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
              />
            </div>

            {/* Elevation Slider for XY Horizontal Slice */}
            {workspaceSettings.sliceMode === 'slice-xy' && (
              <div className="space-y-1 pt-2 border-t border-slate-850">
                <div className="flex justify-between text-[11px] font-mono">
                  <span className="text-slate-400">Cutting Elevation (Z):</span>
                  <span className="text-amber-400 font-semibold">{workspaceSettings.sliceElevationMm} mm</span>
                </div>
                <input
                  type="range"
                  min={workspaceData ? workspaceData.minZMm : -500}
                  max={workspaceData ? workspaceData.maxZMm : 1800}
                  step="10"
                  value={workspaceSettings.sliceElevationMm}
                  onChange={(e) =>
                    setWorkspaceSettings({ sliceElevationMm: parseFloat(e.target.value) })
                  }
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
              </div>
            )}
          </div>
        )}

        {/* Color Mode & Rendering Tweaks */}
        <div className="space-y-3">
          <label className="text-xs font-semibold text-slate-300 flex items-center space-x-1.5">
            <Palette className="w-3.5 h-3.5 text-sky-400" />
            <span>Heatmap & Point Styling</span>
          </label>

          <div className="grid grid-cols-3 gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px]">
            {colorModes.map((cm) => (
              <button
                key={cm.id}
                onClick={() => setWorkspaceSettings({ colorMode: cm.id })}
                className={`py-1.5 px-1 rounded-lg text-center transition truncate ${
                  workspaceSettings.colorMode === cm.id
                    ? 'bg-sky-600 text-white font-medium'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {cm.label}
              </button>
            ))}
          </div>

          {/* Point Size & Opacity */}
          <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950/80 rounded-xl border border-slate-800">
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] font-mono text-slate-400">
                <span>Point Size:</span>
                <span className="text-slate-200">{workspaceSettings.pointSize} px</span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                step="0.5"
                value={workspaceSettings.pointSize}
                onChange={(e) =>
                  setWorkspaceSettings({ pointSize: parseFloat(e.target.value) })
                }
                className="w-full h-1 bg-slate-800 rounded appearance-none cursor-pointer accent-sky-500"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[10px] font-mono text-slate-400">
                <span>Opacity:</span>
                <span className="text-slate-200">{Math.round(workspaceSettings.opacity * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={workspaceSettings.opacity}
                onChange={(e) =>
                  setWorkspaceSettings({ opacity: parseFloat(e.target.value) })
                }
                className="w-full h-1 bg-slate-800 rounded appearance-none cursor-pointer accent-sky-500"
              />
            </div>
          </div>
        </div>

        {/* Workspace Statistics Passport */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-300 flex items-center space-x-1.5">
            <Box className="w-3.5 h-3.5 text-emerald-400" />
            <span>Workspace Kinematic Passport</span>
          </label>

          {workspaceData ? (
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase">Max Reach Radius</span>
                <p className="text-base font-bold text-sky-400 mt-0.5">
                  {workspaceData.maxRadiusMm}{' '}
                  <span className="text-xs text-slate-400 font-normal">mm</span>
                </p>
              </div>

              <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase">Dead Zone Radius</span>
                <p className="text-base font-bold text-amber-400 mt-0.5">
                  {workspaceData.minRadiusMm}{' '}
                  <span className="text-xs text-slate-400 font-normal">mm</span>
                </p>
              </div>

              <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase">Z Height Range</span>
                <p className="text-sm font-bold text-slate-200 mt-0.5">
                  [{workspaceData.minZMm}, {workspaceData.maxZMm}]{' '}
                  <span className="text-xs text-slate-400 font-normal">mm</span>
                </p>
              </div>

              <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase">Occupied Volume</span>
                <p className="text-base font-bold text-emerald-400 mt-0.5">
                  {workspaceData.volumeM3}{' '}
                  <span className="text-xs text-slate-400 font-normal">m³</span>
                </p>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 text-center text-xs text-slate-400 font-mono">
              Click "Sample Cloud" above to calculate exact reachable boundaries and volume.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
