import * as THREE from "three/webgpu";
import type { Combatant } from "./Combatant";
import { wrapAngle } from "./Character";
import type { MapLayout } from "./MapGen";
import { mulberry32, range, clamp } from "./noise";
import { LAYER, type Physics } from "./Physics";
import type { Zone } from "./Zone";

type BotState = "roam" | "engage" | "chase";

export interface BotWorld {
  physics: Physics;
  zone: Zone;
  map: MapLayout;
  combatants: Combatant[];
  now: number;
  /** Fire a shot; the game resolves hits. */
  fire: (shooter: Combatant, origin: THREE.Vector3, dir: THREE.Vector3) => void;
  /** Grace period at match start where bots don't shoot. */
  peaceful: boolean;
}

const EYE = new THREE.Vector3();
const TARGET = new THREE.Vector3();
const DIR = new THREE.Vector3();

/** Simple soldier AI: roam toward the safe zone, fight whoever it can see. */
export class BotBrain {
  state: BotState = "roam";
  private waypoint = new THREE.Vector2();
  private target: Combatant | null = null;
  private lastSeen = new THREE.Vector3();
  private lastSeenTime = -100;
  private thinkTimer = 0;
  private reaction = 0;
  private burstLeft = 0;
  private burstPause = 0;
  private crouchPref = false;
  private stuckTimer = 0;
  private lastPos = new THREE.Vector3();
  private rng: () => number;
  /** 0 (bad) .. 1 (sharp) */
  readonly skill: number;

  constructor(readonly me: Combatant, seed: number) {
    this.rng = mulberry32(seed);
    this.skill = range(this.rng, 0.25, 0.85);
    this.thinkTimer = this.rng() * 0.3;
    this.lastPos.copy(me.position);
  }

  private pickWaypoint(w: BotWorld) {
    const r = this.rng;
    let x: number;
    let z: number;
    if (!w.zone.contains(this.me.position.x, this.me.position.z, 20) || r() < 0.35) {
      [x, z] = w.zone.safePoint(r);
    } else {
      // Wander toward a nearby town or open ground.
      const site = w.map.sites[Math.floor(r() * w.map.sites.length)];
      const near = Math.hypot(site.x - this.me.position.x, site.z - this.me.position.z) < 160;
      [x, z] = near ? w.map.randomOpenPoint(r, site.x, site.z, site.radius + 10) : w.map.randomOpenPoint(r, this.me.position.x, this.me.position.z, 70);
    }
    this.waypoint.set(x, z);
  }

  /** Can `me` see `other`? Ray from eye to chest, blocked by world geometry only. */
  private canSee(w: BotWorld, other: Combatant, maxDist: number) {
    EYE.copy(this.me.position).y += this.me.eyeHeight;
    TARGET.copy(other.position).y += other.eyeHeight * 0.75;
    DIR.subVectors(TARGET, EYE);
    const d = DIR.length();
    if (d > maxDist) return false;
    DIR.divideScalar(d);
    // Field of view, unless we were just shot.
    const facing = new THREE.Vector3(Math.sin(this.me.aimYaw), 0, Math.cos(this.me.aimYaw));
    const flat = new THREE.Vector3(DIR.x, 0, DIR.z).normalize();
    const recentlyHit = w.now - this.me.lastDamageTime < 3;
    if (!recentlyHit && facing.dot(flat) < Math.cos((75 * Math.PI) / 180) && d > 6) return false;
    // Tall grass / prone targets are harder to spot far away.
    if (other.stance === "prone" && d > 60) return false;
    if (other.stance === "crouch" && d > 140 && this.rng() < 0.5) return false;
    return !w.physics.castRay(EYE, DIR, d - 0.4, LAYER.WORLD);
  }

