import * as THREE from "three/webgpu";
import { ASSET_ROOT } from "./config";
import type { BuildingLot, MapLayout } from "./MapGen";
import { mulberry32, pick, type Rng } from "./noise";
import type { Physics } from "./Physics";
import type { Terrain } from "./Terrain";

/**
 * Enterable houses built from textured boxes: door and window openings you can
 * shoot through, interior walls, and stairs on two-storey houses. All boxes of
 * one material are merged into a single mesh, so the whole map costs ~6 draw calls.
 */

type MatKey = "plaster" | "brick" | "concrete" | "floor" | "wood" | "roof";

interface Opening {
  u0: number;
  u1: number;
  v0: number;
  v1: number;
}

const FLOOR_H = 3.2;
const WALL_T = 0.25;
const SLAB_T = 0.22;
const BASE_Y = 0.25;
/** Ground-floor slab sits this much above the foundation top. */
const FLOOR_LIFT = 0.015;

const PLASTER_TINTS = ["#efe6d2", "#f2dcae", "#d9e3e6", "#eac3a6", "#f4f0e8", "#d8c9b0", "#cfd8c4", "#e9d5c9"];
const NEUTRAL_TINTS = ["#ffffff", "#f0ebe4", "#e5e0da", "#d9d4cf"];

class GeoBuffer {
  positions: number[] = [];
  normals: number[] = [];
  uvs: number[] = [];
  colors: number[] = [];
  indices: number[] = [];

  toGeometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.positions, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(this.normals, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(this.uvs, 2));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.colors, 3));
    g.setIndex(this.indices);
    g.computeBoundingSphere();
    return g;
  }
}

const FACES: Array<{ n: [number, number, number]; u: [number, number, number]; v: [number, number, number] }> = [
  { n: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0] },
  { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },
  { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1] },
  { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1] },
  { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] },
  { n: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0] },
];

export interface LootSpot {
  x: number;
  y: number;
  z: number;
}

export class Buildings {
  readonly lootSpots: LootSpot[] = [];
  readonly group = new THREE.Group();
  private buffers = new Map<MatKey, GeoBuffer>();
  private tmpV = new THREE.Vector3();
  private tmpN = new THREE.Vector3();

  constructor(
    private map: MapLayout,
    private terrain: Terrain,
    private physics: Physics,
  ) {}

