/**
 * DoubleTanhProfileGenerator.ts
 * Unified Double-Tanh (UDT) Motion Profiling Engine for RobotCAD
 * High-order, C-infinity continuous trajectory generator with inherent bounding.
 */

import { MotionProfile, MotionProfileState } from './TrajectoryProfileGenerators';

export function logCoshStable(x: number): number {
  const absX = Math.abs(x);
  if (absX > 20.0) {
    return absX - Math.LN2;
  }
  return absX - Math.LN2 + Math.log1p(Math.exp(-2.0 * absX));
}

export interface DoubleTanhParams {
  distTarget: number;
  vCruise: number;
  sigma: number;
  margin: number;
  t1: number;
  dtCruise: number;
  t2: number;
  tTotal: number;
  vOffset: number;
  aOffset: number;
  normFactor: number;
  sOffset: number;
  peakAcceleration: number;
  peakJerk: number;
}

export class DoubleTanhProfileGenerator {
  public static computeProfileParams(
    dist: number,
    vMax: number,
    aMax: number,
    jMax: number,
    sigma?: number,
    margin: number = 3.8
  ): DoubleTanhParams {
    const L = Math.abs(dist);
    if (L < 1e-7) {
      return {
        distTarget: 0,
        vCruise: 0,
        sigma: 0.1,
        margin,
        t1: 0,
        dtCruise: 0,
        t2: 0,
        tTotal: 0,
        vOffset: 0,
        aOffset: 0,
        normFactor: 1.0,
        sOffset: 0,
        peakAcceleration: 0,
        peakJerk: 0,
      };
    }

    // Short-stroke scaling
    const sCrit = (vMax * vMax) / aMax;
    const vCruise = L < sCrit ? Math.sqrt(L * aMax) : vMax;

    // Determine morphological scaling factor sigma with constructive interference bound
    const sigmaFromA = vCruise / (2.0 * aMax);
    const sigmaFromJIso = Math.sqrt((0.38490018 * vCruise) / jMax);
    const deltaEst = L / (vCruise * Math.max(sigmaFromA, sigmaFromJIso));
    const kappa = deltaEst < 3.5 ? 0.76980036 : 0.38490018;
    const sigmaFromJ = Math.sqrt((kappa * vCruise) / jMax);
    const sigmaMin = Math.max(sigmaFromA, sigmaFromJ);
    const sig = sigma !== undefined && sigma >= sigmaMin * 0.999 ? sigma : sigmaMin;

    const t1 = margin * sig;
    let dtCruise = L / vCruise;
    let t2 = t1 + dtCruise;
    let tTotal = t2 + margin * sig;

    const u1_0 = -t1 / sig;
    const u2_0 = -t2 / sig;
    const vOffset = 0.5 * vCruise * (Math.tanh(u1_0) - Math.tanh(u2_0));
    const normFactor = 1.0 - vOffset / vCruise;
    let aOffset = (0.5 * vCruise / sig) * ((1.0 - Math.pow(Math.tanh(u1_0), 2)) - (1.0 - Math.pow(Math.tanh(u2_0), 2)));
    let sOffset = 0.5 * vCruise * sig * (logCoshStable(u1_0) - logCoshStable(u2_0));

    // Fast 3-step Newton calibration for exact terminal distance
    for (let iter = 0; iter < 3; iter++) {
      const u1_end = (tTotal - t1) / sig;
      const u2_end = (tTotal - t2) / sig;
      const sRawEnd = 0.5 * vCruise * sig * (logCoshStable(u1_end) - logCoshStable(u2_end));
      const sCompEnd = (sRawEnd - sOffset - vOffset * tTotal) / normFactor;
      const error = L - sCompEnd;
      if (Math.abs(error) < 1e-12) break;

      dtCruise += error / vCruise;
      t2 = t1 + dtCruise;
      tTotal = t2 + margin * sig;
      const u2_0_new = -t2 / sig;
      aOffset = (0.5 * vCruise / sig) * ((1.0 - Math.pow(Math.tanh(u1_0), 2)) - (1.0 - Math.pow(Math.tanh(u2_0_new), 2)));
      sOffset = 0.5 * vCruise * sig * (logCoshStable(u1_0) - logCoshStable(u2_0_new));
    }

    const peakAcceleration = (0.5 * vCruise / sig) / normFactor;
    const peakJerk = (0.38490018 * vCruise / (sig * sig)) / normFactor;

    return {
      distTarget: L,
      vCruise,
      sigma: sig,
      margin,
      t1,
      dtCruise,
      t2,
      tTotal,
      vOffset,
      aOffset,
      normFactor,
      sOffset,
      peakAcceleration,
      peakJerk,
    };
  }

  public static evaluate(t: number, p: DoubleTanhParams): MotionProfileState {
    if (t <= 0.0) {
      return { s: 0.0, v: 0.0, a: 0.0, j: 0.0 };
    }
    if (t >= p.tTotal) {
      return { s: p.distTarget, v: 0.0, a: 0.0, j: 0.0 };
    }

    const u1 = (t - p.t1) / p.sigma;
    const u2 = (t - p.t2) / p.sigma;

    const tanhU1 = Math.tanh(u1);
    const tanhU2 = Math.tanh(u2);
    const sech2U1 = 1.0 - tanhU1 * tanhU1;
    const sech2U2 = 1.0 - tanhU2 * tanhU2;

    const vRaw = 0.5 * p.vCruise * (tanhU1 - tanhU2);
    const v = (vRaw - p.vOffset) / p.normFactor;

    const aRaw = (0.5 * p.vCruise / p.sigma) * (sech2U1 - sech2U2);
    const aMollifier = p.aOffset * (1.0 - 2.0 * t / p.tTotal);
    const a = (aRaw - aMollifier) / p.normFactor;

    const term1J = sech2U1 * tanhU1;
    const term2J = sech2U2 * tanhU2;
    const jRaw = -(p.vCruise / (p.sigma * p.sigma)) * (term1J - term2J);
    const j = (jRaw + 2.0 * p.aOffset / p.tTotal) / p.normFactor;

    const sRaw = 0.5 * p.vCruise * p.sigma * (logCoshStable(u1) - logCoshStable(u2));
    const s = (sRaw - p.sOffset - p.vOffset * t) / p.normFactor;

    return { s, v, a, j };
  }

  public static createProfile(
    dist: number,
    vMax: number,
    aMax: number,
    jMax: number,
    sigma?: number,
    margin: number = 3.8
  ): MotionProfile {
    const s_sgn = dist >= 0 ? 1.0 : -1.0;
    const L = Math.abs(dist);

    if (L < 1e-7) {
      return {
        algorithm: 'double_tanh',
        T_total: 0,
        s_sgn: 1.0,
        peakVelocity: 0,
        peakAcceleration: 0,
        peakJerk: 0,
        evaluate: () => ({ s: 0, v: 0, a: 0, j: 0 }),
      };
    }

    const p = this.computeProfileParams(L, vMax, aMax, jMax, sigma, margin);

    const evaluate = (t: number): MotionProfileState => {
      const st = this.evaluate(t, p);
      return {
        s: s_sgn * st.s,
        v: s_sgn * st.v,
        a: s_sgn * st.a,
        j: s_sgn * st.j,
      };
    };

    return {
      algorithm: 'double_tanh',
      T_total: p.tTotal,
      s_sgn,
      peakVelocity: p.vCruise,
      peakAcceleration: p.peakAcceleration,
      peakJerk: p.peakJerk,
      evaluate,
    };
  }
}
