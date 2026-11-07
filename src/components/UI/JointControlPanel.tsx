import React from 'react';
import { useRobotStore } from '../../store/robotStore';
import { RotateCcw, Sliders, ChevronDown, ChevronUp } from 'lucide-react';

export const JointControlPanel: React.FC = () => {
  const {
    robotModel,
    jointAngles,
    angleUnit,
    setJointAngle,
    setAngleUnit,
    applyHomePosture,
    applyZeroPosture,
    applyBoundarySingularity,
    applyWristSingularity,
    clearTrace,
  } = useRobotStore();

  const [isCollapsed, setIsCollapsed] = React.useState(false);

  if (!robotModel) return null;

  const toDisplayValue = (angleDeg: number) => {
    if (angleUnit === 'rad') {
      return (angleDeg * (Math.PI / 180)).toFixed(3);
    }
    return angleDeg.toFixed(1);
  };

  const handleInputChange = (index: number, valStr: string) => {
    const val = parseFloat(valStr);
    if (isNaN(val)) return;

    if (angleUnit === 'rad') {
      setJointAngle(index, val * (180 / Math.PI));
    } else {
      setJointAngle(index, val);
    }
  };

  return (
    <div className="absolute top-20 left-6 w-84 bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl shadow-2xl z-20 flex flex-col overflow-hidden transition-all duration-200">
      {/* Panel Header */}
      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
        <div className="flex items-center space-x-2">
          <Sliders className="w-4 h-4 text-sky-400" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            Joint Kinematics Control
          </h2>
        </div>

        <div className="flex items-center space-x-2">
          {/* Deg / Rad toggle */}
          <button
            onClick={() => setAngleUnit(angleUnit === 'deg' ? 'rad' : 'deg')}
            className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-mono font-semibold text-sky-400 border border-slate-700 hover:bg-slate-700 transition"
            title="Toggle Degrees / Radians"
          >
            {angleUnit.toUpperCase()}
          </button>

          {/* Collapse/Expand Toggle */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 text-slate-400 hover:text-slate-200 transition"
          >
            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <div className="p-4 space-y-4 max-h-[calc(100vh-210px)] overflow-y-auto">
          {/* Posture Preset Buttons */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-mono uppercase text-slate-400 tracking-wider">
              Posture Presets
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={applyHomePosture}
                className="px-2.5 py-1.5 rounded-md bg-slate-800/90 hover:bg-slate-750 text-slate-200 border border-slate-700/80 text-[11px] font-medium transition text-left flex items-center justify-between"
              >
                <span>Home Posture</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              </button>
              <button
                onClick={applyZeroPosture}
                className="px-2.5 py-1.5 rounded-md bg-slate-800/90 hover:bg-slate-750 text-slate-200 border border-slate-700/80 text-[11px] font-medium transition text-left flex items-center justify-between"
              >
                <span>Zero Posture</span>
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span>
              </button>
              <button
                onClick={applyBoundarySingularity}
                className="px-2.5 py-1.5 rounded-md bg-slate-800/90 hover:bg-slate-750 text-slate-200 border border-slate-700/80 text-[11px] font-medium transition text-left flex items-center justify-between"
                title="Arm fully outstretched along reach boundary"
              >
                <span>Reach Singularity</span>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
              </button>
              <button
                onClick={applyWristSingularity}
                className="px-2.5 py-1.5 rounded-md bg-slate-800/90 hover:bg-slate-750 text-slate-200 border border-slate-700/80 text-[11px] font-medium transition text-left flex items-center justify-between"
                title="Spherical wrist singularity (q5 = 0)"
              >
                <span>Wrist Singularity</span>
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
              </button>
            </div>
          </div>

          <div className="h-px bg-slate-800" />

          {/* Joint Sliders List */}
          <div className="space-y-3.5">
            {robotModel.joints.map((joint, idx) => {
              const currentVal = jointAngles[idx] !== undefined ? jointAngles[idx] : 0;
              const minVal = joint.qMinDeg;
              const maxVal = joint.qMaxDeg;

              return (
                <div key={idx} className="space-y-1">
                  {/* Slider Header */}
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-1.5">
                      <span className="w-5 h-5 rounded flex items-center justify-center font-mono font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20 text-[10px]">
                        q{idx + 1}
                      </span>
                      <span className="text-slate-300 font-medium text-[11px]">
                        Joint {idx + 1}
                      </span>
                    </div>

                    <div className="flex items-center space-x-1.5">
                      <input
                        type="number"
                        value={toDisplayValue(currentVal)}
                        step={angleUnit === 'deg' ? 1 : 0.01}
                        onChange={(e) => handleInputChange(idx, e.target.value)}
                        className="w-16 bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-right font-mono text-xs text-sky-300 focus:outline-none focus:border-sky-500"
                      />
                      <span className="text-[10px] text-slate-400 font-mono w-4">
                        {angleUnit === 'deg' ? '°' : 'rad'}
                      </span>
                      <button
                        onClick={() => setJointAngle(idx, 0)}
                        className="p-1 text-slate-500 hover:text-slate-300 transition"
                        title={`Reset Joint ${idx + 1} to 0`}
                      >
                        <RotateCcw className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Range Slider */}
                  <div className="relative pt-1">
                    <input
                      type="range"
                      min={minVal}
                      max={maxVal}
                      step={0.5}
                      value={currentVal}
                      onChange={(e) => setJointAngle(idx, parseFloat(e.target.value))}
                      className="w-full"
                    />
                    <div className="flex justify-between text-[10px] font-mono text-slate-500 px-0.5">
                      <span>{minVal}°</span>
                      <span>0°</span>
                      <span>{maxVal}°</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="h-px bg-slate-800" />

          {/* Quick utility actions */}
          <div className="flex items-center justify-between pt-1">
            <button
              onClick={clearTrace}
              className="text-[11px] text-amber-400/90 hover:text-amber-300 font-mono flex items-center space-x-1"
            >
              <span>Clear TCP Trail</span>
            </button>
            <button
              onClick={() => useRobotStore.getState().applyHomePosture()}
              className="text-[11px] text-sky-400 hover:text-sky-300 font-mono flex items-center space-x-1"
            >
              <RotateCcw className="w-3 h-3 mr-1" />
              <span>Reset All</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
