import { Obstacle, PathWaypoint } from '../types/mobileRobot';

interface GridNode {
  gx: number;
  gy: number;
  g: number;
  h: number;
  f: number;
  parent: GridNode | null;
}

export class PathPlanner {
  private static RESOLUTION = 0.25; // 0.25m per grid cell
  private static BOUNDS = 5.2;      // Keep within warehouse walls (+/- 5.5m)
  private static ROBOT_INFLATION_RADIUS = 0.35; // 35cm safety inflation

  /**
   * Checks whether a 2D coordinate collides with obstacles or warehouse boundary walls
   */
  public static isPointColliding(x: number, y: number, obstacles: Obstacle[]): boolean {
    if (Math.abs(x) > this.BOUNDS || Math.abs(y) > this.BOUNDS) {
      return true;
    }
    for (const obs of obstacles) {
      if (obs.type === 'cylinder' && obs.dimensions.radius) {
        const rSafe = obs.dimensions.radius + this.ROBOT_INFLATION_RADIUS;
        const dx = x - obs.position.x;
        const dy = y - obs.position.y;
        if (dx * dx + dy * dy <= rSafe * rSafe) return true;
      } else if ((obs.type === 'box' || obs.type === 'wall') && obs.dimensions.width && obs.dimensions.depth) {
        const halfW = obs.dimensions.width / 2 + this.ROBOT_INFLATION_RADIUS;
        const halfD = obs.dimensions.depth / 2 + this.ROBOT_INFLATION_RADIUS;
        if (Math.abs(x - obs.position.x) <= halfW && Math.abs(y - obs.position.y) <= halfD) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Raycasts between two points to verify true collision-free Line-of-Sight
   */
  public static isSegmentColliding(
    p1: PathWaypoint,
    p2: PathWaypoint,
    obstacles: Obstacle[],
    stepM: number = 0.05
  ): boolean {
    const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    if (dist < 1e-4) return false;
    const steps = Math.max(1, Math.ceil(dist / stepM));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = p1.x + t * (p2.x - p1.x);
      const y = p1.y + t * (p2.y - p1.y);
      if (this.isPointColliding(x, y, obstacles)) return true;
    }
    return false;
  }

  /**
   * Plans an obstacle-free 2D path using A* search algorithm,
   * smoothed via greedy Line-of-Sight Raycasting (String-Pulling),
   * and densely interpolated for stable Pure Pursuit tracking.
   */
  public static planPath(
    startX: number,
    startY: number,
    goalX: number,
    goalY: number,
    obstacles: Obstacle[]
  ): PathWaypoint[] {
    const res = this.RESOLUTION;
    const toGrid = (val: number) => Math.round(val / res);
    const toWorld = (gVal: number) => gVal * res;

    const pStart: PathWaypoint = { x: startX, y: startY };
    const pGoal: PathWaypoint = { x: goalX, y: goalY };

    // 1. Direct Line-of-Sight check (fast-path)
    if (!this.isSegmentColliding(pStart, pGoal, obstacles)) {
      return this.interpolatePath([pStart, pGoal], 0.08);
    }

    const startGx = toGrid(startX);
    const startGy = toGrid(startY);
    const goalGx = toGrid(goalX);
    const goalGy = toGrid(goalY);

    if (startGx === goalGx && startGy === goalGy) {
      return [pStart, pGoal];
    }

    const openList: GridNode[] = [];
    const closedSet = new Set<string>();
    const nodeKey = (gx: number, gy: number) => `${gx},${gy}`;

    const heuristic = (gx: number, gy: number) => {
      const dx = (gx - goalGx) * res;
      const dy = (gy - goalGy) * res;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const startNode: GridNode = {
      gx: startGx,
      gy: startGy,
      g: 0,
      h: heuristic(startGx, startGy),
      f: heuristic(startGx, startGy),
      parent: null,
    };

    openList.push(startNode);

    const neighbors = [
      [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
      [1, 1, 1.414], [-1, 1, 1.414], [1, -1, 1.414], [-1, -1, 1.414],
    ];

    let closestNode = startNode;
    let minH = startNode.h;
    let maxIterations = 3500;

    while (openList.length > 0 && maxIterations-- > 0) {
      // Find node with minimum f
      let bestIdx = 0;
      for (let i = 1; i < openList.length; i++) {
        if (openList[i].f < openList[bestIdx].f) {
          bestIdx = i;
        }
      }

      const current = openList.splice(bestIdx, 1)[0];
      const currentKey = nodeKey(current.gx, current.gy);
      closedSet.add(currentKey);

      if (current.h < minH) {
        minH = current.h;
        closestNode = current;
      }

      // Check if reached goal (within 1 cell)
      if (Math.abs(current.gx - goalGx) <= 1 && Math.abs(current.gy - goalGy) <= 1) {
        return this.reconstructPath(current, startX, startY, goalX, goalY, obstacles);
      }

      // Explore neighbors
      for (const [dx, dy, costMult] of neighbors) {
        const nx = current.gx + dx;
        const ny = current.gy + dy;
        const nKey = nodeKey(nx, ny);

        if (closedSet.has(nKey)) continue;

        const worldX = toWorld(nx);
        const worldY = toWorld(ny);

        if (this.isPointColliding(worldX, worldY, obstacles)) continue;

        const g = current.g + costMult * res;
        const h = heuristic(nx, ny);
        const f = g + h;

        const existing = openList.find((n) => n.gx === nx && n.gy === ny);
        if (existing) {
          if (g < existing.g) {
            existing.g = g;
            existing.f = f;
            existing.parent = current;
          }
        } else {
          openList.push({ gx: nx, gy: ny, g, h, f, parent: current });
        }
      }
    }

    // Fallback: Return best effort path towards goal
    return this.reconstructPath(closestNode, startX, startY, goalX, goalY, obstacles);
  }

  private static reconstructPath(
    endNode: GridNode,
    startX: number,
    startY: number,
    goalX: number,
    goalY: number,
    obstacles: Obstacle[]
  ): PathWaypoint[] {
    const rawWaypoints: PathWaypoint[] = [];
    let curr: GridNode | null = endNode;
    while (curr) {
      rawWaypoints.push({ x: curr.gx * this.RESOLUTION, y: curr.gy * this.RESOLUTION });
      curr = curr.parent;
    }
    rawWaypoints.reverse();

    // Ensure exact start and goal
    if (rawWaypoints.length > 0) {
      rawWaypoints[0] = { x: startX, y: startY };
      rawWaypoints.push({ x: goalX, y: goalY });
    } else {
      rawWaypoints.push({ x: startX, y: startY }, { x: goalX, y: goalY });
    }

    // Line-of-Sight String-Pulling Shortcut
    const pulled = this.stringPull(rawWaypoints, obstacles);

    // Dense interpolation (0.08m) for smooth tracking
    return this.interpolatePath(pulled, 0.08);
  }

  /**
   * Greedy String-Pulling shortcutting
   */
  private static stringPull(points: PathWaypoint[], obstacles: Obstacle[]): PathWaypoint[] {
    if (points.length <= 2) return points;
    const result: PathWaypoint[] = [points[0]];
    let currentIdx = 0;

    while (currentIdx < points.length - 1) {
      let furthestIdx = points.length - 1;
      for (; furthestIdx > currentIdx + 1; furthestIdx--) {
        if (!this.isSegmentColliding(points[currentIdx], points[furthestIdx], obstacles)) {
          break;
        }
      }
      result.push(points[furthestIdx]);
      currentIdx = furthestIdx;
    }

    return result;
  }

  /**
   * Densely interpolates waypoints at fixed distance intervals
   */
  private static interpolatePath(keypoints: PathWaypoint[], stepSize = 0.08): PathWaypoint[] {
    if (keypoints.length <= 1) return keypoints;
    const dense: PathWaypoint[] = [keypoints[0]];

    for (let i = 0; i < keypoints.length - 1; i++) {
      const p1 = keypoints[i];
      const p2 = keypoints[i + 1];
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const steps = Math.max(1, Math.ceil(dist / stepSize));
      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        dense.push({
          x: Number((p1.x + t * (p2.x - p1.x)).toFixed(4)),
          y: Number((p1.y + t * (p2.y - p1.y)).toFixed(4)),
        });
      }
    }

    return dense;
  }
}
