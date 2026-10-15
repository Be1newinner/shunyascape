import * as THREE from "three/webgpu";
import type RAPIER from "@dimforge/rapier3d-compat";
import { CharacterVisual, type CharacterPose, type Stance } from "./Character";
import { ARMOR, GRENADE, MEDKIT_HEAL_TIME, NO_GEAR, PLAYER_MAX_HEALTH, SCOPES, WEAPONS, type AmmoType, type Gear, type GearLevel, type GearSlot, type ScopeId, type WeaponId } from "./config";
import { chuteMesh } from "./Drop";
import { groups, LAYER, type Physics } from "./Physics";
import { makeGun, type Gun, type WeaponFactory } from "./Weapons";
import type { NetState } from "./MatchClient";
import { lerpAngle } from "./Character";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

const RADIUS = 0.3;
const HEIGHT: Record<Stance, number> = { stand: 1.8, crouch: 1.25, prone: 0.62 };
export const EYE_HEIGHT: Record<Stance, number> = { stand: 1.62, crouch: 1.12, prone: 0.42 };
const GRAVITY = 15;

/** Slot 0/1 hold primaries, slot 2 the pistol. */
export type SlotIndex = 0 | 1 | 2;

/** A player or bot: physics capsule, health, inventory and the animated soldier. */
export class Combatant {
  readonly position = new THREE.Vector3();
  readonly velocity = new THREE.Vector3();
  health = PLAYER_MAX_HEALTH;
  kills = 0;
  damageDealt = 0;
  alive = true;
  stance: Stance = "stand";
  aimYaw = 0;
  aimPitch = 0;
  grounded = true;
  sprinting = false;
  aiming = false;
  recoil = 0;
  /** Game time of this soldier's last shot (bots nearby hear it). */
  lastShotTime = -100;

  slots: [Gun | null, Gun | null, Gun | null] = [null, null, null];
  active: SlotIndex = 2;
  reserve: Record<AmmoType, number> = { "5.56mm": 0, "7.62mm": 0, "9mm": 0 };
  medkits = 0;
  /** Scopes carried but not mounted on a gun. */
  scopeBag: ScopeId[] = [];
  /** Worn armour and what's left of it. */
  gear: Gear = { ...NO_GEAR };
  grenades = 0;
  /** Squad: soldiers on the same team can't hurt each other. Empty = on your own. */
  team = "";
  /** Dropping in at the start: 1 free-falling, 2 under the parachute. */
  dropping: 0 | 1 | 2 = 0;
  private chuteObj: THREE.Object3D | null = null;

  fireCooldown = 0;
  reloadLeft = 0;
  reloadTotal = 0;
  switchLeft = 0;
  healLeft = 0;
  lastDamageFrom: Combatant | null = null;
  lastDamageTime = -100;

  readonly visual: CharacterVisual;
  readonly body: RAPIER.RigidBody;
  readonly collider: RAPIER.Collider;
  private controller: RAPIER.KinematicCharacterController;

  /** Bots are AI soldiers; humans are players (you, or someone else over the network). */
  isBot = false;
  /** Driven by network snapshots instead of local input or AI. */
  remote = false;
  private netBuffer: Array<{ t: number; s: NetState }> = [];

  constructor(
    readonly id: string,
    readonly name: string,
    readonly isPlayer: boolean,
    private physics: Physics,
    private weapons: WeaponFactory,
    soldier: GLTF,
    spawn: THREE.Vector3,
    tint?: THREE.ColorRepresentation,
  ) {
    const R = physics.rapier;
    this.visual = new CharacterVisual(soldier, tint);
    this.position.copy(spawn);
    const hh = this.halfHeight("stand");
    this.body = physics.world.createRigidBody(
      R.RigidBodyDesc.kinematicPositionBased().setTranslation(spawn.x, spawn.y + hh + RADIUS, spawn.z),
    );
    // Every soldier starts on the human layer; markBot() moves AI soldiers to theirs.
    const membership = LAYER.PLAYER;
    this.collider = physics.world.createCollider(
      R.ColliderDesc.capsule(hh, RADIUS).setCollisionGroups(groups(membership, LAYER.WORLD | LAYER.PLAYER | LAYER.BOT)),
      this.body,
    );
    this.controller = physics.world.createCharacterController(0.03);
    this.controller.enableAutostep(0.45, 0.15, false);
    this.controller.enableSnapToGround(0.45);
    this.controller.setMaxSlopeClimbAngle((52 * Math.PI) / 180);
    this.controller.setMinSlopeSlideAngle((40 * Math.PI) / 180);
    this.controller.setApplyImpulsesToDynamicBodies(false);
    this.visual.root.position.copy(spawn);
  }

  private halfHeight(s: Stance) {
    return Math.max(0.01, (HEIGHT[s] - RADIUS * 2) / 2);
  }

