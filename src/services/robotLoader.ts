import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { RobotModel, DHParameter, RobotLink } from '../types/robot';

export const AVAILABLE_ROBOTS = [
  { id: 'FrankaEmikaPanda', name: 'Franka Emika Panda', manufacturer: 'Franka Emika', category: '7-DOF Compliant Research Cobot' },
  { id: 'UR5', name: 'UR5', manufacturer: 'Universal Robots', category: 'Collaborative Cobot Benchmark' },
  { id: 'Puma560', name: 'PUMA 560', manufacturer: 'Unimation', category: 'Lightweight Research Benchmark' },
  { id: 'ABBIRB120', name: 'IRB 120', manufacturer: 'ABB', category: 'Tabletop Electronics Assembly' },
  { id: 'FanucM10iA', name: 'M-10iA', manufacturer: 'FANUC', category: 'Precision Arc Welding' },
  { id: 'FanucR2000i', name: 'R-2000i', manufacturer: 'FANUC', category: 'Heavy Automotive Spot Welding' },
  { id: 'KukaKR5', name: 'KR 5', manufacturer: 'KUKA', category: 'Continuous-Path Machining' },
  { id: 'KukaKR5Sixx', name: 'KR 5 Sixx', manufacturer: 'KUKA', category: 'Rapid Pick-and-Place' },
  { id: 'KukaKR210Ultra', name: 'KR 210 Ultra', manufacturer: 'KUKA', category: 'Heavy Palletizing' },
  { id: 'KukaKR62', name: 'KR 6/2', manufacturer: 'KUKA', category: 'Waterjet & Dispensing' },
  { id: 'ABBIRB1410', name: 'IRB 1410', manufacturer: 'ABB', category: 'Hollow-Arm Arc Welding' },
  { id: 'ABBIRB2400', name: 'IRB 2400', manufacturer: 'ABB', category: 'Foundry & Machine Tending' },
  { id: 'ABBIRB4400L30', name: 'IRB 4400L/30', manufacturer: 'ABB', category: 'Extended Reach Palletizing' },
  { id: 'ABBIRB6620', name: 'IRB 6620', manufacturer: 'ABB', category: 'Agile Spot Welding' },
  { id: 'ABBIRB6650', name: 'IRB 6650', manufacturer: 'ABB', category: 'Ultra-Heavy Press Transfer' },
  { id: 'EpsonC3A60CT', name: 'C3-A601S', manufacturer: 'Epson', category: 'Semiconductor Handling' },
  { id: 'FanucR1000i', name: 'R-1000i', manufacturer: 'FANUC', category: 'Automotive Press Tending' },
  { id: 'FanucS430', name: 'S-430', manufacturer: 'FANUC', category: 'Stamping Transfer' },
];

export const ROBOT_DEFAULT_POSTURES: Record<string, number[]> = {
  FrankaEmikaPanda: [0.0, -45.0, 0.0, -135.0, 0.0, 90.0, 45.0],
  UR5: [0.0, -30.0, 60.0, -30.0, 90.0, 0.0],
  Puma560: [0.0, 30.0, -45.0, 0.0, 30.0, 0.0],
  ABBIRB120: [0.0, 50.0, -60.0, 0.0, 35.0, 0.0],
  ABBIRB1410: [0.0, 30.0, -60.0, 0.0, 35.0, 0.0],
  ABBIRB2400: [0.0, 50.0, -80.0, 0.0, 35.0, 0.0],
  ABBIRB4400L30: [0.0, 50.0, -80.0, 0.0, 35.0, 0.0],
  ABBIRB6620: [0.0, 50.0, -50.0, 0.0, 35.0, 0.0],
  ABBIRB6650: [0.0, 40.0, -80.0, 0.0, 35.0, 0.0],
  EpsonC3A60CT: [0.0, 40.0, -80.0, 0.0, 35.0, 0.0],
  FanucM10iA: [0.0, 30.0, -50.0, 0.0, 35.0, 0.0],
  FanucR1000i: [0.0, 30.0, -70.0, 0.0, 35.0, 0.0],
  FanucR2000i: [0.0, 50.0, -80.0, 0.0, 35.0, 0.0],
  FanucS430: [0.0, 40.0, -80.0, 0.0, 35.0, 0.0],
  KukaKR210Ultra: [0.0, 45.0, -80.0, 0.0, 35.0, 0.0],
  KukaKR5: [0.0, 50.0, -60.0, 0.0, 35.0, 0.0],
  KukaKR5Sixx: [0.0, 45.0, -70.0, 0.0, 35.0, 0.0],
  KukaKR62: [0.0, 50.0, -40.0, 0.0, 35.0, 0.0],
};

export const DEFAULT_LINK_PALETTE = [
  '#334155', // Link 0: Slate Titanium Base
  '#2563EB', // Link 1: Cobalt Blue
  '#10B981', // Link 2: Vivid Emerald Green
  '#F59E0B', // Link 3: Amber Gold
  '#EF4444', // Link 4: Ruby Crimson
  '#8B5CF6', // Link 5: Violet Purple
  '#06B6D4', // Link 6: Electric Cyan
  '#F97316', // Link 7: Flame Orange
];

