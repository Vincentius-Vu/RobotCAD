import React from 'react';
import { useRobotStore } from '../../store/robotStore';
import { BackgroundTheme } from '../../types/robot';
import {
  Sun,
  Camera,
  Download,
  Sliders,
  X,
  FileImage,
  Check,
} from 'lucide-react';

interface EnvironmentCameraPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EnvironmentCameraPanel: React.FC<EnvironmentCameraPanelProps> = ({ isOpen, onClose }) => {
  const {
    backgroundTheme,
    setBackgroundTheme,
    lighting,
    setLighting,
    cameraSettings,
    setCameraFov,
    setCameraSettings,
    triggerCapture,
  } = useRobotStore();

  if (!isOpen) return null;

  const themes: { id: BackgroundTheme; label: string; desc: string; bgClass: string; textClass: string }[] = [
    {
      id: 'academic-white',
      label: 'Academic Paper',
      desc: 'Pure #ffffff white for LaTeX textbook print & thesis figures',
      bgClass: 'bg-white border-slate-300 text-slate-900',
      textClass: 'text-slate-800',
    },
    {
      id: 'technical-light',
      label: 'Technical Light',
      desc: 'Soft #f1f5f9 light slate for modern presentations',
      bgClass: 'bg-slate-100 border-slate-300 text-slate-800',
      textClass: 'text-slate-700',
    },
    {
      id: 'studio-dark',
      label: 'Studio Dark',
      desc: 'Slate #0f172a for comfortable interactive screen viewing',
      bgClass: 'bg-slate-900 border-slate-700 text-slate-200',
      textClass: 'text-slate-300',
    },
    {
      id: 'deep-space',
      label: 'Deep Space',
      desc: 'High contrast #020617 deep black for cyber aesthetics',
      bgClass: 'bg-slate-950 border-slate-800 text-slate-100',
      textClass: 'text-slate-400',
    },
  ];

