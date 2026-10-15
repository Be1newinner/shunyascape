import * as THREE from "three/webgpu";
import { positionLocal, positionGeometry, time, sin, cos, vec3, uv, vertexColor, normalViewGeometry, texture, fwidth } from "three/tsl";
import { MAP_HALF, type QualityPreset } from "./config";
import { TREE_TYPES, type Assets, type TreeType } from "./Assets";
import type { MapLayout } from "./MapGen";
import { mulberry32, range } from "./noise";
import type { Physics } from "./Physics";
import type { Terrain } from "./Terrain";

interface TreeInstance {
  type: TreeType;
  matrix: THREE.Matrix4;
  x: number;
  z: number;
}

interface TreeMeshes {
  near: THREE.InstancedMesh[];
  far: THREE.InstancedMesh[];
  instances: TreeInstance[];
}

/**
 * Copy of a geometry with float attributes. Compressed GLBs store positions as
 * normalized integers; transforming those in place would clamp them to +-1.
 */
function dequantize(src: THREE.BufferGeometry) {
  const geo = new THREE.BufferGeometry();
  for (const [name, attr] of Object.entries(src.attributes)) {
    const a = attr as THREE.BufferAttribute;
    const out = new Float32Array(a.count * a.itemSize);
    for (let i = 0; i < a.count; i++) {
      for (let c = 0; c < a.itemSize; c++) out[i * a.itemSize + c] = a.getComponent(i, c);
    }
    geo.setAttribute(name, new THREE.BufferAttribute(out, a.itemSize));
  }
  if (src.index) geo.setIndex(src.index.clone());
  return geo;
}

/** Leaves sway with height in the tree; instancing has already placed vertices in world space. */
function leafMaterial(src: THREE.MeshStandardMaterial) {
  const mat = new THREE.MeshStandardNodeMaterial({
    side: THREE.DoubleSide,
    roughness: 0.82,
    metalness: 0,
    alphaTest: 0.5,
  });
  // Alpha sharpening: rescale alpha by its screen-space rate of change so leaf
  // cards stay solid in the small mip levels instead of fading to bare branches.
  const tex = texture(src.map!, uv());
  mat.colorNode = tex.rgb;
  mat.opacityNode = tex.a.sub(0.4).div(fwidth(tex.a).max(0.0001)).add(0.5).clamp(0, 1);
  const h = positionGeometry.y.max(0);
  const phase = positionLocal.x.mul(0.21).add(positionLocal.z.mul(0.17));
  const sway = sin(time.mul(1.3).add(phase)).mul(0.035).add(sin(time.mul(3.1).add(phase.mul(3.0))).mul(0.012));
  mat.positionNode = positionLocal.add(vec3(sway, 0, sway.mul(0.7)).mul(h.mul(0.12)));
  return mat;
}

function barkMaterial(src: THREE.MeshStandardMaterial) {
  return new THREE.MeshStandardMaterial({ map: src.map, normalMap: src.normalMap, roughness: 0.95, metalness: 0 });
}

export class Vegetation {
  readonly group = new THREE.Group();
  private trees = new Map<TreeType, TreeMeshes>();
  private lodTimer = 0;
  private grass!: GrassField;

  constructor(
    private assets: Assets,
    private map: MapLayout,
    private terrain: Terrain,
    private physics: Physics,
    private quality: QualityPreset,
  ) {}

  build() {
    const placements = this.scatterTrees();
    for (const type of TREE_TYPES) {
      const instances = placements.filter((p) => p.type === type);
      if (!instances.length) continue;
      const near = this.instanced(type, "lod0", instances.length, true);
      const far = this.instanced(type, "lod1", instances.length, false, near);
      this.trees.set(type, { near, far, instances });
      for (const m of [...near, ...far]) this.group.add(m);
    }
    this.grass = new GrassField(this.terrain, this.map, this.quality);
    this.group.add(this.grass.group);
    return this.group;
  }

