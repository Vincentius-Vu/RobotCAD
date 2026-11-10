import { useTranslation } from '../../i18n';
import React, { useState, useEffect } from 'react';
import { useRobotStore } from '../../store/robotStore';
import { useMobileRobotStore } from '../../store/mobileRobotStore';
import {
  X,
  Plus,
  Compass,
  Clock,
  Navigation,
  Move3d,
  AlertCircle,
} from 'lucide-react';

interface AddPoseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AddPoseModal: React.FC<AddPoseModalProps> = ({ isOpen, onClose }) => {
  const { language } = useTranslation();
  const isVi = language === 'vi';
  const { activeDomain, tcpPose, waypoints, addPoseWaypoint } = useRobotStore();
  const { pose: mobilePose, poseWaypoints, addPoseWaypoint: addMobilePose } = useMobileRobotStore();

  // Manipulator form state
  const [armName, setArmName] = useState('');
  const [posX, setPosX] = useState('400');
  const [posY, setPosY] = useState('0');
  const [posZ, setPosZ] = useState('450');
  const [roll, setRoll] = useState('0');
  const [pitch, setPitch] = useState('0');
  const [yaw, setYaw] = useState('0');
  const [armDuration, setArmDuration] = useState('2.0');
  const [armError, setArmError] = useState<string | null>(null);

  // Mobile Robot form state
  const [mobileName, setMobileName] = useState('');
  const [mobX, setMobX] = useState('0.0');
  const [mobY, setMobY] = useState('2.0');
  const [mobTheta, setMobTheta] = useState('90');
  const [mobDuration, setMobDuration] = useState('5.0');

  // Reset form when opening modal
  useEffect(() => {
    if (isOpen) {
      setArmError(null);
      if (activeDomain === 'manipulator') {
        setArmName(`Pose ${waypoints.length + 1}`);
        if (tcpPose) {
          setPosX(tcpPose.position.x.toFixed(1));
          setPosY(tcpPose.position.y.toFixed(1));
          setPosZ(tcpPose.position.z.toFixed(1));
          setRoll(tcpPose.orientationEuler.roll.toFixed(1));
          setPitch(tcpPose.orientationEuler.pitch.toFixed(1));
          setYaw(tcpPose.orientationEuler.yaw.toFixed(1));
        }
        setArmDuration('2.0');
      } else {
        setMobileName(`Pose ${poseWaypoints.length + 1}`);
        setMobX(mobilePose.x.toFixed(2));
        setMobY(mobilePose.y.toFixed(2));
        setMobTheta(((mobilePose.thetaRad * 180) / Math.PI).toFixed(0));
        setMobDuration('5.0');
      }
    }
  }, [isOpen, activeDomain, tcpPose, waypoints.length, mobilePose, poseWaypoints.length]);

  if (!isOpen) return null;

  // Handle Fill from current robot state
  const handleFillCurrentArm = () => {
    if (tcpPose) {
      setPosX(tcpPose.position.x.toFixed(1));
      setPosY(tcpPose.position.y.toFixed(1));
      setPosZ(tcpPose.position.z.toFixed(1));
      setRoll(tcpPose.orientationEuler.roll.toFixed(1));
      setPitch(tcpPose.orientationEuler.pitch.toFixed(1));
      setYaw(tcpPose.orientationEuler.yaw.toFixed(1));
      setArmError(null);
    }
  };

  const handleFillCurrentMobile = () => {
    setMobX(mobilePose.x.toFixed(2));
    setMobY(mobilePose.y.toFixed(2));
    setMobTheta(((mobilePose.thetaRad * 180) / Math.PI).toFixed(1));
  };

  // Submit Manipulator Pose
  const handleAddArmPose = (e: React.FormEvent) => {
    e.preventDefault();
    setArmError(null);
    const x = parseFloat(posX);
    const y = parseFloat(posY);
    const z = parseFloat(posZ);
    const r = parseFloat(roll);
    const p = parseFloat(pitch);
    const yw = parseFloat(yaw);
    const dur = parseFloat(armDuration);

    if (isNaN(x) || isNaN(y) || isNaN(z) || isNaN(r) || isNaN(p) || isNaN(yw) || isNaN(dur) || dur <= 0) {
      setArmError(isVi ? 'Vui lòng nhập đầy đủ các thông số hợp lệ (Thời gian phải > 0s)' : 'Please enter valid parameters (transit duration must be > 0s)');
      return;
    }

    const result = addPoseWaypoint(
      { x, y, z },
      { roll: r, pitch: p, yaw: yw },
      dur,
      armName.trim() || undefined
    );

    if (!result.success) {
      setArmError(result.error || (isVi ? 'Không tìm được cấu hình khớp khả thi (Out of reach)' : 'No inverse kinematic solution found (Pose unreachable)'));
    } else {
      onClose();
    }
  };

