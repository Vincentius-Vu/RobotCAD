import * as THREE from 'three';
import {
  MobileRobotPose,
  WheelState,
  LidarScanPoint,
  PathWaypoint,
  NavGoal,
  Obstacle,
  MobileDriveType,
  MobilePoseWaypoint,
} from '../../types/mobileRobot';
import { AGVState } from '../../physics/mobile/AGVDigitalTwinEngine';

export class MobileRobotVisuals {
  public group: THREE.Group;
  private robotBodyGroup: THREE.Group;
  private chassisSuspensionGroup: THREE.Group;
  private chassisMesh: THREE.Mesh;
  private ledStrip: THREE.Mesh;
  private headingArrow: THREE.Mesh;
  private wheels: (THREE.Mesh | THREE.Group)[] = [];
  private casterFrontGroup: THREE.Group;
  private casterRearGroup: THREE.Group;
  private lidarPuck: THREE.Group;

  // Visual Overlays
  private laserPoints: THREE.Points;
  private laserPointsGeo: THREE.BufferGeometry;
  private laserRays: THREE.LineSegments;
  private laserRaysGeo: THREE.BufferGeometry;
  private pathLine: THREE.Line;
  private pathGeo: THREE.BufferGeometry;
  private goalMarker: THREE.Group;
  private traceLine: THREE.Line;
  private traceGeo: THREE.BufferGeometry;
  private obstaclesGroup: THREE.Group;
  private waypointsGroup: THREE.Group;

  private currentObstaclesHash = '';
  private currentWaypointsHash = '';

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    this.group.visible = false;
    scene.add(this.group);

    // 1. Robot Body Group (moves & rotates with vehicle pose)
    this.robotBodyGroup = new THREE.Group();
    this.group.add(this.robotBodyGroup);

    // Dynamic Suspension Group (carries chassis body with pitch & roll attitude)
    this.chassisSuspensionGroup = new THREE.Group();
    this.robotBodyGroup.add(this.chassisSuspensionGroup);

    // Dual Swivel Casters groups
    this.casterFrontGroup = new THREE.Group();
    this.casterRearGroup = new THREE.Group();
    this.robotBodyGroup.add(this.casterFrontGroup);
    this.robotBodyGroup.add(this.casterRearGroup);

