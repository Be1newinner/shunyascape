import { MAP_HALF } from "./config";
import { mulberry32, range, pick, Simplex2, smoothstep, lerp, type Rng } from "./noise";

/** Deterministic layout of the battleground: towns, roads, building lots and forests. */

export interface Site {
  name: string;
  x: number;
  z: number;
  radius: number;
  buildings: number;
  /** Ground height the town sits on (terrain is flattened to this). */
  height: number;
}

export interface BuildingLot {
  x: number;
  z: number;
  rotation: number; // multiples of 90deg keep walls axis-friendly
  width: number;
  depth: number;
  floors: 1 | 2;
  style: "plaster" | "brick" | "concrete";
  site: string;
}

export interface RoadSegment {
  ax: number;
  az: number;
  bx: number;
  bz: number;
  width: number;
}

const SEED = 20261015;

const SITE_DEFS: Array<Omit<Site, "height">> = [
  { name: "Purana Basti", x: 0, z: 0, radius: 58, buildings: 12 },
  { name: "Kila", x: -175, z: -150, radius: 40, buildings: 7 },
  { name: "Pathshala", x: 165, z: -150, radius: 36, buildings: 6 },
  { name: "Bandar", x: -170, z: 165, radius: 44, buildings: 8 },
  { name: "Mandi", x: 175, z: 160, radius: 42, buildings: 8 },
  { name: "Ghati", x: 15, z: -205, radius: 30, buildings: 5 },
  { name: "Tilla", x: 205, z: 10, radius: 30, buildings: 5 },
  { name: "Chowki", x: -205, z: 5, radius: 32, buildings: 5 },
  { name: "Kheda", x: 0, z: 205, radius: 30, buildings: 5 },
];

export class MapLayout {
  readonly noise = new Simplex2(SEED);
  readonly detail = new Simplex2(SEED + 7);
  readonly sites: Site[];
  readonly roads: RoadSegment[] = [];
  readonly lots: BuildingLot[] = [];

  constructor() {
    this.sites = SITE_DEFS.map((s) => ({ ...s, height: 0 }));
    for (const s of this.sites) s.height = this.naturalHeight(s.x, s.z) * 0.6;
    this.buildRoads();
    this.placeLots();
  }

  /** Terrain before towns/roads are carved in. */
  naturalHeight(x: number, z: number): number {
    const n = this.noise;
    let h = n.fbm(x / 260, z / 260, 4) * 16;
    h += n.fbm(x / 70 + 13, z / 70 - 7, 3) * 2.2;
    // Ridges rise toward the map edge to box the arena in.
    const edge = smoothstep(MAP_HALF - 110, MAP_HALF - 10, Math.max(Math.abs(x), Math.abs(z)));
    const ridge = 1 - Math.abs(n.noise(x / 90 + 40, z / 90 + 40));
    h += edge * (28 + ridge * 26);
    return h;
  }

  /** Final ground height, including flattened towns and smoothed roads. */
  height(x: number, z: number): number {
    let h = this.naturalHeight(x, z);
    for (const s of this.sites) {
      const d = Math.hypot(x - s.x, z - s.z);
      const t = 1 - smoothstep(s.radius, s.radius + 28, d);
      if (t > 0) h = lerp(h, s.height, t);
    }
    const road = this.roadInfluence(x, z);
    if (road > 0) {
      // Roads follow a low-frequency version of the terrain so they don't jump over bumps.
      const smooth = this.noise.fbm(x / 260, z / 260, 2) * 16;
      h = lerp(h, Math.min(h, smooth + 0.15), road * 0.6);
    }
    return h;
  }

  /** 0..1 road coverage at a point (1 on the road surface). */
  roadInfluence(x: number, z: number): number {
    let best = 0;
    for (const r of this.roads) {
      const d = distToSegment(x, z, r.ax, r.az, r.bx, r.bz);
      const v = 1 - smoothstep(r.width * 0.5 - 0.6, r.width * 0.5 + 1.2, d);
      if (v > best) best = v;
    }
    return best;
  }

  /** 0..1 bare-dirt patches scattered through grass. */
  dirtInfluence(x: number, z: number): number {
    const v = this.detail.fbm(x / 35, z / 35, 3);
    let dirt = smoothstep(0.25, 0.55, v);
    for (const s of this.sites) {
      const d = Math.hypot(x - s.x, z - s.z);
      dirt = Math.max(dirt, (1 - smoothstep(s.radius * 0.55, s.radius + 6, d)) * 0.85);
    }
    return dirt;
  }

