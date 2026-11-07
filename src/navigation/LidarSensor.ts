import { LidarConfig, LidarScanPoint, MobileRobotPose, Obstacle } from '../types/mobileRobot';

export class LidarSensor {
  /**
   * Performs 2D LIDAR raycasting against world obstacles
   */
  public static simulateScan(
    robotPose: MobileRobotPose,
    obstacles: Obstacle[],
    config: LidarConfig
  ): LidarScanPoint[] {
    const { numRays, fovRad, minRangeM, maxRangeM } = config;
    const scanPoints: LidarScanPoint[] = [];

    const startAngle = -fovRad / 2;
    const angleStep = fovRad / numRays;

    const ox = robotPose.x;
    const oy = robotPose.y;

    for (let i = 0; i < numRays; i++) {
      const relAngle = startAngle + i * angleStep;
      const worldAngle = robotPose.thetaRad + relAngle;

      const dx = Math.cos(worldAngle);
      const dy = Math.sin(worldAngle);

      let closestDist = maxRangeM;
      let hasHit = false;

      for (const obs of obstacles) {
        let dist = Infinity;

        if (obs.type === 'cylinder' && obs.dimensions.radius) {
          dist = this.rayIntersectCircle(
            ox, oy, dx, dy,
            obs.position.x, obs.position.y,
            obs.dimensions.radius
          );
        } else if ((obs.type === 'box' || obs.type === 'wall') && obs.dimensions.width && obs.dimensions.depth) {
          dist = this.rayIntersectBox(
            ox, oy, dx, dy,
            obs.position.x, obs.position.y,
            obs.dimensions.width, obs.dimensions.depth
          );
        }

        if (dist >= minRangeM && dist < closestDist) {
          closestDist = dist;
          hasHit = true;
        }
      }

      scanPoints.push({
        angleRad: relAngle,
        distanceM: hasHit ? Number(closestDist.toFixed(3)) : maxRangeM,
        hitX: Number((ox + closestDist * dx).toFixed(3)),
        hitY: Number((oy + closestDist * dy).toFixed(3)),
        hasHit
      });
    }

    return scanPoints;
  }

  /**
   * Ray-Circle 2D intersection
   */
  private static rayIntersectCircle(
    ox: number, oy: number, dx: number, dy: number,
    cx: number, cy: number, r: number
  ): number {
    const fx = ox - cx;
    const fy = oy - cy;

    const a = dx * dx + dy * dy; // Should be 1 if normalized
    const b = 2 * (fx * dx + fy * dy);
    const c = fx * fx + fy * fy - r * r;

    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0) return Infinity;

    const sqrtDisc = Math.sqrt(discriminant);
    const t1 = (-b - sqrtDisc) / (2 * a);
    const t2 = (-b + sqrtDisc) / (2 * a);

    if (t1 > 0) return t1;
    if (t2 > 0) return t2;
    return Infinity;
  }

  /**
   * Ray-AABB 2D Box intersection (Slab method)
   */
  private static rayIntersectBox(
    ox: number, oy: number, dx: number, dy: number,
    bx: number, by: number, width: number, depth: number
  ): number {
    const minX = bx - width / 2;
    const maxX = bx + width / 2;
    const minY = by - depth / 2;
    const maxY = by + depth / 2;

    const invDx = Math.abs(dx) > 1e-8 ? 1 / dx : 1e8;
    const invDy = Math.abs(dy) > 1e-8 ? 1 / dy : 1e8;

    let tMinX = (minX - ox) * invDx;
    let tMaxX = (maxX - ox) * invDx;
    if (tMinX > tMaxX) [tMinX, tMaxX] = [tMaxX, tMinX];

    let tMinY = (minY - oy) * invDy;
    let tMaxY = (maxY - oy) * invDy;
    if (tMinY > tMaxY) [tMinY, tMaxY] = [tMaxY, tMinY];

    const tEnter = Math.max(tMinX, tMinY);
    const tExit = Math.min(tMaxX, tMaxY);

    if (tEnter > tExit || tExit < 0) return Infinity;
    return tEnter > 0 ? tEnter : Infinity;
  }
}