  // Submit Mobile Robot Pose
  const handleAddMobilePose = (e: React.FormEvent) => {
    e.preventDefault();
    const x = parseFloat(mobX);
    const y = parseFloat(mobY);
    const th = parseFloat(mobTheta);
    const dur = parseFloat(mobDuration);

    if (isNaN(x) || isNaN(y) || isNaN(th) || isNaN(dur) || dur <= 0) {
      return;
    }

    addMobilePose({
      name: mobileName.trim() || `Pose ${poseWaypoints.length + 1}`,
      x,
      y,
      thetaDeg: th,
      segmentDuration: dur,
    });

    onClose();
  };

  // Calculate estimated mobile speed
  const distMob = Math.hypot(parseFloat(mobX || '0') - mobilePose.x, parseFloat(mobY || '0') - mobilePose.y);
  const durMob = parseFloat(mobDuration || '1') || 1;
  const estimatedSpeed = (distMob / durMob).toFixed(2);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col font-sans">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">
                {activeDomain === 'manipulator'
                  ? (language === 'vi' ? 'Thêm Pose Quỹ Đạo Khớp (Cartesian Pose)' : 'Define Cartesian Waypoint Pose') : (language === 'vi' ? 'Thêm Pose Điểm Đến AMR (Mission Pose)' : 'Define AMR Mission Docking Pose')}
              </h3>
              <p className="text-[11px] text-slate-400">
                {language === 'vi' ? 'Xác định Vị trí không gian, Hướng góc và Thời gian di chuyển dự kiến' : 'Specify Cartesian Position, Euler Orientation, and Scheduled Segment Duration'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        {activeDomain === 'manipulator' ? (
          <form onSubmit={handleAddArmPose} className="p-5 space-y-4">
            {/* Pose Name */}
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">{language === 'vi' ? 'Tên Pose / Waypoint:' : 'Waypoint / Pose Identifier:'}</label>
              <input
                type="text"
                value={armName}
                onChange={(e) => setArmName(e.target.value)}
                placeholder={isVi ? "Ví dụ: Pose Bốc Hàng, Pose Đặt Tải..." : "e.g. Pick-up Pose, Docking Station B2..."}
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-sky-500"
              />
            </div>

            {/* Position X, Y, Z */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono text-sky-400 font-semibold flex items-center space-x-1">
                  <Move3d className="w-3.5 h-3.5" />
                  <span>{language === 'vi' ? '1. Vị trí Không gian TCP (Position [mm])' : '1. End-Effector Cartesian Position (TCP [mm])'}</span>
                </span>
                <button
                  type="button"
                  onClick={handleFillCurrentArm}
                  className="text-[10px] font-mono text-emerald-400 hover:text-emerald-300 underline"
                >
                  {language === 'vi' ? 'Lấy từ tư thế hiện tại' : 'Sample Current Pose'}
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2 font-mono text-xs">
                <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 text-[10px] block">X (mm)</span>
                  <input
                    type="number"
                    step="1"
                    value={posX}
                    onChange={(e) => setPosX(e.target.value)}
                    className="w-full bg-transparent text-slate-100 font-bold outline-none"
                  />
                </div>
                <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 text-[10px] block">Y (mm)</span>
                  <input
                    type="number"
                    step="1"
                    value={posY}
                    onChange={(e) => setPosY(e.target.value)}
                    className="w-full bg-transparent text-slate-100 font-bold outline-none"
                  />
                </div>
                <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 text-[10px] block">Z (mm)</span>
                  <input
                    type="number"
                    step="1"
                    value={posZ}
                    onChange={(e) => setPosZ(e.target.value)}
                    className="w-full bg-transparent text-slate-100 font-bold outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Orientation Roll, Pitch, Yaw */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-mono text-amber-400 font-semibold flex items-center space-x-1">
                <Compass className="w-3.5 h-3.5" />
                <span>{language === 'vi' ? '2. Hướng Góc Euler XYZ (Orientation [°])' : '2. Euler Orientation Angles (XYZ [°])'}</span>
              </span>
              <div className="grid grid-cols-3 gap-2 font-mono text-xs">
                <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 text-[10px] block">Roll φ (°)</span>
                  <input
                    type="number"
                    step="1"
                    value={roll}
                    onChange={(e) => setRoll(e.target.value)}
                    className="w-full bg-transparent text-slate-100 font-bold outline-none"
                  />
                </div>
                <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 text-[10px] block">Pitch θ (°)</span>
                  <input
                    type="number"
                    step="1"
                    value={pitch}
                    onChange={(e) => setPitch(e.target.value)}
                    className="w-full bg-transparent text-slate-100 font-bold outline-none"
                  />
                </div>
                <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 text-[10px] block">Yaw ψ (°)</span>
                  <input
                    type="number"
                    step="1"
                    value={yaw}
                    onChange={(e) => setYaw(e.target.value)}
                    className="w-full bg-transparent text-slate-100 font-bold outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Expected Duration */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-mono text-purple-400 font-semibold flex items-center space-x-1">
                <Clock className="w-3.5 h-3.5" />
                <span>{isVi ? '3. Thời gian Dự kiến Di chuyển (Segment Transit Duration [s])' : '3. Scheduled Segment Duration [s]'}</span>
              </span>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  step="0.5"
                  min="0.2"
                  value={armDuration}
                  onChange={(e) => setArmDuration(e.target.value)}
                  className="w-32 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono font-bold text-slate-100 focus:outline-none focus:border-purple-500"
                />
                <span className="text-xs text-slate-400 font-mono">{isVi ? "giây (transit time từ pose trước)" : "sec (transit time from prior pose)"}</span>
              </div>
            </div>

            {/* Error Message */}
            {armError && (
              <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center space-x-2 text-rose-300 text-xs font-mono">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{armError}</span>
              </div>
            )}

            {/* Footer Buttons */}
            <div className="pt-2 flex items-center justify-end space-x-2 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
              >
                {language === 'vi' ? 'Hủy bỏ' : 'Cancel'}
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold font-mono transition shadow-md shadow-emerald-600/30 flex items-center space-x-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isVi ? 'Kiểm tra IK & Thêm Pose' : 'Solve IK & Insert Pose'}</span>
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleAddMobilePose} className="p-5 space-y-4">
            {/* Mission Pose Name */}
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">{isVi ? "Tên Trạm / Điểm Dừng AMR:" : "Station / Waypoint Identifier:"}</label>
              <input
                type="text"
                value={mobileName}
                onChange={(e) => setMobileName(e.target.value)}
                placeholder={isVi ? "Ví dụ: Trạm sạc, Kệ hàng A1, Khu trả hàng..." : "e.g. Charging Station 1, Rack A3, Drop-off Zone..."}
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-sky-500"
              />
            </div>

            {/* Position X, Y */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono text-sky-400 font-semibold flex items-center space-x-1">
                  <Navigation className="w-3.5 h-3.5" />
                  <span>{isVi ? '1. Tọa độ Mặt bằng Sàn Nhà xưởng (Position [m])' : '1. Floor Coordinates (Position [m])'}</span>
                </span>
                <button
                  type="button"
                  onClick={handleFillCurrentMobile}
                  className="text-[10px] font-mono text-emerald-400 hover:text-emerald-300 underline"
                >
                  {isVi ? 'Lấy vị trí xe hiện tại' : 'Sample Current Pose'}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 text-[10px] block">{isVi ? "Tọa độ X (m)" : "X Coordinate (m)"}</span>
                  <input
                    type="number"
                    step="0.1"
                    value={mobX}
                    onChange={(e) => setMobX(e.target.value)}
                    className="w-full bg-transparent text-slate-100 font-bold outline-none"
                  />
                </div>
                <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 text-[10px] block">{isVi ? "Tọa độ Y (m)" : "Y Coordinate (m)"}</span>
                  <input
                    type="number"
                    step="0.1"
                    value={mobY}
                    onChange={(e) => setMobY(e.target.value)}
                    className="w-full bg-transparent text-slate-100 font-bold outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Orientation / Heading */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-mono text-amber-400 font-semibold flex items-center space-x-1">
                <Compass className="w-3.5 h-3.5" />
                <span>{isVi ? '2. Hướng Đầu Xe Khi Đến Đích (Heading Yaw θ [°])' : '2. Target Arrival Heading (Yaw θ [°])'}</span>
              </span>
              <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 text-[10px]">{isVi ? "Góc quay hướng đầu xe θ" : "Chassis Heading Yaw θ"}</span>
                  <span className="text-amber-400 font-bold">{mobTheta}°</span>
                </div>
                <input
                  type="range"
                  min="-180"
                  max="180"
                  step="5"
                  value={mobTheta}
                  onChange={(e) => setMobTheta(e.target.value)}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500 mt-2"
                />
              </div>
            </div>

            {/* Expected Duration & Velocity Estimate */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-mono text-purple-400 font-semibold flex items-center space-x-1">
                <Clock className="w-3.5 h-3.5" />
                <span>{isVi ? '3. Thời gian Dự kiến Di chuyển (Arrival Duration [s])' : '3. Estimated Travel Duration [s]'}</span>
              </span>
              <div className="flex items-center space-x-3">
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  value={mobDuration}
                  onChange={(e) => setMobDuration(e.target.value)}
                  className="w-32 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono font-bold text-slate-100 focus:outline-none focus:border-purple-500"
                />
                <span className="text-xs text-slate-400 font-mono">{isVi ? "giây" : "sec"}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 font-mono text-[11px] text-slate-400 flex items-center justify-between">
                <span>{isVi ? "Khoảng cách:" : "Distance:"} <strong className="text-sky-400">{distMob.toFixed(2)} m</strong></span>
                <span>{isVi ? "Vận tốc ước tính:" : "Est. Speed:"} <strong className="text-emerald-400">{estimatedSpeed} m/s</strong></span>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="pt-2 flex items-center justify-end space-x-2 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
              >
                {language === 'vi' ? 'Hủy bỏ' : 'Cancel'}
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold font-mono transition shadow-md shadow-emerald-600/30 flex items-center space-x-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isVi ? 'Thêm Pose Vào Hành Trình' : 'Insert Waypoint into Mission'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