  get gun(): Gun | null {
    return this.slots[this.active];
  }

  get eyeHeight() {
    return EYE_HEIGHT[this.stance];
  }

  /** Put on armour; returns what was worn in that slot before (to drop it). */
  wear(slot: GearSlot, level: GearLevel, dur?: number) {
    const old = { level: this.gear[slot], dur: slot === "vest" ? this.gear.vestDur : this.gear.helmetDur };
    const fresh = dur ?? ARMOR[slot].durability[level];
    if (slot === "vest") this.gear = { ...this.gear, vest: level, vestDur: fresh };
    else this.gear = { ...this.gear, helmet: level, helmetDur: fresh };
    this.visual.setGear(this.gear.vest, this.gear.helmet);
    return old;
  }

  /** Armour took a beating; it breaks when nothing is left. */
  wearDown(vestWear: number, helmetWear: number) {
    const g = { ...this.gear };
    if (g.vest && vestWear) {
      g.vestDur -= vestWear;
      if (g.vestDur <= 0) g.vest = g.vestDur = 0;
    }
    if (g.helmet && helmetWear) {
      g.helmetDur -= helmetWear;
      if (g.helmetDur <= 0) g.helmet = g.helmetDur = 0;
    }
    this.gear = g;
    this.visual.setGear(g.vest, g.helmet);
  }

  addGrenades(n: number) {
    const before = this.grenades;
    this.grenades = Math.min(GRENADE.carry, this.grenades + n);
    return this.grenades - before;
  }

  /** Jump straight to a spot (dropping in from the plane), no collisions on the way. */
  teleport(p: THREE.Vector3Like) {
    this.position.set(p.x, p.y, p.z);
    const hh = this.halfHeight(this.stance);
    this.body.setTranslation({ x: p.x, y: p.y + hh + RADIUS, z: p.z }, true);
    this.body.setNextKinematicTranslation({ x: p.x, y: p.y + hh + RADIUS, z: p.z });
  }

  /** Free-fall lies the soldier flat; the canopy stands them up under it. */
  setDropping(state: 0 | 1 | 2) {
    this.dropping = state;
    const want: Stance = state === 1 ? "prone" : "stand";
    if (this.stance !== want) {
      this.stance = want;
      this.collider.setHalfHeight(this.halfHeight(want));
    }
    if (state === 2) this.visual.setChute((this.chuteObj ??= chuteMesh()));
    else this.visual.setChute(null);
  }

  get busy() {
    return this.reloadLeft > 0 || this.switchLeft > 0 || this.healLeft > 0;
  }

  setStance(s: Stance) {
    if (s === this.stance) return;
    // Standing up needs head room.
    if (HEIGHT[s] > HEIGHT[this.stance]) {
      const hit = this.physics.castRay(
        { x: this.position.x, y: this.position.y + HEIGHT[this.stance] - 0.05, z: this.position.z },
        { x: 0, y: 1, z: 0 },
        HEIGHT[s] - HEIGHT[this.stance] + 0.05,
        LAYER.WORLD,
      );
      if (hit) return;
    }
    this.stance = s;
    const hh = this.halfHeight(s);
    this.collider.setHalfHeight(hh);
    this.body.setNextKinematicTranslation({ x: this.position.x, y: this.position.y + hh + RADIUS, z: this.position.z });
  }

  /** Move with a desired horizontal velocity; handles gravity, steps and slopes. */
  move(dt: number, vx: number, vz: number, jump: boolean) {
    if (!this.alive) return;
    if (jump && this.grounded && this.stance === "stand") {
      this.velocity.y = 5.2;
      this.grounded = false;
    }
    this.velocity.y -= GRAVITY * dt;
    this.velocity.x = vx;
    this.velocity.z = vz;
    this.controller.computeColliderMovement(this.collider, {
      x: vx * dt,
      y: this.velocity.y * dt,
      z: vz * dt,
    });
    const mv = this.controller.computedMovement();
    // Centre from our own feet position so a stance change this frame is respected.
    const hh = this.halfHeight(this.stance);
    const next = { x: this.position.x + mv.x, y: this.position.y + hh + RADIUS + mv.y, z: this.position.z + mv.z };
    this.body.setNextKinematicTranslation(next);
    this.grounded = this.controller.computedGrounded();
    if (this.grounded && this.velocity.y < 0) this.velocity.y = -1;
    // Hit a ceiling.
    if (mv.y < this.velocity.y * dt * 0.5 && this.velocity.y > 0) this.velocity.y = 0;
    this.position.set(next.x, next.y - hh - RADIUS, next.z);
    // Actual horizontal velocity after collisions (for animation).
    this.velocity.x = mv.x / Math.max(dt, 1e-4);
    this.velocity.z = mv.z / Math.max(dt, 1e-4);
  }

