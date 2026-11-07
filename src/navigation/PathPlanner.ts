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
  private static BOUNDS = 8.0;      // [-8m, 8m] in X and Y
  private static ROBOT_INFLATION_RADIUS = 0.35; // 35cm safety inflation

  /**
   * Plans an obstacle-free 2D path using A* search algorithm
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

    const startGx = toGrid(startX);
    const startGy = toGrid(startY);
    const goalGx = toGrid(goalX);
    const goalGy = toGrid(goalY);

    if (startGx === goalGx && startGy === goalGy) {
      return [{ x: startX, y: startY }, { x: goalX, y: goalY }];
    }

    const openList: GridNode[] = [];
    const closedSet = new Set<string>();
    const nodeKey = (gx: number, gy: number) => `${gx},${gy}`;

    const heuristic = (gx: number, gy: number) => {
      const dx = (gx - goalGx) * res;
      const dy = (gy - goalGy) * res;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const isColliding = (x: number, y: number): boolean => {
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
    let maxIterations = 2500;

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
        return this.reconstructPath(current, startX, startY, goalX, goalY);
      }

      // Explore neighbors
      for (const [dx, dy, costMult] of neighbors) {
        const nx = current.gx + dx;
        const ny = current.gy + dy;
        const nKey = nodeKey(nx, ny);

        if (closedSet.has(nKey)) continue;

        const worldX = toWorld(nx);
        const worldY = toWorld(ny);

        if (Math.abs(worldX) > this.BOUNDS || Math.abs(worldY) > this.BOUNDS) continue;
        if (isColliding(worldX, worldY)) continue;

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
    return this.reconstructPath(closestNode, startX, startY, goalX, goalY);
  }

  private static reconstructPath(
    endNode: GridNode,
    startX: number,
    startY: number,
    goalX: number,
    goalY: number
  ): PathWaypoint[] {
    const rawWaypoints: PathWaypoint[] = [];
    let curr: GridNode | null = endNode;
    while (curr) {
      rawWaypoints.push({ x: curr.gx * this.RESOLUTION, y: curr.gy * this.RESOLUTION });
      curr = curr.parent;
    }
    rawWaypoints.reverse();

    // Ensure exact start and goal are included
    if (rawWaypoints.length > 0) {
      rawWaypoints[0] = { x: startX, y: startY };
      rawWaypoints.push({ x: goalX, y: goalY });
    }

    // Path smoothing: Decimate redundant collinear points
    return this.smoothPath(rawWaypoints);
  }

  private static smoothPath(points: PathWaypoint[]): PathWaypoint[] {
    if (points.length <= 2) return points;
    const smoothed: PathWaypoint[] = [points[0]];

    for (let i = 1; i < points.length - 1; i++) {
      const prev = smoothed[smoothed.length - 1];
      const curr = points[i];

      // Distance from prev to curr
      const dist = Math.hypot(curr.x - prev.x, curr.y - prev.y);
      if (dist >= 0.5) {
        smoothed.push(curr);
      }
    }

    smoothed.push(points[points.length - 1]);
    return smoothed;
  }
}
