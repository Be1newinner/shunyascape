import { GridCell } from './Types';

export function findPath(
  grid: GridCell[][],
  gridSize: number,
  startX: number,
  startZ: number,
  endX: number,
  endZ: number
): { x: number; z: number }[] | null {
  // Standard BFS pathfinding
  const queue: { x: number; z: number; path: { x: number; z: number }[] }[] = [];
  const visited = new Set<string>();

  queue.push({ x: startX, z: startZ, path: [{ x: startX, z: startZ }] });
  visited.add(`${startX}_${startZ}`);

  while (queue.length > 0) {
    const curr = queue.shift()!;
    if (curr.x === endX && curr.z === endZ) {
      return curr.path;
    }

    // Check 4 directions
    const dirs = [
      { dx: 0, dz: -1 },
      { dx: 0, dz: 1 },
      { dx: -1, dz: 0 },
      { dx: 1, dz: 0 }
    ];

    for (const dir of dirs) {
      const nx = curr.x + dir.dx;
      const nz = curr.z + dir.dz;
      const key = `${nx}_${nz}`;

      if (nx >= 0 && nx < gridSize && nz >= 0 && nz < gridSize && !visited.has(key)) {
        const neighborCell = grid[nx][nz];
        const isRoad = neighborCell.type === 'road';
        const isTarget = nx === endX && nz === endZ;

        if (isRoad || isTarget) {
          visited.add(key);
          queue.push({
            x: nx,
            z: nz,
            path: [...curr.path, { x: nx, z: nz }]
          });
        }
      }
    }
  }

  // No road-only path found: fallback to a straight line pathway across grass
  return findGrassPath(startX, startZ, endX, endZ);
}

export function findGrassPath(startX: number, startZ: number, endX: number, endZ: number): { x: number; z: number }[] {
  const path: { x: number; z: number }[] = [];
  let cx = startX;
  let cz = startZ;
  path.push({ x: cx, z: cz });

  while (cx !== endX || cz !== endZ) {
    if (cx < endX) cx++;
    else if (cx > endX) cx--;

    if (cz < endZ) cz++;
    else if (cz > endZ) cz--;

    path.push({ x: cx, z: cz });
  }
  return path;
}
