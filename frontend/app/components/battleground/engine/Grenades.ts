import * as THREE from "three/webgpu";
import type { Assets } from "./Assets";
import { GRENADE } from "./config";
import { LAYER, type Physics } from "./Physics";

/**
 * Frag grenades in flight: a thrown arc that bounces off walls and the ground,
 * rolls to a stop and bursts when its fuse runs out. Grenades thrown by
 * other players fly the same arc here but burst where the server says.
 */

const GRAVITY = 13;

export interface LiveGrenade {
  id: number;
  owner: string;
  /** Ours: we time the fuse and report the burst. Others' burst on the server's word. */
  local: boolean;
  object: THREE.Object3D;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  fuse: number;
  resting: boolean;
  spin: THREE.Vector3;
}

export class Grenades {
  readonly group = new THREE.Group();
  readonly live = new Map<number, LiveGrenade>();
  private nextId = 1;
  private tmp = new THREE.Vector3();

  constructor(private assets: Assets, private physics: Physics) {}

  /** Throw from `origin` along `dir` (a little upward lob is added). */
  throw(owner: string, origin: THREE.Vector3, velocity: THREE.Vector3, local: boolean, fuse: number = GRENADE.fuse) {
    const object = this.assets.instance("grenade", 0.34);
    object.position.copy(origin);
    this.group.add(object);
    const g: LiveGrenade = {
      id: this.nextId++,
      owner,
      local,
      object,
      position: origin.clone(),
      velocity: velocity.clone(),
      fuse,
      resting: false,
      spin: new THREE.Vector3(Math.random() * 12 - 6, Math.random() * 6, Math.random() * 12 - 6),
    };
    this.live.set(g.id, g);
    return g;
  }

  /** Throw velocity for a soldier looking along `dir`. */
  static launch(dir: THREE.Vector3) {
    const v = dir.clone().normalize();
    v.y += 0.28;
    return v.normalize().multiplyScalar(GRENADE.throwSpeed);
  }

  remove(id: number) {
    const g = this.live.get(id);
    if (!g) return;
    g.object.removeFromParent();
    this.live.delete(id);
  }

  /** The oldest grenade of `owner` still in the air (to pair with the server's burst). */
  latestOf(owner: string) {
    let best: LiveGrenade | null = null;
    for (const g of this.live.values()) if (g.owner === owner && (!best || g.id < best.id)) best = g;
    return best;
  }

  /** Step every grenade. `burst` is called for our own when their fuse runs out. */
  update(dt: number, burst: (g: LiveGrenade) => void) {
    for (const g of [...this.live.values()]) {
      g.fuse -= dt;
      if (g.fuse <= 0 && g.local) {
        this.remove(g.id);
        burst(g);
        continue;
      }
      // Remote grenades whose burst never arrived: tidy up.
      if (g.fuse < -3) {
        this.remove(g.id);
        continue;
      }
      if (g.resting) continue;
      // A few sub-steps so fast grenades don't tunnel through thin walls.
      const steps = 3;
      const h = dt / steps;
      for (let s = 0; s < steps; s++) {
        g.velocity.y -= GRAVITY * h;
        const move = this.tmp.copy(g.velocity).multiplyScalar(h);
        const len = move.length();
        if (len < 1e-5) continue;
        const dir = move.clone().divideScalar(len);
        const hit = this.physics.castRay(g.position, dir, len + 0.05, LAYER.WORLD);
        if (hit) {
          const n = new THREE.Vector3(hit.normal.x, hit.normal.y, hit.normal.z);
          g.position.set(hit.point.x, hit.point.y, hit.point.z).addScaledVector(n, 0.05);
          // Bounce: lose most of the speed into the surface, some along it.
          const vn = n.clone().multiplyScalar(g.velocity.dot(n));
          const vt = g.velocity.clone().sub(vn);
          g.velocity.copy(vt.multiplyScalar(0.62)).addScaledVector(vn, -0.32);
          g.spin.multiplyScalar(0.6);
          if (g.velocity.length() < 0.6 && n.y > 0.6) {
            g.resting = true;
            g.velocity.set(0, 0, 0);
            break;
          }
        } else {
          g.position.add(move);
        }
      }
      g.object.position.copy(g.position);
      g.object.rotation.x += g.spin.x * dt;
      g.object.rotation.y += g.spin.y * dt;
      g.object.rotation.z += g.spin.z * dt;
    }
  }

  dispose() {
    for (const id of [...this.live.keys()]) this.remove(id);
  }
}
