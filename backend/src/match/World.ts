import RAPIER from "@dimforge/rapier3d-compat";
import worldData from "./world.json";

/**
 * The battleground's collision world on the server: terrain heights plus every
 * wall, floor, prop and tree trunk, exported from the client's map generator
 * (see `exportCollisionWorld()` in the frontend's engine/Game.ts).
 */

export interface WorldData {
  mapSize: number;
  segments: number;
  heights: string;
  boxes: number[][];
  cylinders: number[][];
  sites: Array<{ name: string; x: number; z: number; radius: number }>;
  open: number[][];
}

const data = worldData as WorldData;
const N = data.segments + 1;
const HALF = data.mapSize / 2;
const STEP = data.mapSize / data.segments;

/** Terrain heights (metres), decoded once. */
export const heights = (() => {
  const bytes = Buffer.from(data.heights, "base64");
  const q = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.length / 2);
  const out = new Float32Array(q.length);
  for (let i = 0; i < q.length; i++) out[i] = q[i] / 20;
  return out;
})();

export const sites = data.sites;
export const openPoints = data.open;

/** Height under (x, z), interpolated on the same triangles the client renders. */
export function heightAt(x: number, z: number) {
  const fx = (x + HALF) / STEP;
  const fz = (z + HALF) / STEP;
  const i = Math.min(data.segments - 1, Math.max(0, Math.floor(fx)));
  const j = Math.min(data.segments - 1, Math.max(0, Math.floor(fz)));
  const tx = Math.min(1, Math.max(0, fx - i));
  const tz = Math.min(1, Math.max(0, fz - j));
  const h00 = heights[j * N + i];
  const h10 = heights[j * N + i + 1];
  const h01 = heights[(j + 1) * N + i];
  const h11 = heights[(j + 1) * N + i + 1];
  if (tx + tz < 1) return h00 + (h10 - h00) * tx + (h01 - h00) * tz;
  return h11 + (h01 - h11) * (1 - tx) + (h10 - h11) * (1 - tz);
}

let ready: Promise<void> | null = null;
export function initPhysics() {
  ready ??= RAPIER.init();
  return ready;
}

export const WORLD_GROUP = (0x1 << 16) | 0xffff;
export const BOT_GROUP = (0x4 << 16) | 0x1; // bots only collide with the world

/** A fresh Rapier world with the static battleground in it (one per match). */
export function createWorld() {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const verts = new Float32Array(N * N * 3);
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const k = j * N + i;
      verts[k * 3] = -HALF + i * STEP;
      verts[k * 3 + 1] = heights[k];
      verts[k * 3 + 2] = -HALF + j * STEP;
    }
  }
  const idx = new Uint32Array(data.segments * data.segments * 6);
  let p = 0;
  for (let j = 0; j < data.segments; j++) {
    for (let i = 0; i < data.segments; i++) {
      const a = j * N + i;
      const b = a + 1;
      const c = a + N;
      const d = c + 1;
      idx[p++] = a; idx[p++] = c; idx[p++] = b;
      idx[p++] = c; idx[p++] = d; idx[p++] = b;
    }
  }
  world.createCollider(RAPIER.ColliderDesc.trimesh(verts, idx).setCollisionGroups(WORLD_GROUP));
  for (const [x, y, z, hx, hy, hz, yaw] of data.boxes) {
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(hx, hy, hz)
        .setTranslation(x, y, z)
        .setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) })
        .setCollisionGroups(WORLD_GROUP),
    );
  }
  for (const [x, y, z, hh, r] of data.cylinders) {
    world.createCollider(RAPIER.ColliderDesc.cylinder(hh, r).setTranslation(x, y, z).setCollisionGroups(WORLD_GROUP));
  }
  return world;
}

export { RAPIER };
