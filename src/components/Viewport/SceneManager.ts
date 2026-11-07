import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import {
  RobotModel,
  CameraPreset,
  RenderingStyle,
  ViewportOverlaySettings,
  BackgroundTheme,
  LightingSettings,
} from '../../types/robot';
import { TrajectoryPlan } from '../../types/trajectory';
import { WorkspaceCloudData, WorkspaceSettings } from '../../types/workspace';
import { robotLoader, DEFAULT_LINK_PALETTE } from '../../services/robotLoader';
import { RobotKinematics } from '../../kinematics/RobotKinematics';
import { useRobotStore } from '../../store/robotStore';
import { MobileRobotVisuals } from './MobileRobotVisuals';

export class SceneManager {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private animationFrameId: number | null = null;

  // Scene Hierarchy
  private robotRoot: THREE.Group;
  private linkMeshes: THREE.Mesh[] = [];
  private linkWireframes: THREE.LineSegments[] = [];
  private frameHelpers: THREE.Group[] = [];
  private skeletonLine: THREE.Line | null = null;
  private skeletonJointSpheres: THREE.Mesh[] = [];
  private skeletonBones: THREE.Mesh[] = [];
  private tcpMarker: THREE.Group | null = null;
  private trajectoryLine: THREE.Line | null = null;
  private plannedTrajectoryLine: THREE.Line | null = null;
  private waypointMarkersGroup: THREE.Group = new THREE.Group();
  private trajectoryPoints: THREE.Vector3[] = [];
  private maxTrajectoryPoints = 600;

  private transformControls: TransformControls | null = null;
  private transformControlsGizmo: THREE.Object3D | null = null;
  private ikGizmoTarget: THREE.Object3D | null = null;
  private manipulabilityMesh: THREE.Mesh | null = null;
  private isGizmoDragging = false;

  // Mobile Robot visuals
  public mobileVisuals: MobileRobotVisuals;
  public activeDomain: 'manipulator' | 'mobile_robot' = 'manipulator';