  async build(loader: THREE.TextureLoader, anisotropy: number) {
    const rng = mulberry32(99173);
    for (const lot of this.map.lots) this.buildHouse(lot, rng);
    const materials = await this.createMaterials(loader, anisotropy);
    for (const [key, buf] of this.buffers) {
      const mesh = new THREE.Mesh(buf.toGeometry(), materials[key]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.name = `buildings_${key}`;
      this.group.add(mesh);
    }
    this.buffers.clear();
    return this.group;
  }

  private async createMaterials(loader: THREE.TextureLoader, anisotropy: number) {
    const load = async (name: string, srgb: boolean, size: number) => {
      const t = await loader.loadAsync(`${ASSET_ROOT}/textures/${name}.webp`);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.repeat.set(1 / size, 1 / size);
      t.anisotropy = anisotropy;
      return t;
    };
    const make = async (tex: string, size: number, roughness = 1) => {
      const [map, normalMap, roughnessMap] = await Promise.all([
        load(`${tex}_color`, true, size),
        load(`${tex}_normal`, false, size),
        load(`${tex}_rough`, false, size),
      ]);
      return new THREE.MeshStandardMaterial({ map, normalMap, roughnessMap, roughness, vertexColors: true });
    };
    const [plaster, brick, concrete, floor, wood, roof] = await Promise.all([
      make("painted_plaster_wall", 2.4),
      make("brick_wall_02", 2.2),
      make("concrete_wall_008", 3),
      make("concrete_floor_02", 3),
      make("brown_planks_04", 1.6),
      make("concrete_floor_02", 4),
    ]);
    return { plaster, brick, concrete, floor, wood, roof } as Record<MatKey, THREE.Material>;
  }

  private buf(key: MatKey) {
    let b = this.buffers.get(key);
    if (!b) {
      b = new GeoBuffer();
      this.buffers.set(key, b);
    }
    return b;
  }

  /** Axis-aligned box in building space, transformed to world and given a collider. */
  private box(
    m: THREE.Matrix4,
    yaw: number,
    key: MatKey,
    color: THREE.Color,
    cx: number,
    cy: number,
    cz: number,
    w: number,
    h: number,
    d: number,
    collide = true,
  ) {
    const b = this.buf(key);
    const hw = w / 2;
    const hh = h / 2;
    const hd = d / 2;
    const rot = new THREE.Matrix3().setFromMatrix4(m);
    for (const f of FACES) {
      const base = b.positions.length / 3;
      const [nx, ny, nz] = f.n;
      for (let k = 0; k < 4; k++) {
        const su = k === 1 || k === 2 ? 1 : -1;
        const sv = k >= 2 ? 1 : -1;
        const lx = cx + nx * hw + su * f.u[0] * hw + sv * f.v[0] * hw;
        const ly = cy + ny * hh + su * f.u[1] * hh + sv * f.v[1] * hh;
        const lz = cz + nz * hd + su * f.u[2] * hd + sv * f.v[2] * hd;
        this.tmpV.set(lx, ly, lz).applyMatrix4(m);
        b.positions.push(this.tmpV.x, this.tmpV.y, this.tmpV.z);
        this.tmpN.set(nx, ny, nz).applyMatrix3(rot).normalize();
        b.normals.push(this.tmpN.x, this.tmpN.y, this.tmpN.z);
        // Planar UVs in metres along the face's own axes keep texel density constant.
        const uu = lx * f.u[0] + ly * f.u[1] + lz * f.u[2];
        const vv = lx * f.v[0] + ly * f.v[1] + lz * f.v[2];
        b.uvs.push(uu, vv);
        b.colors.push(color.r, color.g, color.b);
      }
      b.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    if (collide) {
      this.tmpV.set(cx, cy, cz).applyMatrix4(m);
      this.physics.addBox(this.tmpV.x, this.tmpV.y, this.tmpV.z, hw, hh, hd, yaw);
    }
  }

  /**
   * A straight wall from (x0,z0) to (x1,z1) in building space with rectangular
   * openings. `u` runs along the wall, `v` up from the wall's base.
   */
  private wall(
    m: THREE.Matrix4,
    yaw: number,
    key: MatKey,
    color: THREE.Color,
    axis: "x" | "z",
    fixed: number,
    from: number,
    to: number,
    y0: number,
    height: number,
    openings: Opening[],
  ) {
    const len = to - from;
    const sorted = [...openings].sort((a, b) => a.u0 - b.u0);
    const piece = (u0: number, u1: number, v0: number, v1: number) => {
      if (u1 - u0 < 0.02 || v1 - v0 < 0.02) return;
      const cu = from + (u0 + u1) / 2;
      const cy = y0 + (v0 + v1) / 2;
      if (axis === "x") this.box(m, yaw, key, color, cu, cy, fixed, u1 - u0, v1 - v0, WALL_T);
      else this.box(m, yaw, key, color, fixed, cy, cu, WALL_T, v1 - v0, u1 - u0);
    };
    let cursor = 0;
    for (const o of sorted) {
      piece(cursor, o.u0, 0, height);
      piece(o.u0, o.u1, 0, o.v0);
      piece(o.u0, o.u1, o.v1, height);
      this.frame(m, yaw, axis, fixed, from, y0, o);
      cursor = o.u1;
    }
    piece(cursor, len, 0, height);
  }

  /** Wooden frame around an opening (visual only). */
  private frame(m: THREE.Matrix4, yaw: number, axis: "x" | "z", fixed: number, from: number, y0: number, o: Opening) {
    const wood = new THREE.Color("#6b4a32");
    const t = 0.08;
    const depth = WALL_T + 0.06;
    // Nudged 1 cm into the opening so the frame's inner faces don't z-fight the wall's edges.
    const e = 0.01;
    const parts: Array<[number, number, number, number]> = [
      [o.u0 - t / 2 + e, (o.v0 + o.v1) / 2, t, o.v1 - o.v0],
      [o.u1 + t / 2 - e, (o.v0 + o.v1) / 2, t, o.v1 - o.v0],
      [(o.u0 + o.u1) / 2, o.v1 + t / 2 - e, o.u1 - o.u0 + t * 2, t],
    ];
    if (o.v0 > 0.05) parts.push([(o.u0 + o.u1) / 2, o.v0 - t / 2 + e, o.u1 - o.u0 + t * 2, t]);
    for (const [u, v, w, h] of parts) {
      if (axis === "x") this.box(m, yaw, "wood", wood, from + u, y0 + v, fixed, w, h, depth, false);
      else this.box(m, yaw, "wood", wood, fixed, y0 + v, from + u, depth, h, w, false);
    }
  }

  private windows(rng: Rng, len: number, avoid?: [number, number]): Opening[] {
    const out: Opening[] = [];
    const count = Math.max(1, Math.floor((len - 1.5) / 3.2));
    const spacing = len / count;
    for (let i = 0; i < count; i++) {
      const c = spacing * (i + 0.5);
      const w = rng() < 0.3 ? 1.6 : 1.1;
      const o = { u0: c - w / 2, u1: c + w / 2, v0: 1.0, v1: 2.25 };
      if (avoid && o.u1 > avoid[0] - 0.4 && o.u0 < avoid[1] + 0.4) continue;
      if (o.u0 < 0.6 || o.u1 > len - 0.6) continue;
      if (rng() < 0.15) continue;
      out.push(o);
    }
    return out;
  }

  private buildHouse(lot: BuildingLot, rng: Rng) {
    const ground = Math.min(
      this.terrain.heightAt(lot.x, lot.z),
      this.terrain.heightAt(lot.x - lot.width / 2, lot.z - lot.depth / 2),
      this.terrain.heightAt(lot.x + lot.width / 2, lot.z - lot.depth / 2),
      this.terrain.heightAt(lot.x - lot.width / 2, lot.z + lot.depth / 2),
      this.terrain.heightAt(lot.x + lot.width / 2, lot.z + lot.depth / 2),
    );
    const m = new THREE.Matrix4().makeRotationY(lot.rotation).setPosition(lot.x, ground, lot.z);
    const yaw = lot.rotation;
    const W = lot.width;
    const D = lot.depth;
    const hx = W / 2;
    const hz = D / 2;
    const wallKey: MatKey = lot.style;
    const tint = new THREE.Color(pick(rng, lot.style === "plaster" ? PLASTER_TINTS : NEUTRAL_TINTS));
    const white = new THREE.Color("#ffffff");
    const floorTint = new THREE.Color(pick(rng, ["#ffffff", "#e8e2da", "#d6d0c8"]));

    // Foundation reaching below ground hides slope gaps.
    this.box(m, yaw, "concrete", new THREE.Color("#bdb8b0"), 0, BASE_Y / 2 - 0.6, 0, W + 0.5, BASE_Y + 1.2, D + 0.5);

    const doorW = 1.3;
    const doorU = W / 2 + (rng() - 0.5) * (W - 4);
    const backDoor = rng() < 0.6;
    const backU = W / 2 + (rng() - 0.5) * (W - 4);
    const hasStairs = lot.floors === 2;
    // Stairwell along the +x wall, rising toward -z.
    const stairW = 1.2;
    const stairLen = 4.2;
    const stairX = hx - WALL_T / 2 - stairW / 2 - 0.05;
    const stairZ0 = hz - WALL_T / 2 - 0.3;

    for (let f = 0; f < lot.floors; f++) {
      const y0 = BASE_Y + f * FLOOR_H;
      const top = f === lot.floors - 1;
      const h = FLOOR_H + (top ? 0.7 : 0); // parapet on the roof
      const front = f === 0 ? [{ u0: doorU - doorW / 2, u1: doorU + doorW / 2, v0: 0, v1: 2.25 }] : [];
      const frontWin = this.windows(rng, W, f === 0 ? [front[0].u0, front[0].u1] : undefined);
      const back = f === 0 && backDoor ? [{ u0: backU - doorW / 2, u1: backU + doorW / 2, v0: 0, v1: 2.25 }] : [];
      const backWin = this.windows(rng, W, back.length ? [back[0].u0, back[0].u1] : undefined);
      // Front (-z) and back (+z) walls run along x; side walls along z sit between them.
      this.wall(m, yaw, wallKey, tint, "x", -hz + WALL_T / 2, -hx, hx, y0, h, [...front, ...frontWin]);
      this.wall(m, yaw, wallKey, tint, "x", hz - WALL_T / 2, -hx, hx, y0, h, [...back, ...backWin]);
      const sideLen = D - WALL_T * 2;
      const sideFrom = -hz + WALL_T;
      this.wall(m, yaw, wallKey, tint, "z", -hx + WALL_T / 2, sideFrom, sideFrom + sideLen, y0, h, this.windows(rng, sideLen));
      const stairSide = hasStairs ? [] : this.windows(rng, sideLen);
      this.wall(m, yaw, wallKey, tint, "z", hx - WALL_T / 2, sideFrom, sideFrom + sideLen, y0, h, stairSide);

      // Interior partition with a doorway in wider houses.
      if (W >= 10) {
        const px = -hx + W * 0.42;
        const gapC = sideLen * (0.3 + rng() * 0.4);
        this.wall(m, yaw, "plaster", new THREE.Color("#f3eee6"), "z", px, sideFrom, sideFrom + sideLen, y0, FLOOR_H - SLAB_T,
          [{ u0: gapC - 0.55, u1: gapC + 0.55, v0: 0, v1: 2.2 }]);
      }

      // Floor of this storey (ground floor slab sits on the foundation). Its top is
      // FLOOR_LIFT above the foundation's: two surfaces at the same height z-fight
      // (the floor flickered and flashed white indoors, worst on phones).
      if (f === 0) {
        this.box(m, yaw, "floor", floorTint, 0, BASE_Y - 0.05 + FLOOR_LIFT, 0, W - 0.05, 0.1, D - 0.05);
      }
      this.lootSpotsFor(lot, m, y0, hasStairs, rng);
    }

    // Upper slabs: the first-floor slab leaves a stairwell opening.
    for (let f = 1; f <= lot.floors; f++) {
      const y = BASE_Y + f * FLOOR_H - SLAB_T / 2;
      const isRoof = f === lot.floors;
      const key: MatKey = isRoof ? "roof" : "floor";
      if (!isRoof && hasStairs) {
        const holeX0 = stairX - stairW / 2 - 0.05;
        const holeZ0 = stairZ0 - stairLen - 0.2;
        // Slab minus the stairwell rectangle (+x, +z corner strip).
        // Slabs stop at the inner wall faces so their edges don't stripe the facade.
        const ix = hx - WALL_T;
        const iz = hz - WALL_T;
        this.box(m, yaw, key, floorTint, (-ix + holeX0) / 2, y, 0, holeX0 + ix, SLAB_T, iz * 2);
        this.box(m, yaw, key, floorTint, (holeX0 + ix) / 2, y, (-iz + holeZ0) / 2, ix - holeX0, SLAB_T, holeZ0 + iz);
      } else {
        this.box(m, yaw, key, isRoof ? white : floorTint, 0, y, 0, W - WALL_T * 2, SLAB_T, D - WALL_T * 2);
      }
    }

    if (hasStairs) {
      const steps = 16;
      const rise = FLOOR_H / steps;
      const run = stairLen / steps;
      for (let s = 0; s < steps; s++) {
        const top = BASE_Y + rise * (s + 1);
        const z = stairZ0 - run * (s + 0.5);
        this.box(m, yaw, "concrete", new THREE.Color("#c9c4bc"), stairX, (BASE_Y + top) / 2, z, stairW, top - BASE_Y, run);
      }
    }
  }

  private lootSpotsFor(lot: BuildingLot, m: THREE.Matrix4, y0: number, hasStairs: boolean, rng: Rng) {
    const count = 1 + Math.floor(rng() * 3);
    for (let i = 0; i < count; i++) {
      const lx = (rng() - 0.5) * (lot.width - 2.4);
      const lz = (rng() - 0.5) * (lot.depth - 2.4);
      if (hasStairs && lx > lot.width / 2 - 2.2) continue;
      const p = new THREE.Vector3(lx, y0 + 0.02, lz).applyMatrix4(m);
      this.lootSpots.push({ x: p.x, y: p.y, z: p.z });
    }
  }
}
