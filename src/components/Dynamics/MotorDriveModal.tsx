import React, { useState } from 'react';
import { useRobotStore } from '../../store/robotStore';
import { MotorDriveEngine } from '../../physics/motors/MotorDriveEngine';
import { PowerConverterEngine } from '../../physics/converters/PowerConverterEngine';
import { MotorDriveParameters, MotorType } from '../../types/motor';
import {
  X,
  Cpu,
  Zap,
  Activity,
  Flame,
  Check,
  Sparkles,
  Layers,
  Radio,
  Thermometer,
  ShieldAlert,
} from 'lucide-react';

interface MotorDriveModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialJointIndex?: number;
}

export const MotorDriveModal: React.FC<MotorDriveModalProps> = ({
  isOpen,
  onClose,
  initialJointIndex = 0,
}) => {
  const {
    robotModel,
    activeDynamicsProfile,
    updateJointMotorParams,
    applyMotorPresetToAllJoints,
    activeDynamicState,
    dcBusSettings,
    inverterSettings,
    updateDCBusSettings,
    updateInverterSettings,
  } = useRobotStore();

  const [selectedJointIdx, setSelectedJointIdx] = useState<number>(initialJointIndex);
  const [modalTab, setModalTab] = useState<'motor' | 'converter'>('motor');

  if (!isOpen || !robotModel || !activeDynamicsProfile) return null;

  const currentJoint = activeDynamicsProfile.joints[selectedJointIdx] || activeDynamicsProfile.joints[0];
  const motorParams: MotorDriveParameters =
    currentJoint.motorParams || MotorDriveEngine.MOTOR_PRESETS.robodrive_pmsm_ilm70.params;

  const motorState = activeDynamicState?.motorStates?.[selectedJointIdx];
  const dcBusState = activeDynamicState?.dcBusState;
  const currentAxisInverter = dcBusState?.axisStates?.[selectedJointIdx];

  const reflectedInertia = MotorDriveEngine.computeReflectedInertia(motorParams);

  const handleUpdate = (patch: Partial<MotorDriveParameters>) => {
    updateJointMotorParams(selectedJointIdx, patch);
  };

  const handleApplyPresetToCurrent = (presetId: string) => {
    const preset = MotorDriveEngine.MOTOR_PRESETS[presetId];
    if (preset) {
      updateJointMotorParams(selectedJointIdx, { ...preset.params });
    }
  };

  const motorTypeLabels: Record<MotorType, { title: string; badge: string; color: string; desc: string }> = {
    ideal: {
      title: 'Lý tưởng (Direct Drive)',
      badge: 'IDEAL',
      color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      desc: 'Mô-men ngõ ra tức thời, không trễ dòng điện, bỏ qua suy hao nhiệt và bão hòa điện áp.',
    },
    dc: {
      title: 'DC Chổi Than (Brushed DC)',
      badge: 'DC SERVO',
      color: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
      desc: 'Rô-to không rãnh (coreless), phương trình điện tích phân La·di/dt = v - R·i - e_b, s.đ.đ phản kháng Ke·ωm.',
    },
    bldc: {
      title: 'BLDC Không Chổi Than (Trapezoidal)',
      badge: 'BLDC 6-STEP',
      color: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
      desc: 'Chuyển mạch điện tử biến tần 6 bước với gợn sóng mô-men (torque ripple) chu kỳ 60° điện.',
    },
    pmsm: {
      title: 'PMSM Đồng Bộ Nam Châm (FOC Vector)',
      badge: 'PMSM FOC',
      color: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      desc: 'Chuẩn công nghiệp & Cobot: Điều khiển vector tựa từ thông FOC (id=0), triệt tiêu rung giật, hỗ trợ suy giảm từ thông.',
    },
    im: {
      title: 'IM Động Cơ Dị Bộ (Asynchronous RFOC)',
      badge: 'IM AC',
      color: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
      desc: 'Động cơ cảm ứng 3 pha điều khiển RFOC: Quán tính lớn, trượt rotor (slip), động học tích lũy từ thông rotor dψr/dt.',
    },
  };

  // Generate real-time PWM oscilloscope micro-scope zoom waveforms
  const pwmZoomData = PowerConverterEngine.generatePWMZoomWaveforms(
    currentAxisInverter?.modulationIndex || 0.8,
    inverterSettings.switchingFrequencyHz,
    inverterSettings.deadTimeMicrosec,
    dcBusState?.voltageV || dcBusSettings.nominalVoltage
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-rose-500/10 text-rose-400 rounded-xl border border-rose-500/20">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-white tracking-wide">
                  Hệ Thống Động Cơ & Biến Tần Công Suất (Actuators & Inverter Drives)
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 font-semibold">
                  Multi-Physics 500 Hz
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Mô hình liên tầng: Điện tử công suất (SVPWM Inverter) → Động cơ (DC/BLDC/PMSM/IM) → Hộp số → Động lực học cánh tay
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Top Navigation Mode Tabs */}
        <div className="flex bg-slate-950 border-b border-slate-800 px-6 pt-2">
          <div className="flex space-x-2">
            <button
              onClick={() => setModalTab('motor')}
              className={`px-4 py-2 rounded-t-lg font-mono text-xs flex items-center space-x-2 border-t border-x transition ${
                modalTab === 'motor'
                  ? 'bg-slate-900 text-rose-300 border-slate-750 font-bold border-b-2 border-b-rose-500'
                  : 'text-slate-400 border-transparent hover:text-slate-200'
              }`}
            >
              <Cpu className="w-4 h-4 text-rose-400" />
              <span>1. Động Cơ & Hộp Số (Motors & Transmission)</span>
            </button>
            <button
              onClick={() => setModalTab('converter')}
              className={`px-4 py-2 rounded-t-lg font-mono text-xs flex items-center space-x-2 border-t border-x transition ${
                modalTab === 'converter'
                  ? 'bg-slate-900 text-amber-300 border-slate-750 font-bold border-b-2 border-b-amber-500'
                  : 'text-slate-400 border-transparent hover:text-slate-200'
              }`}
            >
              <Zap className="w-4 h-4 text-amber-400" />
              <span>2. Biến Tần & Bus DC (Inverter & Power Electronics)</span>
            </button>
          </div>
        </div>

        {/* Global Preset Bar (Only on Motor tab) */}
        {modalTab === 'motor' && (
          <div className="px-6 py-2.5 bg-slate-950/40 border-b border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span className="text-slate-300 font-mono font-medium">Nạp Preset cho TẤT CẢ các khớp:</span>
            </div>
            <div className="flex items-center space-x-1.5 overflow-x-auto">
              {Object.values(MotorDriveEngine.MOTOR_PRESETS).map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => applyMotorPresetToAllJoints(preset.id)}
                  className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-mono transition flex items-center space-x-1 whitespace-nowrap"
                  title={preset.description}
                >
                  <span>{preset.name.split(' ')[0]}</span>
                  <span className="text-[9px] text-slate-400">({preset.type.toUpperCase()})</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Joint Selector Tabs */}
        <div className="px-6 pt-2.5 pb-2 bg-slate-900 border-b border-slate-800 flex items-center space-x-2 overflow-x-auto">
          {activeDynamicsProfile.joints.map((j, idx) => {
            const jType = j.motorParams?.type || 'pmsm';
            const isSelected = selectedJointIdx === idx;
            return (
              <button
                key={j.jointIndex}
                onClick={() => setSelectedJointIdx(idx)}
                className={`px-3 py-1.5 rounded-lg font-mono text-xs flex items-center space-x-2 border transition shrink-0 ${
                  isSelected
                    ? 'bg-rose-600 text-white border-rose-500 shadow-md font-bold'
                    : 'bg-slate-800/80 text-slate-400 border-slate-750 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <span>Khớp J{j.jointIndex}</span>
                <span
                  className={`text-[9px] px-1.5 py-0.2 rounded font-semibold uppercase ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-slate-900 text-slate-400'
                  }`}
                >
                  {jType}
                </span>
              </button>
            );
          })}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: MOTOR & TRANSMISSION */}
          {modalTab === 'motor' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* Motor Type Selector Grid */}
              <div className="space-y-2">
                <label className="text-xs font-mono font-bold text-slate-300 block">
                  Chọn Kiến Trúc Động Cơ Cho Khớp J{currentJoint.jointIndex} ({currentJoint.name}):
                </label>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-2.5">
                  {(['ideal', 'dc', 'bldc', 'pmsm', 'im'] as MotorType[]).map((type) => {
                    const info = motorTypeLabels[type];
                    const isCur = motorParams.type === type;
                    return (
                      <button
                        key={type}
                        onClick={() => {
                          const matchPreset = Object.values(MotorDriveEngine.MOTOR_PRESETS).find(
                            (p) => p.type === type
                          );
                          if (matchPreset) {
                            handleUpdate({ ...matchPreset.params });
                          } else {
                            handleUpdate({ type });
                          }
                        }}
                        className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                          isCur
                            ? 'bg-slate-800/90 border-rose-500 ring-1 ring-rose-500/50 shadow-lg'
                            : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-400'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold border ${info.color}`}>
                              {info.badge}
                            </span>
                            {isCur && <Check className="w-3.5 h-3.5 text-rose-400" />}
                          </div>
                          <div className={`text-xs font-mono font-bold ${isCur ? 'text-white' : 'text-slate-300'}`}>
                            {info.title.split(' ')[0]}
                          </div>
                        </div>
                        <p className="text-[10px] text-slate-400 font-mono mt-2 line-clamp-3 leading-relaxed">
                          {info.desc}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Quick Presets */}
              <div className="flex items-center justify-between p-2.5 bg-slate-950/60 rounded-xl border border-slate-800 text-xs">
                <span className="text-slate-400 font-mono">Preset chuẩn công nghiệp cho J{currentJoint.jointIndex}:</span>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleApplyPresetToCurrent('robodrive_pmsm_ilm70')}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-purple-300 border border-purple-500/30 text-[10px] font-mono transition"
                  >
                    RoboDrive ILM 70 (Cobot)
                  </button>
                  <button
                    onClick={() => handleApplyPresetToCurrent('maxon_bldc_eci52')}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-sky-300 border border-sky-500/30 text-[10px] font-mono transition"
                  >
                    Maxon EC-i 52 (BLDC)
                  </button>
                  <button
                    onClick={() => handleApplyPresetToCurrent('maxon_dc_re50')}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 text-[10px] font-mono transition"
                  >
                    Maxon RE 50 (DC)
                  </button>
                  <button
                    onClick={() => handleApplyPresetToCurrent('siemens_im_1le1')}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-rose-300 border border-rose-500/30 text-[10px] font-mono transition"
                  >
                    Siemens 1LE1 (IM)
                  </button>
                </div>
              </div>

              {/* Parameters Grid */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                {/* Mechanical Column */}
                <div className="md:col-span-6 space-y-4">
                  <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800 space-y-3">
                    <span className="text-xs font-mono font-bold text-slate-200 flex items-center space-x-1.5 border-b border-slate-800 pb-2">
                      <Layers className="w-4 h-4 text-amber-400" />
                      <span>Cơ khí & Hộp số Truyền động (Gearbox)</span>
                    </span>

                    <div className="space-y-3 text-xs font-mono">
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-slate-400">Tỷ số truyền hộp số (N : 1):</span>
                          <span className="text-amber-300 font-bold">{motorParams.gearRatio} : 1</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="200"
                          step="5"
                          value={motorParams.gearRatio}
                          onChange={(e) => handleUpdate({ gearRatio: parseFloat(e.target.value) || 1 })}
                          className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-amber-500"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-slate-400">Hiệu suất hộp số (η):</span>
                          <span className="text-sky-300 font-bold">{Math.round(motorParams.gearEfficiency * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0.5"
                          max="1.0"
                          step="0.02"
                          value={motorParams.gearEfficiency}
                          onChange={(e) => handleUpdate({ gearEfficiency: parseFloat(e.target.value) || 0.85 })}
                          className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-sky-500"
                        />
                      </div>

                      <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800 space-y-2">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Quán tính Rotor J_m (kg·m²):</span>
                          <input
                            type="number"
                            step="0.00005"
                            value={motorParams.rotorInertia}
                            onChange={(e) => handleUpdate({ rotorInertia: parseFloat(e.target.value) || 0.0001 })}
                            className="w-24 bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-right text-slate-200"
                          />
                        </div>
                        <div className="pt-1.5 border-t border-slate-800 flex items-center justify-between text-[11px]">
                          <span className="text-emerald-400 font-bold">Quán tính phản xạ J_refl = N²·J_m:</span>
                          <span className="text-emerald-300 font-bold">{reflectedInertia.toFixed(4)} kg·m²</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Electrical Column */}
                <div className="md:col-span-6 space-y-4">
                  <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800 space-y-3">
                    <span className="text-xs font-mono font-bold text-slate-200 flex items-center space-x-1.5 border-b border-slate-800 pb-2">
                      <Zap className="w-4 h-4 text-rose-400" />
                      <span>Thông số Cuộn Dây & Động Cơ</span>
                    </span>

                    <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                      <div>
                        <span className="text-slate-400 block mb-0.5">Dòng cực đại I_peak (A):</span>
                        <input
                          type="number"
                          value={motorParams.peakCurrent}
                          onChange={(e) => handleUpdate({ peakCurrent: parseFloat(e.target.value) || 20 })}
                          className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-rose-300 font-bold"
                        />
                      </div>
                      <div>
                        <span className="text-slate-400 block mb-0.5">Hằng số Kt (N·m/A):</span>
                        <input
                          type="number"
                          step="0.01"
                          value={motorParams.torqueConstant}
                          onChange={(e) => handleUpdate({ torqueConstant: parseFloat(e.target.value) || 0.1 })}
                          className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-100"
                        />
                      </div>
                      <div>
                        <span className="text-slate-400 block mb-0.5">Hằng số s.đ.đ Ke (V/rad/s):</span>
                        <input
                          type="number"
                          step="0.01"
                          value={motorParams.backEmfConstant}
                          onChange={(e) => handleUpdate({ backEmfConstant: parseFloat(e.target.value) || 0.1 })}
                          className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-100"
                        />
                      </div>
                      <div>
                        <span className="text-slate-400 block mb-0.5">Điện trở cuộn dây Ra (Ω):</span>
                        <input
                          type="number"
                          step="0.05"
                          value={motorParams.armatureResistance}
                          onChange={(e) => handleUpdate({ armatureResistance: parseFloat(e.target.value) || 0.5 })}
                          className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-100"
                        />
                      </div>
                      <div>
                        <span className="text-slate-400 block mb-0.5">Điện cảm La (mH):</span>
                        <input
                          type="number"
                          step="0.05"
                          value={motorParams.armatureInductance * 1000}
                          onChange={(e) =>
                            handleUpdate({ armatureInductance: (parseFloat(e.target.value) || 0.5) / 1000 })
                          }
                          className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-100"
                        />
                      </div>
                      <div>
                        <span className="text-slate-400 block mb-0.5">Số đôi cực từ (p):</span>
                        <input
                          type="number"
                          value={motorParams.polePairs}
                          onChange={(e) => handleUpdate({ polePairs: parseInt(e.target.value) || 4 })}
                          className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-100"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: POWER ELECTRONIC CONVERTER & DC BUS */}
          {modalTab === 'converter' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* Shared DC Bus Live Telemetry Card */}
              <div className="p-4 bg-slate-950 rounded-xl border border-amber-500/40 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center space-x-2">
                    <Radio className="w-4 h-4 text-amber-400 animate-pulse" />
                    <span className="text-xs font-mono font-bold text-amber-300">
                      Hệ Thống Bus DC Chung & Mạch Xả Hãm Tái Sinh (Shared DC Bus & Braking Chopper)
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    {dcBusState?.isBrakingChopperActive ? (
                      <span className="px-2 py-0.5 rounded bg-rose-500 text-white text-[10px] font-mono font-bold animate-pulse">
                        ĐANG XẢ HÃM (BRAKING CHOPPER ON)
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] font-mono">
                        Chopper Sẵn Sàng (Standby)
                      </span>
                    )}

                    {dcBusState?.isOvervoltageTripped && (
                      <span className="px-2 py-0.5 rounded bg-red-600 text-white text-[10px] font-mono font-bold animate-bounce flex items-center space-x-1">
                        <ShieldAlert className="w-3 h-3" />
                        <span>QUÁ ÁP BUS TRIP!</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* DC Bus Live Gauges */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
                  {/* Bus Voltage */}
                  <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                    <div className="text-slate-400 text-[10px] flex justify-between">
                      <span>Điện áp Bus V_dc(t):</span>
                      <span className="text-amber-400">Danh định: {dcBusSettings.nominalVoltage}V</span>
                    </div>
                    <div className="text-lg font-bold text-amber-300 mt-1">
                      {(dcBusState?.voltageV || dcBusSettings.nominalVoltage).toFixed(2)}{' '}
                      <span className="text-xs text-slate-400">V</span>
                    </div>
                    <div className="w-full bg-slate-950 rounded-full h-1.5 mt-2 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-75 ${
                          (dcBusState?.voltageV || 48) > dcBusSettings.brakingActivationVoltage
                            ? 'bg-rose-500'
                            : 'bg-amber-500'
                        }`}
                        style={{
                          width: `${Math.min(
                            100,
                            Math.max(
                              0,
                              (((dcBusState?.voltageV || 48) - 30) / (dcBusSettings.overvoltageTripThreshold - 30)) * 100
                            )
                          )}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Net Power & Regen Power */}
                  <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                    <div className="text-slate-400 text-[10px] flex justify-between">
                      <span>Công suất tổng 6 trục:</span>
                      <span className="text-sky-400">P_net</span>
                    </div>
                    <div className="text-lg font-bold text-sky-400 mt-1">
                      {(dcBusState?.netMotorPowerW || 0).toFixed(1)}{' '}
                      <span className="text-xs text-slate-400">W</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">
                      Tái sinh: {(dcBusState?.regenerativePowerW || 0).toFixed(1)} W
                    </div>
                  </div>

                  {/* Braking Resistor Power */}
                  <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                    <div className="text-slate-400 text-[10px] flex justify-between">
                      <span>Công suất xả nhiệt:</span>
                      <Flame className="w-3 h-3 text-rose-400" />
                    </div>
                    <div className="text-lg font-bold text-rose-400 mt-1">
                      {(dcBusState?.brakingPowerW || 0).toFixed(1)}{' '}
                      <span className="text-xs text-slate-400">W</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">
                      Dòng xả: {(dcBusState?.brakingCurrentA || 0).toFixed(1)} A
                    </div>
                  </div>

                  {/* Supply Current */}
                  <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                    <div className="text-slate-400 text-[10px] flex justify-between">
                      <span>Dòng nguồn cấp:</span>
                      <span className="text-emerald-400">I_supply</span>
                    </div>
                    <div className="text-lg font-bold text-emerald-400 mt-1">
                      {(dcBusState?.supplyCurrentA || 0).toFixed(1)}{' '}
                      <span className="text-xs text-slate-400">A</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">
                      Giới hạn: {dcBusSettings.powerSupplyCurrentLimit} A
                    </div>
                  </div>
                </div>
              </div>

              {/* DC Bus & Inverter Settings */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                {/* DC Bus Configuration (6 cols) */}
                <div className="md:col-span-6 space-y-3 p-4 bg-slate-950/80 rounded-xl border border-slate-800 text-xs font-mono">
                  <span className="font-bold text-slate-200 block border-b border-slate-800 pb-2">
                    Cấu Hình Tụ Điện Bus & Mạch Hãm (DC Link)
                  </span>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Dung lượng tụ lọc C_bus:</span>
                      <div className="flex items-center space-x-1">
                        <input
                          type="number"
                          step="500"
                          value={dcBusSettings.busCapacitanceMicroFarad}
                          onChange={(e) =>
                            updateDCBusSettings({ busCapacitanceMicroFarad: parseFloat(e.target.value) || 1000 })
                          }
                          className="w-20 bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-right text-slate-200"
                        />
                        <span className="text-slate-400">µF</span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Điện trở xả hãm R_brake:</span>
                      <div className="flex items-center space-x-1">
                        <input
                          type="number"
                          step="0.5"
                          value={dcBusSettings.brakingResistorOhms}
                          onChange={(e) =>
                            updateDCBusSettings({ brakingResistorOhms: parseFloat(e.target.value) || 2 })
                          }
                          className="w-20 bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-right text-slate-200"
                        />
                        <span className="text-slate-400">Ω</span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Ngưỡng kích hoạt xả hãm:</span>
                      <div className="flex items-center space-x-1">
                        <input
                          type="number"
                          step="1"
                          value={dcBusSettings.brakingActivationVoltage}
                          onChange={(e) =>
                            updateDCBusSettings({ brakingActivationVoltage: parseFloat(e.target.value) || 56 })
                          }
                          className="w-20 bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-right text-amber-300 font-bold"
                        />
                        <span className="text-slate-400">V</span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t border-slate-800">
                      <span className="text-slate-300 font-semibold">Bảo vệ hãm tái sinh (Chopper):</span>
                      <button
                        onClick={() =>
                          updateDCBusSettings({ enableBrakingChopper: !dcBusSettings.enableBrakingChopper })
                        }
                        className={`px-3 py-1 rounded text-[11px] font-bold border transition ${
                          dcBusSettings.enableBrakingChopper
                            ? 'bg-emerald-600/30 text-emerald-300 border-emerald-500/50'
                            : 'bg-rose-600/30 text-rose-300 border-rose-500/50'
                        }`}
                      >
                        {dcBusSettings.enableBrakingChopper ? 'KÍCH HOẠT (Bật)' : 'TẮT (Gây Quá Áp)'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Inverter Switching & Thermal Configuration (6 cols) */}
                <div className="md:col-span-6 space-y-3 p-4 bg-slate-950/80 rounded-xl border border-slate-800 text-xs font-mono">
                  <span className="font-bold text-slate-200 block border-b border-slate-800 pb-2">
                    Bộ Điều Chế Biến Tần & Thời Gian Chết (PWM Inverter)
                  </span>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Thuật toán điều chế PWM:</span>
                      <select
                        value={inverterSettings.modulationScheme}
                        onChange={(e) => updateInverterSettings({ modulationScheme: e.target.value as any })}
                        className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200"
                      >
                        <option value="svpwm">SVPWM (Vector không gian, +15.5% Vmax)</option>
                        <option value="spwm">SPWM (Sin truyền thống)</option>
                        <option value="third-harmonic-pwm">Sin + Hài bậc 3 (THPWM)</option>
                      </select>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Tần số đóng cắt f_sw:</span>
                      <div className="flex items-center space-x-1">
                        <select
                          value={inverterSettings.switchingFrequencyHz}
                          onChange={(e) =>
                            updateInverterSettings({ switchingFrequencyHz: parseInt(e.target.value) || 16000 })
                          }
                          className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200"
                        >
                          <option value="8000">8 kHz</option>
                          <option value="16000">16 kHz (SiC Standard)</option>
                          <option value="24000">24 kHz (SiC High-speed)</option>
                          <option value="32000">32 kHz (Ultra-quiet)</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Thời gian chết t_dead:</span>
                      <div className="flex items-center space-x-1">
                        <input
                          type="number"
                          step="0.2"
                          min="0.2"
                          max="4.0"
                          value={inverterSettings.deadTimeMicrosec}
                          onChange={(e) =>
                            updateInverterSettings({ deadTimeMicrosec: parseFloat(e.target.value) || 1.2 })
                          }
                          className="w-16 bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-right text-rose-300 font-bold"
                        />
                        <span className="text-slate-400">µs</span>
                      </div>
                    </div>

                    {currentAxisInverter && (
                      <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-[11px]">
                        <span className="text-slate-400 flex items-center space-x-1">
                          <Thermometer className="w-3.5 h-3.5 text-amber-400" />
                          <span>Nhiệt độ mối nối bán dẫn Tj (J{currentJoint.jointIndex}):</span>
                        </span>
                        <span className="text-amber-300 font-bold">
                          {currentAxisInverter.junctionTemperatureC.toFixed(1)} °C
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* PWM Micro-Scope Oscilloscope Canvas */}
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs font-mono font-bold text-sky-400 flex items-center space-x-2">
                    <Activity className="w-4 h-4 text-sky-400" />
                    <span>Dao Động Ký Kính Hiển Vi Xung PWM (Micro-Scope PWM Zoom - 2 Chu Kỳ Đóng Cắt)</span>
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    Hệ số điều chế m = {currentAxisInverter?.modulationIndex.toFixed(2) || '0.80'} | Sóng mang: {inverterSettings.switchingFrequencyHz / 1000} kHz
                  </span>
                </div>

                {/* SVG Visualizer */}
                <div className="bg-slate-900/90 rounded-lg p-2 border border-slate-800">
                  <svg viewBox="0 0 600 140" className="w-full h-32 block select-none">
                    {/* Grid lines */}
                    <line x1="0" y1="20" x2="600" y2="20" stroke="#1e293b" strokeDasharray="2,2" />
                    <line x1="0" y1="50" x2="600" y2="50" stroke="#334155" />
                    <line x1="0" y1="80" x2="600" y2="80" stroke="#1e293b" strokeDasharray="2,2" />
                    <line x1="0" y1="110" x2="600" y2="110" stroke="#334155" />

                    {/* Carrier wave (cyan) */}
                    <path
                      d={pwmZoomData.timeMicrosec.reduce((acc, t, idx) => {
                        const x = (t / pwmZoomData.timeMicrosec[pwmZoomData.timeMicrosec.length - 1]) * 600;
                        const y = 50 - pwmZoomData.carrierTriangle[idx] * 30;
                        return `${acc} ${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
                      }, '')}
                      fill="none"
                      stroke="#06b6d4"
                      strokeWidth="1.2"
                      opacity="0.8"
                    />

                    {/* Reference Modulation wave Va (yellow) */}
                    <path
                      d={pwmZoomData.timeMicrosec.reduce((acc, t, idx) => {
                        const x = (t / pwmZoomData.timeMicrosec[pwmZoomData.timeMicrosec.length - 1]) * 600;
                        const y = 50 - pwmZoomData.refWaveA[idx] * 30;
                        return `${acc} ${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
                      }, '')}
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="1.8"
                    />

                    {/* PWM Gate Pulse A (emerald step pulses) */}
                    <path
                      d={pwmZoomData.timeMicrosec.reduce((acc, t, idx) => {
                        const x = (t / pwmZoomData.timeMicrosec[pwmZoomData.timeMicrosec.length - 1]) * 600;
                        const y = 130 - pwmZoomData.pwmGateA[idx] * 20;
                        return `${acc} ${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
                      }, '')}
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="1.5"
                    />

                    {/* Labels */}
                    <text x="10" y="15" fill="#f59e0b" fontSize="9" fontFamily="monospace">
                      Sóng điều chế V_ref (SVPWM)
                    </text>
                    <text x="210" y="15" fill="#06b6d4" fontSize="9" fontFamily="monospace">
                      Sóng mang tam giác Carrier (16 kHz)
                    </text>
                    <text x="10" y="105" fill="#10b981" fontSize="9" fontFamily="monospace">
                      Xung đóng mở van Gate PWM S_A(t)
                    </text>
                  </svg>
                </div>
              </div>
            </div>
          )}

          {/* Live Telemetry Panel (Always Visible at Bottom) */}
          <div className="p-4 bg-slate-950 rounded-xl border border-rose-500/30 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-mono font-bold text-rose-300 flex items-center space-x-2">
                <Activity className="w-4 h-4 text-rose-400 animate-pulse" />
                <span>Giám Sát Cơ Điện Trực Tuyến - Khớp J{currentJoint.jointIndex} ({currentJoint.name})</span>
              </span>
              <div className="flex items-center space-x-2">
                {motorState?.isCurrentSaturated && (
                  <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500 text-[10px] font-mono font-bold animate-bounce">
                    BÃO HÒA DÒNG ĐIỆN (I_PEAK)
                  </span>
                )}
                {motorState?.isVoltageSaturated && (
                  <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500 text-[10px] font-mono font-bold">
                    BÃO HÒA ĐIỆN ÁP BUS (V_DC)
                  </span>
                )}
              </div>
            </div>

            {motorState ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
                {/* Current i(t) */}
                <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800">
                  <div className="text-slate-400 text-[10px] flex justify-between">
                    <span>Dòng điện i(t):</span>
                    <span className="text-slate-400">Max: {motorParams.peakCurrent} A</span>
                  </div>
                  <div className="text-base font-bold text-sky-400 mt-1">
                    {motorState.currentA.toFixed(2)} <span className="text-xs text-slate-400">A</span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-1.5 mt-2 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-75 ${
                        motorState.isCurrentSaturated ? 'bg-rose-500' : 'bg-sky-500'
                      }`}
                      style={{
                        width: `${Math.min(100, (Math.abs(motorState.currentA) / motorParams.peakCurrent) * 100)}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Voltage v(t) */}
                <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800">
                  <div className="text-slate-400 text-[10px] flex justify-between">
                    <span>Điện áp phần ứng:</span>
                    <span className="text-slate-400">Bus: {dcBusState?.voltageV.toFixed(1) || motorParams.ratedVoltage} V</span>
                  </div>
                  <div className="text-base font-bold text-purple-400 mt-1">
                    {motorState.voltageV.toFixed(1)} <span className="text-xs text-slate-400">V</span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-1.5 mt-2 overflow-hidden">
                    <div
                      className="h-full bg-purple-500 transition-all duration-75"
                      style={{
                        width: `${Math.min(100, (Math.abs(motorState.voltageV) / (dcBusState?.voltageV || motorParams.ratedVoltage)) * 100)}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Rotor RPM */}
                <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800">
                  <div className="text-slate-400 text-[10px] flex justify-between">
                    <span>Tốc độ Rotor:</span>
                    <span className="text-slate-400">Max: {motorParams.maxRpm}</span>
                  </div>
                  <div className="text-base font-bold text-emerald-400 mt-1">
                    {Math.round(motorState.rotorSpeedRpm)}{' '}
                    <span className="text-xs text-slate-400">RPM</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    Trục link: {((motorState.rotorSpeedRpm / motorParams.gearRatio) * (360 / 60)).toFixed(1)} °/s
                  </div>
                </div>

                {/* Power & Heat Losses */}
                <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800">
                  <div className="text-slate-400 text-[10px] flex justify-between">
                    <span>Tổn hao cuộn dây I²·R:</span>
                    <Flame className="w-3.5 h-3.5 text-rose-400" />
                  </div>
                  <div className="text-base font-bold text-rose-400 mt-1">
                    {motorState.copperLossW.toFixed(1)} <span className="text-xs text-slate-400">W</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    Biến tần loss: {(currentAxisInverter?.totalLossW || 0).toFixed(1)} W
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-4 text-center text-xs font-mono text-slate-500">
                Nhấn [Chạy Động Lực Học] trong bảng điều khiển để bắt đầu tích phân và theo dõi dòng/áp/biến tần thời gian thực.
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs font-mono text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Mô hình Biến tần & Động cơ đồng bộ liên tục vào vòng lặp RK4 500 Hz</span>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-mono font-bold transition shadow-lg shadow-rose-900/30"
          >
            Đóng & Áp Dụng
          </button>
        </div>
      </div>
    </div>
  );
};
