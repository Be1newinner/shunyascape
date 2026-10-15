// Server-run city population.
//
// NPCs used to be simulated in the admin's browser and pushed to everyone
// else, so they froze whenever the admin was offline. They now live here and
// follow a daily routine driven by the shared clock: sleep at home, commute,
// work, lunch, run errands, walk in the park, go home. Builders walk to
// construction sites and build them.
//
// Bandwidth: clients receive a path and a start time whenever an NPC makes a
// new decision and animate the walk themselves, so nothing is streamed per
// frame.

import { WORLD_SIZE, WORLD_SEED, baseCellType } from "./layout";
import { findPath, Cell } from "./pathfinding";
import { CellOverride, getCell, getCellType, getOverrides, onCellChange, setCell } from "./grid";

type Role = "worker" | "shopkeeper" | "builder" | "resident";
export type Activity =
  | "home"
  | "work"
  | "lunch"
  | "errand"
  | "park"
  | "stroll"
  | "build"
  | "night_walk";

interface Npc {
  id: string;
  name: string;
  clothingColor: number;
  role: Role;
  home: Cell;
  work: Cell | null;
  /** Walking speed in cells per second. */
  speed: number;
  /** Fixed lateral offset in world units so people don't walk single file. */
  offset: [number, number];
  // Daily routine, in in-game hours (jittered per person)
  wake: number;
  leave: number;
  lunch: number;
  workEnd: number;
  bed: number;
  ateToday: boolean;
  // Movement: walking along `path` since `startedAt` (ms epoch)
  path: Cell[];
  startedAt: number;
  activity: Activity;
  /** Goes inside (hidden) once the path ends. */
  indoors: boolean;
  /** No new decision before this time (ms epoch). */
  busyUntil: number;
  /** Construction site this builder is assigned to ("x_z"). */
  site: string | null;
}

export interface NpcSnapshot {
  id: string;
  name: string;
  clothingColor: number;
  offset: [number, number];
  /** Flat [x0, z0, x1, z1, ...] cell coordinates. */
  path: number[];
  startedAt: number;
  speed: number;
  activity: Activity;
  indoors: boolean;
}

const BASE_POPULATION = 220;
const MAX_POPULATION = 320;
const TICK_MS = 500;
/** Construction progress per second for each builder on site. */
const BUILD_RATE = 10;
/** Slow progress for sites no builder has reached yet, so every site finishes. */
const UNATTENDED_BUILD_RATE = 0.5;
const SITE_SYNC_MS = 2000;

const FIRST_NAMES = [
  "Aarav", "Maya", "Leo", "Zara", "Kabir", "Ivy", "Omar", "Nina", "Ravi", "Ella",
  "Sami", "Aria", "Dev", "Luna", "Arjun", "Mila", "Theo", "Isha", "Noah", "Sara",
  "Vikram", "Chloe", "Ishan", "Anaya", "Felix", "Priya", "Jonah", "Tara", "Rohan", "Lila",
];
const LAST_INITIALS = "ABCDEFGHJKLMNPRSTVW";
const CLOTHING_COLORS = [0x4287f5, 0xeb4034, 0x228b22, 0xe0c012, 0x8a2be2, 0xff69b4, 0x0f766e, 0xf97316];
const SHOP_TYPES = ["restaurant", "clothshop", "barbershop"];

// ── Indexed lists of cells by type, for "find me a nearby X" ─────────────────

class CellIndex {
  private lists = new Map<string, Cell[]>();
  private positions = new Map<string, number>();

  add(type: string, c: Cell) {
    const k = `${type}:${c.x}_${c.z}`;
    if (this.positions.has(k)) return;
    let list = this.lists.get(type);
    if (!list) this.lists.set(type, (list = []));
    this.positions.set(k, list.length);
    list.push(c);
  }

  remove(type: string, c: Cell) {
    const k = `${type}:${c.x}_${c.z}`;
    const i = this.positions.get(k);
    const list = this.lists.get(type);
    if (i === undefined || !list) return;
    const last = list.pop()!;
    if (i < list.length) {
      list[i] = last;
      this.positions.set(`${type}:${last.x}_${last.z}`, i);
    }
    this.positions.delete(k);
  }