  // Video recording
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];

  // Workspace Cloud & Slicing
  private workspacePointsMesh: THREE.Points | null = null;
  private workspaceSlicePlaneHelper: THREE.Mesh | null = null;

  // Active configurations
  private currentLoadId = 0;
  private currentModel: RobotModel | null = null;
  private currentAngles: number[] = [];
  private currentTransforms: THREE.Matrix4[] = [];
  private renderingStyle: RenderingStyle = 'solid';
  private overlays: ViewportOverlaySettings = {
    showFrames: true,
    showSkeleton: true,
    skeletonMode: 'physical',
    showTcp: true,
    showTrace: true,
    showGrid: true,
    showShadows: true,
    wireframeOnly: false,
    showManipulabilityEllipsoid: false,
    showIKGizmo: false,
  };

  private gridFloor: THREE.Group | null = null;
  private shadowPlane: THREE.Mesh | null = null;
  private mainGrid: THREE.GridHelper | null = null;
  private subGrid: THREE.GridHelper | null = null;

  private ambientLight: THREE.AmbientLight | null = null;
  private keyLight: THREE.DirectionalLight | null = null;
  private rimLight: THREE.DirectionalLight | null = null;
  private groundFill: THREE.HemisphereLight | null = null;
  private shadowLight: THREE.DirectionalLight | null = null;
  private cameraLerpTarget: { position: THREE.Vector3; target: THREE.Vector3 } | null = null;
  private backgroundTheme: BackgroundTheme = 'studio-dark';

  constructor(container: HTMLElement) {
    this.container = container;

    // 1. Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0f172a); // Studio dark default
    this.scene.fog = new THREE.FogExp2(0x0f172a, 0.00012);

    // 2. Camera setup (Initial view with expanded near/far planes)
    const aspect = container.clientWidth / container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(42, aspect, 1, 150000);
    this.camera.position.set(1600, 1400, 1900);

    // 3. Renderer setup
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true, // Needed for screenshot export
    });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    container.appendChild(this.renderer.domElement);

    // 4. OrbitControls with unconstrained zoom ranges (5mm to 60 meters)
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.screenSpacePanning = true;
    this.controls.zoomSpeed = 1.2;
    this.controls.minDistance = 5;
    this.controls.maxDistance = 60000;
    this.controls.target.set(0, 450, 0);

    (window as any).__sceneManager = this;

    // 5. Robot Root Group
    this.robotRoot = new THREE.Group();
    this.robotRoot.rotation.x = -Math.PI / 2;
    this.scene.add(this.robotRoot);
    this.robotRoot.add(this.waypointMarkersGroup);

    // 5b. Mobile Robot Visuals
    this.mobileVisuals = new MobileRobotVisuals(this.scene);

    // 6. TransformControls for Interactive 3D TCP Dragging
    this.transformControls = new TransformControls(this.camera, this.renderer.domElement);
    this.transformControls.size = 0.85;
    this.transformControls.addEventListener('dragging-changed', (event: any) => {
      this.controls.enabled = !event.value;
      this.isGizmoDragging = event.value;
    });

    this.ikGizmoTarget = new THREE.Object3D();
    this.scene.add(this.ikGizmoTarget);
    this.transformControls.attach(this.ikGizmoTarget);
    this.transformControlsGizmo = this.transformControls.getHelper();
    this.transformControlsGizmo.visible = false;
    this.transformControls.enabled = false;
    this.scene.add(this.transformControlsGizmo);

    this.transformControls.addEventListener('objectChange', () => {
      if (!this.ikGizmoTarget || !this.currentModel) return;
      this.ikGizmoTarget.updateMatrixWorld();
      this.robotRoot.updateMatrixWorld();

      const targetWorldMatrix = this.ikGizmoTarget.matrixWorld.clone();
      const invRobotRoot = this.robotRoot.matrixWorld.clone().invert();
      const localTargetMatrix = invRobotRoot.multiply(targetWorldMatrix);

      useRobotStore.getState().solveTargetIK(localTargetMatrix);
    });

    // 7. Lighting & Environment
    this.setupLighting();
    this.setupEnvironmentFloor();

    // 7. Event listeners
    window.addEventListener('resize', this.onWindowResize);

    // 8. Start render loop
    this.animate();
  }

  private setupLighting() {
    // Ambient soft fill
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(this.ambientLight);

    // Key directional light with high-res soft shadow
    this.keyLight = new THREE.DirectionalLight(0xffffff, 1.3);
    this.keyLight.position.set(2000, 3500, 2500);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.width = 2048;
    this.keyLight.shadow.mapSize.height = 2048;
    this.keyLight.shadow.camera.near = 100;
    this.keyLight.shadow.camera.far = 10000;
    const d = 1600;
    this.keyLight.shadow.camera.left = -d;
    this.keyLight.shadow.camera.right = d;
    this.keyLight.shadow.camera.top = d;
    this.keyLight.shadow.camera.bottom = -d;
    this.keyLight.shadow.bias = -0.0005;
    this.scene.add(this.keyLight);
    this.shadowLight = this.keyLight;

    // Rim/accent light from back-left
    this.rimLight = new THREE.DirectionalLight(0x38bdf8, 0.7);
    this.rimLight.position.set(-2500, 2000, -2500);
    this.scene.add(this.rimLight);

    // Ground bounce fill
    this.groundFill = new THREE.HemisphereLight(0x334155, 0x0f172a, 0.4);
    this.scene.add(this.groundFill);
  }

  private setupEnvironmentFloor() {
    this.gridFloor = new THREE.Group();

    // Shadow receiver plane
    const planeGeo = new THREE.PlaneGeometry(8000, 8000);
    const planeMat = new THREE.ShadowMaterial({ opacity: 0.35 });
    this.shadowPlane = new THREE.Mesh(planeGeo, planeMat);
    this.shadowPlane.rotation.x = -Math.PI / 2;
    this.shadowPlane.position.y = -1;
    this.shadowPlane.receiveShadow = true;
    this.gridFloor.add(this.shadowPlane);

    // Build grids
    this.rebuildGrids('studio-dark');

    this.scene.add(this.gridFloor);
  }

  private rebuildGrids(theme: BackgroundTheme) {
    if (!this.gridFloor) return;

    if (this.mainGrid) {
      this.gridFloor.remove(this.mainGrid);
      this.mainGrid.geometry.dispose();
      (this.mainGrid.material as THREE.Material).dispose();
      this.mainGrid = null;
    }
    if (this.subGrid) {
      this.gridFloor.remove(this.subGrid);
      this.subGrid.geometry.dispose();
      (this.subGrid.material as THREE.Material).dispose();
      this.subGrid = null;
    }

    let mainColor = 0x0284c7;
    let mainSecondary = 0x1e293b;
    let subColor = 0x0ea5e9;
    let subSecondary = 0x0f172a;

    if (theme === 'academic-white') {
      mainColor = 0x0284c7;
      mainSecondary = 0xd1d5db; // Soft grey grid on paper
      subColor = 0x38bdf8;
      subSecondary = 0xe5e7eb;
    } else if (theme === 'technical-light') {
      mainColor = 0x0284c7;
      mainSecondary = 0xcbd5e1;
      subColor = 0x38bdf8;
      subSecondary = 0xe2e8f0;
    } else if (theme === 'deep-space') {
      mainColor = 0x0284c7;
      mainSecondary = 0x0f172a;
      subColor = 0x0ea5e9;
      subSecondary = 0x020617;
    }

    this.mainGrid = new THREE.GridHelper(4000, 40, mainColor, mainSecondary);
    this.mainGrid.position.y = 0;
    this.gridFloor.add(this.mainGrid);

    this.subGrid = new THREE.GridHelper(2000, 40, subColor, subSecondary);
    this.subGrid.position.y = 0.5;
    this.gridFloor.add(this.subGrid);
  }

  /**
   * Sets background theme (Academic White, Light Technical, Studio Dark, Deep Space)
   */
  public setBackgroundTheme(theme: BackgroundTheme) {
    this.backgroundTheme = theme;

    switch (theme) {
      case 'academic-white':
        this.scene.background = new THREE.Color(0xffffff);
        this.scene.fog = null; // Clean sharp paper background
        if (this.ambientLight) this.ambientLight.intensity = 0.95;
        if (this.keyLight) this.keyLight.intensity = 1.35;
        if (this.rimLight) {
          this.rimLight.color.setHex(0x64748b);
          this.rimLight.intensity = 0.45;
        }
        if (this.groundFill) {
          this.groundFill.color.setHex(0xf8fafc);
          this.groundFill.groundColor.setHex(0xe2e8f0);
          this.groundFill.intensity = 0.5;
        }
        if (this.shadowPlane) {
          (this.shadowPlane.material as THREE.ShadowMaterial).opacity = 0.16;
        }
        break;

      case 'technical-light':
        this.scene.background = new THREE.Color(0xf1f5f9);
        this.scene.fog = new THREE.FogExp2(0xf1f5f9, 0.0001);
        if (this.ambientLight) this.ambientLight.intensity = 0.85;
        if (this.keyLight) this.keyLight.intensity = 1.3;
        if (this.rimLight) {
          this.rimLight.color.setHex(0x38bdf8);
          this.rimLight.intensity = 0.5;
        }
        if (this.groundFill) {
          this.groundFill.color.setHex(0xe2e8f0);
          this.groundFill.groundColor.setHex(0xcbd5e1);
          this.groundFill.intensity = 0.45;
        }
        if (this.shadowPlane) {
          (this.shadowPlane.material as THREE.ShadowMaterial).opacity = 0.22;
        }
        break;

      case 'studio-dark':
        this.scene.background = new THREE.Color(0x0f172a);
        this.scene.fog = new THREE.FogExp2(0x0f172a, 0.00012);
        if (this.ambientLight) this.ambientLight.intensity = 0.7;
        if (this.keyLight) this.keyLight.intensity = 1.3;
        if (this.rimLight) {
          this.rimLight.color.setHex(0x38bdf8);
          this.rimLight.intensity = 0.7;
        }
        if (this.groundFill) {
          this.groundFill.color.setHex(0x334155);
          this.groundFill.groundColor.setHex(0x0f172a);
          this.groundFill.intensity = 0.4;
        }
        if (this.shadowPlane) {
          (this.shadowPlane.material as THREE.ShadowMaterial).opacity = 0.35;
        }
        break;

      case 'deep-space':
        this.scene.background = new THREE.Color(0x020617);
        this.scene.fog = new THREE.FogExp2(0x020617, 0.00015);
        if (this.ambientLight) this.ambientLight.intensity = 0.6;
        if (this.keyLight) this.keyLight.intensity = 1.4;
        if (this.rimLight) {
          this.rimLight.color.setHex(0x38bdf8);
          this.rimLight.intensity = 0.8;
        }
        if (this.groundFill) {
          this.groundFill.color.setHex(0x1e293b);
          this.groundFill.groundColor.setHex(0x020617);
          this.groundFill.intensity = 0.3;
        }
        if (this.shadowPlane) {
          (this.shadowPlane.material as THREE.ShadowMaterial).opacity = 0.4;
        }
        break;
    }

    this.rebuildGrids(theme);
    this.setRenderingStyle(this.renderingStyle);
  }

  public getBackgroundTheme(): BackgroundTheme {
    return this.backgroundTheme;
  }

  /**
   * Adjusts lighting intensities and direction
   */
  public setLighting(settings: LightingSettings) {
    if (this.ambientLight) this.ambientLight.intensity = settings.ambientIntensity;
    if (this.keyLight) {
      this.keyLight.intensity = settings.keyLightIntensity;
      const deg = settings.lightAzimuthDeg !== undefined ? settings.lightAzimuthDeg : 45;
      const rad = THREE.MathUtils.degToRad(deg);
      const radius = 3500;
      this.keyLight.position.set(radius * Math.cos(rad), 3500, radius * Math.sin(rad));
    }
    if (this.rimLight) this.rimLight.intensity = settings.rimLightIntensity;
    if (this.shadowPlane) {
      (this.shadowPlane.material as THREE.ShadowMaterial).opacity = settings.shadowOpacity;
    }
  }

  /**
   * Adjusts camera Field of View (FOV)
   * Lower FOV (e.g. 20-30 deg) gives an orthographic/axonometric textbook look!
   */
  public setCameraFov(fov: number) {
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Directly sets camera spherical orbit position (distance, elevation angle, azimuth angle)
   */
  public setCameraSpherical(distance: number, elevationDeg: number, azimuthDeg: number, fov?: number) {
    if (fov !== undefined && this.camera.fov !== fov) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
    const target = this.controls.target || new THREE.Vector3(0, 450, 0);
    const clampedElev = Math.max(-10, Math.min(85, elevationDeg));
    const phi = THREE.MathUtils.degToRad(90 - clampedElev);
    const theta = THREE.MathUtils.degToRad(azimuthDeg);

    const x = target.x + distance * Math.sin(phi) * Math.sin(theta);
    const y = target.y + distance * Math.cos(phi);
    const z = target.z + distance * Math.sin(phi) * Math.cos(theta);

    this.camera.position.set(x, y, z);
    this.controls.update();
  }

  /**
   * Exports high-resolution PNG snapshot with customizable DPI for textbooks, LaTeX, or slides
   */
  public captureScreenshot(options: {
    format: 'white' | 'transparent' | 'current';
    resolutionScale?: number;
    dpi?: number;
    customFileName?: string;
  }): string {
    let scale = options.resolutionScale || 2;
    if (options.dpi) {
      scale = Math.max(1, Math.round((options.dpi / 96) * 10) / 10);
    }

    const origWidth = this.container.clientWidth;
    const origHeight = this.container.clientHeight;
    const origBackground = this.scene.background;
    const origFog = this.scene.fog;

    const targetWidth = Math.round(origWidth * scale);
    const targetHeight = Math.round(origHeight * scale);

    if (options.format === 'transparent') {
      this.scene.background = null;
      this.scene.fog = null;
    } else if (options.format === 'white') {
      this.scene.background = new THREE.Color(0xffffff);
      this.scene.fog = null;
    }

    this.renderer.setSize(targetWidth, targetHeight, false);
    this.camera.aspect = targetWidth / targetHeight;
    this.camera.updateProjectionMatrix();

    this.renderer.render(this.scene, this.camera);
    const dataUrl = this.renderer.domElement.toDataURL('image/png');

    // Restore viewport state
    this.scene.background = origBackground;
    this.scene.fog = origFog;
    this.renderer.setSize(origWidth, origHeight, true);
    this.camera.aspect = origWidth / origHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.render(this.scene, this.camera);

    // Auto download image
    const link = document.createElement('a');
    const robotName = this.currentModel?.modelName || 'Robot';
    const dpiTag = options.dpi ? `_${options.dpi}DPI` : `_${scale}x`;
    const prefix = options.customFileName || `${robotName.replace(/\s+/g, '_')}_Trajectory`;
    link.download = `${prefix}_${options.format}${dpiTag}_${Date.now()}.png`;
    link.href = dataUrl;
    link.click();

    return dataUrl;
  }

  /**
   * Starts high-fps video recording of the 3D canvas
   */
  public startVideoRecording(fps = 60): boolean {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      return false;
    }

    try {
      const canvas = this.renderer.domElement;
      const stream = canvas.captureStream(fps);

      let mimeType = 'video/webm;codecs=vp9';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm';
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = '';
      }

      this.recordedChunks = [];
      this.mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 10000000 })
        : new MediaRecorder(stream);

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        if (this.recordedChunks.length === 0) return;
        const blob = new Blob(this.recordedChunks, {
          type: this.mediaRecorder?.mimeType || 'video/webm',
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const robotName = this.currentModel?.modelName || 'Robot';
        link.download = `${robotName.replace(/\s+/g, '_')}_Trajectory_Simulation_${Date.now()}.webm`;
        link.href = url;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        this.recordedChunks = [];
      };

      this.mediaRecorder.start(100);
      return true;
    } catch (err) {
      console.error('Failed to start video recording:', err);
      return false;
    }
  }

  /**
   * Stops video recording and triggers file download
   */
  public stopVideoRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
    }
  }

  /**
   * Loads and builds the robot visual representations
   */
  public async loadRobot(model: RobotModel, initialAngles: number[]) {
    const loadId = ++this.currentLoadId;
    this.currentModel = model;
    this.currentAngles = [...initialAngles];

    // Compute initial FK transforms
    this.currentTransforms = RobotKinematics.computeForwardKinematics(model.joints, initialAngles);

    // 1. Fetch all link geometries in parallel
    const loadPromises = model.links.map(async (link) => {
      try {
        return await robotLoader.loadLinkGeometry(model.id, link.fileName);
      } catch (err) {
        console.warn(`Could not load mesh ${link.fileName}`, err);
        return null;
      }
    });

    const geometries = await Promise.all(loadPromises);

    // If another robot was selected while this was downloading, abort immediately!
    if (this.currentLoadId !== loadId) {
      return;
    }

    // 2. Completely clear and dispose all existing children from robotRoot
    this.clearRobotHierarchy();

    // 3. Build link meshes
    geometries.forEach((geometry, index) => {
      if (!geometry) return;
      const link = model.links[index];

      // Solid material - rich high-contrast industrial polyurethane finish (vibrant across dark/light modes)
      const solidMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(link.color),
        roughness: 0.28,
        metalness: 0.20,
        wireframe: this.overlays.wireframeOnly,
      });

      const mesh = new THREE.Mesh(geometry, solidMat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;

      // Wireframe edges for ghosted / technical style
      const edgesGeo = new THREE.EdgesGeometry(geometry, 25);
      const isDark = this.backgroundTheme === 'studio-dark' || this.backgroundTheme === 'deep-space';
      const wireframeMat = new THREE.LineBasicMaterial({
        color: isDark ? 0x94a3b8 : 0x334155,
        transparent: true,
        opacity: isDark ? 0.50 : 0.65,
        linewidth: 1,
      });
      const wireframe = new THREE.LineSegments(edgesGeo, wireframeMat);
      wireframe.matrixAutoUpdate = false;
      wireframe.visible = this.renderingStyle === 'ghosted' || this.overlays.wireframeOnly;

      this.robotRoot.add(mesh);
      this.robotRoot.add(wireframe);

      this.linkMeshes[index] = mesh;
      this.linkWireframes[index] = wireframe;
    });

    // 4. Create D-H Coordinate Frames
    this.buildCoordinateFrames();

    // 5. Create Kinematic Skeleton
    this.buildKinematicSkeleton();

    // 6. Create Tool Center Point (TCP) Marker
    this.buildTcpMarker();

    // 7. Create Manipulability Ellipsoid (Yoshikawa 3D)
    this.buildManipulabilityEllipsoid();

    // 8. Create Trajectory Line
    this.buildTrajectoryLine();

    // 9. Apply initial transforms
    this.updateJoints(this.currentAngles);

    // 10. Center camera on robot
    this.fitCameraToRobot();
  }

  private clearRobotHierarchy() {
    // 1. Thoroughly remove and dispose EVERY child in robotRoot
    while (this.robotRoot.children.length > 0) {
      const child = this.robotRoot.children[0];
      this.robotRoot.remove(child);
      this.disposeObject(child);
    }

    this.linkMeshes = [];
    this.linkWireframes = [];
    this.frameHelpers = [];

    this.skeletonLine = null;
    this.skeletonJointSpheres = [];
    this.skeletonBones = [];
    this.tcpMarker = null;
    this.manipulabilityMesh = null;
    this.trajectoryLine = null;

    this.clearTrajectory();
  }

  private disposeObject(obj: THREE.Object3D) {
    obj.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.geometry) {
        mesh.geometry.dispose();
      }
      if (mesh.material) {
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => m.dispose());
        } else {
          mesh.material.dispose();
        }
      }
    });
  }

  /**
   * Builds industrial standard RGB Coordinate Frames for {0} through {n}
   * Red: +X, Green: +Y, Blue: +Z
   */
  private buildCoordinateFrames() {
    if (!this.currentModel) return;
    const numFrames = this.currentModel.joints.length + 1;

    // Scale frame axis size proportionally to robot reach
    const reach = this.currentModel.reachMm || 1000;
    const axisLength = Math.max(90, Math.min(220, reach * 0.16));
    const headLength = axisLength * 0.22;
    const headWidth = axisLength * 0.11;

    for (let i = 0; i < numFrames; i++) {
      const frameGroup = new THREE.Group();
      frameGroup.matrixAutoUpdate = false;

      // X Axis (Red)
      const dirX = new THREE.Vector3(1, 0, 0);
      const arrowX = new THREE.ArrowHelper(dirX, new THREE.Vector3(0, 0, 0), axisLength, 0xef4444, headLength, headWidth);
      frameGroup.add(arrowX);

      // Y Axis (Green)
      const dirY = new THREE.Vector3(0, 1, 0);
      const arrowY = new THREE.ArrowHelper(dirY, new THREE.Vector3(0, 0, 0), axisLength, 0x22c55e, headLength, headWidth);
      frameGroup.add(arrowY);

      // Z Axis (Blue)
      const dirZ = new THREE.Vector3(0, 0, 1);
      const arrowZ = new THREE.ArrowHelper(dirZ, new THREE.Vector3(0, 0, 0), axisLength, 0x3b82f6, headLength, headWidth);
      frameGroup.add(arrowZ);

      // Origin dot
      const sphereGeo = new THREE.SphereGeometry(Math.max(6, axisLength * 0.06), 16, 16);
      const sphereMat = new THREE.MeshBasicMaterial({ color: i === 0 ? 0xf8fafc : 0x38bdf8 });
      const originSphere = new THREE.Mesh(sphereGeo, sphereMat);
      frameGroup.add(originSphere);

      // Badge Sprite label: {0}, {1}, ..., {n}
      const labelSprite = this.createFrameLabelSprite(`{${i}}`, i === 0 ? '#38bdf8' : '#94a3b8');
      labelSprite.position.set(axisLength * 0.2, axisLength * 0.2, axisLength * 0.2);
      frameGroup.add(labelSprite);

      frameGroup.visible = this.overlays.showFrames;
      this.robotRoot.add(frameGroup);
      this.frameHelpers.push(frameGroup);
    }
  }

  private createFrameLabelSprite(text: string, color: string = '#38bdf8'): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Rounded pill badge
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      const x = 6, y = 6, w = 116, h = 52, r = 12;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(x, y, w, h, r);
      } else {
        ctx.rect(x, y, w, h);
      }
      ctx.fill();
      ctx.stroke();

      // Text label
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 28px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 64, 32);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(70, 35, 1);
    sprite.renderOrder = 999;
    return sprite;
  }

  private buildKinematicSkeleton() {
    if (!this.currentModel) return;
    const numTransforms = this.currentModel.joints.length + 1;
    const points = new Array(numTransforms).fill(0).map(() => new THREE.Vector3());

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: 0x38bdf8, // Cyber Sky Blue
      linewidth: 3,
      transparent: true,
      opacity: 0.9,
    });

    this.skeletonLine = new THREE.Line(geometry, material);
    this.skeletonLine.visible = this.overlays.showSkeleton;
    this.robotRoot.add(this.skeletonLine);

    const reach = this.currentModel.reachMm || 1000;
    const boneRadius = Math.max(7, Math.min(14, reach * 0.012)); // ~10mm prominent cylinder bone
    const numBones = numTransforms - 1;

    // Unit height 3D cylinder bone geometry (height = 1, centered at origin, aligned with Y axis)
    const boneGeo = new THREE.CylinderGeometry(boneRadius, boneRadius, 1, 16);

    // Differentiate each Link Bone by its matching 3D link color
    this.skeletonBones = [];
    for (let i = 0; i < numBones; i++) {
      const linkColorHex =
        this.currentModel.links[i + 1]?.color ||
        DEFAULT_LINK_PALETTE[(i + 1) % DEFAULT_LINK_PALETTE.length];
      const linkColor = new THREE.Color(linkColorHex);

      const boneMat = new THREE.MeshStandardMaterial({
        color: linkColor,
        emissive: linkColor.clone().multiplyScalar(0.4),
        emissiveIntensity: 0.6,
        roughness: 0.25,
        metalness: 0.6,
        transparent: true,
        opacity: 0.95,
      });

      const boneMesh = new THREE.Mesh(boneGeo, boneMat);
      boneMesh.matrixAutoUpdate = false;
      boneMesh.visible = this.overlays.showSkeleton;
      boneMesh.castShadow = false;
      this.robotRoot.add(boneMesh);
      this.skeletonBones.push(boneMesh);
    }

    // High-visibility glowing Actuator Nodes representing JOINTS (Khớp J_i)
    // Gold/Amber hubs distinguish rotational joint degrees-of-freedom from passive link bones
    const sphereRadius = boneRadius * 1.65; // ~16.5mm
    this.skeletonJointSpheres = [];
    for (let i = 0; i < numTransforms; i++) {
      const sphereGeo = new THREE.SphereGeometry(sphereRadius, 20, 20);

      // Base {0} is industrial slate/titanium, Tool tip {n} is signal orange reticle,
      // All intermediate joints J_1..J_{n-1} are luminous Gold/Amber Actuator Hubs
      const isBase = i === 0;
      const isTip = i === numTransforms - 1;
      const jointColor = isBase ? 0x94a3b8 : isTip ? 0xf97316 : 0xfbbf24;
      const emissiveColor = isBase ? 0x475569 : isTip ? 0xea580c : 0xd97706;

      const sphereMat = new THREE.MeshStandardMaterial({
        color: jointColor,
        emissive: emissiveColor,
        emissiveIntensity: 0.85,
        roughness: 0.2,
        metalness: 0.6,
      });
      const sphere = new THREE.Mesh(sphereGeo, sphereMat);
      sphere.visible = this.overlays.showSkeleton;
      sphere.castShadow = false;
      this.robotRoot.add(sphere);
      this.skeletonJointSpheres.push(sphere);
    }
  }

  private buildTcpMarker() {
    const tcpGroup = new THREE.Group();
    tcpGroup.matrixAutoUpdate = false;

    // Glowing end-effector focal point
    const coreGeo = new THREE.SphereGeometry(14, 24, 24);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b, // Amber
      emissive: 0xf59e0b,
      emissiveIntensity: 0.9,
      roughness: 0.1,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    tcpGroup.add(core);

    // Reticle rings
    const ringGeo = new THREE.RingGeometry(22, 26, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
    });
    const ringXY = new THREE.Mesh(ringGeo, ringMat);
    tcpGroup.add(ringXY);

    const ringXZ = new THREE.Mesh(ringGeo, ringMat);
    ringXZ.rotation.x = Math.PI / 2;
    tcpGroup.add(ringXZ);

    tcpGroup.visible = this.overlays.showTcp;
    this.robotRoot.add(tcpGroup);
    this.tcpMarker = tcpGroup;
  }

  private buildManipulabilityEllipsoid() {
    const geo = new THREE.SphereGeometry(1, 32, 24);
    const mat = new THREE.MeshPhysicalMaterial({
      color: 0x06b6d4, // Cyan
      transparent: true,
      opacity: 0.38,
      roughness: 0.25,
      metalness: 0.1,
      clearcoat: 0.5,
      wireframe: false,
    });
    this.manipulabilityMesh = new THREE.Mesh(geo, mat);
    this.manipulabilityMesh.matrixAutoUpdate = false;
    this.manipulabilityMesh.visible = this.overlays.showManipulabilityEllipsoid;
    this.robotRoot.add(this.manipulabilityMesh);
  }

  private buildTrajectoryLine() {
    const geo = new THREE.BufferGeometry();
    const posAttr = new THREE.BufferAttribute(new Float32Array(this.maxTrajectoryPoints * 3), 3);
    posAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', posAttr);

    const mat = new THREE.LineBasicMaterial({
      color: 0xf59e0b, // Amber golden trail
      linewidth: 2,
      transparent: true,
      opacity: 0.85,
    });

    this.trajectoryLine = new THREE.Line(geo, mat);
    this.trajectoryLine.visible = this.overlays.showTrace;
    this.robotRoot.add(this.trajectoryLine);
  }

  /**
   * Updates all rigid link transforms and visual overlays based on joint angles
   */
  public updateJoints(jointAnglesDeg: number[]) {
    if (!this.currentModel) return;
    this.currentAngles = [...jointAnglesDeg];

    // Compute homogeneous transforms
    this.currentTransforms = RobotKinematics.computeForwardKinematics(
      this.currentModel.joints,
      jointAnglesDeg
    );

    // 1. Update Link Meshes
    for (let i = 0; i < this.linkMeshes.length; i++) {
      if (this.linkMeshes[i] && this.currentTransforms[i]) {
        this.linkMeshes[i].matrix.copy(this.currentTransforms[i]);
      }
      if (this.linkWireframes[i] && this.currentTransforms[i]) {
        this.linkWireframes[i].matrix.copy(this.currentTransforms[i]);
      }
    }

    // 2. Compute Kinematic Skeleton & Adjusted Transforms
    const skeletonData = RobotKinematics.computeSkeleton(
      this.currentModel.id,
      this.currentTransforms,
      this.overlays.skeletonMode || 'physical'
    );

    // 3. Update Coordinate Frames (in physical mode, places frame helpers at true structural joints)
    const effectiveTransforms = skeletonData.adjustedTransforms || this.currentTransforms;
    for (let i = 0; i < this.frameHelpers.length; i++) {
      if (this.frameHelpers[i] && effectiveTransforms[i]) {
        this.frameHelpers[i].matrix.copy(effectiveTransforms[i]);
      }
    }

    // 4. Update Kinematic Skeleton line, bones & spheres
    if (this.skeletonLine) {
      this.skeletonLine.geometry.setFromPoints(skeletonData.pathPoints);
    }
    for (let i = 0; i < this.skeletonJointSpheres.length; i++) {
      if (this.skeletonJointSpheres[i] && skeletonData.spherePositions[i]) {
        this.skeletonJointSpheres[i].position.copy(skeletonData.spherePositions[i]);
      }
    }

    // Update 3D cylindrical kinematic bones connecting structural joints
    const upAxis = new THREE.Vector3(0, 1, 0);
    const dir = new THREE.Vector3();
    const mid = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const boneMat4 = new THREE.Matrix4();

    for (let i = 0; i < this.skeletonBones.length; i++) {
      const bone = this.skeletonBones[i];
      const boneData = skeletonData.bones[i];
      if (!bone || !boneData) {
        if (bone) bone.visible = false;
        continue;
      }

      const p0 = boneData.from;
      const p1 = boneData.to;
      dir.subVectors(p1, p0);
      const dist = dir.length();

      if (dist < 1.0) {
        // Coincident frames (e.g. spherical wrist center), hide bone
        bone.visible = false;
        continue;
      }

      bone.visible = this.overlays.showSkeleton;

      // Dynamically match bone color to the physical link it represents
      const linkIdx = boneData.linkIndex;
      const linkColorHex =
        this.currentModel.links[linkIdx]?.color ||
        DEFAULT_LINK_PALETTE[linkIdx % DEFAULT_LINK_PALETTE.length];
      const boneMat = bone.material as THREE.MeshStandardMaterial;
      if (boneMat && boneMat.color) {
        boneMat.color.set(linkColorHex);
        boneMat.emissive.set(linkColorHex).multiplyScalar(0.4);
      }

      // Center point
      mid.addVectors(p0, p1).multiplyScalar(0.5);

      // Orientation from unit Y to direction vector
      dir.normalize();
      quat.setFromUnitVectors(upAxis, dir);

      // Scale: preserve X & Z radius, scale height along Y
      scale.set(1, dist, 1);

      boneMat4.compose(mid, quat, scale);
      bone.matrix.copy(boneMat4);
    }

    // 4. Update TCP Marker
    const tcpTransform = this.currentTransforms[this.currentTransforms.length - 1];
    if (this.tcpMarker && tcpTransform) {
      this.tcpMarker.matrix.copy(tcpTransform);

      // Sync 3D Gizmo Target if user is not actively dragging it
      if (!this.isGizmoDragging && this.ikGizmoTarget) {
        this.tcpMarker.updateMatrixWorld(true);
        const tcpWorldMat = this.tcpMarker.matrixWorld;
        this.ikGizmoTarget.position.setFromMatrixPosition(tcpWorldMat);
        this.ikGizmoTarget.quaternion.setFromRotationMatrix(tcpWorldMat);
      }

      // Update 3D Manipulability Ellipsoid (Yoshikawa)
      if (this.manipulabilityMesh && this.currentModel) {
        const { Jv } = RobotKinematics.computeGeometricJacobian(
          this.currentModel.joints,
          jointAnglesDeg
        );
        const manip = RobotKinematics.computeManipulability(Jv);

        // Scale factor: display semi-axes visibly in mm
        const scaleFactor = 0.22;
        const s1 = Math.max(8, manip.singularValues[0] * scaleFactor);
        const s2 = Math.max(8, manip.singularValues[1] * scaleFactor);
        const s3 = Math.max(8, manip.singularValues[2] * scaleFactor);

        const mat = this.manipulabilityMesh.material as THREE.MeshPhysicalMaterial;
        if (manip.isNearSingularity) {
          mat.color.setHex(0xef4444); // Red warning for singularity
        } else if (manip.yoshikawaIndex < 0.05) {
          mat.color.setHex(0xf59e0b); // Amber for low dexterity
        } else {
          mat.color.setHex(0x06b6d4); // Cyan for high dexterity
        }

        const rotMat = new THREE.Matrix4().makeBasis(
          manip.eigenVectors[0],
          manip.eigenVectors[1],
          manip.eigenVectors[2]
        );
        const scaleMat = new THREE.Matrix4().makeScale(s1, s2, s3);
        const posMat = new THREE.Matrix4().makeTranslation(
          tcpTransform.elements[12],
          tcpTransform.elements[13],
          tcpTransform.elements[14]
        );

        this.manipulabilityMesh.matrix.copy(posMat.multiply(rotMat).multiply(scaleMat));
      }

      // 5. Update Trajectory trace
      const tcpPos = new THREE.Vector3();
      tcpTransform.decompose(tcpPos, new THREE.Quaternion(), new THREE.Vector3());
      this.appendTrajectoryPoint(tcpPos);
    }
  }

  private appendTrajectoryPoint(point: THREE.Vector3) {
    if (!this.overlays.showTrace) return;

    // Check minimum distance to avoid recording duplicate stationary points
    if (this.trajectoryPoints.length > 0) {
      const lastPoint = this.trajectoryPoints[this.trajectoryPoints.length - 1];
      if (lastPoint.distanceTo(point) < 2) return;
    }

    this.trajectoryPoints.push(point.clone());
    if (this.trajectoryPoints.length > this.maxTrajectoryPoints) {
      this.trajectoryPoints.shift();
    }

    if (this.trajectoryLine) {
      const positions = (this.trajectoryLine.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array;
      for (let i = 0; i < this.trajectoryPoints.length; i++) {
        positions[i * 3] = this.trajectoryPoints[i].x;
        positions[i * 3 + 1] = this.trajectoryPoints[i].y;
        positions[i * 3 + 2] = this.trajectoryPoints[i].z;
      }
      this.trajectoryLine.geometry.setDrawRange(0, this.trajectoryPoints.length);
      this.trajectoryLine.geometry.attributes.position.needsUpdate = true;
    }
  }

  public clearTrajectory() {
    this.trajectoryPoints = [];
    if (this.trajectoryLine) {
      this.trajectoryLine.geometry.setDrawRange(0, 0);
      this.trajectoryLine.geometry.attributes.position.needsUpdate = true;
    }
  }

  /**
   * Visualizes planned spatial path and 3D Waypoint targets in the viewport
   */
  public updatePlannedTrajectory(plan: TrajectoryPlan | null) {
    if (!this.robotRoot.children.includes(this.waypointMarkersGroup)) {
      this.robotRoot.add(this.waypointMarkersGroup);
    }

    // 1. Clear old waypoint markers
    while (this.waypointMarkersGroup.children.length > 0) {
      const child = this.waypointMarkersGroup.children[0];
      this.waypointMarkersGroup.remove(child);
      this.disposeObject(child);
    }

    // 2. Remove old planned trajectory line
    if (this.plannedTrajectoryLine) {
      this.robotRoot.remove(this.plannedTrajectoryLine);
      this.plannedTrajectoryLine.geometry.dispose();
      (this.plannedTrajectoryLine.material as THREE.Material).dispose();
      this.plannedTrajectoryLine = null;
    }

    if (!plan || plan.samples.length < 2) return;

    // 3. Create continuous planned trajectory 3D ribbon / polyline
    const points: THREE.Vector3[] = plan.samples.map(
      (s) => new THREE.Vector3(s.tcpPosition.x, s.tcpPosition.y, s.tcpPosition.z)
    );
    const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
    const lineMat = new THREE.LineDashedMaterial({
      color: 0x38bdf8, // Sky cyan
      dashSize: 18,
      gapSize: 9,
      linewidth: 3,
      transparent: true,
      opacity: 0.85,
    });
    this.plannedTrajectoryLine = new THREE.Line(lineGeo, lineMat);
    this.plannedTrajectoryLine.computeLineDistances();
    this.robotRoot.add(this.plannedTrajectoryLine);

    // 4. Create 3D Waypoint Markers
    plan.waypoints.forEach((wp, idx) => {
      const wpGroup = new THREE.Group();
      wpGroup.position.set(
        wp.cartesianPose.position.x,
        wp.cartesianPose.position.y,
        wp.cartesianPose.position.z
      );

      // Glowing sphere marker
      const isStart = idx === 0;
      const isEnd = idx === plan.waypoints.length - 1;
      const sphereGeo = new THREE.SphereGeometry(16, 16, 16);
      const sphereMat = new THREE.MeshStandardMaterial({
        color: isStart ? 0x22c55e : isEnd ? 0xef4444 : 0x0ea5e9,
        emissive: isStart ? 0x15803d : isEnd ? 0xb91c1c : 0x0284c7,
        emissiveIntensity: 0.6,
        roughness: 0.25,
        metalness: 0.3,
      });
      const sphereMesh = new THREE.Mesh(sphereGeo, sphereMat);
      wpGroup.add(sphereMesh);

      // Orientation frame quivers at waypoint
      const frameAxes = new THREE.AxesHelper(45);
      wpGroup.add(frameAxes);

      this.waypointMarkersGroup.add(wpGroup);
    });
  }

  /**
   * Renders dense 3D Workspace Point Cloud and interactive 2D slicing planes
   */
  public updateWorkspaceCloud(
    data: WorkspaceCloudData | null,
    settings: WorkspaceSettings
  ) {
    // 1. Remove and dispose previous point cloud and helper
    if (this.workspacePointsMesh) {
      this.robotRoot.remove(this.workspacePointsMesh);
      this.workspacePointsMesh.geometry.dispose();
      (this.workspacePointsMesh.material as THREE.Material).dispose();
      this.workspacePointsMesh = null;
    }

    if (this.workspaceSlicePlaneHelper) {
      this.robotRoot.remove(this.workspaceSlicePlaneHelper);
      this.workspaceSlicePlaneHelper.geometry.dispose();
      (this.workspaceSlicePlaneHelper.material as THREE.Material).dispose();
      this.workspaceSlicePlaneHelper = null;
    }

    if (!data || !settings.visible || data.totalPoints === 0) return;

    const total = data.totalPoints;
    const pos = data.positions;
    const manip = data.manipulabilities;
    const maxManip = data.maxManipulability || 1;
    const minManip = data.minManipulability || 0;
    const manipRange = Math.max(1e-4, maxManip - minManip);

    const maxZ = data.maxZMm;
    const minZ = data.minZMm;
    const zRange = Math.max(1, maxZ - minZ);

    const halfThick = settings.sliceThicknessMm / 2;
    const sliceElev = settings.sliceElevationMm;

    // Filter points based on slicing plane
    const filteredPos: number[] = [];
    const filteredCol: number[] = [];

    for (let i = 0; i < total; i++) {
      const x = pos[i * 3];
      const y = pos[i * 3 + 1];
      const z = pos[i * 3 + 2];

      // Physical Floor boundary filter (cannot penetrate below mounting pedestal/ground)
      if (settings.enforceFloorLimit && z < 0) continue;

      // Dexterous threshold filter (isolate high-dexterity sweet spots vs singular boundaries)
      const tManip = Math.max(0, Math.min(1, (manip[i] - minManip) / manipRange));
      if (settings.dexterousThreshold > 0 && tManip < settings.dexterousThreshold) continue;

      // Slicing filter
      if (settings.sliceMode === 'slice-xz') {
        if (Math.abs(y) > halfThick) continue;
      } else if (settings.sliceMode === 'slice-yz') {
        if (Math.abs(x) > halfThick) continue;
      } else if (settings.sliceMode === 'slice-xy') {
        if (Math.abs(z - sliceElev) > halfThick) continue;
      }

      filteredPos.push(x, y, z);

      // Compute color
      if (settings.colorMode === 'yoshikawa') {
        const t = Math.max(0, Math.min(1, (manip[i] - minManip) / manipRange));
        const [r, g, b] = this.getHeatmapColor(t);
        filteredCol.push(r, g, b);
      } else if (settings.colorMode === 'height') {
        const t = Math.max(0, Math.min(1, (z - minZ) / zRange));
        const [r, g, b] = this.getHeatmapColor(t);
        filteredCol.push(r, g, b);
      } else {
        filteredCol.push(0.22, 0.74, 0.97);
      }
    }

    if (filteredPos.length === 0) return;

    // Create Three.js Point Cloud
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(filteredPos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(filteredCol, 3));

    const mat = new THREE.PointsMaterial({
      size: settings.pointSize * 2.2,
      vertexColors: true,
      transparent: true,
      opacity: settings.opacity,
      depthWrite: false,
    });

    this.workspacePointsMesh = new THREE.Points(geo, mat);
    this.robotRoot.add(this.workspacePointsMesh);

    // 2. Add visual slicing plane helper if active
    if (settings.sliceMode !== 'full-3d') {
      const planeSize = Math.max(1500, (data.maxRadiusMm || 1000) * 2.2);
      const planeGeo = new THREE.PlaneGeometry(planeSize, planeSize);
      const planeMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.1,
        side: THREE.DoubleSide,
        depthWrite: false,
      });

      this.workspaceSlicePlaneHelper = new THREE.Mesh(planeGeo, planeMat);

      if (settings.sliceMode === 'slice-xz') {
        this.workspaceSlicePlaneHelper.rotation.x = Math.PI / 2;
        this.workspaceSlicePlaneHelper.position.set(0, 0, 0);
      } else if (settings.sliceMode === 'slice-yz') {
        this.workspaceSlicePlaneHelper.rotation.y = Math.PI / 2;
        this.workspaceSlicePlaneHelper.position.set(0, 0, 0);
      } else if (settings.sliceMode === 'slice-xy') {
        this.workspaceSlicePlaneHelper.position.set(0, 0, sliceElev);
      }

      this.robotRoot.add(this.workspaceSlicePlaneHelper);
    }
  }

  private getHeatmapColor(t: number): [number, number, number] {
    let r = 0, g = 0, b = 0;
    if (t < 0.25) {
      r = 0;
      g = t / 0.25;
      b = 1;
    } else if (t < 0.5) {
      r = 0;
      g = 1;
      b = 1 - (t - 0.25) / 0.25;
    } else if (t < 0.75) {
      r = (t - 0.5) / 0.25;
      g = 1;
      b = 0;
    } else {
      r = 1;
      g = 1 - (t - 0.75) / 0.25;
      b = 0;
    }
    return [r, g, b];
  }

  /**
   * Sets rendering style: Solid Metallic vs Ghosted X-Ray
   * When Skeleton overlay is active, 3D model automatically renders in translucent ghost frame mode
   */
  public setRenderingStyle(style: RenderingStyle) {
    this.renderingStyle = style;
    if (!this.currentModel) return;

    // Ghost / frame mode is active if explicitly requested OR when Skeleton overlay is toggled on
    const isGhostMode = this.renderingStyle === 'ghosted' || this.overlays.showSkeleton;
    const isDark = this.backgroundTheme === 'studio-dark' || this.backgroundTheme === 'deep-space';

    this.linkMeshes.forEach((mesh, index) => {
      const linkColor = this.currentModel!.links[index]?.color || '#3b82f6';
      if (!isGhostMode) {
        // High-contrast polyurethane industrial finish with rich saturation
        mesh.material = new THREE.MeshStandardMaterial({
          color: new THREE.Color(linkColor),
          roughness: 0.28,
          metalness: 0.20,
          wireframe: this.overlays.wireframeOnly,
        });
      } else {
        // Ghosted translucent technical acrylic: opacity 0.38 preserves vibrant link colors while skeleton shines through
        mesh.material = new THREE.MeshPhysicalMaterial({
          color: new THREE.Color(linkColor),
          transparent: true,
          opacity: 0.38,
          roughness: 0.20,
          metalness: 0.12,
          clearcoat: 0.85,
          clearcoatRoughness: 0.10,
          emissive: new THREE.Color(linkColor),
          emissiveIntensity: 0.15,
          wireframe: this.overlays.wireframeOnly,
          depthWrite: false,
        });
      }
    });

    this.linkWireframes.forEach((wire) => {
      wire.visible = isGhostMode || this.overlays.wireframeOnly;
      if (wire.material) {
        (wire.material as THREE.LineBasicMaterial).color.setHex(isDark ? 0x94a3b8 : 0x334155);
        (wire.material as THREE.LineBasicMaterial).opacity = isDark ? 0.50 : 0.65;
      }
    });
  }

  /**
   * Toggles visual overlay layers
   */
  public setOverlays(overlays: ViewportOverlaySettings) {
    this.overlays = { ...overlays };

    this.frameHelpers.forEach((f) => (f.visible = overlays.showFrames));
    if (this.skeletonLine) this.skeletonLine.visible = overlays.showSkeleton;
    this.skeletonJointSpheres.forEach((s) => (s.visible = overlays.showSkeleton));
    this.skeletonBones.forEach((b) => (b.visible = overlays.showSkeleton));
    if (this.tcpMarker) this.tcpMarker.visible = overlays.showTcp;
    if (this.trajectoryLine) this.trajectoryLine.visible = overlays.showTrace;
    if (this.gridFloor) this.gridFloor.visible = overlays.showGrid;
    if (this.shadowLight) this.shadowLight.castShadow = overlays.showShadows;
    if (this.manipulabilityMesh) this.manipulabilityMesh.visible = overlays.showManipulabilityEllipsoid;
    if (this.transformControls && this.transformControlsGizmo) {
      this.transformControlsGizmo.visible = overlays.showIKGizmo;
      this.transformControls.enabled = overlays.showIKGizmo;
    }

    this.setRenderingStyle(this.renderingStyle);
    this.updateJoints(this.currentAngles);
  }

  public setGizmoMode(mode: 'translate' | 'rotate') {
    if (this.transformControls) {
      this.transformControls.setMode(mode);
    }
  }

  public setDomain(domain: 'manipulator' | 'mobile_robot') {
    this.activeDomain = domain;
    if (domain === 'manipulator') {
      this.robotRoot.visible = true;
      this.mobileVisuals.setVisible(false);
      this.controls.target.set(0, 450, 0);
    } else {
      this.robotRoot.visible = false;
      this.mobileVisuals.setVisible(true);
      this.controls.target.set(0, 100, 0);
      this.cameraLerpTarget = {
        position: new THREE.Vector3(0, 6000, 4000),
        target: new THREE.Vector3(0, 0, 0),
      };
    }
  }

  public setMobileCameraMode(mode: 'orbit' | 'chase' | 'top_down') {
    (window as any).__mobileCamChase = mode === 'chase';
    if (this.activeDomain !== 'mobile_robot') return;

    if (mode === 'top_down') {
      this.cameraLerpTarget = {
        position: new THREE.Vector3(0.01, 8500, 0.01),
        target: new THREE.Vector3(0, 0, 0),
      };
    } else if (mode === 'orbit') {
      const vPos = this.mobileVisuals.getVehicleWorldPosition();
      this.cameraLerpTarget = {
        position: new THREE.Vector3(vPos.x + 2500, vPos.y + 2200, vPos.z + 2500),
        target: vPos,
      };
    }
  }

  /**
   * Smoothly changes camera perspective preset
   */
  public setCameraPreset(preset: CameraPreset) {
    const target = new THREE.Vector3(0, 450, 0);
    const pos = new THREE.Vector3();
    const distance = 2200;

    switch (preset) {
      case 'isometric':
        pos.set(1600, 1400, 1900);
        break;
      case 'front': // X-Z in robot local -> Looking along -Y in local -> along Three.js +Z
        pos.set(0, 500, distance);
        break;
      case 'top': // Overhead down looking down +Y in Three.js
        pos.set(0, distance * 1.2, 0.01);
        break;
      case 'side': // Looking from side (along Three.js +X)
        pos.set(distance, 500, 0);
        break;
      case 'tcp': // Focusing directly on TCP
        if (this.currentTransforms.length > 0) {
          const tcpTrans = this.currentTransforms[this.currentTransforms.length - 1];
          const localTcp = new THREE.Vector3();
          tcpTrans.decompose(localTcp, new THREE.Quaternion(), new THREE.Vector3());
          // Transform local TCP to world coords (accounting for robotRoot -90 deg X rotation)
          const worldTcp = localTcp.clone().applyMatrix4(this.robotRoot.matrixWorld);
          target.copy(worldTcp);
          pos.copy(worldTcp).add(new THREE.Vector3(350, 250, 400));
        } else {
          pos.set(1600, 1400, 1900);
        }
        break;
    }

    this.cameraLerpTarget = { position: pos, target };
  }

  public fitCameraToRobot() {
    this.setCameraPreset('isometric');
  }

  public zoomIn(factor = 0.8) {
    this.zoomBy(factor);
  }

  public zoomOut(factor = 1.25) {
    this.zoomBy(factor);
  }

  public zoomBy(factor: number) {
    const offset = this.camera.position.clone().sub(this.controls.target);
    const newDist = THREE.MathUtils.clamp(
      offset.length() * factor,
      this.controls.minDistance,
      this.controls.maxDistance
    );
    offset.setLength(newDist);
    this.camera.position.copy(this.controls.target).add(offset);
    this.controls.update();
  }

  private onWindowResize = () => {
    if (!this.container || !this.renderer || !this.camera) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  private animate = () => {
    this.animationFrameId = requestAnimationFrame(this.animate);

    // Chase camera smooth tracking for Mobile Robot
    if (this.activeDomain === 'mobile_robot' && (window as any).__mobileCamChase) {
      const vPos = this.mobileVisuals.getVehicleWorldPosition();
      this.controls.target.lerp(vPos, 0.08);
      const desiredPos = new THREE.Vector3(vPos.x, vPos.y + 1600, vPos.z + 2400);
      this.camera.position.lerp(desiredPos, 0.06);
    } else if (this.cameraLerpTarget) {
      // Smooth camera transition if active
      this.camera.position.lerp(this.cameraLerpTarget.position, 0.08);
      this.controls.target.lerp(this.cameraLerpTarget.target, 0.08);

      if (
        this.camera.position.distanceTo(this.cameraLerpTarget.position) < 2 &&
        this.controls.target.distanceTo(this.cameraLerpTarget.target) < 2
      ) {
        this.camera.position.copy(this.cameraLerpTarget.position);
        this.controls.target.copy(this.cameraLerpTarget.target);
        this.cameraLerpTarget = null;
      }
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  public destroy() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    window.removeEventListener('resize', this.onWindowResize);
    if (this.transformControls) {
      this.transformControls.dispose();
    }
    this.clearRobotHierarchy();
    this.renderer.dispose();
    if (this.renderer.domElement && this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
  }
}
