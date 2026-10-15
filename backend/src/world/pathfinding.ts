import { WORLD_SIZE } from "./layout";

/**
 * A* over the city grid for pedestrians. Roads and the park are the preferred
 * surfaces, open grass is allowed but costs more (people cut across lots only
 * when it saves real distance), buildings and trees block. The start and goal
 * cells are always enterable so NPCs can leave and enter buildings.
 */

export type Cell = { x: number; z: number };

const N = WORLD_SIZE * WORLD_SIZE;
const MAX_EXPANSIONS = 30000;

// Reused across calls; `stamp` marks which entries belong to the current search
const gScore = new Float32Array(N);
const cameFrom = new Int32Array(N);
const seen = new Uint32Array(N);
const closed = new Uint32Array(N);
let stamp = 0;

// Binary min-heap of node indices keyed by fScore
const heap = new Int32Array(N);
const fScore = new Float32Array(N);
let heapSize = 0;

function heapPush(node: number) {
  let i = heapSize++;
  heap[i] = node;
  while (i > 0) {
    const parent = (i - 1) >> 1;
    if (fScore[heap[parent]] <= fScore[heap[i]]) break;
    [heap[parent], heap[i]] = [heap[i], heap[parent]];
    i = parent;
  }
}

function heapPop(): number {
  const top = heap[0];
  heap[0] = heap[--heapSize];
  let i = 0;
  for (;;) {
    const l = i * 2 + 1;
    const r = l + 1;
    let m = i;
    if (l < heapSize && fScore[heap[l]] < fScore[heap[m]]) m = l;
    if (r < heapSize && fScore[heap[r]] < fScore[heap[m]]) m = r;
    if (m === i) break;
    [heap[m], heap[i]] = [heap[i], heap[m]];
    i = m;
  }
  return top;
}

/** Movement cost to enter a cell of this type, or Infinity if blocked. */
export function walkCost(type: string): number {
  switch (type) {
    case "road":
      return 1;
    case "park":
      return 1.2;
    case "empty":
      return 2.5;
    default:
      return Infinity;
  }
}

export function findPath(
  start: Cell,
  goal: Cell,
  cellType: (x: number, z: number) => string,
): Cell[] | null {
  if (start.x === goal.x && start.z === goal.z) return [start];

  stamp++;
  heapSize = 0;
  const startIdx = start.x * WORLD_SIZE + start.z;
  const goalIdx = goal.x * WORLD_SIZE + goal.z;
  const h = (x: number, z: number) => Math.abs(x - goal.x) + Math.abs(z - goal.z);

  gScore[startIdx] = 0;
  fScore[startIdx] = h(start.x, start.z);
  cameFrom[startIdx] = -1;
  seen[startIdx] = stamp;
  heapPush(startIdx);

  let expansions = 0;
  while (heapSize > 0 && expansions++ < MAX_EXPANSIONS) {
    const cur = heapPop();
    if (closed[cur] === stamp) continue;
    closed[cur] = stamp;

    if (cur === goalIdx) {
      const path: Cell[] = [];
      for (let n = cur; n !== -1; n = cameFrom[n]) {
        path.push({ x: Math.floor(n / WORLD_SIZE), z: n % WORLD_SIZE });
      }
      return path.reverse();
    }

    const cx = Math.floor(cur / WORLD_SIZE);
    const cz = cur % WORLD_SIZE;
    for (let d = 0; d < 4; d++) {
      const nx = cx + (d === 0 ? 1 : d === 1 ? -1 : 0);
      const nz = cz + (d === 2 ? 1 : d === 3 ? -1 : 0);
      if (nx < 0 || nz < 0 || nx >= WORLD_SIZE || nz >= WORLD_SIZE) continue;
      const ni = nx * WORLD_SIZE + nz;
      if (closed[ni] === stamp) continue;

      const cost = ni === goalIdx ? 1 : walkCost(cellType(nx, nz));
      if (cost === Infinity) continue;

      const g = gScore[cur] + cost;
      if (seen[ni] === stamp && g >= gScore[ni]) continue;
      seen[ni] = stamp;
      gScore[ni] = g;
      cameFrom[ni] = cur;
      fScore[ni] = g + h(nx, nz);
      heapPush(ni);
    }
  }
  return null;
}