class RobotLoaderService {
  private stlLoader = new STLLoader();
  private geometryCache = new Map<string, THREE.BufferGeometry>();

  /**
   * Fetches and parses robot.xml from the robots repository
   */
  public async loadRobotDefinition(robotId: string): Promise<RobotModel> {
    const baseUrl = (import.meta.env.BASE_URL || '/').replace(/\/$/, '') + '/';
    const xmlUrl = `${baseUrl}robots/${robotId}/robot.xml`;
    const response = await fetch(xmlUrl);
    if (!response.ok) {
      throw new Error(`Failed to load robot XML configuration from ${xmlUrl} (Status: ${response.status})`);
    }

    const xmlText = await response.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

    const name = xmlDoc.querySelector('Name')?.textContent?.trim() || robotId;
    const manufacturer = xmlDoc.querySelector('Manufacturer')?.textContent?.trim() || 'Industrial Robotics';
    const modelName = xmlDoc.querySelector('ModelName')?.textContent?.trim() || name;
    const scale = parseFloat(xmlDoc.querySelector('Scale')?.textContent?.trim() || '1');
    const payloadKg = parseFloat(xmlDoc.querySelector('Payload')?.textContent?.trim() || '0');
    const totalWeightKg = parseFloat(xmlDoc.querySelector('TotalWeight')?.textContent?.trim() || '0');

    // Parse joints
    const joints: DHParameter[] = [];
    const jointNodes = xmlDoc.querySelectorAll('Joints > RevoluteJoint');
    jointNodes.forEach((node, index) => {
      const d = parseFloat(node.querySelector('JointOffset')?.textContent?.trim() || '0');
      const thetaOffsetDeg = parseFloat(node.querySelector('JointAngle')?.textContent?.trim() || '0');
      const a = parseFloat(node.querySelector('LinkLength')?.textContent?.trim() || '0');
      const alphaDeg = parseFloat(node.querySelector('TwistAngle')?.textContent?.trim() || '0');
      const rawQMin = parseFloat(node.querySelector('JointAngleMin')?.textContent?.trim() || '-180');
      const rawQMax = parseFloat(node.querySelector('JointAngleMax')?.textContent?.trim() || '180');

      // In the dataset XML, JointAngleMin / Max store total absolute theta angles: theta = q + thetaOffset.
      // Therefore, the variable joint rotation limit is: q = theta - thetaOffset.
      const qMinDeg = Math.round((rawQMin - thetaOffsetDeg) * 10) / 10;
      const qMaxDeg = Math.round((rawQMax - thetaOffsetDeg) * 10) / 10;

      joints.push({
        jointIndex: index + 1,
        thetaOffsetDeg,
        d,
        a,
        alphaDeg,
        qMinDeg,
        qMaxDeg,
      });
    });

    // Parse links
    const links: RobotLink[] = [];
    const linkNodes = xmlDoc.querySelectorAll('Links > Link');
    linkNodes.forEach((node, index) => {
      const fileName = node.querySelector('FileName')?.textContent?.trim() || `link${index}.stl`;
      let color = node.querySelector('Color')?.textContent?.trim() || DEFAULT_LINK_PALETTE[index % DEFAULT_LINK_PALETTE.length];
      if (!color.startsWith('#')) {
        color = DEFAULT_LINK_PALETTE[index % DEFAULT_LINK_PALETTE.length];
      }

      links.push({
        index,
        fileName,
        color,
      });
    });

    // Calculate reach in mm
    const reachMm = joints.slice(1).reduce((sum, j) => sum + Math.abs(j.a) + Math.abs(j.d), 0);
    const defaultPostureDeg = ROBOT_DEFAULT_POSTURES[robotId] || new Array(joints.length).fill(0);

    return {
      id: robotId,
      name,
      manufacturer,
      modelName,
      payloadKg,
      totalWeightKg,
      scale,
      reachMm,
      dof: joints.length,
      joints,
      links,
      defaultPostureDeg,
    };
  }

  /**
   * Loads and caches an STL mesh for a specific robot link
   */
  public async loadLinkGeometry(robotId: string, fileName: string): Promise<THREE.BufferGeometry> {
    const cacheKey = `${robotId}/${fileName}`;
    if (this.geometryCache.has(cacheKey)) {
      return this.geometryCache.get(cacheKey)!.clone();
    }

    const baseUrl = (import.meta.env.BASE_URL || '/').replace(/\/$/, '') + '/';
    const stlUrl = `${baseUrl}robots/${robotId}/${fileName}`;
    return new Promise((resolve, reject) => {
      this.stlLoader.load(
        stlUrl,
        (geometry) => {
          geometry.computeVertexNormals();
          this.geometryCache.set(cacheKey, geometry);
          resolve(geometry.clone());
        },
        undefined,
        (error) => {
          console.error(`Error loading mesh at ${stlUrl}:`, error);
          reject(error);
        }
      );
    });
  }
}

export const robotLoader = new RobotLoaderService();
