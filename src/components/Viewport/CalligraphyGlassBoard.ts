import * as THREE from 'three';
import { TDTU_LOGO_BASE64 } from './tdtuLogo';

/**
 * 3D Transparent Glass Board, Metallic Standoffs, Dynamic Calligraphy Ribbon,
 * and End-Effector Pen Stylus for Franka Emika Panda.
 */
export class CalligraphyGlassBoard {
  public group: THREE.Group;
  private ribbonGeometry: THREE.BufferGeometry;
  private ribbonMesh: THREE.Mesh;
  private ribbonMaterial: THREE.MeshStandardMaterial;

  private penStylusGroup: THREE.Group;
  private penLight: THREE.PointLight;

  // Dynamic ribbon vertex buffer arrays (preallocated for 2000 points = 4000 vertices)
  private maxVertices = 16000;
  private positions: Float32Array;
  private normals: Float32Array;
  private uvs: Float32Array;
  private vertexCount = 0;
  private indexCount = 0;
  private indices: Uint32Array;

  private lastPenPoint: THREE.Vector3 | null = null;
  private lastLeftVertex: THREE.Vector3 | null = null;
  private lastRightVertex: THREE.Vector3 | null = null;

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'CalligraphyGlassBoardGroup';

    // 1. Build Physical Glass Board
    this.buildGlassBoard();

    // 2. Build Dynamic Ribbon Mesh
    this.positions = new Float32Array(this.maxVertices * 3);
    this.normals = new Float32Array(this.maxVertices * 3);
    this.uvs = new Float32Array(this.maxVertices * 2);
    this.indices = new Uint32Array((this.maxVertices - 2) * 6);

