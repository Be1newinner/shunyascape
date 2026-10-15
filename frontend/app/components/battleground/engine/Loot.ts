import * as THREE from "three/webgpu";
import type { Assets } from "./Assets";
import type { LootSpot } from "./Buildings";
import { AMMO_PICKUP, SCOPES, WEAPONS, type AmmoType, type GearLevel, type GearSlot, type ScopeId, type WeaponId } from "./config";
import { gearLootMesh, gearName } from "./Gear";
import { mulberry32, pick } from "./noise";
import { scopeLootMesh, type WeaponFactory } from "./Weapons";

export type LootItem =
  | { kind: "weapon"; weapon: WeaponId; mag: number; scope?: ScopeId | null }
  | { kind: "scope"; scope: ScopeId }
  | { kind: "ammo"; ammo: AmmoType; amount: number }
  | { kind: "medkit" }
  /** `dur`: durability left, for armour someone dropped (fresh when missing). */
  | { kind: "armor"; slot: GearSlot; level: GearLevel; dur?: number }
  | { kind: "grenade"; count: number };

export interface LootEntity {
  /** "L<n>" for map loot (same on every client), "d<n>" for drops the server numbers. */
  id: string;
  item: LootItem;
  object: THREE.Object3D;
  position: THREE.Vector3;
}

export function lootLabel(item: LootItem) {
  if (item.kind === "weapon") return WEAPONS[item.weapon].name;
  if (item.kind === "ammo") return `${item.ammo} ×${item.amount}`;
  if (item.kind === "scope") return SCOPES[item.scope].name;
  if (item.kind === "armor") return gearName(item.slot, item.level);
  if (item.kind === "grenade") return item.count > 1 ? `Frag Grenade ×${item.count}` : "Frag Grenade";
  return "Med Kit";
}

/** Items lying around the map: guns, ammo boxes, med kits. */
export class Loot {
  readonly group = new THREE.Group();
  readonly items = new Map<string, LootEntity>();
  private nextId = 1;

  constructor(
    private assets: Assets,
    private weapons: WeaponFactory,
  ) {}

  scatter(spots: LootSpot[], extra: Array<{ x: number; y: number; z: number }>) {
    const rng = mulberry32(777);
    const weaponPool: WeaponId[] = ["m416", "m416", "m416", "kar98k", "p92", "p92"];
    const ammoFor: Record<WeaponId, AmmoType> = { m416: "5.56mm", kar98k: "7.62mm", p92: "9mm" };
    for (const s of [...spots, ...extra]) {
      const roll = rng();
      const pos = new THREE.Vector3(s.x, s.y, s.z);
      if (roll < 0.4) {
        const weapon = pick(rng, weaponPool);
        this.spawn({ kind: "weapon", weapon, mag: 0 }, pos);
        // Ammo for it next to the gun.
        const a = ammoFor[weapon];
        this.spawn({ kind: "ammo", ammo: a, amount: AMMO_PICKUP[a] }, pos.clone().add(new THREE.Vector3(0.6, 0, 0.3)));
      } else if (roll < 0.52) {
        const scope = pick(rng, ["reddot", "reddot", "2x", "2x", "4x", "4x", "6x"] as ScopeId[]);
        this.spawn({ kind: "scope", scope }, pos);
      } else if (roll < 0.74) {
        const a = pick(rng, ["5.56mm", "5.56mm", "7.62mm", "9mm"] as AmmoType[]);
        this.spawn({ kind: "ammo", ammo: a, amount: AMMO_PICKUP[a] }, pos);
      } else if (roll < 0.85) {
        this.spawn({ kind: "medkit" }, pos);
      } else if (roll < 0.95) {
        // Armour: mostly level 1, rarely level 3.
        const lv = rng();
        const level: GearLevel = lv < 0.58 ? 1 : lv < 0.9 ? 2 : 3;
        this.spawn({ kind: "armor", slot: rng() < 0.5 ? "vest" : "helmet", level }, pos);
      } else {
        this.spawn({ kind: "grenade", count: 1 }, pos);
      }
    }
  }

  spawn(item: LootItem, position: THREE.Vector3, id = `L${this.nextId++}`) {
    let object: THREE.Object3D;
    if (item.kind === "scope") {
      object = new THREE.Group();
      const m = scopeLootMesh(item.scope);
      m.rotation.z = Math.PI / 2;
      m.position.y = 0.03;
      object.add(m);
    } else if (item.kind === "weapon") {
      const model = this.weapons.create(item.weapon, item.scope ?? null);
      object = new THREE.Group();
      // Gun lies on its side.
      model.object.rotation.z = Math.PI / 2;
      model.object.position.y = 0.035;
      object.add(model.object);
    } else if (item.kind === "ammo") {
      object = this.assets.instance("ammoBox", 0.32);
    } else if (item.kind === "armor") {
      object = gearLootMesh(item.slot, item.level);
    } else if (item.kind === "grenade") {
      object = new THREE.Group();
      const nade = this.assets.instance("grenade", 0.34);
      nade.rotation.z = Math.PI / 2;
      nade.position.y = 0.03;
      object.add(nade);
    } else {
      object = this.assets.instance("medkit", 0.42);
    }
    object.position.copy(position);
    object.rotation.y = Math.random() * Math.PI * 2;
    this.group.add(object);
    this.items.set(id, { id, item, object, position: position.clone() });
    return id;
  }

  remove(id: string) {
    const e = this.items.get(id);
    if (!e) return;
    this.group.remove(e.object);
    this.items.delete(id);
  }

  /** Closest item within `radius` metres (horizontal + small vertical tolerance). */
  nearest(p: THREE.Vector3, radius: number, filter?: (e: LootEntity) => boolean) {
    let best: LootEntity | null = null;
    let bestD = radius;
    for (const e of this.items.values()) {
      if (Math.abs(e.position.y - p.y) > 1.6) continue;
      const d = Math.hypot(e.position.x - p.x, e.position.z - p.z);
      if (d < bestD && (!filter || filter(e))) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }
}
