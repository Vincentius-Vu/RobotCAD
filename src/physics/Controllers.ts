import { DHParameter } from '../types/robot';
import {
  InertialParameters,
  ControllerType,
  ControllerGains,
  SMCSettings,
} from '../types/dynamics';
import {
  ControllerStrategyRegistry,
  ControllerContext,
  ControllerOutput,
  IRobotController,
  CustomControllerDefinition,
  CONTROLLER_TEMPLATES,
  resetLADRCObservers,
} from './controllers/ControllerStrategyRegistry';

export {
  ControllerStrategyRegistry,
  CONTROLLER_TEMPLATES,
  resetLADRCObservers,
};
export type {
  IRobotController,
  ControllerContext,
  ControllerOutput,
  CustomControllerDefinition,
};

/**
 * Industrial & Educational Robot Motion Controllers Dispatcher
 * Powered by Open-Architecture ControllerStrategyRegistry
 */
export class Controllers {
  /**
   * Computes control torque tau based on selected control architecture
   */
  public static computeControlTorque(
    type: ControllerType,
    dhParams: DHParameter[],
    inertiaList: InertialParameters[],
    qRad: number[],
    qdRad: number[],
    qDesiredRad: number[],
    qdDesiredRad: number[],
    qddDesiredRad: number[],
    gains: ControllerGains,
    gravityAcc: number = 9.81,
    externalTorqueDisturbance: number[] = [],
    smcSettings?: SMCSettings,
    reflectedRotorInertias?: number[]
  ): ControllerOutput {
    return ControllerStrategyRegistry.compute(type, {
      dhParams,
      inertiaList,
      qRad,
      qdRad,
      qDesiredRad,
      qdDesiredRad,
      qddDesiredRad,
      gains,
      gravityAcc,
      externalTorqueDisturbance,
      smcSettings,
      reflectedRotorInertias,
    });
  }

  /**
   * Lists all available registered control strategies
   */
  public static getAvailableControllers(): IRobotController[] {
    return ControllerStrategyRegistry.getAll();
  }
}