  private instanced(type: TreeType, lod: string, capacity: number, shadows: boolean, reuse?: THREE.InstancedMesh[]) {
    // Far trees: simplified bark from lod1, but full (sparser) leaf cards from lod1l,
    // since simplifying leaf cards shreds them.
    const sources = lod === "lod1" ? [`tree_${type}_lod1`, `tree_${type}_lod1l`] : [`tree_${type}_${lod}`];
    const meshes: THREE.InstancedMesh[] = [];
    for (const key of sources) {
      const scene = this.assets.get(key).scene;
      scene.updateMatrixWorld(true);
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const src = mesh.material as THREE.MeshStandardMaterial;
        const isLeaf = src.name === "leaves";
        if (lod === "lod1" && isLeaf !== key.endsWith("lod1l")) return;
        // LOD1 files ship without textures; borrow the near-LOD material.
        const shared = reuse?.find((m) => m.userData.leaf === isLeaf)?.material as THREE.Material | undefined;
        const material = shared ?? (isLeaf ? leafMaterial(src) : barkMaterial(src));
        const geo = dequantize(mesh.geometry);
        geo.applyMatrix4(mesh.matrixWorld);
        const im = new THREE.InstancedMesh(geo, material, capacity);
        im.count = 0;
        im.frustumCulled = false;
        im.castShadow = shadows;
        im.receiveShadow = true;
        im.userData.leaf = isLeaf;
        meshes.push(im);
      });
    }
    return meshes;
  }

  private scatterTrees(): TreeInstance[] {
    const rng = mulberry32(4242);
    const out: TreeInstance[] = [];
    const spacing = 7.5;
    for (let z = -MAP_HALF + 12; z < MAP_HALF - 12; z += spacing) {
      for (let x = -MAP_HALF + 12; x < MAP_HALF - 12; x += spacing) {
        const px = x + range(rng, -3, 3);
        const pz = z + range(rng, -3, 3);
        const forest = this.map.forestDensity(px, pz);
        const roll = rng();
        const bushRoll = rng();
        if (this.map.roadInfluence(px, pz) > 0.05 || this.map.insideLot(px, pz, 3)) continue;
        const slope = this.terrain.normalAt(px, pz).y;
        if (slope < 0.8) continue;
        let type: TreeType | null = null;
        if (roll < forest * 0.75 + 0.012) {
          const t = rng();
          type =
            forest > 0.55
              ? t < 0.45
                ? "pine_a"
                : t < 0.8
                  ? "pine_b"
                  : "ash_a"
              : t < 0.35
                ? "oak_a"
                : t < 0.6
                  ? "aspen_a"
                  : t < 0.8
                    ? "ash_a"
                    : "pine_b";
        } else if (bushRoll < 0.05 + forest * 0.2) {
          type = rng() < 0.5 ? "bush_a" : "bush_b";
        }
        if (!type) continue;
        const scale = range(rng, 0.8, 1.25);
        const y = this.terrain.heightAt(px, pz) - 0.15;
        const matrix = new THREE.Matrix4().compose(
          new THREE.Vector3(px, y, pz),
          new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rng() * Math.PI * 2),
          new THREE.Vector3(scale, scale * range(rng, 0.9, 1.1), scale),
        );
        out.push({ type, matrix, x: px, z: pz });
        if (!type.startsWith("bush")) {
          this.physics.addCylinder(px, y + 2.5, pz, 2.5, 0.28 * scale + 0.05);
        }
      }
    }
    return out;
  }

  /** Swap trees between detailed and simple meshes by distance; move grass with the player. */
  update(dt: number, viewer: THREE.Vector3) {
    this.grass.update(viewer);
    this.lodTimer -= dt;
    if (this.lodTimer > 0) return;
    this.lodTimer = 0.35;
    const nearD2 = this.quality.treeLodDistance ** 2;
    const farD2 = (this.quality.fogFar * 0.95) ** 2;
    for (const t of this.trees.values()) {
      let n = 0;
      let f = 0;
      for (const inst of t.instances) {
        const d2 = (inst.x - viewer.x) ** 2 + (inst.z - viewer.z) ** 2;
        if (d2 < nearD2) {
          for (const m of t.near) m.setMatrixAt(n, inst.matrix);
          n++;
        } else if (d2 < farD2) {
          for (const m of t.far) m.setMatrixAt(f, inst.matrix);
          f++;
        }
      }
      for (const m of t.near) {
        m.count = n;
        m.instanceMatrix.needsUpdate = true;
      }
      for (const m of t.far) {
        m.count = f;
        m.instanceMatrix.needsUpdate = true;
      }
    }
  }
}