  /** Puts the visual where the capsule is and animates it. */
  updateVisual(dt: number, detail: number) {
    this.visual.root.position.copy(this.position);
    const pose: CharacterPose = {
      aimYaw: this.aimYaw,
      aimPitch: this.aimPitch,
      velX: this.velocity.x,
      velZ: this.velocity.z,
      grounded: this.grounded,
      stance: this.stance,
      sprinting: this.sprinting,
      aiming: this.aiming,
      reloading: this.reloadLeft > 0 ? 1 - this.reloadLeft / this.reloadTotal : 0,
      healing: this.healLeft > 0,
      recoil: this.recoil,
    };
    this.visual.update(dt, pose, detail);
    this.recoil = Math.max(0, this.recoil - dt * 8);
  }

  give(id: WeaponId, mag?: number, scope: ScopeId | null = null): SlotIndex {
    const gun = makeGun(id, mag, scope);
    // Mount the best spare scope on a new gun that has none.
    if (!gun.scope && gun.stats.takesScope && this.scopeBag.length) {
      this.scopeBag.sort((a, b) => SCOPES[b].rank - SCOPES[a].rank);
      gun.scope = this.scopeBag.shift()!;
    }
    let slot: SlotIndex;
    if (gun.stats.slot === "secondary") slot = 2;
    else if (!this.slots[0]) slot = 0;
    else if (!this.slots[1]) slot = 1;
    else slot = this.active === 1 ? 1 : 0;
    this.slots[slot] = gun;
    this.equip(slot);
    return slot;
  }

  equip(slot: SlotIndex) {
    if (!this.slots[slot]) return;
    if (slot !== this.active) this.switchLeft = 0.55;
    this.active = slot;
    this.reloadLeft = 0;
    this.healLeft = 0;
    this.refreshWeaponModel();
  }

  /** Rebuild the held gun's model (after equipping or changing its scope). */
  refreshWeaponModel() {
    const gun = this.gun;
    this.visual.setWeapon(gun ? this.weapons.create(gun.stats.id, gun.scope) : null);
  }

  /**
   * Mount a picked-up scope: on the held primary, else the other primary
   * (better scopes replace worse ones), else keep it in the bag.
   */
  takeScope(scope: ScopeId): string {
    const order: SlotIndex[] = this.active === 1 ? [1, 0] : [0, 1];
    for (const s of order) {
      const g = this.slots[s];
      if (!g || !g.stats.takesScope) continue;
      if (!g.scope || SCOPES[g.scope].rank < SCOPES[scope].rank) {
        if (g.scope) this.scopeBag.push(g.scope);
        g.scope = scope;
        if (s === this.active) this.refreshWeaponModel();
        return `${SCOPES[scope].name} on ${WEAPONS[g.stats.id].name}`;
      }
    }
    this.scopeBag.push(scope);
    return `${SCOPES[scope].name} (in backpack)`;
  }

  /** Next slot that holds a gun. */
  cycleWeapon() {
    for (let i = 1; i <= 3; i++) {
      const s = ((this.active + i) % 3) as SlotIndex;
      if (this.slots[s]) {
        this.equip(s);
        return;
      }
    }
  }

  startReload(): boolean {
    const gun = this.gun;
    if (!gun || this.busy || gun.mag >= gun.stats.magSize) return false;
    if (!this.isPlayer) this.reserve[gun.stats.ammo] = 999; // bots never run dry
    if (this.reserve[gun.stats.ammo] <= 0) return false;
    this.reloadLeft = this.reloadTotal = gun.stats.reloadTime;
    return true;
  }

  startHeal(): boolean {
    if (this.medkits <= 0 || this.health >= PLAYER_MAX_HEALTH || this.busy) return false;
    this.healLeft = MEDKIT_HEAL_TIME;
    this.aiming = false;
    return true;
  }

  /** Timers for reload / switch / heal. */
  tick(dt: number) {
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    if (this.switchLeft > 0) this.switchLeft = Math.max(0, this.switchLeft - dt);
    if (this.reloadLeft > 0) {
      this.reloadLeft -= dt;
      if (this.reloadLeft <= 0) {
        this.reloadLeft = 0;
        const gun = this.gun;
        if (gun) {
          const need = gun.stats.magSize - gun.mag;
          const take = Math.min(need, this.reserve[gun.stats.ammo]);
          gun.mag += take;
          this.reserve[gun.stats.ammo] -= take;
        }
      }
    }
    if (this.healLeft > 0) {
      this.healLeft -= dt;
      if (this.healLeft <= 0) {
        this.healLeft = 0;
        this.medkits--;
        this.health = PLAYER_MAX_HEALTH;
      }
    }
  }

  cancelActions() {
    this.reloadLeft = 0;
    this.healLeft = 0;
  }