  return (
    <div className="absolute top-20 right-6 w-88 bg-slate-900/95 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl z-40 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
      {/* Panel Header */}
      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
        <div className="flex items-center space-x-2">
          <Sliders className="w-4 h-4 text-sky-400" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            Environment, Lighting & Camera
          </h2>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-5 max-h-[calc(100vh-140px)] overflow-y-auto">
        {/* 1. Background Theme Presets */}
        <div>
          <label className="text-[11px] font-mono uppercase text-slate-400 tracking-wider block mb-2">
            Background Theme (Sắc độ nền)
          </label>
          <div className="grid grid-cols-2 gap-2">
            {themes.map((t) => {
              const isActive = backgroundTheme === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setBackgroundTheme(t.id)}
                  className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between relative ${
                    isActive
                      ? 'border-sky-500 ring-2 ring-sky-500/20 shadow-md'
                      : 'border-slate-800 hover:border-slate-700'
                  } ${t.id.includes('light') || t.id.includes('white') ? 'bg-slate-800/80' : 'bg-slate-950/60'}`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="text-xs font-semibold text-slate-200 flex items-center space-x-1.5">
                      <span className={`w-3 h-3 rounded-full border border-slate-400/30 ${t.bgClass}`} />
                      <span>{t.label}</span>
                    </span>
                    {isActive && <Check className="w-3.5 h-3.5 text-sky-400" />}
                  </div>
                  <span className="text-[10px] text-slate-400 leading-tight">{t.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="h-px bg-slate-800" />

        {/* 2. Camera Field of View (FOV) & Orbit Angle Tuning */}
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-mono uppercase text-slate-400 tracking-wider flex items-center space-x-1.5">
                <Camera className="w-3.5 h-3.5 text-sky-400" />
                <span>Camera FOV (Góc mở ống kính)</span>
              </label>
              <span className="text-xs font-mono font-bold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
                {cameraSettings.fov}°
              </span>
            </div>

            <input
              type="range"
              min={15}
              max={75}
              step={1}
              value={cameraSettings.fov}
              onChange={(e) => setCameraFov(parseFloat(e.target.value))}
              className="w-full"
            />

            <div className="flex justify-between text-[10px] font-mono text-slate-400 mt-1">
              <button
                onClick={() => setCameraFov(24)}
                className="px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-750 hover:text-sky-300 transition"
                title="Axonometric / Orthographic textbook figure look"
              >
                24° Telephoto / Axo
              </button>
              <button
                onClick={() => setCameraFov(42)}
                className="px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-750 hover:text-sky-300 transition"
              >
                42° Standard
              </button>
              <button
                onClick={() => setCameraFov(60)}
                className="px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-750 hover:text-sky-300 transition"
              >
                60° Wide
              </button>
            </div>
          </div>

          {/* Camera Elevation Angle */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-300">Camera Elevation (Góc ngẩng):</span>
              <span className="text-sky-400">{Math.round(cameraSettings.elevationDeg)}°</span>
            </div>
            <input
              type="range"
              min={-5}
              max={85}
              step={1}
              value={cameraSettings.elevationDeg}
              onChange={(e) => setCameraSettings({ elevationDeg: parseFloat(e.target.value) })}
              className="w-full"
            />
          </div>

          {/* Camera Azimuth Angle */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-300">Camera Azimuth (Góc quay quanh):</span>
              <span className="text-sky-400">{Math.round(cameraSettings.azimuthDeg)}°</span>
            </div>
            <input
              type="range"
              min={0}
              max={360}
              step={2}
              value={cameraSettings.azimuthDeg}
              onChange={(e) => setCameraSettings({ azimuthDeg: parseFloat(e.target.value) })}
              className="w-full"
            />
          </div>

          {/* Camera Distance / Zoom */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-300">Distance / Zoom (Khoảng cách):</span>
              <span className="text-sky-400">{Math.round(cameraSettings.distance)} mm</span>
            </div>
            <input
              type="range"
              min={50}
              max={30000}
              step={25}
              value={cameraSettings.distance}
              onChange={(e) => setCameraSettings({ distance: parseFloat(e.target.value) })}
              className="w-full"
            />
          </div>
        </div>

        <div className="h-px bg-slate-800" />

        {/* 3. Lighting Controls (Ánh sáng môi trường) */}
        <div className="space-y-3">
          <label className="text-[11px] font-mono uppercase text-slate-400 tracking-wider flex items-center space-x-1.5">
            <Sun className="w-3.5 h-3.5 text-amber-400" />
            <span>Lighting & Shadows (Cường độ & Hướng sáng)</span>
          </label>

          {/* Light Azimuth / Direction */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-300">Light Direction (Góc hướng đèn chiếu):</span>
              <span className="text-amber-400">{Math.round(lighting.lightAzimuthDeg)}°</span>
            </div>
            <input
              type="range"
              min={0}
              max={360}
              step={5}
              value={lighting.lightAzimuthDeg}
              onChange={(e) => setLighting({ lightAzimuthDeg: parseFloat(e.target.value) })}
              className="w-full"
            />
          </div>

          {/* Ambient Light */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-300">Ambient Fill (Ánh sáng tán xạ):</span>
              <span className="text-sky-400">{lighting.ambientIntensity.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={0.1}
              max={2.0}
              step={0.05}
              value={lighting.ambientIntensity}
              onChange={(e) => setLighting({ ambientIntensity: parseFloat(e.target.value) })}
              className="w-full"
            />
          </div>

          {/* Key Light */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-300">Key Direct Light (Đèn chiếu chính):</span>
              <span className="text-amber-400">{lighting.keyLightIntensity.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={0.2}
              max={2.5}
              step={0.05}
              value={lighting.keyLightIntensity}
              onChange={(e) => setLighting({ keyLightIntensity: parseFloat(e.target.value) })}
              className="w-full"
            />
          </div>

          {/* Rim Accent Light */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-300">Rim Accent Light (Đèn viền khối):</span>
              <span className="text-cyan-400">{lighting.rimLightIntensity.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={0.0}
              max={1.5}
              step={0.05}
              value={lighting.rimLightIntensity}
              onChange={(e) => setLighting({ rimLightIntensity: parseFloat(e.target.value) })}
              className="w-full"
            />
          </div>

          {/* Floor Shadow Opacity */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-300">Ground Shadow (Độ đậm bóng sàn):</span>
              <span className="text-slate-400">{Math.round(lighting.shadowOpacity * 100)}%</span>
            </div>
            <input
              type="range"
              min={0.0}
              max={0.8}
              step={0.02}
              value={lighting.shadowOpacity}
              onChange={(e) => setLighting({ shadowOpacity: parseFloat(e.target.value) })}
              className="w-full"
            />
          </div>
        </div>

        <div className="h-px bg-slate-800" />

        {/* 4. One-Click Textbook Snapshot / Export */}
        <div className="space-y-2">
          <label className="text-[11px] font-mono uppercase text-slate-400 tracking-wider flex items-center space-x-1.5">
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Chụp & Xuất ảnh Sách / Bài giảng (High-Res 2X)</span>
          </label>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => triggerCapture('white')}
              className="flex items-center space-x-2 px-3 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-900 border border-slate-300 shadow text-xs font-semibold transition text-left"
              title="Xuất ảnh nền trắng tinh khiết độ phân giải cao phục vụ chèn vào tài liệu LaTeX/Word"
            >
              <FileImage className="w-4 h-4 text-sky-600 flex-shrink-0" />
              <div>
                <span className="block leading-tight">Nền trắng</span>
                <span className="text-[10px] text-slate-500 font-normal">Cho Sách / LaTeX</span>
              </div>
            </button>

            <button
              onClick={() => triggerCapture('transparent')}
              className="flex items-center space-x-2 px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 shadow text-xs font-semibold transition text-left"
              title="Xuất ảnh PNG trong suốt (Transparent Alpha), không nền"
            >
              <Download className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <div>
                <span className="block leading-tight">Nền trong suốt</span>
                <span className="text-[10px] text-slate-400 font-normal">Alpha PNG</span>
              </div>
            </button>
          </div>

          <button
            onClick={() => triggerCapture('current')}
            className="w-full py-2 px-3 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs font-medium transition flex items-center justify-center space-x-1.5"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Chụp nguyên trạng góc nhìn hiện tại</span>
          </button>
        </div>
      </div>
    </div>
  );
};
