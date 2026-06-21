import { GridCell } from './Types';

export function findPath(
  grid: GridCell[][],
  gridSize: number,
  startX: number,
  startZ: number,
  endX: number,
  endZ: number
): { x: number; z: number }[] | null {
  if (startX === endX && startZ === endZ) {
    return [{ x: startX, z: startZ }];
  }

  // Restrict search space to a localized bounding box around start and end
  const margin = 8;
  const minX = Math.max(0, Math.min(startX, endX) - margin);
  const maxX = Math.min(gridSize - 1, Math.max(startX, endX) + margin);
  const minZ = Math.max(0, Math.min(startZ, endZ) - margin);
  const maxZ = Math.min(gridSize - 1, Math.max(startZ, endZ) + margin);

  const maxCells = gridSize * gridSize;
  
  // Parallel queues for X and Z to avoid allocation
  const queueX = new Int32Array(maxCells);
  const queueZ = new Int32Array(maxCells);
  let head = 0;
  let tail = 0;

  // parentMap tracks standard 1D indices: parentX * gridSize + parentZ.
  // Unvisited coordinates are marked as -1.
  const parentMap = new Int32Array(maxCells);
  parentMap.fill(-1);

  // Initialize start node
  const startIdx = startX * gridSize + startZ;
  queueX[tail] = startX;
  queueZ[tail] = startZ;
  tail++;
  parentMap[startIdx] = startIdx; // self parent to denote start and visited

  let found = false;

  const dirs = [
    { dx: 0, dz: -1 },
    { dx: 0, dz: 1 },
    { dx: -1, dz: 0 },
    { dx: 1, dz: 0 }
  ];

  while (head < tail) {
    const cx = queueX[head];
    const cz = queueZ[head];
    head++;

    if (cx === endX && cz === endZ) {
      found = true;
      break;
    }

    for (let i = 0; i < 4; i++) {
      const nx = cx + dirs[i].dx;
      const nz = cz + dirs[i].dz;

      // Constrain search to the bounding box
      if (nx >= minX && nx <= maxX && nz >= minZ && nz <= maxZ) {
        const nIdx = nx * gridSize + nz;
        if (parentMap[nIdx] === -1) {
          const neighborCell = grid[nx]?.[nz];
          if (neighborCell) {
            const isRoad = neighborCell.type === 'road';
            const isTarget = nx === endX && nz === endZ;

            if (isRoad || isTarget) {
              parentMap[nIdx] = cx * gridSize + cz;
              queueX[tail] = nx;
              queueZ[tail] = nz;
              tail++;
            }
          }
        }
      }
    }
  }

  if (found) {
    // Reconstruct path backward
    const path: { x: number; z: number }[] = [];
    let currIdx = endX * gridSize + endZ;
    while (true) {
      const cz = currIdx % gridSize;
      const cx = (currIdx - cz) / gridSize;
      path.push({ x: cx, z: cz });
      
      const parent = parentMap[currIdx];
      if (parent === currIdx) {
        break; // reached start
      }
      currIdx = parent;
    }
    return path.reverse();
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
