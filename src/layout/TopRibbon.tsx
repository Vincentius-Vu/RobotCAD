import React from 'react';
import { useRobotStore } from '../store/robotStore';
import { useMobileRobotStore } from '../store/mobileRobotStore';
import { AVAILABLE_ROBOTS } from '../services/robotLoader';
import { WorkspaceMode } from '../types/ui';
import { useTranslation } from '../i18n';
import {
  Bot,
  Sliders,
  Activity,
  Waypoints,
  Globe,
  Cpu,
  Layers,
  Camera,
  Code,
  GraduationCap,
  Ruler,
  FileText,
  SlidersHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Sun,
  Moon,
} from 'lucide-react';

interface TopRibbonProps {
  onOpenEnvCamera: () => void;
  onOpenExportPNG: () => void;
  onOpenCodeExport: () => void;
  onOpenDHQuiz: () => void;
  onOpenCaliper: () => void;
  onOpenReport: () => void;
  onOpenOscilloscopeDialog?: () => void;
}

export const TopRibbon: React.FC<TopRibbonProps> = ({
  onOpenEnvCamera,
  onOpenExportPNG,
  onOpenCodeExport,
  onOpenDHQuiz,
  onOpenCaliper,
  onOpenReport,
  onOpenOscilloscopeDialog,
}) => {
  const { t, language, toggleLanguage } = useTranslation();

  const {
    activeDomain,
    setActiveDomain,
    currentRobotId,
    loadRobot,
    activeWorkspaceMode,
    setActiveWorkspaceMode,
    isLeftSidebarOpen,
    toggleLeftSidebar,
    isRightInspectorOpen,
    toggleRightInspector,
    overlays,
    toggleOverlay,
    toggleSkeletonMode,
    isRecording,
    recordingSeconds,
    startVideoRecording,
    stopVideoRecording,
    backgroundTheme,
    setBackgroundTheme,
  } = useRobotStore();

  const {
    specs: mobileSpecs,
    setDriveType: setMobileDriveType,
    cameraMode: mobileCameraMode,
    setCameraMode: setMobileCameraMode,
  } = useMobileRobotStore();

  const modes: { id: WorkspaceMode; label: string; icon: React.ReactNode }[] = [
    { id: 'jogging', label: t.topRibbon.joggingTab, icon: <Sliders className="w-3.5 h-3.5" /> },
    { id: 'ik', label: t.topRibbon.ikTab, icon: <Activity className="w-3.5 h-3.5" /> },
    { id: 'trajectory', label: t.topRibbon.trajectoryTab, icon: <Waypoints className="w-3.5 h-3.5" /> },
    { id: 'workspace', label: t.topRibbon.workspaceTab, icon: <Globe className="w-3.5 h-3.5" /> },
    { id: 'dynamics', label: t.topRibbon.dynamicsTab, icon: <Cpu className="w-3.5 h-3.5" /> },
  ];

  const formatRec = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const isWhitePaper = backgroundTheme === 'academic-white';

  return (
    <header className="h-14 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between select-none z-30 shrink-0">
      {/* Left: Branding & Model Switcher & Left Sidebar Toggle */}
      <div className="flex items-center space-x-3">
        <button
          onClick={toggleLeftSidebar}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          title={isLeftSidebarOpen ? t.topRibbon.collapseLeft : t.topRibbon.expandLeft}
        >
          {isLeftSidebarOpen ? (
            <PanelLeftClose className="w-4 h-4" />
          ) : (
            <PanelLeftOpen className="w-4 h-4 text-sky-400" />
          )}
        </button>

        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 rounded-lg bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-400">
            <Bot className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold text-slate-100 hidden sm:inline">
            {t.topRibbon.brandName}
          </span>
        </div>

        <div className="h-5 w-px bg-slate-800" />

        {/* Primary Domain Switcher */}
        <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800">
          <button
            onClick={() => setActiveDomain('manipulator')}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center space-x-1 transition ${
              activeDomain === 'manipulator'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>{t.topRibbon.domainManipulator}</span>
          </button>
          <button
            onClick={() => setActiveDomain('mobile_robot')}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center space-x-1 transition ${
              activeDomain === 'mobile_robot'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>{t.topRibbon.domainMobile}</span>
          </button>
        </div>

        <div className="h-5 w-px bg-slate-800 hidden sm:block" />

        {/* Model Selector depending on active domain */}
        {activeDomain === 'manipulator' ? (
          <select
            value={currentRobotId}
            onChange={(e) => loadRobot(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-sky-500 font-mono"
          >
            {AVAILABLE_ROBOTS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.manufacturer})
              </option>
            ))}
          </select>
        ) : (
          <select
            value={mobileSpecs.driveType}
            onChange={(e) => setMobileDriveType(e.target.value as any)}
            className="bg-slate-950 border border-slate-800 text-emerald-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-emerald-500 font-mono"
          >
            <option value="differential">TurtleBot / Pioneer (Diff-Drive)</option>
            <option value="mecanum">KUKA youBot Base (Mecanum-4WD)</option>
          </select>
        )}
      </div>

      {/* Center: 5 Workspace Mode Tabs (Manipulator) OR Camera Views (Mobile Robot) */}
      {activeDomain === 'manipulator' ? (
        <div className="hidden md:flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 space-x-1">
          {modes.map((m) => (
            <button
              key={m.id}
              onClick={() => setActiveWorkspaceMode(m.id)}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-medium transition ${
                activeWorkspaceMode === m.id
                  ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              {m.icon}
              <span>{m.label}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="hidden md:flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 space-x-1 font-sans">
          <button
            onClick={() => setMobileCameraMode('orbit')}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
              mobileCameraMode === 'orbit'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            🌐 3D Orbit
          </button>
          <button
            onClick={() => setMobileCameraMode('chase')}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
              mobileCameraMode === 'chase'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            🎥 {t.topRibbon.camFollow}
          </button>
          <button
            onClick={() => setMobileCameraMode('top_down')}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
              mobileCameraMode === 'top_down'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            🗺️ {t.topRibbon.camTop}
          </button>
        </div>
      )}

      {/* Right: Quick Overlays, Language Toggle, Video Rec, Snapshot, Right Inspector Toggle */}
      <div className="flex items-center space-x-2">
        {/* Quick Overlays */}
        <div className="hidden lg:flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 space-x-0.5">
          <button
            onClick={() => toggleOverlay('showFrames')}
            className={`p-1.5 rounded text-xs transition ${
              overlays.showFrames
                ? 'bg-sky-500/20 text-sky-300'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title={t.topRibbon.framesTooltip}
          >
            <Layers className="w-3.5 h-3.5" />
          </button>
          <div className="flex items-center">
            <button
              onClick={() => toggleOverlay('showSkeleton')}
              className={`px-1.5 py-1 text-[10px] font-mono font-medium transition ${
                overlays.showSkeleton
                  ? 'bg-sky-500/20 text-sky-300 rounded-l'
                  : 'text-slate-400 hover:text-slate-200 rounded'
              }`}
              title={t.topRibbon.skeletonTooltip}
            >
              {t.topRibbon.skeleton}
            </button>
            {overlays.showSkeleton && (
              <button
                onClick={() => toggleSkeletonMode()}
                className={`px-1.5 py-1 border-l rounded-r text-[9px] font-mono font-semibold transition ${
                  overlays.skeletonMode === 'physical'
                    ? 'bg-emerald-950/80 hover:bg-emerald-900 border-emerald-700/60 text-emerald-300'
                    : 'bg-amber-950/80 hover:bg-amber-900 border-amber-700/60 text-amber-300'
                }`}
                title={t.topRibbon.skeletonTooltip}
              >
                {overlays.skeletonMode === 'physical' ? t.topRibbon.skeletonPhys : t.topRibbon.skeletonDH}
              </button>
            )}
          </div>
          <button
            onClick={() => toggleOverlay('showGrid')}
            className={`px-1.5 py-1 rounded text-[10px] font-mono font-medium transition ${
              overlays.showGrid
                ? 'bg-sky-500/20 text-sky-300'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title={t.topRibbon.gridTooltip}
          >
            {t.topRibbon.grid}
          </button>
        </div>

        {/* Paper White / Studio Dark Quick Toggle */}
        <button
          onClick={() =>
            setBackgroundTheme(isWhitePaper ? 'studio-dark' : 'academic-white')
          }
          className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-750 border border-slate-700 transition"
          title={isWhitePaper ? t.topRibbon.darkModeTitle : t.topRibbon.paperWhiteTitle}
        >
          {isWhitePaper ? (
            <Moon className="w-3.5 h-3.5 text-sky-400" />
          ) : (
            <Sun className="w-3.5 h-3.5 text-amber-400" />
          )}
        </button>

        {/* Academic Language En/Vie Switcher */}
        <button
          onClick={toggleLanguage}
          className="flex items-center space-x-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700 transition font-mono text-[11px] font-semibold"
          title={language === 'en' ? 'Switch to Tiếng Việt' : 'Switch to Academic English'}
        >
          <Globe className="w-3.5 h-3.5 text-sky-400" />
          <span className={language === 'en' ? 'text-sky-400 font-bold' : 'text-slate-400'}>EN</span>
          <span className="text-slate-600">|</span>
          <span className={language === 'vi' ? 'text-amber-400 font-bold' : 'text-slate-400'}>VI</span>
        </button>

        {/* Video Recording */}
        <button
          onClick={() => (isRecording ? stopVideoRecording() : startVideoRecording())}
          className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-mono font-medium transition ${
            isRecording
              ? 'bg-rose-600/30 text-rose-300 border-rose-500 shadow-md shadow-rose-600/20'
              : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white hover:bg-slate-750'
          }`}
          title={isRecording ? t.topRibbon.stopRecord : t.topRibbon.recordVideo}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              isRecording ? 'bg-rose-500 animate-ping' : 'bg-rose-500'
            }`}
          />
          <span className="hidden sm:inline">
            {isRecording ? formatRec(recordingSeconds) : t.topRibbon.rec}
          </span>
        </button>

        {/* Snapshot PNG (DPI) */}
        <button
          onClick={onOpenExportPNG}
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700 transition"
          title={t.topRibbon.snapshotDPI}
        >
          <Camera className="w-3.5 h-3.5 text-amber-400" />
        </button>

        {/* Virtual Lab: D-H Quiz */}
        <button
          onClick={onOpenDHQuiz}
          className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 hover:text-amber-300 border border-amber-500/30 transition"
          title={t.topRibbon.dhQuiz}
        >
          <GraduationCap className="w-3.5 h-3.5" />
        </button>

        {/* Virtual Lab: Caliper 3D Ruler */}
        <button
          onClick={onOpenCaliper}
          className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 border border-emerald-500/30 transition"
          title={t.topRibbon.caliper}
        >
          <Ruler className="w-3.5 h-3.5" />
        </button>

        {/* Code Export (Multi-Platform Python / C++ / MATLAB / ROS 2 URDF) */}
        <button
          onClick={onOpenCodeExport}
          className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 hover:text-sky-300 border border-sky-500/30 font-mono text-xs font-semibold transition"
          title={t.topRibbon.codeExport}
        >
          <Code className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Code</span>
        </button>

        {/* Academic Report (Thesis & LaTeX Exporter) */}
        <button
          onClick={onOpenReport}
          className="p-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 hover:text-purple-300 border border-purple-500/30 transition"
          title={t.topRibbon.academicReport}
        >
          <FileText className="w-3.5 h-3.5" />
        </button>

        {/* Multi-Physics Oscilloscope Dialog & Pop-out */}
        <button
          onClick={onOpenOscilloscopeDialog}
          className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-400 hover:text-sky-300 border border-sky-500/40 font-mono text-xs font-semibold transition shadow-sm"
          title={t.topRibbon.oscilloscope}
        >
          <Activity className="w-3.5 h-3.5 text-sky-400" />
          <span className="hidden lg:inline">Oscilloscope</span>
        </button>

        {/* Lighting & Camera */}
        <button
          onClick={onOpenEnvCamera}
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700 transition"
          title={t.topRibbon.lightingCamera}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
        </button>

        <div className="h-5 w-px bg-slate-800" />

        {/* Right Inspector Toggle */}
        <button
          onClick={() => toggleRightInspector()}
          className={`p-1.5 rounded-lg border transition ${
            isRightInspectorOpen
              ? 'bg-sky-600 text-white border-sky-500 shadow-md shadow-sky-600/30'
              : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white hover:bg-slate-750'
          }`}
          title={t.topRibbon.inspector}
        >
          {isRightInspectorOpen ? (
            <PanelRightClose className="w-4 h-4" />
          ) : (
            <PanelRightOpen className="w-4 h-4" />
          )}
        </button>
      </div>
    </header>
  );
};
