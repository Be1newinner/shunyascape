import * as THREE from "three/webgpu";
import { texture, uv, normalWorld, mix, smoothstep, vec2, vec3, float, normalMap, positionWorld, abs } from "three/tsl";
import { ASSET_ROOT, MAP_HALF, MAP_SIZE, TERRAIN_SEGMENTS } from "./config";
import type { MapLayout } from "./MapGen";

const MASK_RES = 512;

/**
 * Heightfield ground with PBR texture splatting (grass / dirt / road / rock).
 * Heights are sampled once into a grid; `heightAt` interpolates the exact
 * triangles that are rendered and handed to physics, so feet never float.
 */
export class Terrain {
  readonly segments = TERRAIN_SEGMENTS;
  readonly step = MAP_SIZE / TERRAIN_SEGMENTS;
  readonly heights: Float32Array;
  /** Road (r) and dirt (g) coverage, 0..255, row-major in z. */
  readonly mask: Uint8Array;
  mesh!: THREE.Mesh;

  constructor(private map: MapLayout) {
    const n = this.segments + 1;
    this.heights = new Float32Array(n * n);
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        this.heights[j * n + i] = map.height(-MAP_HALF + i * this.step, -MAP_HALF + j * this.step);
      }
    }
    this.mask = new Uint8Array(MASK_RES * MASK_RES * 4);
    const cell = MAP_SIZE / MASK_RES;
    for (let j = 0; j < MASK_RES; j++) {
      for (let i = 0; i < MASK_RES; i++) {
        const x = -MAP_HALF + (i + 0.5) * cell;
        const z = -MAP_HALF + (j + 0.5) * cell;
        const o = (j * MASK_RES + i) * 4;
        this.mask[o] = Math.round(map.roadInfluence(x, z) * 255);
        this.mask[o + 1] = Math.round(map.dirtInfluence(x, z) * 255);
        this.mask[o + 2] = 0;
        this.mask[o + 3] = 255;
      }
    }
  }

  heightAt(x: number, z: number): number {
    const fx = (x + MAP_HALF) / this.step;
    const fz = (z + MAP_HALF) / this.step;
    const i = Math.min(this.segments - 1, Math.max(0, Math.floor(fx)));
    const j = Math.min(this.segments - 1, Math.max(0, Math.floor(fz)));
    const tx = Math.min(1, Math.max(0, fx - i));
    const tz = Math.min(1, Math.max(0, fz - j));
    const n = this.segments + 1;
    const h00 = this.heights[j * n + i];
    const h10 = this.heights[j * n + i + 1];
    const h01 = this.heights[(j + 1) * n + i];
    const h11 = this.heights[(j + 1) * n + i + 1];
    // Same diagonal split as the index buffer below.
    if (tx + tz < 1) return h00 + (h10 - h00) * tx + (h01 - h00) * tz;
    return h11 + (h01 - h11) * (1 - tx) + (h10 - h11) * (1 - tz);
  }

  normalAt(x: number, z: number, out = new THREE.Vector3()) {
    const e = 0.5;
    const hx = this.heightAt(x + e, z) - this.heightAt(x - e, z);
    const hz = this.heightAt(x, z + e) - this.heightAt(x, z - e);
    return out.set(-hx, 2 * e, -hz).normalize();
  }

  /** Road / dirt coverage at a point, 0..1. */
  surfaceAt(x: number, z: number): { road: number; dirt: number } {
    const i = Math.min(MASK_RES - 1, Math.max(0, Math.floor(((x + MAP_HALF) / MAP_SIZE) * MASK_RES)));
    const j = Math.min(MASK_RES - 1, Math.max(0, Math.floor(((z + MAP_HALF) / MAP_SIZE) * MASK_RES)));
    const o = (j * MASK_RES + i) * 4;
    return { road: this.mask[o] / 255, dirt: this.mask[o + 1] / 255 };
  }

  /** Vertices and indices for the physics trimesh (identical to the render mesh). */
  buildGeometry(): THREE.BufferGeometry {
    const n = this.segments + 1;
    const positions = new Float32Array(n * n * 3);
    const uvs = new Float32Array(n * n * 2);
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const k = j * n + i;
        const x = -MAP_HALF + i * this.step;
        const z = -MAP_HALF + j * this.step;
        positions[k * 3] = x;
        positions[k * 3 + 1] = this.heights[k];
        positions[k * 3 + 2] = z;
        // UVs in metres: every texture layer shares one tangent frame.
        uvs[k * 2] = x;
        uvs[k * 2 + 1] = z;
      }
    }
    const indices = new Uint32Array(this.segments * this.segments * 6);
    let p = 0;
    for (let j = 0; j < this.segments; j++) {
      for (let i = 0; i < this.segments; i++) {
        const a = j * n + i;
        const b = a + 1;
        const c = a + n;
        const d = c + 1;
        indices[p++] = a; indices[p++] = c; indices[p++] = b;
        indices[p++] = c; indices[p++] = d; indices[p++] = b;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    g.setIndex(new THREE.BufferAttribute(indices, 1));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }

  async createMesh(loader: THREE.TextureLoader, anisotropy: number): Promise<THREE.Mesh> {
    const load = async (name: string, srgb: boolean) => {
      const t = await loader.loadAsync(`${ASSET_ROOT}/textures/${name}.webp`);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.anisotropy = anisotropy;
      return t;
    };
    const [grassC, grassN, dirtC, dirtN, rockC, rockN, roadC, roadN] = await Promise.all([
      load("leafy_grass_color", true), load("leafy_grass_normal", false),
      load("forrest_ground_01_color", true), load("forrest_ground_01_normal", false),
      load("aerial_rocks_02_color", true), load("aerial_rocks_02_normal", false),
      load("gravel_road_color", true), load("gravel_road_normal", false),
    ]);

    const maskTex = new THREE.DataTexture(this.mask, MASK_RES, MASK_RES, THREE.RGBAFormat);
    maskTex.magFilter = THREE.LinearFilter;
    maskTex.minFilter = THREE.LinearFilter;
    maskTex.needsUpdate = true;

    const w = uv(); // metres
    const maskUv = w.div(MAP_SIZE).add(0.5);
    const m = texture(maskTex, maskUv);
    const roadW = smoothstep(0.15, 0.6, m.r);
    // Two scales of grass hide the tile repeat at a distance.
    const grassUvA = w.div(3.2);
    const grassUvB = w.div(13.0).add(vec2(0.37, 0.71));
    const macro = texture(grassC, w.div(97.0)).g; // large-scale tint variation
    // The scanned grass is late-summer dry; push it toward a lusher green.
    const grassCol = mix(texture(grassC, grassUvA), texture(grassC, grassUvB), 0.4).rgb.mul(macro.mul(0.5).add(0.72)).mul(vec3(0.78, 1.0, 0.55));
    const dirtUv = w.div(4.0);
    const rockUv = w.div(9.0);
    const roadUv = w.div(4.5);
    const slope = float(1).sub(normalWorld.y);
    const rockW = smoothstep(0.16, 0.34, slope);
    const dirtW = smoothstep(0.25, 0.85, m.g);

    // Rock is projected from three axes (triplanar) so cliffs don't smear.
    const wp = positionWorld.div(9.0);
    const an = abs(normalWorld);
    const blend = an.mul(an).mul(an).mul(an);
    const bw = blend.div(blend.x.add(blend.y).add(blend.z));
    const tri = (tex: THREE.Texture) =>
      texture(tex, wp.zy).mul(bw.x).add(texture(tex, rockUv).mul(bw.y)).add(texture(tex, wp.xy).mul(bw.z));

    let color = mix(grassCol, texture(dirtC, dirtUv).rgb, dirtW);
    color = mix(color, texture(roadC, roadUv).rgb, roadW);
    color = mix(color, tri(rockC).rgb, rockW);

    let nrm = mix(texture(grassN, grassUvA), texture(dirtN, dirtUv), dirtW);
    nrm = mix(nrm, texture(roadN, roadUv), roadW);
    nrm = mix(nrm, tri(rockN), rockW);

    const mat = new THREE.MeshStandardNodeMaterial();
    mat.colorNode = color;
    mat.normalNode = normalMap(nrm.rgb, vec2(1.0, 1.0));
    mat.roughnessNode = mix(float(0.96), float(0.88), roadW);
    mat.metalnessNode = float(0);

    this.mesh = new THREE.Mesh(this.buildGeometry(), mat);
    this.mesh.receiveShadow = true;
    this.mesh.name = "terrain";
    return this.mesh;
  }
}
