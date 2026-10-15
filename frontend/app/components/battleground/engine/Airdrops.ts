import * as THREE from "three/webgpu";
import type { Assets } from "./Assets";
import { chuteMesh, planeMesh, spinProps } from "./Drop";
import type { Effects } from "./Effects";
import type { LootItem } from "./Loot";

/**
 * Airdrops: a plane flies over a spot inside the next safe zone, a crate
 * floats down under a parachute and lands trailing red smoke. Its loot
 * (top-tier armour, a scoped rifle, grenades, med kits) appears when it lands.
 */

/** How long the crate hangs under its parachute. */
export const AIRDROP_FALL = 24;
const RELEASE_ALT = 150;
const PLANE_LEAD = 9;

export interface AirdropLoot {
  id: string;
  item: LootItem;
}

interface Drop {
  id: string;
  x: number;
  z: number;
  ground: number;
  /** Game time it touches down. */
  landAt: number;
  items: AirdropLoot[];
  crate: THREE.Object3D;
  chute: THREE.Object3D;
  plane: THREE.Object3D;
  dir: THREE.Vector3;
  landed: boolean;
  smokeAcc: number;
}

/** What's in a crate. Alternates between a sniper kit and an assault kit. */
export function airdropItems(n: number): LootItem[] {
  const gun: LootItem[] =
    n % 2 === 1
      ? [{ kind: "weapon", weapon: "kar98k", mag: 5, scope: "6x" }, { kind: "ammo", ammo: "7.62mm", amount: 30 }]
      : [{ kind: "weapon", weapon: "m416", mag: 30, scope: "4x" }, { kind: "ammo", ammo: "5.56mm", amount: 120 }];
  return [
    ...gun,
    { kind: "armor", slot: "vest", level: 3 },
    { kind: "armor", slot: "helmet", level: 3 },
    { kind: "grenade", count: 2 },
    { kind: "medkit" },
    { kind: "medkit" },
  ];
}

export class Airdrops {
  readonly group = new THREE.Group();
  private drops: Drop[] = [];

  constructor(
    private assets: Assets,
    private effects: Effects,
    private heightAt: (x: number, z: number) => number,
  ) {}

  /** A crate is on its way: lands at (x, z) `landIn` seconds from `now`. */
  announce(id: string, x: number, z: number, items: AirdropLoot[], landIn: number, now: number) {
    if (this.drops.some((d) => d.id === id)) return;
    const crate = this.assets.instance("crateWood", 1.35);
    // Painted red-and-white so it stands out from map crates.
    crate.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.material = (mesh.material as THREE.MeshStandardMaterial).clone();
        (mesh.material as THREE.MeshStandardMaterial).color = new THREE.Color("#d8483a");
      }
    });
    const chute = chuteMesh("#2f7fe8");
    chute.scale.setScalar(1.25);
    crate.add(chute);
    const plane = planeMesh();
    const angle = Math.random() * Math.PI * 2;
    const dir = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    plane.rotation.y = Math.atan2(dir.x, dir.z);
    plane.visible = false;
    crate.visible = false;
    this.group.add(crate, plane);
    this.drops.push({
      id, x, z, ground: this.heightAt(x, z), landAt: now + landIn, items, crate, chute, plane, dir, landed: landIn <= 0, smokeAcc: 0,
    });
  }

  /** Crates, falling or landed (for the minimap and on-screen markers). */
  markers() {
    return this.drops.map((d) => ({ id: d.id, x: d.x, z: d.z, y: d.ground, landed: d.landed }));
  }

  update(dt: number, now: number, onLand: (items: AirdropLoot[], at: THREE.Vector3) => void) {
    for (const d of this.drops) {
      const release = d.landAt - AIRDROP_FALL;
      // The plane passes over the drop point at the release moment.
      const tp = now - release;
      d.plane.visible = tp > -PLANE_LEAD && tp < PLANE_LEAD + 6;
      if (d.plane.visible) {
        d.plane.position.set(d.x + d.dir.x * tp * 55, d.ground + RELEASE_ALT + 25, d.z + d.dir.z * tp * 55);
        spinProps(d.plane, dt);
      }
      if (d.landed) {
        // Red smoke for a minute, so everyone can see where it came down.
        if (now - d.landAt < 60) {
          d.smokeAcc += dt;
          while (d.smokeAcc > 0.12) {
            d.smokeAcc -= 0.12;
            this.effects.smoke(new THREE.Vector3(d.x + 0.9, d.ground + 0.3, d.z), "#d33a2c");
          }
        }
        continue;
      }
      if (now < release) continue;
      d.crate.visible = true;
      const k = Math.min(1, (now - release) / AIRDROP_FALL);
      d.crate.position.set(d.x, d.ground + RELEASE_ALT * (1 - k), d.z);
      d.crate.rotation.y += dt * 0.4;
      d.crate.rotation.z = Math.sin(now * 1.3) * 0.06;
      if (k >= 1) {
        d.landed = true;
        d.crate.rotation.z = 0;
        d.crate.position.y = d.ground;
        d.chute.removeFromParent();
        onLand(d.items, new THREE.Vector3(d.x, d.ground, d.z));
      }
    }
  }

  /** Where the loot of a landed crate goes: in a ring around it. */
  static lootSpot(at: THREE.Vector3, i: number, n: number) {
    const a = (i / n) * Math.PI * 2;
    return new THREE.Vector3(at.x + Math.cos(a) * 1.4, at.y + 0.02, at.z + Math.sin(a) * 1.4);
  }
}