  /** Random sample biased towards cells close to `from`. */
  pickNear(type: string, from: Cell, rand: () => number, samples = 24): Cell | null {
    const list = this.lists.get(type);
    if (!list || list.length === 0) return null;
    let best: Cell | null = null;
    let bestScore = Infinity;
    for (let i = 0; i < Math.min(samples, list.length); i++) {
      const c = list[Math.floor(rand() * list.length)];
      const score = Math.abs(c.x - from.x) + Math.abs(c.z - from.z) + rand() * 6;
      if (score < bestScore) {
        bestScore = score;
        best = c;
      }
    }
    return best;
  }

  count(type: string) {
    return this.lists.get(type)?.length ?? 0;
  }
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Is `hour` inside [from, to), allowing windows that wrap past midnight. */
function inWindow(hour: number, from: number, to: number): boolean {
  return from <= to ? hour >= from && hour < to : hour >= from || hour < to;
}

const cellKey = (c: Cell) => `${c.x}_${c.z}`;
const sameCell = (a: Cell, b: Cell) => a.x === b.x && a.z === b.z;
const between = (rand: () => number, a: number, b: number) => a + rand() * (b - a);

export interface NpcSimulationDeps {
  broadcast: (message: object) => void;
  /** Current in-game hour, 0–24. */
  getHour: () => number;
}

export function createNpcSimulation({ broadcast, getHour }: NpcSimulationDeps) {
  const npcs: Npc[] = [];
  const index = new CellIndex();
  const dirty = new Set<Npc>();
  const sites = new Map<string, { cell: Cell; progress: number; lastSync: number }>();
  const seeded = mulberry32(WORLD_SEED ^ 0x5eed);
  let nextId = 0;

  // ── World index ────────────────────────────────────────────────────────────

  for (let x = 0; x < WORLD_SIZE; x++) {
    for (let z = 0; z < WORLD_SIZE; z++) {
      const type = baseCellType(x, z);
      if (type !== "empty") index.add(type, { x, z });
    }
  }
  for (const o of getOverrides()) {
    index.remove(baseCellType(o.x, o.z), o);
    if (o.type !== "empty") index.add(o.type, o);
  }

  // ── Movement helpers ───────────────────────────────────────────────────────

  const arrivalTime = (n: Npc) => n.startedAt + ((n.path.length - 1) / n.speed) * 1000;

  /** Cell the NPC is in right now (mid-walk NPCs are somewhere on their path). */
  function currentCell(n: Npc, now: number): Cell {
    const i = Math.floor(((now - n.startedAt) / 1000) * n.speed);
    return n.path[Math.max(0, Math.min(n.path.length - 1, i))];
  }

  function snapshot(n: Npc): NpcSnapshot {
    const path: number[] = [];
    for (const c of n.path) path.push(c.x, c.z);
    return {
      id: n.id,
      name: n.name,
      clothingColor: n.clothingColor,
      offset: n.offset,
      path,
      startedAt: n.startedAt,
      speed: n.speed,
      activity: n.activity,
      indoors: n.indoors,
    };
  }

  /** Walk to `target`, then do `activity` there for `stayMs`. */
  function goTo(n: Npc, target: Cell, activity: Activity, indoors: boolean, stayMs: number, now: number) {
    const from = currentCell(n, now);
    if (sameCell(from, target) && now >= arrivalTime(n)) {
      // Already there: keep doing it, only tell clients if something visible changed
      if (n.activity !== activity || n.indoors !== indoors) {
        n.path = [target];
        n.startedAt = now;
        dirty.add(n);
      }
      n.activity = activity;
      n.indoors = indoors;
      n.busyUntil = now + stayMs;
      return true;
    }

    const path = findPath(from, target, getCellType);
    if (!path) return false;
    n.path = path;
    n.startedAt = now;
    n.activity = activity;
    n.indoors = indoors;
    n.busyUntil = arrivalTime(n) + stayMs;
    dirty.add(n);
    return true;
  }

  function strollNear(n: Npc, now: number, activity: Activity) {
    const here = currentCell(n, now);
    for (let attempt = 0; attempt < 6; attempt++) {
      const x = here.x + Math.round(between(Math.random, -10, 10));
      const z = here.z + Math.round(between(Math.random, -10, 10));
      if (x < 0 || z < 0 || x >= WORLD_SIZE || z >= WORLD_SIZE) continue;
      const type = getCellType(x, z);
      if (type !== "road" && type !== "park") continue;
      if (goTo(n, { x, z }, activity, false, between(Math.random, 4000, 15000), now)) return;
    }
    n.busyUntil = now + 5000;
  }

  // ── Population ─────────────────────────────────────────────────────────────

  function pickHome(rand: () => number): Cell | null {
    return index.pickNear("house", { x: Math.floor(rand() * WORLD_SIZE), z: Math.floor(rand() * WORLD_SIZE) }, rand, 1);
  }

  function pickWork(role: Role, home: Cell, rand: () => number): Cell | null {
    if (role === "worker") {
      const type = rand() < 0.85 || index.count("policestation") === 0 ? "skyscraper" : "policestation";
      return index.pickNear(type, home, rand, 16);
    }
    if (role === "shopkeeper") {
      return index.pickNear(SHOP_TYPES[Math.floor(rand() * SHOP_TYPES.length)], home, rand, 16);
    }
    return null;
  }

  function spawn(rand: () => number, home: Cell, now: number, roleHint?: Role): Npc {
    const r = rand();
    const role: Role =
      roleHint ?? (r < 0.52 ? "worker" : r < 0.62 ? "shopkeeper" : r < 0.7 ? "builder" : "resident");
    const resident = role === "resident" || role === "builder";
    const wake = resident ? between(rand, 7, 9.5) : between(rand, 6, 8);
    const npc: Npc = {
      id: `npc_${nextId++}`,
      name: `${FIRST_NAMES[Math.floor(rand() * FIRST_NAMES.length)]} ${LAST_INITIALS[Math.floor(rand() * LAST_INITIALS.length)]}.`,
      clothingColor: CLOTHING_COLORS[Math.floor(rand() * CLOTHING_COLORS.length)],
      role,
      home,
      work: pickWork(role, home, rand),
      speed: between(rand, 0.6, 1.0),
      offset: [between(rand, -0.7, 0.7), between(rand, -0.7, 0.7)],
      wake,
      leave: wake + between(rand, 0.5, 1.2),
      lunch: between(rand, 12, 13.5),
      workEnd: between(rand, 16.5, 18.5),
      bed: resident ? between(rand, 20.5, 23) : between(rand, 21.5, 23.5),
      ateToday: false,
      path: [home],
      startedAt: now,
      activity: "home",
      indoors: true,
      // Stagger first decisions so the whole town doesn't move at once
      busyUntil: now + rand() * 60000,
      site: null,
    };
    npcs.push(npc);
    return npc;
  }

  const now0 = Date.now();
  for (let i = 0; i < BASE_POPULATION; i++) {
    const home = pickHome(seeded);
    if (!home) break;
    spawn(seeded, home, now0);
  }
  // Pick up construction sites that existed before a restart
  for (const o of getOverrides()) {
    if (o.type === "construction") addSite(o, now0);
  }

  // ── Daily routine ──────────────────────────────────────────────────────────

  function ensureAnchors(n: Npc) {
    if (getCellType(n.home.x, n.home.z) !== "house") {
      n.home = index.pickNear("house", n.home, Math.random) ?? n.home;
    }
    const workType = n.work ? getCellType(n.work.x, n.work.z) : null;
    if (n.work && workType !== "skyscraper" && workType !== "policestation" && !SHOP_TYPES.includes(workType ?? "")) {
      n.work = pickWork(n.role, n.home, Math.random);
    }
  }

  function decide(n: Npc, now: number, hour: number) {
    ensureAnchors(n);
    const rand = Math.random;

    if (n.role === "builder" && n.site) {
      const site = sites.get(n.site);
      if (site && goTo(n, site.cell, "build", false, 30000, now)) return;
      n.site = null;
    }

    if (!inWindow(hour, n.wake, n.bed)) {
      n.ateToday = false;
      if (rand() < 0.03) return strollNear(n, now, "night_walk");
      goTo(n, n.home, "home", true, between(rand, 60000, 180000), now);
      return;
    }

    if (n.work && inWindow(hour, n.leave, n.workEnd)) {
      if (n.role === "worker" && !n.ateToday && inWindow(hour, n.lunch, n.lunch + 1)) {
        const food = index.pickNear("restaurant", n.work, rand, 12);
        if (food && goTo(n, food, "lunch", true, between(rand, 40000, 90000), now)) {
          n.ateToday = true;
          return;
        }
      }
      if (goTo(n, n.work, "work", true, between(rand, 60000, 150000), now)) return;
    }

    // Free time: errands, the park, a stroll, or home
    const r = rand();
    const here = currentCell(n, now);
    if (r < 0.35) {
      const shop = index.pickNear(SHOP_TYPES[Math.floor(rand() * SHOP_TYPES.length)], here, rand, 16);
      if (shop && goTo(n, shop, "errand", true, between(rand, 30000, 120000), now)) return;
    } else if (r < 0.6) {
      const park = index.pickNear("park", here, rand, 16);
      if (park && goTo(n, park, "park", false, between(rand, 20000, 90000), now)) return;
    } else if (r < 0.85) {
      return strollNear(n, now, "stroll");
    }
    if (!goTo(n, n.home, "home", true, between(rand, 60000, 180000), now)) {
      n.busyUntil = now + 15000;
    }
  }

  // ── Construction ───────────────────────────────────────────────────────────

  function addSite(cell: Cell & { constructionProgress?: number }, now: number) {
    const key = cellKey(cell);
    if (sites.has(key)) return;
    sites.set(key, { cell: { x: cell.x, z: cell.z }, progress: cell.constructionProgress ?? 0, lastSync: now });

    // Send the nearest free builder
    let best: Npc | null = null;
    let bestDist = Infinity;
    for (const n of npcs) {
      if (n.role !== "builder" || n.site) continue;
      const c = currentCell(n, now);
      const d = Math.abs(c.x - cell.x) + Math.abs(c.z - cell.z);
      if (d < bestDist) {
        bestDist = d;
        best = n;
      }
    }
    if (best) {
      best.site = key;
      best.busyUntil = 0;
    }
  }

  function releaseBuilders(key: string, now: number) {
    for (const n of npcs) {
      if (n.site === key) {
        n.site = null;
        n.busyUntil = now + between(Math.random, 2000, 8000);
      }
    }
  }

  function tickSites(now: number, dt: number) {
    for (const [key, site] of sites) {
      let onSite = 0;
      for (const n of npcs) {
        if (n.site === key && n.activity === "build" && now >= arrivalTime(n)) onSite++;
      }
      site.progress = Math.min(100, site.progress + (onSite > 0 ? BUILD_RATE * onSite : UNATTENDED_BUILD_RATE) * dt);

      const cell = getCell(site.cell.x, site.cell.z);
      if (cell.type !== "construction") {
        sites.delete(key);
        releaseBuilders(key, now);
        continue;
      }
      if (site.progress >= 100) {
        sites.delete(key);
        releaseBuilders(key, now);
        commitCell({ ...cell, type: cell.targetType, constructionProgress: 100 });
      } else if (now - site.lastSync >= SITE_SYNC_MS && site.progress > cell.constructionProgress) {
        site.lastSync = now;
        commitCell({ ...cell, constructionProgress: Math.floor(site.progress) });
      }
    }
  }

  function commitCell(cell: CellOverride) {
    setCell(cell)
      .then((saved) => broadcast({ type: "grid-updated", cell: saved }))
      .catch((err) => console.error("NPC construction update failed:", err));
  }

  function moveInResidents(house: Cell, now: number) {
    const count = 1 + Math.floor(Math.random() * 2);
    const added: NpcSnapshot[] = [];
    for (let i = 0; i < count && npcs.length < MAX_POPULATION; i++) {
      added.push(snapshot(spawn(Math.random, { x: house.x, z: house.z }, now)));
    }
    if (added.length) broadcast({ type: "npcs-added", t: now, npcs: added });
  }

  // Keep the index and construction sites in step with every grid change
  onCellChange((before, after) => {
    if (before.type !== after.type) {
      if (before.type !== "empty") index.remove(before.type, before);
      if (after.type !== "empty") index.add(after.type, after);
    }
    // New homes get residents, whoever finished the build (builder NPC or player job)
    if (before.type === "construction" && after.type === "house") {
      moveInResidents(after, Date.now());
    }
    const key = cellKey(after);
    if (after.type === "construction") {
      const site = sites.get(key);
      if (site) site.progress = Math.max(site.progress, after.constructionProgress);
      else addSite(after, Date.now());
    }
  });

  // ── Main loop ──────────────────────────────────────────────────────────────

  let last = Date.now();
  const timer = setInterval(() => {
    const now = Date.now();
    const dt = (now - last) / 1000;
    last = now;
    const hour = getHour();

    for (const n of npcs) {
      if (now >= n.busyUntil) decide(n, now, hour);
    }
    tickSites(now, dt);

    if (dirty.size > 0) {
      broadcast({ type: "npc-paths", t: now, npcs: Array.from(dirty, snapshot) });
      dirty.clear();
    }
  }, TICK_MS);

  return {
    /** Full population for a newly connected client. */
    snapshot: (): NpcSnapshot[] => npcs.map(snapshot),
    stop: () => clearInterval(timer),
  };
}
