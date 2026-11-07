import { MobileRobotSpecs, MobileRobotPose, MobileRobotVelocity, WheelState } from '../types/mobileRobot';

export class MobileRobotKinematics {
  /**
   * Normalizes an angle to [-PI, PI] range
   */
  public static normalizeAngle(angleRad: number): number {
    let a = angleRad % (2 * Math.PI);
    if (a > Math.PI) a -= 2 * Math.PI;
    if (a < -Math.PI) a += 2 * Math.PI;
    return a;
  }

  /**
   * Computes individual wheel rotational velocities for Differential Drive
   * Returns [omegaL, omegaR] in rad/s
   */
  public static computeDifferentialDriveWheelSpeeds(
    v: number,
    omega: number,
    specs: MobileRobotSpecs
  ): [number, number] {
    const R = specs.wheelRadiusM;
    const L = specs.trackWidthM;

    // v_R = v + (omega * L) / 2
    // v_L = v - (omega * L) / 2
    const vR = v + (omega * L) / 2;
    const vL = v - (omega * L) / 2;

    const omegaR = vR / R;
    const omegaL = vL / R;

    return [omegaL, omegaR];
  }

  /**
   * Computes body velocity [v, omega] from wheel speeds [omegaL, omegaR]
   */
  public static computeDifferentialDriveBodyVelocity(
    omegaL: number,
    omegaR: number,
    specs: MobileRobotSpecs
  ): { v: number; omega: number } {
    const R = specs.wheelRadiusM;
    const L = specs.trackWidthM;

    const v = (R / 2) * (omegaR + omegaL);
    const omega = (R / L) * (omegaR - omegaL);

    return { v, omega };
  }

  /**
   * Computes 4 Mecanum wheel rotational velocities [w1, w2, w3, w4] in rad/s
   * Standard 45-degree roller configuration:
   * w1: Front-Left, w2: Front-Right, w3: Rear-Left, w4: Rear-Right
   */
  public static computeMecanumWheelSpeeds(
    vx: number,
    vy: number,
    omega: number,
    specs: MobileRobotSpecs
  ): [number, number, number, number] {
    const R = specs.wheelRadiusM;
    const lx = specs.wheelBaseM / 2;
    const ly = specs.trackWidthM / 2;
    const k = lx + ly;

    const w1 = (vx - vy - k * omega) / R; // Front-Left
    const w2 = (vx + vy + k * omega) / R; // Front-Right
    const w3 = (vx + vy - k * omega) / R; // Rear-Left
    const w4 = (vx - vy + k * omega) / R; // Rear-Right

    return [w1, w2, w3, w4];
  }

  /**
   * Updates robot odometry using Runge-Kutta 2nd-order (Midpoint) numerical integration
   */
  public static integrateOdometry(
    currentPose: MobileRobotPose,
    velocity: MobileRobotVelocity,
    dtSec: number
  ): MobileRobotPose {
    const { v, vY = 0, omega } = velocity;

    // Midpoint heading
    const halfDTheta = (omega * dtSec) / 2;
    const thetaMid = currentPose.thetaRad + halfDTheta;

    // Displacement in world frame using midpoint heading
    const cosMid = Math.cos(thetaMid);
    const sinMid = Math.sin(thetaMid);

    const deltaX = (v * cosMid - vY * sinMid) * dtSec;
    const deltaY = (v * sinMid + vY * cosMid) * dtSec;
    const deltaTheta = omega * dtSec;

    return {
      x: Number((currentPose.x + deltaX).toFixed(4)),
      y: Number((currentPose.y + deltaY).toFixed(4)),
      thetaRad: this.normalizeAngle(currentPose.thetaRad + deltaTheta),
      z: currentPose.z
    };
  }

  /**
   * Updates cumulative rotation angles of wheels for 3D visual spinning animation
   */
  public static updateWheelAngles(
    currentWheelState: WheelState,
    wheelSpeedsRadps: number[],
    dtSec: number
  ): WheelState {
    const newAngles = currentWheelState.anglesRad.map((angle, idx) => {
      const speed = wheelSpeedsRadps[idx] ?? 0;
      return (angle + speed * dtSec) % (2 * Math.PI);
    });

    return {
      speedsRadps: [...wheelSpeedsRadps],
      anglesRad: newAngles
    };
  }
}