    // Chassis Base Box: 960mm x 160mm x 420mm (SSoT v2.0.0, recesses for drive wheels at Z = +-250mm)
    const chassisGeo = new THREE.BoxGeometry(960, 160, 420);
    const chassisMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.7,
      roughness: 0.25,
    });
    this.chassisMesh = new THREE.Mesh(chassisGeo, chassisMat);
    this.chassisMesh.position.y = 130; // 50mm ground clearance
    this.chassisMesh.castShadow = true;
    this.chassisMesh.receiveShadow = true;
    this.chassisSuspensionGroup.add(this.chassisMesh);

    // Top Cargo Deck / Overhang Protective Plate: 960mm x 20mm x 540mm
    const deckGeo = new THREE.BoxGeometry(960, 20, 540);
    const deckMesh = new THREE.Mesh(deckGeo, chassisMat);
    deckMesh.position.y = 220;
    deckMesh.castShadow = true;
    this.chassisSuspensionGroup.add(deckMesh);

    // Luminous Cyber Cyan LED Light Strip around deck perimeter
    const ledGeo = new THREE.BoxGeometry(966, 20, 546);
    const ledMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      emissive: 0x0891b2,
      emissiveIntensity: 0.9,
      roughness: 0.1,
    });
    this.ledStrip = new THREE.Mesh(ledGeo, ledMat);
    this.ledStrip.position.y = 220;
    this.chassisSuspensionGroup.add(this.ledStrip);

    // Heading Arrow on top (+X direction)
    const arrowShape = new THREE.Shape();
    arrowShape.moveTo(220, 0);
    arrowShape.lineTo(80, 90);
    arrowShape.lineTo(80, 35);
    arrowShape.lineTo(-150, 35);
    arrowShape.lineTo(-150, -35);
    arrowShape.lineTo(80, -35);
    arrowShape.lineTo(80, -90);
    arrowShape.closePath();

    const arrowExtrudeSettings = { depth: 10, bevelEnabled: false };
    const arrowGeo = new THREE.ExtrudeGeometry(arrowShape, arrowExtrudeSettings);
    arrowGeo.rotateX(Math.PI / 2);
    const arrowMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.8,
    });
    this.headingArrow = new THREE.Mesh(arrowGeo, arrowMat);
    this.headingArrow.position.set(0, 236, 0);
    this.chassisSuspensionGroup.add(this.headingArrow);

    // 2. Wheels (Differential: 2 large drive wheels + 2 swiveling casters)
    this.buildWheels('differential');

    // 3. LIDAR Turret
    this.lidarPuck = new THREE.Group();
    this.lidarPuck.position.set(100, 204, 0);

    const baseCyl = new THREE.Mesh(
      new THREE.CylinderGeometry(55, 60, 40, 24),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8, roughness: 0.3 })
    );
    this.lidarPuck.add(baseCyl);

    const domeCyl = new THREE.Mesh(
      new THREE.CylinderGeometry(48, 48, 30, 24),
      new THREE.MeshStandardMaterial({
        color: 0x0284c7,
        emissive: 0x06b6d4,
        emissiveIntensity: 0.6,
        metalness: 0.9,
        roughness: 0.1,
      })
    );
    domeCyl.position.y = 25;
    this.lidarPuck.add(domeCyl);
    this.chassisSuspensionGroup.add(this.lidarPuck);

    // 4. LIDAR Point Cloud & Ray Beams
    const maxScanPoints = 360;
    this.laserPointsGeo = new THREE.BufferGeometry();
    const pointPositions = new Float32Array(maxScanPoints * 3);
    this.laserPointsGeo.setAttribute('position', new THREE.BufferAttribute(pointPositions, 3));
    const laserMat = new THREE.PointsMaterial({
      color: 0x10b981, // Emerald neon
      size: 16,
      transparent: true,
      opacity: 0.9,
    });
    this.laserPoints = new THREE.Points(this.laserPointsGeo, laserMat);
    this.group.add(this.laserPoints);

    // Sample laser ray lines
    this.laserRaysGeo = new THREE.BufferGeometry();
    const rayPositions = new Float32Array(maxScanPoints * 6);
    this.laserRaysGeo.setAttribute('position', new THREE.BufferAttribute(rayPositions, 3));
    const rayMat = new THREE.LineBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.25,
    });
    this.laserRays = new THREE.LineSegments(this.laserRaysGeo, rayMat);
    this.group.add(this.laserRays);

    // 5. Planned Path Line (Ribbon on ground)
    this.pathGeo = new THREE.BufferGeometry();
    const pathPositions = new Float32Array(500 * 3);
    this.pathGeo.setAttribute('position', new THREE.BufferAttribute(pathPositions, 3));
    const pathMat = new THREE.LineBasicMaterial({
      color: 0xfacc15, // Golden yellow
      linewidth: 3,
    });
    this.pathLine = new THREE.Line(this.pathGeo, pathMat);
    this.group.add(this.pathLine);

    // 6. Navigation Goal Target Marker
    this.goalMarker = new THREE.Group();
    const goalPinGeo = new THREE.CylinderGeometry(20, 0, 180, 16);
    goalPinGeo.rotateX(Math.PI);
    const goalPinMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xd97706,
      emissiveIntensity: 0.8,
    });
    const pin = new THREE.Mesh(goalPinGeo, goalPinMat);
    pin.position.y = 90;
    this.goalMarker.add(pin);

    // Concentric ring on ground
    const goalRingGeo = new THREE.RingGeometry(180, 220, 32);
    goalRingGeo.rotateX(-Math.PI / 2);
    const goalRingMat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
    });
    const ring = new THREE.Mesh(goalRingGeo, goalRingMat);
    ring.position.y = 4;
    this.goalMarker.add(ring);

    // Goal Heading Cone Arrow
    const goalArrowGeo = new THREE.ConeGeometry(35, 100, 16);
    goalArrowGeo.rotateX(Math.PI / 2);
    const goalArrowMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xb45309,
      emissiveIntensity: 0.8,
    });
    const goalArrow = new THREE.Mesh(goalArrowGeo, goalArrowMat);
    goalArrow.position.set(0, 15, 170);
    this.goalMarker.add(goalArrow);

    this.group.add(this.goalMarker);

    // 7. Ground Position Trace Line
    this.traceGeo = new THREE.BufferGeometry();
    const tracePositions = new Float32Array(1000 * 3);
    this.traceGeo.setAttribute('position', new THREE.BufferAttribute(tracePositions, 3));
    const traceMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.6,
    });
    this.traceLine = new THREE.Line(this.traceGeo, traceMat);
    this.group.add(this.traceLine);

    // 8. Obstacles Group
    this.obstaclesGroup = new THREE.Group();
    this.group.add(this.obstaclesGroup);

    // 9. Mission Pose Waypoints Group
    this.waypointsGroup = new THREE.Group();
    this.group.add(this.waypointsGroup);
  }

  private buildWheels(driveType: MobileDriveType) {
    // Clear existing wheels
    for (const w of this.wheels) {
      this.robotBodyGroup.remove(w);
    }
    this.wheels = [];

    // Clear existing caster children
    while (this.casterFrontGroup.children.length > 0) {
      this.casterFrontGroup.remove(this.casterFrontGroup.children[0]);
    }
    while (this.casterRearGroup.children.length > 0) {
      this.casterRearGroup.remove(this.casterRearGroup.children[0]);
    }

    // SSoT Master Unified v2.0.0: rw = 0.10m (radius 100mm, diameter 200mm)
    const wheelRadius = 100;
    const wheelWidth = 50;
    const rimRadius = 68;
    const hubRadius = 28;

    // Helper to create high-fidelity AGV drive wheel oriented along the longitudinal X axis (axle along lateral Z)
    const createWheelGroup = (posX: number, posY: number, posZ: number, isLeftSide: boolean): THREE.Group => {
      const wheelGroup = new THREE.Group();
      wheelGroup.position.set(posX, posY, posZ);

      // 1. Rubber Tire (Main tread: diameter 200mm, width 50mm, oriented along vehicle body)
      const tireGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelWidth, 32);
      tireGeo.rotateX(Math.PI / 2); // Rotate about X so cylinder height/axle aligns with lateral Z!
      const tireMat = new THREE.MeshStandardMaterial({
        color: 0x0f172a, // Industrial slate rubber
        roughness: 0.85,
        metalness: 0.2,
      });
      const tire = new THREE.Mesh(tireGeo, tireMat);
      tire.castShadow = true;
      wheelGroup.add(tire);

      // 2. Alloy Rim (Lip & Outer barrel)
      const rimGeo = new THREE.CylinderGeometry(rimRadius, rimRadius, wheelWidth + 1, 24);
      rimGeo.rotateX(Math.PI / 2);
      const rimMat = new THREE.MeshStandardMaterial({
        color: 0x0284c7, // Cyber Blue alloy rim
        metalness: 0.8,
        roughness: 0.25,
      });
      const rim = new THREE.Mesh(rimGeo, rimMat);
      wheelGroup.add(rim);

      // 3. Central Hub Cap
      const hubGeo = new THREE.CylinderGeometry(hubRadius, hubRadius, wheelWidth + 3, 20);
      hubGeo.rotateX(Math.PI / 2);
      const hubMat = new THREE.MeshStandardMaterial({
        color: 0x334155, // Slate titanium hub
        metalness: 0.9,
        roughness: 0.2,
      });
      const hub = new THREE.Mesh(hubGeo, hubMat);
      wheelGroup.add(hub);

      // 4. 4 Visible Radial Spokes on outer face to visibly demonstrate rotation during driving
      const spokeLength = rimRadius - hubRadius;
      const spokeGeo = new THREE.BoxGeometry(7, spokeLength, 4);
      const spokeMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        metalness: 0.7,
        roughness: 0.3,
      });

      const outerZ = isLeftSide ? wheelWidth / 2 + 1 : -(wheelWidth / 2 + 1);
      for (let s = 0; s < 4; s++) {
        const angle = (s * Math.PI) / 2;
        const spoke = new THREE.Mesh(spokeGeo, spokeMat);
        const distFromCenter = hubRadius + spokeLength / 2;
        spoke.position.set(
          Math.cos(angle) * distFromCenter,
          Math.sin(angle) * distFromCenter,
          outerZ
        );
        spoke.rotation.z = angle;
        wheelGroup.add(spoke);
      }

      return wheelGroup;
    };

    if (driveType === 'differential') {
      // SSoT v2.0.0: Track width L = 0.50m (Z = +-250mm)
      // Left drive wheel (Z = +250mm)
      const wLeft = createWheelGroup(0, wheelRadius, 250, true);
      this.robotBodyGroup.add(wLeft);
      this.wheels.push(wLeft);

      // Right drive wheel (Z = -250mm)
      const wRight = createWheelGroup(0, wheelRadius, -250, false);
      this.robotBodyGroup.add(wRight);
      this.wheels.push(wRight);

      // Helper to build a high-fidelity swiveling caster assembly with kingpin and trailing wheel
      // SSoT v2.0.0: LcF = 0.42m (+420mm), LcR = 0.42m (-420mm), b_trail = 30mm, Rc = 50mm
      const createCasterAssembly = (group: THREE.Group, posX: number) => {
        group.position.set(posX, 0, 0);

        // 1. Kingpin Mount (Cylinder along Y)
        const pinGeo = new THREE.CylinderGeometry(16, 16, 45, 16);
        const pinMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8, roughness: 0.2 });
        const pin = new THREE.Mesh(pinGeo, pinMat);
        pin.position.set(0, 70, 0);
        group.add(pin);

        // 2. Trailing Fork (offset backwards along -X by b_trail = 30mm)
        const forkGeo = new THREE.BoxGeometry(40, 36, 34);
        const fork = new THREE.Mesh(forkGeo, pinMat);
        fork.position.set(-16, 56, 0);
        group.add(fork);

        // 3. Caster Wheel (Radius = 50mm, Width = 28mm, offset trailing -30mm, axle along lateral Z)
        const cWheelGeo = new THREE.CylinderGeometry(50, 50, 28, 24);
        cWheelGeo.rotateX(Math.PI / 2); // Aligned along trailing direction
        const cWheelMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.5, roughness: 0.4 });
        const cWheel = new THREE.Mesh(cWheelGeo, cWheelMat);
        cWheel.position.set(-30, 50, 0);
        cWheel.castShadow = true;
        group.add(cWheel);

        // Caster Rim
        const cRimGeo = new THREE.CylinderGeometry(28, 28, 29, 16);
        cRimGeo.rotateX(Math.PI / 2);
        const cRimMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.8, roughness: 0.2 });
        const cRim = new THREE.Mesh(cRimGeo, cRimMat);
        cRim.position.set(-30, 50, 0);
        group.add(cRim);
      };

      createCasterAssembly(this.casterFrontGroup, 420);
      createCasterAssembly(this.casterRearGroup, -420);
    } else {
      // Mecanum 4-Wheel: Front-Left, Front-Right, Rear-Left, Rear-Right
      const positions: [number, number, number, boolean][] = [
        [180, wheelRadius, 205, true],
        [180, wheelRadius, -205, false],
        [-180, wheelRadius, 205, true],
        [-180, wheelRadius, -205, false],
      ];
      for (const [x, y, z, isLeft] of positions) {
        const w = createWheelGroup(x, y, z, isLeft);
        this.robotBodyGroup.add(w);
        this.wheels.push(w);
      }
    }
  }

  public setVisible(visible: boolean) {
    this.group.visible = visible;
  }

  public update(
    pose: MobileRobotPose,
    wheelState: WheelState,
    lidarScan: LidarScanPoint[],
    plannedPath: PathWaypoint[],
    navGoal: NavGoal | null,
    tracePoints: Array<{ x: number; y: number }>,
    _driveType?: MobileDriveType,
    agvState?: AGVState | null,
    poseWaypoints?: MobilePoseWaypoint[]
  ) {
    if (!this.group.visible) return;

    // Convert world (meters) to Three.js scene (millimeters)
    const worldX = pose.x * 1000;
    const worldZ = -pose.y * 1000;
    const yaw = pose.thetaRad;

    this.robotBodyGroup.position.set(worldX, 0, worldZ);
    this.robotBodyGroup.rotation.y = yaw;

    // Apply Multi-Physics dynamic pitch & roll to suspension group
    if (agvState) {
      this.chassisSuspensionGroup.rotation.x = THREE.MathUtils.degToRad(agvState.pitchDeg);
      this.chassisSuspensionGroup.rotation.z = THREE.MathUtils.degToRad(agvState.rollDeg);

      // Rotate Dual Casters according to analytical swivel angles
      this.casterFrontGroup.rotation.y = agvState.psi_cF;
      this.casterRearGroup.rotation.y = agvState.psi_cR;

      // Wheel Slip Alert Glow on perimeter LED strip
      const maxSlip = Math.max(Math.abs(agvState.slip_L), Math.abs(agvState.slip_R));
      const ledMat = this.ledStrip.material as THREE.MeshStandardMaterial;
      if (maxSlip > 0.12) {
        ledMat.color.setHex(0xf59e0b); // Amber warning on tire slip
        ledMat.emissive.setHex(0xd97706);
      } else {
        ledMat.color.setHex(0x06b6d4); // Cyan cyber normal
        ledMat.emissive.setHex(0x0891b2);
      }
    } else {
      this.chassisSuspensionGroup.rotation.set(0, 0, 0);
      this.casterFrontGroup.rotation.y = 0;
      this.casterRearGroup.rotation.y = 0;
    }

    // Spin wheels according to wheel angles
    for (let i = 0; i < this.wheels.length; i++) {
      if (this.wheels[i] && wheelState.anglesRad[i] !== undefined) {
        this.wheels[i].rotation.z = -wheelState.anglesRad[i];
      }
    }

    // Spin LIDAR puck
    this.lidarPuck.rotation.y += 0.12;

    // Update LIDAR points & rays
    if (lidarScan && lidarScan.length > 0) {
      const pAttr = this.laserPointsGeo.attributes.position as THREE.BufferAttribute;
      const rAttr = this.laserRaysGeo.attributes.position as THREE.BufferAttribute;
      const pArray = pAttr.array as Float32Array;
      const rArray = rAttr.array as Float32Array;

      const lidarWorldOrigin = new THREE.Vector3(worldX, 235, worldZ);
      let count = 0;

      for (let i = 0; i < lidarScan.length; i++) {
        const sp = lidarScan[i];
        if (!sp.hasHit) continue;

        const hx = sp.hitX * 1000;
        const hz = -sp.hitY * 1000;
        const hy = 235; // Lidar height

        pArray[count * 3] = hx;
        pArray[count * 3 + 1] = hy;
        pArray[count * 3 + 2] = hz;

        // Rays (draw every 6th ray to maintain crisp clean visuals)
        if (count % 4 === 0) {
          const rIdx = (count / 4) * 6;
          rArray[rIdx] = lidarWorldOrigin.x;
          rArray[rIdx + 1] = lidarWorldOrigin.y;
          rArray[rIdx + 2] = lidarWorldOrigin.z;
          rArray[rIdx + 3] = hx;
          rArray[rIdx + 4] = hy;
          rArray[rIdx + 5] = hz;
        }

        count++;
      }

      this.laserPointsGeo.setDrawRange(0, count);
      this.laserRaysGeo.setDrawRange(0, Math.floor(count / 4) * 2);
      pAttr.needsUpdate = true;
      rAttr.needsUpdate = true;
    }

    // Update Planned Path Line
    if (plannedPath && plannedPath.length > 0) {
      const pathAttr = this.pathGeo.attributes.position as THREE.BufferAttribute;
      const pathArr = pathAttr.array as Float32Array;
      for (let i = 0; i < plannedPath.length; i++) {
        pathArr[i * 3] = plannedPath[i].x * 1000;
        pathArr[i * 3 + 1] = 6; // Just above ground
        pathArr[i * 3 + 2] = -plannedPath[i].y * 1000;
      }
      this.pathGeo.setDrawRange(0, plannedPath.length);
      pathAttr.needsUpdate = true;
      this.pathLine.visible = true;
    } else {
      this.pathLine.visible = false;
    }

    // Update Nav Goal Marker
    if (navGoal) {
      this.goalMarker.position.set(navGoal.x * 1000, 0, -navGoal.y * 1000);
      if (navGoal.thetaRad !== undefined) {
        this.goalMarker.rotation.y = navGoal.thetaRad;
      }
      this.goalMarker.visible = true;
    } else {
      this.goalMarker.visible = false;
    }

    // Update Mission Pose Waypoints
    if (poseWaypoints && poseWaypoints.length > 0) {
      const wpHash = poseWaypoints.map((p) => `${p.id}_${p.x}_${p.y}_${p.thetaDeg}`).join('|');
      if (wpHash !== this.currentWaypointsHash) {
        this.currentWaypointsHash = wpHash;
        while (this.waypointsGroup.children.length > 0) {
          const child = this.waypointsGroup.children[0];
          this.waypointsGroup.remove(child);
        }

        poseWaypoints.forEach((wp) => {
          const wpObj = new THREE.Group();
          wpObj.position.set(wp.x * 1000, 0, -wp.y * 1000);
          wpObj.rotation.y = (wp.thetaDeg * Math.PI) / 180;

          // Ground ring
          const ringGeo = new THREE.RingGeometry(120, 155, 24);
          ringGeo.rotateX(-Math.PI / 2);
          const ringMat = new THREE.MeshBasicMaterial({
            color: 0x10b981,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.8,
          });
          const ring = new THREE.Mesh(ringGeo, ringMat);
          ring.position.y = 3;
          wpObj.add(ring);

          // Direction arrow
          const arrowDir = new THREE.ConeGeometry(25, 80, 12);
          arrowDir.rotateX(Math.PI / 2);
          const arrowMat = new THREE.MeshStandardMaterial({
            color: 0x34d399,
            emissive: 0x059669,
            emissiveIntensity: 0.6,
          });
          const arrow = new THREE.Mesh(arrowDir, arrowMat);
          arrow.position.set(0, 12, 120);
          wpObj.add(arrow);

          // Center pole & Beacon
          const poleGeo = new THREE.CylinderGeometry(6, 6, 90, 8);
          const poleMat = new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.4 });
          const pole = new THREE.Mesh(poleGeo, poleMat);
          pole.position.y = 45;
          wpObj.add(pole);

          const beaconGeo = new THREE.SphereGeometry(14, 12, 12);
          const beaconMat = new THREE.MeshStandardMaterial({
            color: 0x38bdf8,
            emissive: 0x0284c7,
            emissiveIntensity: 0.9,
          });
          const beacon = new THREE.Mesh(beaconGeo, beaconMat);
          beacon.position.y = 95;
          wpObj.add(beacon);

          this.waypointsGroup.add(wpObj);
        });
      }
      this.waypointsGroup.visible = true;
    } else {
      this.waypointsGroup.visible = false;
    }

    // Update Trace Line
    if (tracePoints && tracePoints.length > 0) {
      const traceAttr = this.traceGeo.attributes.position as THREE.BufferAttribute;
      const traceArr = traceAttr.array as Float32Array;
      for (let i = 0; i < tracePoints.length; i++) {
        traceArr[i * 3] = tracePoints[i].x * 1000;
        traceArr[i * 3 + 1] = 2; // On ground
        traceArr[i * 3 + 2] = -tracePoints[i].y * 1000;
      }
      this.traceGeo.setDrawRange(0, tracePoints.length);
      traceAttr.needsUpdate = true;
      this.traceLine.visible = true;
    } else {
      this.traceLine.visible = false;
    }
  }

  public updateObstacles(obstacles: Obstacle[]) {
    const hash = JSON.stringify(obstacles.map((o) => `${o.id}_${o.position.x}_${o.position.y}`));
    if (hash === this.currentObstaclesHash) return;
    this.currentObstaclesHash = hash;

    // Clear previous obstacle meshes
    while (this.obstaclesGroup.children.length > 0) {
      const child = this.obstaclesGroup.children[0];
      this.obstaclesGroup.remove(child);
      if ((child as THREE.Mesh).geometry) (child as THREE.Mesh).geometry.dispose();
    }

    // Rebuild obstacles
    for (const obs of obstacles) {
      const ox = obs.position.x * 1000;
      const oz = -obs.position.y * 1000;

      if (obs.type === 'cylinder' && obs.dimensions.radius) {
        const r = obs.dimensions.radius * 1000;
        const h = (obs.dimensions.height || 2.0) * 1000;
        const geo = new THREE.CylinderGeometry(r, r, h, 24);
        const mat = new THREE.MeshStandardMaterial({
          color: obs.color ? new THREE.Color(obs.color) : 0xeab308,
          metalness: 0.6,
          roughness: 0.35,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(ox, h / 2, oz);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.obstaclesGroup.add(mesh);
      } else if ((obs.type === 'box' || obs.type === 'wall') && obs.dimensions.width && obs.dimensions.depth) {
        const w = obs.dimensions.width * 1000;
        const d = obs.dimensions.depth * 1000;
        const h = (obs.dimensions.height || 1.0) * 1000;
        const geo = new THREE.BoxGeometry(w, h, d);
        const mat = new THREE.MeshStandardMaterial({
          color: obs.color ? new THREE.Color(obs.color) : 0xd97706,
          metalness: 0.3,
          roughness: 0.7,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(ox, h / 2, oz);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.obstaclesGroup.add(mesh);
      }
    }
  }

  public getVehicleWorldPosition(): THREE.Vector3 {
    return this.robotBodyGroup.position.clone();
  }
}