  /** Returns true if this damage killed them. */
  damage(amount: number, from: Combatant | null, now: number): boolean {
    if (!this.alive) return false;
    this.health -= amount;
    this.lastDamageFrom = from;
    this.lastDamageTime = now;
    this.visual.hit();
    if (this.healLeft > 0) this.healLeft = 0;
    if (this.health <= 0) {
      this.health = 0;
      this.alive = false;
      if (!from) this.visual.die();
      // Corpses don't block movement or bullets.
      this.collider.setCollisionGroups(groups(0, 0));
      return true;
    }
    return false;
  }

  /** Mark as an AI soldier: bots live on their own collision layer. */
  markBot() {
    this.isBot = true;
    this.collider.setCollisionGroups(groups(LAYER.BOT, LAYER.WORLD | LAYER.PLAYER | LAYER.BOT));
  }

  /** What this soldier looks like right now, for the network. */
  netState(): NetState {
    const g = this.gun;
    return {
      x: this.position.x, y: this.position.y, z: this.position.z,
      yaw: this.aimYaw, pitch: this.aimPitch, stance: this.stance,
      sprint: this.sprinting, aim: this.aiming, grounded: this.grounded,
      reload: this.reloadLeft > 0, heal: this.healLeft > 0,
      vx: this.velocity.x, vz: this.velocity.z,
      weapon: g?.stats.id ?? null, scope: g?.scope ?? null,
      vest: this.gear.vest, helmet: this.gear.helmet, drop: this.dropping,
    };
  }

  /** Queue a snapshot for a remote soldier (played back slightly in the past). */
  pushNetState(s: NetState, t: number) {
    this.netBuffer.push({ t, s });
    if (this.netBuffer.length > 12) this.netBuffer.shift();
  }

  /**
   * Remote soldiers are drawn ~120 ms behind real time, blended between the
   * two snapshots around that moment so they move smoothly.
   */
  applyNetBuffer(now: number, delay = 0.12) {
    const buf = this.netBuffer;
    if (!buf.length || !this.alive) return;
    const t = now - delay;
    let a = buf[0];
    let b = buf[buf.length - 1];
    for (let i = 0; i < buf.length - 1; i++) {
      if (buf[i].t <= t && buf[i + 1].t >= t) {
        a = buf[i];
        b = buf[i + 1];
        break;
      }
    }
    const span = b.t - a.t;
    const k = span > 0 ? Math.min(1, Math.max(0, (t - a.t) / span)) : 1;
    const s = k < 0.5 ? a.s : b.s;
    this.position.set(a.s.x + (b.s.x - a.s.x) * k, a.s.y + (b.s.y - a.s.y) * k, a.s.z + (b.s.z - a.s.z) * k);
    this.aimYaw = lerpAngle(a.s.yaw, b.s.yaw, k);
    this.aimPitch = a.s.pitch + (b.s.pitch - a.s.pitch) * k;
    this.velocity.set(a.s.vx + (b.s.vx - a.s.vx) * k, 0, a.s.vz + (b.s.vz - a.s.vz) * k);
    this.sprinting = s.sprint;
    this.aiming = s.aim;
    this.grounded = s.grounded;
    if (s.stance !== this.stance) {
      this.stance = s.stance;
      this.collider.setHalfHeight(this.halfHeight(s.stance));
    }
    // Reload / heal only drive the animation for remote soldiers.
    this.reloadLeft = s.reload ? Math.max(this.reloadLeft, 0.5) : 0;
    this.reloadTotal = Math.max(this.reloadTotal, 1);
    this.healLeft = s.heal ? 1 : 0;
    this.netEquip(s.weapon, s.scope);
    if (s.vest !== this.gear.vest || s.helmet !== this.gear.helmet) {
      this.gear = { ...this.gear, vest: s.vest, helmet: s.helmet };
      this.visual.setGear(s.vest, s.helmet);
    }
    if (s.drop !== this.dropping) {
      this.dropping = s.drop;
      this.visual.setChute(s.drop === 2 ? (this.chuteObj ??= chuteMesh()) : null);
    }
    const hh = this.halfHeight(this.stance);
    this.body.setNextKinematicTranslation({ x: this.position.x, y: this.position.y + hh + RADIUS, z: this.position.z });
  }

  /** Show the gun a remote soldier says they're holding. */
  private netEquip(weapon: NetState["weapon"], scope: NetState["scope"]) {
    const g = this.gun;
    if (!weapon) return;
    if (g && g.stats.id === weapon && g.scope === scope) return;
    const slot: SlotIndex = weapon === "p92" ? 2 : 0;
    this.slots[slot] = makeGun(weapon, undefined, scope);
    this.active = slot;
    this.refreshWeaponModel();
  }

  dispose() {
    this.visual.dispose();
    this.physics.world.removeCharacterController(this.controller);
    this.physics.world.removeRigidBody(this.body);
  }
}