/** Paints a tuft of grass blades on a canvas: used as an alpha-tested card texture. */
function grassTuftTexture() {
  const W = 256;
  const H = 256;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  const rng = mulberry32(911);
  for (let i = 0; i < 70; i++) {
    const x = W * (0.08 + rng() * 0.84);
    const h = H * (0.45 + rng() * 0.53);
    const lean = (rng() - 0.5) * W * 0.35;
    const w = 3 + rng() * 5;
    const hue = 70 + rng() * 30;
    const light = 18 + rng() * 16;
    const grad = g.createLinearGradient(0, H, 0, H - h);
    grad.addColorStop(0, `hsl(${hue}, 45%, ${light * 0.45}%)`);
    grad.addColorStop(0.55, `hsl(${hue}, 50%, ${light}%)`);
    grad.addColorStop(1, `hsl(${hue - 12}, 55%, ${light + 14}%)`);
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(x - w, H);
    g.quadraticCurveTo(x - w * 0.6 + lean * 0.3, H - h * 0.6, x + lean, H - h);
    g.quadraticCurveTo(x + w * 0.6 + lean * 0.3, H - h * 0.6, x + w, H);
    g.closePath();
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

/** Chunks of grass tufts (three crossed cards each) rebuilt around the player as they move. */
class GrassField {
  readonly group = new THREE.Group();
  private chunkSize = 12;
  private chunks = new Map<string, THREE.Mesh>();
  private pool: THREE.Mesh[] = [];
  private material: THREE.MeshStandardNodeMaterial;
  private pending: Array<[number, number]> = [];

  constructor(
    private terrain: Terrain,
    private map: MapLayout,
    private quality: QualityPreset,
  ) {
    const tuft = grassTuftTexture();
    const mat = new THREE.MeshStandardNodeMaterial({ side: THREE.DoubleSide, roughness: 0.92, metalness: 0, alphaTest: 0.45 });
    mat.alphaToCoverage = true;
    const v = uv().y;
    const tex = texture(tuft, uv());
    mat.colorNode = tex.rgb.mul(vertexColor()).mul(1.2);
    mat.opacityNode = tex.a;
    // Cards share the ground normal on both faces so they light like the turf under them.
    mat.normalNode = normalViewGeometry;
    const p = positionLocal;
    const gust = sin(time.mul(0.7).add(p.x.mul(0.035)).add(p.z.mul(0.02)))
      .mul(0.5)
      .add(0.6);
    const wave = sin(time.mul(2.2).add(p.x.mul(0.45)).add(p.z.mul(0.3)));
    const bend = v.mul(v).mul(gust).mul(0.12);
    mat.positionNode = p.add(
      vec3(
        wave.mul(bend),
        0,
        cos(time.mul(1.7).add(p.z.mul(0.4)))
          .mul(bend)
          .mul(0.6),
      ),
    );
    this.material = mat;
  }

  update(viewer: THREE.Vector3) {
    const cs = this.chunkSize;
    const cx = Math.floor(viewer.x / cs);
    const cz = Math.floor(viewer.z / cs);
    const r = this.quality.grassRadius;
    const wanted = new Set<string>();
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dz * dz > r * r + 1) continue;
        wanted.add(`${cx + dx},${cz + dz}`);
      }
    }
    for (const [key, mesh] of this.chunks) {
      if (!wanted.has(key)) {
        this.group.remove(mesh);
        this.pool.push(mesh);
        this.chunks.delete(key);
      }
    }
    this.pending = [];
    for (const key of wanted) {
      if (!this.chunks.has(key)) {
        const [x, z] = key.split(",").map(Number);
        this.pending.push([x, z]);
      }
    }
    // Nearest chunks first, a couple per frame to avoid hitches.
    this.pending.sort((a, b) => Math.hypot(a[0] - cx, a[1] - cz) - Math.hypot(b[0] - cx, b[1] - cz));
    for (const [x, z] of this.pending.slice(0, 2)) this.buildChunk(x, z);
  }

  private buildChunk(ix: number, iz: number) {
    const key = `${ix},${iz}`;
    const cs = this.chunkSize;
    const count = this.quality.grassPerChunk;
    const rng = mulberry32((ix * 73856093) ^ (iz * 19349663));
    const CARDS = 3;
    const vertsPer = CARDS * 4;
    const pos = new Float32Array(count * vertsPer * 3);
    const uvs = new Float32Array(count * vertsPer * 2);
    const col = new Float32Array(count * vertsPer * 3);
    const nrm = new Float32Array(count * vertsPer * 3);
    const idx: number[] = [];
    let tufts = 0;
    const c = new THREE.Color();
    for (let b = 0; b < count; b++) {
      const x = (ix + rng()) * cs;
      const z = (iz + rng()) * cs;
      const s = this.terrain.surfaceAt(x, z);
      if (s.road > 0.25 || rng() < s.dirt * 0.9) continue;
      // Patchy meadow: mostly full, thinning out in noisy blotches.
      const patch = this.map.detail.noise(x / 11, z / 11);
      if (rng() > 0.2 + 0.8 * Math.min(1, Math.max(0, (patch + 0.45) / 0.7))) continue;
      if (Math.abs(x) > MAP_HALF - 2 || Math.abs(z) > MAP_HALF - 2) continue;
      if (this.map.insideLot(x, z, 0.6)) continue;
      const n = this.terrain.normalAt(x, z);
      if (n.y < 0.86) continue;
      const y = this.terrain.heightAt(x, z) - 0.03;
      const h = range(rng, 0.22, 0.5) * (rng() < 0.1 ? 1.6 : 1);
      const w = h * range(rng, 1.1, 1.5);
      const yaw0 = rng() * Math.PI;
      // Slightly dry or lush per tuft.
      c.setRGB(range(rng, 0.8, 1.15), range(rng, 0.85, 1.05), range(rng, 0.55, 0.85));
      const flip = rng() < 0.5 ? 1 : 0;
      for (let k = 0; k < CARDS; k++) {
        const yaw = yaw0 + (k * Math.PI) / CARDS;
        const dx = Math.cos(yaw) * w * 0.5;
        const dz = Math.sin(yaw) * w * 0.5;
        const base = tufts * vertsPer + k * 4;
        const corners: Array<[number, number, number, number, number]> = [
          [x - dx, y, z - dz, flip, 0],
          [x + dx, y, z + dz, 1 - flip, 0],
          [x + dx, y + h, z + dz, 1 - flip, 1],
          [x - dx, y + h, z - dz, flip, 1],
        ];
        corners.forEach(([px, py, pz, u, vv], i) => {
          const vi = base + i;
          pos[vi * 3] = px;
          pos[vi * 3 + 1] = py;
          pos[vi * 3 + 2] = pz;
          uvs[vi * 2] = u;
          uvs[vi * 2 + 1] = vv;
          col[vi * 3] = c.r;
          col[vi * 3 + 1] = c.g;
          col[vi * 3 + 2] = c.b;
          nrm[vi * 3] = n.x;
          nrm[vi * 3 + 1] = n.y;
          nrm[vi * 3 + 2] = n.z;
        });
        idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
      tufts++;
    }
    let mesh = this.pool.pop();
    const used = tufts * vertsPer;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos.subarray(0, used * 3), 3));
    g.setAttribute("uv", new THREE.BufferAttribute(uvs.subarray(0, used * 2), 2));
    g.setAttribute("color", new THREE.BufferAttribute(col.subarray(0, used * 3), 3));
    g.setAttribute("normal", new THREE.BufferAttribute(nrm.subarray(0, used * 3), 3));
    g.setIndex(idx);
    g.computeBoundingSphere();
    if (mesh) {
      mesh.geometry.dispose();
      mesh.geometry = g;
    } else {
      mesh = new THREE.Mesh(g, this.material);
      mesh.receiveShadow = true;
      mesh.castShadow = false;
    }
    this.chunks.set(key, mesh);
    this.group.add(mesh);
  }
}