    this.ribbonGeometry = new THREE.BufferGeometry();
    this.ribbonGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage)
    );
    this.ribbonGeometry.setAttribute(
      'normal',
      new THREE.BufferAttribute(this.normals, 3).setUsage(THREE.DynamicDrawUsage)
    );
    this.ribbonGeometry.setAttribute(
      'uv',
      new THREE.BufferAttribute(this.uvs, 2).setUsage(THREE.DynamicDrawUsage)
    );
    this.ribbonGeometry.setIndex(new THREE.BufferAttribute(this.indices, 1));
    this.ribbonGeometry.setDrawRange(0, 0);

    // Luminous imperial vermilion ink for festive celebration
    this.ribbonMaterial = new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      emissive: 0x991b1b,
      emissiveIntensity: 0.65,
      roughness: 0.2,
      metalness: 0.3,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.98,
      depthWrite: false,
    });

    this.ribbonMesh = new THREE.Mesh(this.ribbonGeometry, this.ribbonMaterial);
    this.ribbonMesh.name = 'CalligraphyRibbonMesh';
    this.group.add(this.ribbonMesh);

    // 3. Build Flange Pen Stylus
    this.penStylusGroup = new THREE.Group();
    this.penStylusGroup.name = 'FrankaCalligraphyPenStylus';
    this.penLight = new THREE.PointLight(0xfbbf24, 1.2, 120);

    this.buildPenStylus();
  }

  /**
   * Constructs the architectural transparent glass plane with standoffs and etched header
   */
  private buildGlassBoard() {
    // Glass plane at X = 504 mm (front face at X = 500 mm, thickness 8 mm)
    // Board spans Y: [-260, 260] (width 520 mm), Z: [280, 620] (height 340 mm)
    const glassWidth = 540;
    const glassHeight = 360;
    const glassThickness = 8;
    const glassCenterY = 0;
    const glassCenterZ = 450;
    const glassCenterX = 500 + glassThickness / 2; // 504 mm

    const glassGeo = new THREE.BoxGeometry(glassThickness, glassWidth, glassHeight);
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xe0f2fe,
      transparent: true,
      opacity: 0.28,
      transmission: 0.75,
      roughness: 0.05,
      metalness: 0.05,
      ior: 1.52,
      reflectivity: 0.9,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      depthWrite: false,
    });

    const glassMesh = new THREE.Mesh(glassGeo, glassMat);
    glassMesh.position.set(glassCenterX, glassCenterY, glassCenterZ);
    this.group.add(glassMesh);

    // Glowing cyan/sky edge border
    const edgeGeo = new THREE.EdgesGeometry(glassGeo);
    const edgeMat = new THREE.LineBasicMaterial({
      color: 0x0284c7,
      transparent: true,
      opacity: 0.75,
    });
    const edgeLines = new THREE.LineSegments(edgeGeo, edgeMat);
    edgeLines.position.copy(glassMesh.position);
    this.group.add(edgeLines);

    // Sleek architectural brushed steel floor mount standoffs (bottom corners only; top corners are clean frameless glass)
    const standoffGeo = new THREE.CylinderGeometry(12, 12, 24, 24);
    standoffGeo.rotateZ(Math.PI / 2); // align with X axis
    const standoffMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.85,
      roughness: 0.25,
    });

    const corners = [
      { y: -245, z: 295 },
      { y: 245, z: 295 },
    ];

    corners.forEach((c) => {
      const bolt = new THREE.Mesh(standoffGeo, standoffMat);
      bolt.position.set(glassCenterX, c.y, c.z);
      this.group.add(bolt);

      // Floor mount rods for bottom standoffs
      const rodGeo = new THREE.CylinderGeometry(6, 6, 295, 16);
      rodGeo.rotateX(Math.PI / 2); // align with Z in local frame
      const rod = new THREE.Mesh(rodGeo, standoffMat);
      rod.position.set(glassCenterX, c.y, 147);
      this.group.add(rod);
    });

    // Etched Header Texture at the top of the glass, facing FRONT (+X) towards audience
    this.createHeaderBanner(glassCenterX + 4.5, glassCenterY, glassCenterZ + 145);
  }

  /**
   * Generates high-res canvas texture for the etched frosted TDTU institutional header banner:
   * Top-left: TDTU Official Logo
   * Top line: VIETNAM GENERAL CONFEDERATION OF LABOR
   * Bottom line: TON DUC THANG UNIVERSITY
   */
  private createHeaderBanner(x: number, y: number, z: number) {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;

    const renderBanner = (logoImg?: HTMLImageElement) => {
      ctx.clearRect(0, 0, 2048, 256);

      // 1. Draw TDTU Logo on top-left (góc trên cùng bên trái)
      if (logoImg && logoImg.complete && logoImg.naturalWidth > 0) {
        const logoH = 185;
        const logoW = Math.round(logoH * (logoImg.naturalWidth / logoImg.naturalHeight));
        ctx.drawImage(logoImg, 45, 20, logoW, logoH);
      }

      const textCenterX = 1200;

      // 2. Dòng trên: VIETNAM GENERAL CONFEDERATION OF LABOR
      ctx.font = 'bold 46px "Segoe UI", "Arial", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#002B49'; // Official Deep Navy
      ctx.fillText('VIETNAM GENERAL CONFEDERATION OF LABOR', textCenterX, 68);

      // 3. Dòng dưới: TON DUC THANG UNIVERSITY
      ctx.font = 'bold 74px "Segoe UI", "Arial", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#C8102E'; // Official TDTU Signature Heritage Red
      ctx.shadowColor = 'rgba(200, 16, 46, 0.4)';
      ctx.shadowBlur = 10;
      ctx.fillText('TON DUC THANG UNIVERSITY', textCenterX, 148);
      ctx.shadowBlur = 0;

      // 4. Elegant institutional divider line & gold diamond
      ctx.strokeStyle = '#C8102E';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(420, 208);
      ctx.lineTo(1980, 208);
      ctx.stroke();

      ctx.fillStyle = '#d97706';
      ctx.beginPath();
      ctx.arc(textCenterX, 208, 6.5, 0, Math.PI * 2);
      ctx.fill();

      texture.needsUpdate = true;
    };

    // Load logo from Base64
    const img = new Image();
    img.src = TDTU_LOGO_BASE64;
    if (img.complete && img.naturalWidth > 0) {
      renderBanner(img);
    } else {
      renderBanner();
      img.onload = () => renderBanner(img);
    }

    // Plane geometry in YZ plane: width = 500 mm, height = 65 mm
    const bannerGeo = new THREE.PlaneGeometry(500, 65);
    // Align X_geom -> +Y_local, Y_geom -> +Z_local, normal Z_geom -> +X_local
    const rotMat = new THREE.Matrix4().set(
      0, 0, 1, 0,
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 0, 1
    );
    bannerGeo.applyMatrix4(rotMat);

    const bannerMat = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const bannerMesh = new THREE.Mesh(bannerGeo, bannerMat);
    bannerMesh.position.set(x, y, z);
    this.group.add(bannerMesh);
  }

  /**
   * Builds the pen stylus mounted to Franka Link 7 flange along +Z_flange
   */
  private buildPenStylus() {
    // Pen body (CNC aluminum barrel) aligned along Link 7 Z axis (+Z_flange)
    const barrelGeo = new THREE.CylinderGeometry(5, 5, 42, 20);
    barrelGeo.rotateX(Math.PI / 2); // align along +Z
    const barrelMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.85,
      roughness: 0.2,
    });
    const barrel = new THREE.Mesh(barrelGeo, barrelMat);
    barrel.position.set(0, 0, 21);
    this.penStylusGroup.add(barrel);

    // Brass grip collar
    const collarGeo = new THREE.CylinderGeometry(6, 6, 10, 20);
    collarGeo.rotateX(Math.PI / 2);
    const collarMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      metalness: 0.9,
      roughness: 0.15,
    });
    const collar = new THREE.Mesh(collarGeo, collarMat);
    collar.position.set(0, 0, 44);
    this.penStylusGroup.add(collar);

    // Tapered nib cone pointing along +Z
    const nibGeo = new THREE.ConeGeometry(4, 14, 20);
    nibGeo.rotateX(Math.PI / 2);
    const nibMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      metalness: 0.85,
      roughness: 0.15,
      emissive: 0x991b1b,
      emissiveIntensity: 0.5,
    });
    const nib = new THREE.Mesh(nibGeo, nibMat);
    nib.position.set(0, 0, 53);
    this.penStylusGroup.add(nib);

    // Glowing tip light
    this.penLight.position.set(0, 0, 60);
    this.penStylusGroup.add(this.penLight);

    this.group.add(this.penStylusGroup);
  }

  /**
   * Updates the pen stylus pose to follow Franka's Link 7 / End-Effector transform
   */
  public updatePenPose(endEffectorMatrix: THREE.Matrix4) {
    this.penStylusGroup.matrixAutoUpdate = false;
    this.penStylusGroup.matrix.copy(endEffectorMatrix);
  }

  /**
   * Resets and clears all drawn calligraphy strokes
   */
  public clear() {
    this.vertexCount = 0;
    this.indexCount = 0;
    this.lastPenPoint = null;
    this.lastLeftVertex = null;
    this.lastRightVertex = null;
    this.ribbonGeometry.setDrawRange(0, 0);
    const posAttr = this.ribbonGeometry.getAttribute('position') as THREE.BufferAttribute;
    posAttr.needsUpdate = true;
  }

  /**
   * Adds a point to the dynamic calligraphy ribbon.
   * Modulates stroke thickness in the YZ plane perpendicular to the motion direction.
   */
  public addPoint(cartesian: [number, number, number], width: number, isPenDown: boolean) {
    if (!isPenDown || width <= 0.1) {
      // Pen is lifted; end current continuous ribbon segment
      this.lastPenPoint = null;
      this.lastLeftVertex = null;
      this.lastRightVertex = null;
      return;
    }

    // Place ribbon on the glass surface (X = 501.0 mm) with double-sided rendering
    const ribbonX = 501.0;
    const currPoint = new THREE.Vector3(ribbonX, cartesian[1], cartesian[2]);

    if (!this.lastPenPoint) {
      // Starting new stroke
      this.lastPenPoint = currPoint.clone();
      return;
    }

    // Direction vector in YZ plane
    const dy = currPoint.y - this.lastPenPoint.y;
    const dz = currPoint.z - this.lastPenPoint.z;
    const dist = Math.hypot(dy, dz);

    if (dist < 0.2) return; // avoid duplicate points

    // Normal perpendicular to motion tangent in YZ plane
    const ny = -dz / dist;
    const nz = dy / dist;

    const halfW = width * 0.5;

    const vLeft = new THREE.Vector3(ribbonX, currPoint.y + ny * halfW, currPoint.z + nz * halfW);
    const vRight = new THREE.Vector3(ribbonX, currPoint.y - ny * halfW, currPoint.z - nz * halfW);

    if (this.lastLeftVertex && this.lastRightVertex) {
      if (this.vertexCount + 4 >= this.maxVertices) return;

      const baseIdx = this.vertexCount;

      // Add 2 vertices (vLeft, vRight)
      this.positions[baseIdx * 3] = vLeft.x;
      this.positions[baseIdx * 3 + 1] = vLeft.y;
      this.positions[baseIdx * 3 + 2] = vLeft.z;

      this.normals[baseIdx * 3] = -1; // facing -X towards robot
      this.normals[baseIdx * 3 + 1] = 0;
      this.normals[baseIdx * 3 + 2] = 0;

      this.uvs[baseIdx * 2] = 0;
      this.uvs[baseIdx * 2 + 1] = 1;

      const rIdx = baseIdx + 1;
      this.positions[rIdx * 3] = vRight.x;
      this.positions[rIdx * 3 + 1] = vRight.y;
      this.positions[rIdx * 3 + 2] = vRight.z;

      this.normals[rIdx * 3] = -1;
      this.normals[rIdx * 3 + 1] = 0;
      this.normals[rIdx * 3 + 2] = 0;

      this.uvs[rIdx * 2] = 1;
      this.uvs[rIdx * 2 + 1] = 1;

      // Two triangles connecting previous pair (baseIdx - 2, baseIdx - 1) to (baseIdx, baseIdx + 1)
      const pL = baseIdx - 2;
      const pR = baseIdx - 1;
      const cL = baseIdx;
      const cR = baseIdx + 1;

      this.indices[this.indexCount++] = pL;
      this.indices[this.indexCount++] = pR;
      this.indices[this.indexCount++] = cL;

      this.indices[this.indexCount++] = pR;
      this.indices[this.indexCount++] = cR;
      this.indices[this.indexCount++] = cL;

      this.vertexCount += 2;

      this.ribbonGeometry.setDrawRange(0, this.indexCount);

      const posAttr = this.ribbonGeometry.getAttribute('position') as THREE.BufferAttribute;
      const normAttr = this.ribbonGeometry.getAttribute('normal') as THREE.BufferAttribute;
      const uvAttr = this.ribbonGeometry.getAttribute('uv') as THREE.BufferAttribute;
      const indexAttr = this.ribbonGeometry.getIndex() as THREE.BufferAttribute;

      posAttr.needsUpdate = true;
      normAttr.needsUpdate = true;
      uvAttr.needsUpdate = true;
      if (indexAttr) indexAttr.needsUpdate = true;
    } else {
      // First point of stroke: insert initial pair
      if (this.vertexCount + 2 >= this.maxVertices) return;

      const prevLeft = new THREE.Vector3(
        ribbonX,
        this.lastPenPoint.y + ny * halfW * 0.5,
        this.lastPenPoint.z + nz * halfW * 0.5
      );
      const prevRight = new THREE.Vector3(
        ribbonX,
        this.lastPenPoint.y - ny * halfW * 0.5,
        this.lastPenPoint.z - nz * halfW * 0.5
      );

      const idx0 = this.vertexCount;
      this.positions[idx0 * 3] = prevLeft.x;
      this.positions[idx0 * 3 + 1] = prevLeft.y;
      this.positions[idx0 * 3 + 2] = prevLeft.z;

      this.normals[idx0 * 3] = -1;
      this.normals[idx0 * 3 + 1] = 0;
      this.normals[idx0 * 3 + 2] = 0;

      const idx1 = idx0 + 1;
      this.positions[idx1 * 3] = prevRight.x;
      this.positions[idx1 * 3 + 1] = prevRight.y;
      this.positions[idx1 * 3 + 2] = prevRight.z;

      this.normals[idx1 * 3] = -1;
      this.normals[idx1 * 3 + 1] = 0;
      this.normals[idx1 * 3 + 2] = 0;

      this.vertexCount += 2;
    }

    this.lastPenPoint = currPoint.clone();
    this.lastLeftVertex = vLeft.clone();
    this.lastRightVertex = vRight.clone();
  }

  /**
   * Clean up WebGL resources
   */
  public dispose() {
    this.ribbonGeometry.dispose();
    this.ribbonMaterial.dispose();
    this.clear();
  }
}
