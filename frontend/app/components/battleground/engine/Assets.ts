import * as THREE from "three/webgpu";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { ASSET_ROOT } from "./config";

/** All GLB files the battleground loads, with what they're for. */
export const MODEL_FILES = {
  soldier: "models/soldier.glb",
  kar98k: "models/bolt_action_rifle_7_62.glb",
  p92: "models/service_pistol.glb",
  ammoBox: "models/ammo_box.glb",
  medkit: "models/medical_box.glb",
  crateWood: "models/wooden_military_crate.glb",
  crateOld: "models/old_military_crate.glb",
  barrier: "models/concrete_road_barrier.glb",
  car: "models/covered_car.glb",
  barrel1: "models/Barrel_01.glb",
  barrel2: "models/barrel_03.glb",
  tyre: "models/old_tyre.glb",
  jerrycan: "models/metal_jerrycan_green.glb",
  propane: "models/propane_tank.glb",
  rocks: "models/rock_moss_set_01.glb",
  boulder: "models/namaqualand_boulder_02.glb",
  log: "models/dead_tree_trunk.glb",
} as const;

export const TREE_TYPES = ["pine_a", "pine_b", "oak_a", "ash_a", "aspen_a", "bush_a", "bush_b"] as const;
export type TreeType = (typeof TREE_TYPES)[number];

export type ModelKey = keyof typeof MODEL_FILES;

export class Assets {
  readonly gltf = new GLTFLoader();
  readonly textures = new THREE.TextureLoader();
  readonly models = new Map<string, GLTF>();
  private loaded = 0;
  private total = 0;

  constructor(private onProgress: (fraction: number, label: string) => void) {
    this.gltf.setMeshoptDecoder(MeshoptDecoder);
  }

  private async loadOne(key: string, file: string) {
    const g = await this.gltf.loadAsync(`${ASSET_ROOT}/${file}`);
    this.models.set(key, g);
    this.loaded++;
    this.onProgress(this.loaded / this.total, key);
  }

  async loadAll() {
    const jobs: Array<[string, string]> = Object.entries(MODEL_FILES);
    for (const t of TREE_TYPES) {
      jobs.push([`tree_${t}_lod0`, `trees/tree_${t}_lod0.glb`]);
      jobs.push([`tree_${t}_lod1`, `trees/tree_${t}_lod1.glb`]);
      jobs.push([`tree_${t}_lod1l`, `trees/tree_${t}_lod1l.glb`]);
    }
    this.total = jobs.length;
    await MeshoptDecoder.ready;
    // A few at a time keeps the loading bar moving without flooding the network.
    const queue = [...jobs];
    const workers = Array.from({ length: 6 }, async () => {
      while (queue.length) {
        const [k, f] = queue.shift()!;
        await this.loadOne(k, f);
      }
    });
    await Promise.all(workers);
  }

  get(key: string): GLTF {
    const g = this.models.get(key);
    if (!g) throw new Error(`Model not loaded: ${key}`);
    return g;
  }

  /**
   * A fresh copy of a static model, scaled so its largest dimension (or a given
   * axis) matches `size` metres, resting on y=0 and centred on x/z.
   */
  instance(key: ModelKey, size: number, axis: "max" | "x" | "y" | "z" = "max"): THREE.Group {
    const src = this.get(key).scene;
    const obj = src.clone(true);
    const box = new THREE.Box3().setFromObject(obj);
    const dim = box.getSize(new THREE.Vector3());
    const ref = axis === "max" ? Math.max(dim.x, dim.y, dim.z) : dim[axis];
    const s = size / ref;
    const wrap = new THREE.Group();
    obj.scale.multiplyScalar(s);
    const c = box.getCenter(new THREE.Vector3());
    obj.position.set(-c.x * s, -box.min.y * s, -c.z * s);
    wrap.add(obj);
    wrap.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
    return wrap;
  }
}
