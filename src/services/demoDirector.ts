import { useRobotStore } from '../store/robotStore';

export type DemoRecordMode = 'tab' | 'canvas' | 'none';

/**
 * Orchestrates automated in-app feature demonstrations with synchronized video recording.
 */
class DemoDirectorService {
  private activeRunId = 0;
  private tabRecorder: MediaRecorder | null = null;
  private tabStream: MediaStream | null = null;
  private tabChunks: Blob[] = [];
  private tabTimerId: ReturnType<typeof setInterval> | null = null;
  private activeMode: DemoRecordMode = 'none';

  private isCancelled(runId: number): boolean {
    return this.activeRunId !== runId;
  }

  private sleep(ms: number, runId: number): Promise<boolean> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(!this.isCancelled(runId));
      }, ms);
    });
  }

  /**
   * Smoothly interpolates joint angles over durationMs using cosine easing.
   */
  private animateJointsTo(
    targetDeg: number[],
    durationMs: number,
    runId: number
  ): Promise<boolean> {
    return new Promise((resolve) => {
      const store = useRobotStore.getState();
      const startAngles = [...store.jointAngles];
      const dof = startAngles.length;
      const clampedTarget = startAngles.map((a, i) => targetDeg[i] ?? a);
      const startTime = performance.now();

      const step = (now: number) => {
        if (this.isCancelled(runId)) {
          resolve(false);
          return;
        }
        const elapsed = now - startTime;
        const t = Math.min(1, elapsed / Math.max(1, durationMs));
        // Smooth cosine ease-in-out
        const ease = 0.5 - 0.5 * Math.cos(Math.PI * t);
        const current = new Array<number>(dof);
        for (let i = 0; i < dof; i++) {
          current[i] = startAngles[i] + (clampedTarget[i] - startAngles[i]) * ease;
        }
        useRobotStore.getState().setAllJointAngles(current);

        if (t < 1) {
          requestAnimationFrame(step);
        } else {
          resolve(true);
        }
      };

      requestAnimationFrame(step);
    });
  }

  /**
   * Smoothly orbits/zooms the 3D viewport camera over durationMs.
   */
  private animateCameraTo(
    target: { azimuthDeg?: number; elevationDeg?: number; distance?: number },
    durationMs: number,
    runId: number
  ): Promise<boolean> {
    return new Promise((resolve) => {
      const startCam = { ...useRobotStore.getState().cameraSettings };
      const tgtAz = target.azimuthDeg ?? startCam.azimuthDeg;
      const tgtEl = target.elevationDeg ?? startCam.elevationDeg;
      const tgtDist = target.distance ?? startCam.distance;
      const startTime = performance.now();

      const step = (now: number) => {
        if (this.isCancelled(runId)) {
          resolve(false);
          return;
        }
        const t = Math.min(1, (now - startTime) / Math.max(1, durationMs));
        const ease = 0.5 - 0.5 * Math.cos(Math.PI * t);

        useRobotStore.getState().setCameraSettings({
          azimuthDeg: startCam.azimuthDeg + (tgtAz - startCam.azimuthDeg) * ease,
          elevationDeg: startCam.elevationDeg + (tgtEl - startCam.elevationDeg) * ease,
          distance: startCam.distance + (tgtDist - startCam.distance) * ease,
        });

        if (t < 1) {
          requestAnimationFrame(step);
        } else {
          resolve(true);
        }
      };

      requestAnimationFrame(step);
    });
  }

  /**
   * Starts full browser-tab MediaRecorder so sidebars, alerts, plots, and 3D canvas are all captured.
   * Returns false if unsupported or cancelled by user.
   */
  private async startTabRecording(runId: number): Promise<boolean> {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: { ideal: 60 },
          displaySurface: 'browser',
        },
        audio: false,
        preferCurrentTab: true,
        selfBrowserSurface: 'include',
      } as DisplayMediaStreamOptions);

      if (this.isCancelled(runId)) {
        stream.getTracks().forEach((tr) => tr.stop());
        return false;
      }

      this.tabStream = stream;
      this.tabChunks = [];

      let mimeType = 'video/webm;codecs=vp9';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm';
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = '';
      }

      this.tabRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 12000000 })
        : new MediaRecorder(stream);

      this.tabRecorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          this.tabChunks.push(ev.data);
        }
      };

      this.tabRecorder.onstop = () => {
        if (this.tabChunks.length > 0) {
          const blob = new Blob(this.tabChunks, {
            type: this.tabRecorder?.mimeType || 'video/webm',
          });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.download = `RoboCAD_Tutorial_PUMA560_FullUI_${Date.now()}.webm`;
          link.href = url;
          link.click();
          setTimeout(() => URL.revokeObjectURL(url), 2500);
        }
        this.cleanupTabStream();
      };

      // Handle native browser "Stop sharing" bar click
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          if (this.activeMode === 'tab' && useRobotStore.getState().demoState.isRunning) {
            this.stopDemo();
          }
        };
      }

      this.tabRecorder.start(100);

      // Keep TopRibbon REC timer ticking cleanly without invoking 3D-only SceneManager recorder
      if (this.tabTimerId) clearInterval(this.tabTimerId);
      useRobotStore.setState({ isRecording: true, recordingSeconds: 0 });
      this.tabTimerId = setInterval(() => {
        useRobotStore.setState((s) => ({ recordingSeconds: s.recordingSeconds + 1 }));
      }, 1000);

      return true;
    } catch {
      return false;
    }
  }

  private cleanupTabStream(): void {
    if (this.tabTimerId) {
      clearInterval(this.tabTimerId);
      this.tabTimerId = null;
    }
    if (this.tabStream) {
      this.tabStream.getTracks().forEach((tr) => tr.stop());
      this.tabStream = null;
    }
    this.tabRecorder = null;
    this.tabChunks = [];
    useRobotStore.setState({ isRecording: false });
  }

  private stopActiveRecording(): void {
    if (this.activeMode === 'tab') {
      if (this.tabRecorder && this.tabRecorder.state === 'recording') {
        this.tabRecorder.stop();
      } else {
        this.cleanupTabStream();
      }
    } else if (this.activeMode === 'canvas') {
      useRobotStore.getState().stopVideoRecording();
    }
    this.activeMode = 'none';
  }

  /**
   * Stops any running demo and saves the active recording immediately.
   */
  public stopDemo(): void {
    this.activeRunId++;
    const store = useRobotStore.getState();
    store.pauseTrajectory();
    this.stopActiveRecording();
    store.setDemoState({
      isRunning: false,
      scenarioId: null,
      stepIndex: 0,
      captionEn: '',
      captionVi: '',
      recordMode: 'none',
    });
  }

  /**
   * Runs Scenario 1: PUMA 560 — 6-DOF Kinematics, 8-Branch IK, Wrist Singularity & Quintic RNE Dynamics.
   */
  public async runScenario1(requestedMode: DemoRecordMode = 'tab'): Promise<void> {
    this.stopDemo();
    const runId = ++this.activeRunId;
    const store = useRobotStore.getState();

    // 1. Setup recording first so the demo starts cleanly from Step 1
    let actualMode: DemoRecordMode = requestedMode;
    if (requestedMode === 'tab') {
      const granted = await this.startTabRecording(runId);
      if (this.isCancelled(runId)) return;
      if (!granted) {
        // Fallback silently to 3D Canvas recording if user declined browser tab prompt
        actualMode = 'canvas';
      }
    }

    if (actualMode === 'canvas') {
      useRobotStore.getState().startVideoRecording();
    }
    this.activeMode = actualMode;

    const updateStep = (stepIndex: number, captionEn: string, captionVi: string) => {
      if (this.isCancelled(runId)) return;
      useRobotStore.getState().setDemoState({
        isRunning: true,
        scenarioId: 'scenario_1_puma560',
        stepIndex,
        totalSteps: 5,
        captionEn,
        captionVi,
        recordMode: actualMode,
      });
    };

    try {
      // =========================================================================
      // STEP 1: Initialize PUMA 560 & Standard D-H Workspace
      // =========================================================================
      updateStep(
        1,
        'Step 1/5: PUMA 560 (6-DOF) — Standard Denavit–Hartenberg Initialization',
        'Bước 1/5: Khởi tạo Robot PUMA 560 (6 DOF) theo chuẩn Denavit–Hartenberg'
      );

      if (store.activeDomain !== 'manipulator') {
        useRobotStore.getState().setActiveDomain('manipulator');
      }
      if (!store.isLeftSidebarOpen) useRobotStore.getState().toggleLeftSidebar();
      if (!store.isRightInspectorOpen) useRobotStore.getState().toggleRightInspector('dh');
      if (store.isBottomDockExpanded) useRobotStore.getState().toggleBottomDockExpanded();

      useRobotStore.getState().setActiveWorkspaceMode('jogging');
      useRobotStore.getState().setRightInspectorTab('dh');

      if (useRobotStore.getState().currentRobotId !== 'puma560') {
        await useRobotStore.getState().loadRobot('puma560');
        if (!(await this.sleep(350, runId))) return;
      }
      if (this.isCancelled(runId)) return;

      useRobotStore.getState().applyHomePosture();
      useRobotStore.getState().clearTrace();

      if (
        !(await this.animateCameraTo(
          { azimuthDeg: 42, elevationDeg: 24, distance: 2250 },
          1400,
          runId
        ))
      )
        return;
      if (!(await this.sleep(800, runId))) return;

      // =========================================================================
      // STEP 2: 60 FPS Forward Motion & 8-Branch Inverse Kinematics
      // =========================================================================
      updateStep(
        2,
        'Step 2/5: 60 FPS Inverse Kinematics & 8 Analytical Posture Branches',
        'Bước 2/5: Động học ngược 60 FPS & Chuyển đổi 8 cấu hình nghiệm giải tích'
      );

      useRobotStore.getState().setActiveWorkspaceMode('ik');
      if (!(await this.animateJointsTo([28, -32, 92, 10, 38, -20], 1800, runId))) return;
      useRobotStore.getState().updateMetricsAndIK();

      // Switch between 2 valid analytical IK branches if available
      const ikConfigs = useRobotStore.getState().ikConfigurations.filter((c) => c.anglesDeg.length > 0);
      if (ikConfigs.length >= 2) {
        if (!(await this.sleep(900, runId))) return;
        useRobotStore.getState().applyIKConfiguration(ikConfigs[1]);
        await this.animateCameraTo({ azimuthDeg: 68, elevationDeg: 22, distance: 2150 }, 1100, runId);
        if (this.isCancelled(runId)) return;
        if (!(await this.sleep(900, runId))) return;
        useRobotStore.getState().applyIKConfiguration(ikConfigs[0]);
      }
      if (!(await this.sleep(900, runId))) return;

      // =========================================================================
      // STEP 3: Geometric Jacobian Matrix & Wrist Singularity Alert (q5 -> 0)
      // =========================================================================
      updateStep(
        3,
        'Step 3/5: Geometric Jacobian J(q) & Wrist Singularity Detection (q₅ → 0°, w(q) → 0)',
        'Bước 3/5: Ma trận Jacobian J(q) & Cảnh báo Kỳ dị cổ tay (q₅ → 0°, w(q) → 0)'
      );

      useRobotStore.getState().setRightInspectorTab('jacobian');
      if (!(await this.animateJointsTo([18, -24, 72, 0, 1.5, 0], 1800, runId))) return;
      useRobotStore.getState().applyWristSingularity();

      if (
        !(await this.animateCameraTo(
          { azimuthDeg: 52, elevationDeg: 18, distance: 1750 },
          1400,
          runId
        ))
      )
        return;
      if (!(await this.sleep(2200, runId))) return;

      // =========================================================================
      // STEP 4: C2 Quintic Spline Trajectory Execution & Kinematic Curves
      // =========================================================================
      updateStep(
        4,
        'Step 4/5: C² Quintic Spline Trajectory & Zero-Jerk Motion Profiles',
        'Bước 4/5: Hoạch định quỹ đạo bậc 5 (Quintic Spline) & Đồ thị Vận tốc/Gia tốc'
      );

      useRobotStore.getState().setActiveWorkspaceMode('trajectory');
      useRobotStore.getState().setInterpolationType('quintic');
      useRobotStore.getState().loadPresetTrajectory('pick-and-place');
      useRobotStore.getState().calculateTrajectoryTorques();

      if (!useRobotStore.getState().isBottomDockExpanded) {
        useRobotStore.getState().toggleBottomDockExpanded();
      }
      useRobotStore.getState().setBottomDockTab('curves');

      await this.animateCameraTo({ azimuthDeg: 40, elevationDeg: 28, distance: 2350 }, 900, runId);
      if (this.isCancelled(runId)) return;

      useRobotStore.getState().setPlaybackSpeed(1.0);
      useRobotStore.getState().playTrajectory();

      // Orbit gently during the first half of trajectory playback
      if (
        !(await this.animateCameraTo(
          { azimuthDeg: 78, elevationDeg: 32, distance: 2200 },
          4200,
          runId
        ))
      )
        return;

      // =========================================================================
      // STEP 5: Recursive Newton-Euler (RNE) Inverse Dynamics Joint Torques
      // =========================================================================
      updateStep(
        5,
        'Step 5/5: Recursive Newton–Euler (RNE) Inverse Dynamics Torques τ(t)',
        'Bước 5/5: Phân tích Mô-men Động lực học ngược Newton–Euler (RNE)'
      );

      useRobotStore.getState().setBottomDockTab('torques');

      // Wait until trajectory finishes or max 4.5s
      const startWait = performance.now();
      while (
        useRobotStore.getState().playbackState.isPlaying &&
        performance.now() - startWait < 4500
      ) {
        if (!(await this.sleep(250, runId))) return;
      }

      await this.animateCameraTo({ azimuthDeg: 45, elevationDeg: 26, distance: 2300 }, 1200, runId);
      if (this.isCancelled(runId)) return;
      if (!(await this.sleep(800, runId))) return;
    } finally {
      if (this.activeRunId === runId) {
        this.stopDemo();
      }
    }
  }
}

export const DemoDirector = new DemoDirectorService();