  /** 0..1 forest density: trees cluster in noise blobs away from towns and roads. */
  forestDensity(x: number, z: number): number {
    let f = smoothstep(0.05, 0.45, this.detail.fbm(x / 140 + 100, z / 140 - 50, 3));
    for (const s of this.sites) {
      const d = Math.hypot(x - s.x, z - s.z);
      f *= smoothstep(s.radius + 4, s.radius + 30, d);
    }
    f *= 1 - this.roadInfluence(x, z);
    return f;
  }

  nearestSite(x: number, z: number): Site {
    let best = this.sites[0];
    let bestD = Infinity;
    for (const s of this.sites) {
      const d = Math.hypot(x - s.x, z - s.z);
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    return best;
  }

  private buildRoads() {
    const rng = mulberry32(SEED + 1);
    const hub = this.sites[0];
    const link = (a: Site, b: Site, width: number) => {
      // Gentle bend through a jittered midpoint, split into short segments.
      const mx = (a.x + b.x) / 2 + range(rng, -30, 30);
      const mz = (a.z + b.z) / 2 + range(rng, -30, 30);
      const pts: Array<[number, number]> = [];
      const steps = 12;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * mx + t * t * b.x;
        const z = (1 - t) * (1 - t) * a.z + 2 * (1 - t) * t * mz + t * t * b.z;
        pts.push([x, z]);
      }
      for (let i = 0; i < pts.length - 1; i++) {
        this.roads.push({ ax: pts[i][0], az: pts[i][1], bx: pts[i + 1][0], bz: pts[i + 1][1], width });
      }
    };
    for (const s of this.sites.slice(1)) link(hub, s, 7);
    // Outer ring between neighbouring towns.
    const outer = this.sites.slice(1).sort((a, b) => Math.atan2(a.z, a.x) - Math.atan2(b.z, b.x));
    for (let i = 0; i < outer.length; i++) link(outer[i], outer[(i + 1) % outer.length], 5.5);
  }

  private placeLots() {
    const rng = mulberry32(SEED + 2);
    for (const s of this.sites) {
      const placed: BuildingLot[] = [];
      let attempts = 0;
      while (placed.length < s.buildings && attempts < 400) {
        attempts++;
        const a = rng() * Math.PI * 2;
        const r = Math.sqrt(rng()) * (s.radius - 9);
        const x = s.x + Math.cos(a) * r;
        const z = s.z + Math.sin(a) * r;
        const floors: 1 | 2 = rng() < 0.4 ? 2 : 1;
        const width = Math.round(range(rng, 8, floors === 2 ? 12 : 14));
        const depth = Math.round(range(rng, 7, 11));
        const rotation = Math.floor(rng() * 4) * (Math.PI / 2);
        const radius = Math.hypot(width, depth) / 2 + 3.5;
        if (this.roadInfluence(x, z) > 0 || roadNear(this, x, z, radius)) continue;
        if (placed.some((p) => Math.hypot(p.x - x, p.z - z) < radius + Math.hypot(p.width, p.depth) / 2 + 2)) continue;
        const style = pick(rng, ["plaster", "plaster", "brick", "concrete"] as const);
        placed.push({ x, z, rotation, width, depth, floors, style, site: s.name });
      }
      this.lots.push(...placed);
    }
  }

  /** Random point on open ground: not in a building, optionally inside a radius. */
  randomOpenPoint(rng: Rng, cx = 0, cz = 0, maxR = MAP_HALF - 60): [number, number] {
    for (let i = 0; i < 200; i++) {
      const a = rng() * Math.PI * 2;
      const r = Math.sqrt(rng()) * maxR;
      const x = cx + Math.cos(a) * r;
      const z = cz + Math.sin(a) * r;
      if (Math.abs(x) > MAP_HALF - 40 || Math.abs(z) > MAP_HALF - 40) continue;
      if (this.insideLot(x, z, 2)) continue;
      return [x, z];
    }
    return [cx, cz];
  }

  insideLot(x: number, z: number, margin = 0): boolean {
    for (const l of this.lots) {
      const dx = x - l.x;
      const dz = z - l.z;
      const c = Math.cos(-l.rotation);
      const s = Math.sin(-l.rotation);
      const lx = dx * c - dz * s;
      const lz = dx * s + dz * c;
      if (Math.abs(lx) < l.width / 2 + margin && Math.abs(lz) < l.depth / 2 + margin) return true;
    }
    return false;
  }
}

function roadNear(map: MapLayout, x: number, z: number, radius: number) {
  for (const r of map.roads) {
    if (distToSegment(x, z, r.ax, r.az, r.bx, r.bz) < radius + r.width / 2) return true;
  }
  return false;
}

export function distToSegment(px: number, pz: number, ax: number, az: number, bx: number, bz: number) {
  const dx = bx - ax;
  const dz = bz - az;
  const len2 = dx * dx + dz * dz;
  let t = len2 > 0 ? ((px - ax) * dx + (pz - az) * dz) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
}