  update(dt: number, w: BotWorld) {
    const me = this.me;
    if (!me.alive) return;
    me.tick(dt);
    this.thinkTimer -= dt;
    const range = me.gun?.stats.range ?? 100;

    if (this.thinkTimer <= 0) {
      this.thinkTimer = 0.25 + this.rng() * 0.1;
      // Bots only hunt the player.
      let best: Combatant | null = null;
      const player = w.combatants.find((c) => c.isPlayer && c.alive);
      const maxD = range > 400 ? 220 : 140;
      if (player && player.position.distanceTo(me.position) < maxD && this.canSee(w, player, maxD)) best = player;
      if (best && !w.peaceful) {
        if (this.target !== best) {
          this.reaction = (range > 400 ? 1.1 : 0.7) + (1 - this.skill) * 0.9 + this.rng() * 0.4;
          this.crouchPref = this.rng() < 0.35;
        }
        this.target = best;
        this.state = "engage";
        this.lastSeen.copy(best.position);
        this.lastSeenTime = w.now;
      } else if (this.state === "engage") {
        this.state = "chase";
      } else if (player && me.lastDamageFrom === player && w.now - me.lastDamageTime < 1 && !w.peaceful) {
        // Shot from somewhere unseen: head toward the shooter.
        this.state = "chase";
        this.lastSeen.copy(player.position);
        this.lastSeenTime = w.now;
      }
      if (this.state === "chase" && w.now - this.lastSeenTime > 9) {
        this.state = "roam";
        this.target = null;
        this.pickWaypoint(w);
      }
    }

    let vx = 0;
    let vz = 0;
    let jump = false;
    me.sprinting = false;
    me.aiming = false;

    if (this.state === "engage" && this.target?.alive) {
      const t = this.target;
      TARGET.copy(t.position);
      // Aim at chest, sometimes the head.
      TARGET.y += t.eyeHeight * (this.rng() < 0.18 + this.skill * 0.15 ? 1.02 : 0.72);
      EYE.copy(me.position).y += me.eyeHeight;
      DIR.subVectors(TARGET, EYE);
      const dist = DIR.length();
      const wantYaw = Math.atan2(DIR.x, DIR.z);
      const wantPitch = Math.asin(clamp(DIR.y / dist, -1, 1));
      const turn = 1 - Math.exp(-dt * (5 + this.skill * 6));
      me.aimYaw += wrapAngle(wantYaw - me.aimYaw) * turn;
      me.aimPitch += (wantPitch - me.aimPitch) * turn;
      me.aiming = dist > 25;

      // Like a real soldier: close in until the gun is effective, then plant your feet and shoot.
      const ideal = range > 400 ? 90 : range < 150 ? 14 : 30;
      const advancing = dist > ideal + 6;
      if (advancing) {
        const yaw = this.avoid(w, wantYaw);
        const speed = dist > ideal * 2.5 ? 5.6 : 4.2;
        me.sprinting = speed > 5;
        vx = Math.sin(yaw) * speed;
        vz = Math.cos(yaw) * speed;
        if (me.stance !== "stand") me.setStance("stand");
      } else {
        if (dist < 4) {
          // Too close: step back a little.
          vx = -Math.sin(wantYaw) * 1.5;
          vz = -Math.cos(wantYaw) * 1.5;
        }
        me.aiming = dist > 10;
        // Some soldiers drop to a crouch once they've stopped to fire.
        if (this.crouchPref && me.stance === "stand" && dist > 12) me.setStance("crouch");
      }

      // Shooting.
      this.reaction -= dt;
      const gun = me.gun;
      if (advancing && gun && gun.mag < gun.stats.magSize * 0.6) me.startReload();
      if (gun && !advancing && this.reaction <= 0 && !me.busy && Math.abs(wrapAngle(wantYaw - me.aimYaw)) < 0.12) {
        if (gun.mag <= 0) {
          me.startReload();
        } else if (this.burstPause > 0) {
          this.burstPause -= dt;
        } else if (me.fireCooldown <= 0) {
          // Spread grows with distance and target speed; better bots are tighter.
          const tSpeed = Math.hypot(t.velocity.x, t.velocity.z);
          const spreadDeg = (1.3 - this.skill * 0.6) * (1.5 + dist / 35) + tSpeed * 0.45 + (t.stance === "prone" ? 0.8 : t.stance === "crouch" ? 0.3 : 0);
          const spread = (spreadDeg * Math.PI) / 180;
          const shot = DIR.clone().normalize();
          shot.x += (this.rng() - 0.5) * 2 * spread;
          shot.y += (this.rng() - 0.5) * 2 * spread * 0.7;
          shot.z += (this.rng() - 0.5) * 2 * spread;
          shot.normalize();
          w.fire(me, EYE.clone(), shot);
          if (this.burstLeft <= 0) {
            const [lo, hi] = gun.stats.botBurst;
            this.burstLeft = Math.round(range > 400 ? 1 : lo + this.rng() * (hi - lo));
          }
          this.burstLeft--;
          if (this.burstLeft <= 0) this.burstPause = gun.stats.auto ? 0.7 + this.rng() * 1.1 : 0.5 + this.rng() * 0.8;
        }
      }
    } else {
      if (this.state === "chase") this.waypoint.set(this.lastSeen.x, this.lastSeen.z);
      if (this.state === "roam" && (this.waypoint.lengthSq() === 0 || !w.zone.contains(this.waypoint.x, this.waypoint.y, 5))) {
        this.pickWaypoint(w);
      }
      const dx = this.waypoint.x - me.position.x;
      const dz = this.waypoint.y - me.position.z;
      const d = Math.hypot(dx, dz);
      if (d < 3) {
        if (this.state === "chase") this.state = "roam";
        this.pickWaypoint(w);
      } else {
        let yaw = Math.atan2(dx, dz);
        yaw = this.avoid(w, yaw);
        me.aimYaw += wrapAngle(yaw - me.aimYaw) * (1 - Math.exp(-dt * 5));
        me.aimPitch *= 1 - dt * 3;
        const outside = !w.zone.contains(me.position.x, me.position.z);
        const speed = outside || this.state === "chase" ? 6 : 4.4;
        me.sprinting = speed > 5;
        vx = Math.sin(me.aimYaw) * speed;
        vz = Math.cos(me.aimYaw) * speed;
        if (me.stance !== "stand") me.setStance("stand");
      }
      if (me.gun && me.gun.mag < me.gun.stats.magSize * 0.5) me.startReload();
    }

    me.move(dt, vx, vz, jump);

    // Unstick: if we tried to move but didn't, hop and pick a new direction.
    this.stuckTimer += dt;
    if (this.stuckTimer > 1.2) {
      const moved = me.position.distanceTo(this.lastPos);
      const wanted = Math.hypot(vx, vz) * this.stuckTimer;
      if (wanted > 2 && moved < wanted * 0.15) {
        jump = true;
        me.move(0, 0, 0, true);
        this.waypoint.set(0, 0);
        if (this.state === "roam") this.pickWaypoint(w);
      }
      this.stuckTimer = 0;
      this.lastPos.copy(me.position);
    }
  }

  /** Steer around obstacles with three short feeler rays. */
  private avoid(w: BotWorld, yaw: number) {
    const origin = new THREE.Vector3(this.me.position.x, this.me.position.y + 0.9, this.me.position.z);
    const probe = (a: number) => {
      const dir = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
      return w.physics.castRay(origin, dir, 3.5, LAYER.WORLD);
    };
    if (!probe(yaw)) return yaw;
    for (const off of [0.6, -0.6, 1.2, -1.2, 1.8, -1.8]) {
      if (!probe(yaw + off)) return yaw + off;
    }
    return yaw + Math.PI;
  }
}
