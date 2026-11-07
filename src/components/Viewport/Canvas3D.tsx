import React, { useEffect, useRef } from 'react';
import { SceneManager } from './SceneManager';
import { useRobotStore } from '../../store/robotStore';
import { useMobileRobotStore } from '../../store/mobileRobotStore';
import { Loader2, AlertTriangle } from 'lucide-react';

export const Canvas3D: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneManagerRef = useRef<SceneManager | null>(null);

  const {
    activeDomain,
    currentRobotId,
    robotModel,
    isLoading,
    loadingProgressText,
    errorMessage,
    cameraPreset,
    renderingStyle,
    overlays,
    traceClearTrigger,
    backgroundTheme,
    lighting,
    cameraSettings,
    captureRequest,
    gizmoMode,
    activeTrajectory,
    recordingRequest,
    workspaceData,
    workspaceSettings,
  } = useRobotStore();

  // 1. Initialize SceneManager once on mount
  useEffect(() => {
    if (!containerRef.current) return;

    const sm = new SceneManager(containerRef.current);
    sceneManagerRef.current = sm;

    return () => {
      sm.destroy();
      sceneManagerRef.current = null;
    };
  }, []);

  // 2. Load robot model when it changes
  useEffect(() => {
    if (!sceneManagerRef.current || !robotModel) return;
    const initialAngles = useRobotStore.getState().jointAngles;
    sceneManagerRef.current.loadRobot(robotModel, initialAngles);
  }, [robotModel]);

  // 2b. Domain Switcher effect (Manipulator vs Mobile Robot)
  useEffect(() => {
    if (sceneManagerRef.current) {
      sceneManagerRef.current.setDomain(activeDomain);
      if (activeDomain === 'mobile_robot') {
        const mState = useMobileRobotStore.getState();
        sceneManagerRef.current.mobileVisuals.updateObstacles(mState.obstacles);
        sceneManagerRef.current.mobileVisuals.update(
          mState.pose,
          mState.wheelState,
          mState.lidarScan,
          mState.plannedPath,
          mState.navGoal,
          mState.tracePoints,
          mState.specs.driveType,
          mState.agvState,
          mState.poseWaypoints
        );
      }
    }
  }, [activeDomain]);

  // 2c. Mobile Robot 60 FPS Simulation & Visual Update Loop
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const loop = (time: number) => {
      const dt = Math.min(0.05, (time - lastTime) / 1000);
      lastTime = time;

      if (useRobotStore.getState().activeDomain === 'mobile_robot' && sceneManagerRef.current) {
        useMobileRobotStore.getState().tickSimulation(dt);
        const mState = useMobileRobotStore.getState();
        sceneManagerRef.current.mobileVisuals.update(
          mState.pose,
          mState.wheelState,
          mState.lidarScan,
          mState.plannedPath,
          mState.navGoal,
          mState.tracePoints,
          mState.specs.driveType,
          mState.agvState,
          mState.poseWaypoints
        );
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, []);

  // 2d. Mobile Robot Store Listeners (Obstacles & Camera Mode)
  useEffect(() => {
    const unsub = useMobileRobotStore.subscribe((state, prevState) => {
      if (sceneManagerRef.current) {
        if (state.obstacles !== prevState.obstacles) {
          sceneManagerRef.current.mobileVisuals.updateObstacles(state.obstacles);
        }
        if (state.cameraMode !== prevState.cameraMode) {
          sceneManagerRef.current.setMobileCameraMode(state.cameraMode);
        }
      }
    });
    return () => unsub();
  }, []);

  // 3. Fast 60 FPS subscriber to jointAngles (no React re-renders of Canvas3D!)
  useEffect(() => {
    let prevAngles = useRobotStore.getState().jointAngles;
    const unsubscribe = useRobotStore.subscribe((state) => {
      if (state.jointAngles !== prevAngles) {
        prevAngles = state.jointAngles;
        if (sceneManagerRef.current) {
          sceneManagerRef.current.updateJoints(state.jointAngles);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // 4. Camera preset updates
  useEffect(() => {
    if (sceneManagerRef.current) {
      sceneManagerRef.current.setCameraPreset(cameraPreset);
    }
  }, [cameraPreset]);

  // 5. Rendering style updates
  useEffect(() => {
    if (sceneManagerRef.current) {
      sceneManagerRef.current.setRenderingStyle(renderingStyle);
    }
  }, [renderingStyle]);

  // 6. Overlays updates
  useEffect(() => {
    if (sceneManagerRef.current) {
      sceneManagerRef.current.setOverlays(overlays);
    }
  }, [overlays]);

  // 6b. Gizmo Mode updates (Translate vs Rotate)
  useEffect(() => {
    if (sceneManagerRef.current) {
      sceneManagerRef.current.setGizmoMode(gizmoMode);
    }
  }, [gizmoMode]);

  // 7. Clear trajectory trigger
  useEffect(() => {
    if (sceneManagerRef.current && traceClearTrigger > 0) {
      sceneManagerRef.current.clearTrajectory();
    }
  }, [traceClearTrigger]);

  // 8. Background Theme updates (Academic White / Paper vs Studio Dark)
  useEffect(() => {
    if (sceneManagerRef.current) {
      sceneManagerRef.current.setBackgroundTheme(backgroundTheme);
    }
  }, [backgroundTheme]);

  // 9. Lighting updates
  useEffect(() => {
    if (sceneManagerRef.current) {
      sceneManagerRef.current.setLighting(lighting);
    }
  }, [lighting]);

  // 10. Camera updates (FOV, distance, elevation, azimuth)
  useEffect(() => {
    if (sceneManagerRef.current) {
      sceneManagerRef.current.setCameraSpherical(
        cameraSettings.distance,
        cameraSettings.elevationDeg,
        cameraSettings.azimuthDeg,
        cameraSettings.fov
      );
    }
  }, [cameraSettings]);

  // 11. Screenshot capture trigger
  useEffect(() => {
    if (sceneManagerRef.current && captureRequest) {
      sceneManagerRef.current.captureScreenshot(captureRequest);
    }
  }, [captureRequest]);

  // 12. Planned trajectory & waypoint visualizer
  useEffect(() => {
    if (sceneManagerRef.current) {
      sceneManagerRef.current.updatePlannedTrajectory(activeTrajectory);
    }
  }, [activeTrajectory]);

  // 13. Video recording handler
  useEffect(() => {
    if (!sceneManagerRef.current || !recordingRequest) return;
    if (recordingRequest.action === 'start') {
      sceneManagerRef.current.startVideoRecording(60);
    } else if (recordingRequest.action === 'stop') {
      sceneManagerRef.current.stopVideoRecording();
    }
  }, [recordingRequest]);

  // 14. Workspace point cloud and slicing plane visualizer
  useEffect(() => {
    if (sceneManagerRef.current) {
      sceneManagerRef.current.updateWorkspaceCloud(workspaceData, workspaceSettings);
    }
  }, [workspaceData, workspaceSettings]);

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-950">
      {/* 3D WebGL Canvas Container */}
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center z-40">
          <Loader2 className="w-12 h-12 text-sky-400 animate-spin mb-4" />
          <p className="text-sky-300 font-mono text-sm tracking-wide">{loadingProgressText || 'Loading 3D Meshes...'}</p>
          <p className="text-slate-400 text-xs mt-1">Parsing STL geometries and kinematic transformation chains</p>
        </div>
      )}

      {/* Error Overlay */}
      {errorMessage && (
        <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center z-50 p-6 text-center">
          <AlertTriangle className="w-12 h-12 text-rose-500 mb-4" />
          <h3 className="text-lg font-semibold text-rose-300">Kinematic Asset Error</h3>
          <p className="text-slate-300 text-sm max-w-md mt-2 font-mono">{errorMessage}</p>
          <button
            onClick={() => useRobotStore.getState().loadRobot(currentRobotId)}
            className="mt-6 px-4 py-2 bg-rose-600/80 hover:bg-rose-500 text-white rounded-md text-sm font-medium transition"
          >
            Retry Loading
          </button>
        </div>
      )}
    </div>
  );
};
