import React from 'react';
import { useRobotStore } from '../../store/robotStore';
import { useTranslation } from '../../i18n';
import { AVAILABLE_ROBOTS } from '../../services/robotLoader';
import {
  Bot,
  Layers,
  Settings2,
  Sparkles,
  Box,
  Sun,
  Moon,
  SlidersHorizontal,
  Camera,
  Activity,
  Waypoints,
  Globe,
} from 'lucide-react';

interface HeaderProps {
  onToggleSpecs: () => void;
  isSpecsOpen: boolean;
  onToggleEnvCamera: () => void;
  isEnvCameraOpen: boolean;
  onToggleIKJacobian: () => void;
  isIKJacobianOpen: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onToggleSpecs,
  isSpecsOpen,
  onToggleEnvCamera,
  isEnvCameraOpen,
  onToggleIKJacobian,
  isIKJacobianOpen,
}) => {
  const { language } = useTranslation();
  const isVi = language === 'vi';
  const {
    currentRobotId,
    loadRobot,
    robotModel,
    renderingStyle,
    setRenderingStyle,
    overlays,
    toggleOverlay,
    toggleSkeletonMode,
    backgroundTheme,
    setBackgroundTheme,
    triggerCapture,
    isTrajectoryDrawerOpen,
    toggleTrajectoryDrawer,
    waypoints,
    isWorkspaceDrawerOpen,
    toggleWorkspaceDrawer,
    workspaceSettings,
  } = useRobotStore();

  const isWhitePaper = backgroundTheme === 'academic-white';

  return (
    <header className="absolute top-0 left-0 right-0 h-16 bg-slate-900/85 backdrop-blur-md border-b border-slate-800 z-30 px-6 flex items-center justify-between">
      {/* Left: Branding & Model Switcher */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2.5">
          <div className="w-9 h-9 rounded-lg bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-400">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-slate-100 flex items-center space-x-2">
              <span>RoboKinematics 3D</span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
                WebGL
              </span>
            </h1>
            <p className="text-[11px] text-slate-400 font-mono">Denavit–Hartenberg Forward Kinematics</p>
          </div>
        </div>

        <div className="h-6 w-px bg-slate-800" />

        {/* Model Selector Dropdown */}
        <div className="flex items-center space-x-2">
          <label className="text-xs text-slate-400 font-medium">Model:</label>
          <select
            value={currentRobotId}
            onChange={(e) => loadRobot(e.target.value)}
            className="bg-slate-800/90 hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-md px-3 py-1.5 text-xs font-mono font-medium focus:outline-none focus:ring-1 focus:ring-sky-500 transition cursor-pointer"
          >
            {AVAILABLE_ROBOTS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.manufacturer} {r.name}
              </option>
            ))}
          </select>
        </div>

        {/* Model Spec Badge */}
        {robotModel && (
          <div className="hidden lg:flex items-center space-x-3 text-[11px] font-mono text-slate-400 bg-slate-950/50 px-3 py-1 rounded-md border border-slate-800/80">
            <span>Payload: <b className="text-slate-200">{robotModel.payloadKg} kg</b></span>
            <span>•</span>
            <span>Reach: <b className="text-slate-200">~{Math.round(robotModel.reachMm)} mm</b></span>
            <span>•</span>
            <span>DOF: <b className="text-sky-400">{robotModel.dof}</b></span>
          </div>
        )}
      </div>

      {/* Right: Render Style, Visual Overlays, Lighting/Camera & Technical Drawer */}
      <div className="flex items-center space-x-2.5">
        {/* Quick Academic White / Dark Paper Toggle */}
        <button
          onClick={() => setBackgroundTheme(isWhitePaper ? 'studio-dark' : 'academic-white')}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
            isWhitePaper
              ? 'bg-white text-slate-900 border-slate-300 shadow-md font-semibold'
              : 'bg-slate-800/90 text-slate-300 border-slate-700 hover:text-white'
          }`}
          title={isWhitePaper ? (isVi ? 'Đang ở chế độ Nền trắng (Academic Paper). Nhấn để chuyển nền tối.' : 'Academic White Paper theme active. Click to switch to dark mode.') : (isVi ? 'Chuyển sang Nền trắng tinh khiết để chụp hình chèn vào sách/bài giảng' : 'Switch to pure white paper theme for paper/book figure capture')}
        >
          {isWhitePaper ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-sky-400" />}
          <span className="hidden sm:inline">{isWhitePaper ? 'Paper White' : 'Dark Mode'}</span>
        </button>

        {/* Quick 1-Click Snapshot Button */}
        <button
          onClick={() => triggerCapture(isWhitePaper ? 'white' : 'transparent')}
          className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-emerald-600/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-600/30 transition"
          title={isVi ? "Chụp ảnh 2X độ phân giải cao tải về máy ngay lập tức" : "Instant high-resolution 2X PNG snapshot"}
        >
          <Camera className="w-4 h-4 text-emerald-400" />
          <span className="hidden md:inline">Snap PNG</span>
        </button>

        {/* Rendering Style Toggle */}
        <div className="flex items-center bg-slate-800/80 p-0.5 rounded-lg border border-slate-700/80 text-xs">
          <button
            onClick={() => setRenderingStyle('solid')}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md transition ${
              renderingStyle === 'solid'
                ? 'bg-sky-600 text-white font-medium shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Solid Metallic PBR Material"
          >
            <Box className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Solid</span>
          </button>
          <button
            onClick={() => setRenderingStyle('ghosted')}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md transition ${
              renderingStyle === 'ghosted'
                ? 'bg-sky-600 text-white font-medium shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Ghosted Translucent X-Ray with Wireframe Edges"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Ghosted</span>
          </button>
        </div>

        {/* Overlay Quick Toggles */}
        <div className="hidden sm:flex items-center space-x-1 bg-slate-800/80 p-1 rounded-lg border border-slate-700/80">
          <button
            onClick={() => toggleOverlay('showFrames')}
            className={`p-1.5 rounded text-xs transition ${
              overlays.showFrames
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Toggle D-H Frames {0}..{6}"
          >
            <Layers className="w-4 h-4" />
          </button>
          <div className="flex items-center">
            <button
              onClick={() => toggleOverlay('showSkeleton')}
              className={`px-2 py-1 text-xs font-mono font-medium transition ${
                overlays.showSkeleton
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 rounded-l'
                  : 'text-slate-400 hover:text-slate-200 rounded'
              }`}
              title="Toggle Kinematic Skeleton Backbone"
            >
              Skel
            </button>
            {overlays.showSkeleton && (
              <button
                onClick={() => toggleSkeletonMode()}
                className="px-1.5 py-1 bg-sky-950/80 hover:bg-sky-900 border border-l-0 border-sky-500/40 rounded-r text-[10px] font-mono text-sky-200 font-semibold transition"
                title={`Chế độ khung xương: ${overlays.skeletonMode === 'physical' ? 'Cơ học thực tế (Physical Linkage)' : 'Hệ trục D-H toán học (Mathematical D-H)'}. Bấm để đổi.`}
              >
                {overlays.skeletonMode === 'physical' ? 'Phys' : 'D-H'}
              </button>
            )}
          </div>
          <button
            onClick={() => toggleOverlay('showTcp')}
            className={`px-2 py-1 rounded text-xs font-mono font-medium transition ${
              overlays.showTcp
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Toggle Tool Center Point (TCP) Marker"
          >
            TCP
          </button>
        </div>

        {/* Lighting & Camera Adjustments Panel Toggle */}
        <button
          onClick={onToggleEnvCamera}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
            isEnvCameraOpen
              ? 'bg-sky-600 text-white border-sky-500 shadow-md shadow-sky-600/30'
              : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750 hover:text-white'
          }`}
          title="Tùy chỉnh Ánh sáng, Sắc độ nền và Góc nhìn Camera (FOV)"
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span className="hidden md:inline">Lighting & Camera</span>
        </button>

        {/* IK & Jacobian Analysis Drawer Button */}
        <button
          onClick={onToggleIKJacobian}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
            isIKJacobianOpen
              ? 'bg-amber-600 text-white border-amber-500 shadow-md shadow-amber-600/30'
              : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750 hover:text-white'
          }`}
          title="Inverse Kinematics (8 Postures), 3D TCP Gizmo, Jacobian Matrix & Manipulability Ellipsoid"
        >
          <Activity className="w-4 h-4 text-amber-400" />
          <span className="hidden md:inline">IK & Jacobian</span>
        </button>

        {/* Trajectory Planning Drawer Button */}
        <button
          onClick={toggleTrajectoryDrawer}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
            isTrajectoryDrawerOpen
              ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-600/30'
              : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750 hover:text-white'
          }`}
          title="Trajectory Planning, Waypoints Sequencer & Motion Profiles"
        >
          <Waypoints className="w-4 h-4 text-purple-400" />
          <span className="hidden md:inline">Trajectory ({waypoints.length})</span>
        </button>

        {/* Workspace Cloud & 2D Slicing Drawer Button */}
        <button
          onClick={toggleWorkspaceDrawer}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
            isWorkspaceDrawerOpen || workspaceSettings.visible
              ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-600/30'
              : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750 hover:text-white'
          }`}
          title="Workspace Analysis, 3D Monte-Carlo Cloud & 2D Cross-Sections"
        >
          <Globe className="w-4 h-4 text-emerald-400" />
          <span className="hidden md:inline">Workspace</span>
        </button>

        {/* Technical Specs & D-H Table Drawer Button */}
        <button
          onClick={onToggleSpecs}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
            isSpecsOpen
              ? 'bg-sky-600 text-white border-sky-500 shadow-md shadow-sky-600/30'
              : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750 hover:text-white'
          }`}
        >
          <Settings2 className="w-4 h-4" />
          <span className="hidden md:inline">D-H Specs</span>
        </button>
      </div>
    </header>
  );
};

