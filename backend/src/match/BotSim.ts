import type RAPIER_T from "@dimforge/rapier3d-compat";
import { BOT_GROUP, RAPIER, createWorld, heightAt, openPoints, sites } from "./World";
import { EYE_HEIGHT, STANCE_HEIGHT, WEAPONS, mulberry32, type ServerZone, type WeaponId } from "./rules";

/** A soldier the bots can see and shoot (a human, as the match knows them). */
export interface Target {
  id: string;
  alive: boolean;
  pos: [number, number, number] | null;
  stance: "s" | "c" | "p";
  vx: number;
  vz: number;
}

/** What the bot simulation needs from its match. */
export interface BotHost {
  zone: ServerZone;
  humans(): Target[];
  /** Bots hold fire until this is false. */
  peaceful(): boolean;
  /** A bot shot: tell everyone (and apply damage if `hit`). */
  shot(botId: string, weapon: WeaponId, o: number[], e: number[], hit: { id: string; head: boolean } | null): void;
}

type V3 = { x: number; y: number; z: number };
const RADIUS = 0.3;
/** Bots walk into walls and terrain, not into each other. */
const MOVE_FILTER = (0xffff << 16) | 0x1;
const GRAVITY = 15;
const HEIGHT = { s: 1.8, c: 1.25, p: 0.62 };

const wrap = (a: number) => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

interface Bot {
  id: string;
  alive: boolean;
  rng: () => number;
  skill: number;
  body: RAPIER_T.RigidBody;
  collider: RAPIER_T.Collider;
  controller: RAPIER_T.KinematicCharacterController;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  pitch: number;
  stance: "s" | "c";
  sprint: boolean;
  aim: boolean;
  grounded: boolean;
  weapon: WeaponId;
  scope: string | null;
  mag: number;
  reloadLeft: number;
  fireCooldown: number;
  state: "roam" | "engage" | "chase";
  wx: number;
  wz: number;
  target: string | null;
  lastSeen: V3;
  lastSeenTime: number;
  reaction: number;
  burstLeft: number;
  burstPause: number;
  crouchPref: boolean;
  think: number;
  stuckTimer: number;
  lastX: number;
  lastZ: number;
  lastHitBy: string | null;
  lastHitAt: number;
}

/**
 * Server-side AI soldiers. They run on the game server's clock, independent of
 * every player, and are relayed to clients like any other soldier.
 */
export class BotSim {
  private world: RAPIER_T.World;
  private ray: RAPIER_T.Ray;
  private bots = new Map<string, Bot>();
  private now = 0;

  constructor(private host: BotHost, seed: number, ids: string[]) {
    this.world = createWorld();
    this.ray = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 });
    const rng = mulberry32(seed ^ 0xb075);
    // Spread bots over open ground, at least 40 m apart.
    const used: number[][] = [];
    for (const [i, id] of ids.entries()) {
      let pt = openPoints[Math.floor(rng() * openPoints.length)];
      for (let t = 0; t < 30; t++) {
        const cand = openPoints[Math.floor(rng() * openPoints.length)];
        if (used.every((u) => Math.hypot(u[0] - cand[0], u[1] - cand[1]) > 40)) {
          pt = cand;
          break;
        }
      }
      used.push(pt);
      const weapon = (["m416", "m416", "m416", "kar98k", "p92"] as WeaponId[])[Math.floor(rng() * 5)];
      const scope = weapon === "kar98k" ? "4x" : weapon === "m416" && rng() < 0.5 ? (rng() < 0.5 ? "reddot" : "2x") : null;
      this.add(id, pt[0], pt[1], weapon, scope, seed + i * 7919);
    }
    this.world.step();
  }

  private add(id: string, x: number, z: number, weapon: WeaponId, scope: string | null, seed: number) {
    const y = heightAt(x, z) + 0.05;
    const hh = (HEIGHT.s - RADIUS * 2) / 2;
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, y + hh + RADIUS, z));
    const collider = this.world.createCollider(RAPIER.ColliderDesc.capsule(hh, RADIUS).setCollisionGroups(BOT_GROUP), body);
    const controller = this.world.createCharacterController(0.03);
    controller.enableAutostep(0.45, 0.15, false);
    controller.enableSnapToGround(0.45);
    controller.setMaxSlopeClimbAngle((52 * Math.PI) / 180);
    controller.setMinSlopeSlideAngle((40 * Math.PI) / 180);
    const rng = mulberry32(seed);
    this.bots.set(id, {
      id, alive: true, rng, skill: 0.25 + rng() * 0.6, body, collider, controller,
      x, y, z, vx: 0, vy: 0, vz: 0, yaw: rng() * Math.PI * 2, pitch: 0, stance: "s",
      sprint: false, aim: false, grounded: true, weapon, scope, mag: WEAPONS[weapon].mag,
      reloadLeft: 0, fireCooldown: 0, state: "roam", wx: x, wz: z, target: null,
      lastSeen: { x, y, z }, lastSeenTime: -100, reaction: 0, burstLeft: 0, burstPause: 0,
      crouchPref: false, think: rng() * 0.3, stuckTimer: 0, lastX: x, lastZ: z, lastHitBy: null, lastHitAt: -100,
    });
  }

  /** Where a bot is (for hit validation, zone damage and snapshots). */
  position(id: string): [number, number, number] | null {
    const b = this.bots.get(id);
    return b ? [b.x, b.y, b.z] : null;
  }

  /** Snapshot row in the same format clients send for themselves. */
  state(id: string): unknown[] | null {
    const b = this.bots.get(id);
    if (!b) return null;
    const r = (n: number) => Math.round(n * 100) / 100;
    const flags = (b.sprint ? 1 : 0) | (b.aim ? 2 : 0) | (b.grounded ? 4 : 0) | (b.reloadLeft > 0 ? 8 : 0);
    return [r(b.x), r(b.y), r(b.z), r(b.yaw), r(b.pitch), b.stance, flags, r(b.vx), r(b.vz), b.weapon, b.scope];
  }

  loadout(id: string) {
    const b = this.bots.get(id);
    return b ? { weapon: b.weapon, scope: b.scope, mag: b.mag } : null;
  }

  /** A human hit this bot: it turns on them even without seeing them. */
  wasHit(id: string, by: string) {
    const b = this.bots.get(id);
    if (!b) return;
    b.lastHitBy = by;
    b.lastHitAt = this.now;
  }

  kill(id: string) {
    const b = this.bots.get(id);
    if (!b || !b.alive) return;
    b.alive = false;
    this.world.removeCharacterController(b.controller);
    this.world.removeRigidBody(b.body);
  }

  private castWorld(o: V3, dir: V3, max: number) {
    this.ray.origin = o;
    this.ray.dir = dir;
    // Rays hit the static world only (never a bot's own capsule).
    const hit = this.world.castRay(this.ray, max, true, undefined, MOVE_FILTER);
    return hit ? hit.timeOfImpact : null;
  }

  /** Can bot `b` see target `t`? Field of view unless just shot, line of sight, stance. */
  private canSee(b: Bot, t: Target, maxDist: number) {
    if (!t.pos) return false;
    const ex = b.x, ey = b.y + EYE_HEIGHT[b.stance], ez = b.z;
    const tx = t.pos[0], ty = t.pos[1] + EYE_HEIGHT[t.stance] * 0.75, tz = t.pos[2];
    const dx = tx - ex, dy = ty - ey, dz = tz - ez;
    const d = Math.hypot(dx, dy, dz);
    if (d > maxDist || d < 0.01) return false;
    const recentlyHit = this.now - b.lastHitAt < 3;
    const facing = Math.cos(wrap(Math.atan2(dx, dz) - b.yaw));
    if (!recentlyHit && facing < Math.cos((75 * Math.PI) / 180) && d > 6) return false;
    if (t.stance === "p" && d > 60) return false;
    if (t.stance === "c" && d > 140 && b.rng() < 0.5) return false;
    const blocked = this.castWorld({ x: ex, y: ey, z: ez }, { x: dx / d, y: dy / d, z: dz / d }, d - 0.4);
    return blocked === null;
  }

  private pickWaypoint(b: Bot) {
    const zone = this.host.zone;
    if (!zone.contains(b.x, b.z) || b.rng() < 0.35) {
      const r = Math.max(4, zone.nRadius * 0.8) * Math.sqrt(b.rng());
      const a = b.rng() * Math.PI * 2;
      b.wx = zone.nx + Math.cos(a) * r;
      b.wz = zone.nz + Math.sin(a) * r;
      return;
    }
    // Head for open ground near a town or near where we are.
    const site = sites[Math.floor(b.rng() * sites.length)];
    const near = Math.hypot(site.x - b.x, site.z - b.z) < 160;
    const cx = near ? site.x : b.x;
    const cz = near ? site.z : b.z;
    const radius = near ? site.radius + 10 : 70;
    for (let i = 0; i < 20; i++) {
      const p = openPoints[Math.floor(b.rng() * openPoints.length)];
      if (Math.hypot(p[0] - cx, p[1] - cz) < radius) {
        b.wx = p[0];
        b.wz = p[1];
        return;
      }
    }
    b.wx = cx + (b.rng() - 0.5) * radius;
    b.wz = cz + (b.rng() - 0.5) * radius;
  }

  /** Steer around obstacles with short feeler rays. */
  private avoid(b: Bot, yaw: number) {
    const o = { x: b.x, y: b.y + 0.9, z: b.z };
    const blocked = (a: number) => this.castWorld(o, { x: Math.sin(a), y: 0, z: Math.cos(a) }, 3.5) !== null;
    if (!blocked(yaw)) return yaw;
    for (const off of [0.6, -0.6, 1.2, -1.2, 1.8, -1.8]) if (!blocked(yaw + off)) return yaw + off;
    return yaw + Math.PI;
  }

  private setStance(b: Bot, s: "s" | "c") {
    if (s === b.stance) return;
    b.stance = s;
    b.collider.setHalfHeight(Math.max(0.01, (HEIGHT[s] - RADIUS * 2) / 2));
  }

  update(dt: number) {
    this.now += dt;
    const humans = this.host.humans();
    const peaceful = this.host.peaceful();
    for (const b of this.bots.values()) if (b.alive) this.updateBot(b, dt, humans, peaceful);
    this.world.step();
  }

  private updateBot(b: Bot, dt: number, humans: Target[], peaceful: boolean) {
    const stats = WEAPONS[b.weapon];
    b.fireCooldown = Math.max(0, b.fireCooldown - dt);
    if (b.reloadLeft > 0) {
      b.reloadLeft -= dt;
      if (b.reloadLeft <= 0) {
        b.reloadLeft = 0;
        b.mag = stats.mag;
      }
    }
    const range = stats.range;
    b.think -= dt;
    if (b.think <= 0) {
      b.think = 0.25 + b.rng() * 0.1;
      const maxD = range > 400 ? 220 : 140;
      let best: Target | null = null;
      const attacker = b.lastHitBy ? humans.find((h) => h.id === b.lastHitBy && h.alive) : undefined;
      if (attacker && this.now - b.lastHitAt < 4 && this.canSee(b, attacker, maxD * 1.3)) best = attacker;
      if (!best) {
        const near = humans
          .filter((h) => h.alive && h.pos)
          .map((h) => ({ h, d: Math.hypot(h.pos![0] - b.x, h.pos![2] - b.z) }))
          .filter((e) => e.d < maxD)
          .sort((p, q) => p.d - q.d)
          .slice(0, 3);
        for (const { h } of near) {
          if (this.canSee(b, h, maxD)) {
            best = h;
            break;
          }
        }
      }
      if (best && !peaceful) {
        if (b.target !== best.id) {
          b.reaction = (range > 400 ? 1.1 : 0.7) + (1 - b.skill) * 0.9 + b.rng() * 0.4;
          b.crouchPref = b.rng() < 0.35;
        }
        b.target = best.id;
        b.state = "engage";
        b.lastSeen = { x: best.pos![0], y: best.pos![1], z: best.pos![2] };
        b.lastSeenTime = this.now;
      } else if (b.state === "engage") {
        b.state = "chase";
      } else if (attacker && attacker.pos && this.now - b.lastHitAt < 1 && !peaceful) {
        // Shot from somewhere unseen: head toward the shooter.
        b.state = "chase";
        b.lastSeen = { x: attacker.pos[0], y: attacker.pos[1], z: attacker.pos[2] };
        b.lastSeenTime = this.now;
      }
      if (b.state === "chase" && this.now - b.lastSeenTime > 9) {
        b.state = "roam";
        b.target = null;
        this.pickWaypoint(b);
      }
    }

    let vx = 0;
    let vz = 0;
    b.sprint = false;
    b.aim = false;
    const target = b.state === "engage" ? humans.find((h) => h.id === b.target && h.alive && h.pos) : undefined;

    if (target && target.pos) {
      const head = b.rng() < 0.18 + b.skill * 0.15;
      const tx = target.pos[0];
      const ty = target.pos[1] + EYE_HEIGHT[target.stance] * (head ? 1.02 : 0.72);
      const tz = target.pos[2];
      const ex = b.x, ey = b.y + EYE_HEIGHT[b.stance], ez = b.z;
      const dx = tx - ex, dy = ty - ey, dz = tz - ez;
      const dist = Math.hypot(dx, dy, dz);
      const wantYaw = Math.atan2(dx, dz);
      const wantPitch = Math.asin(clamp(dy / dist, -1, 1));
      const turn = 1 - Math.exp(-dt * (5 + b.skill * 6));
      b.yaw += wrap(wantYaw - b.yaw) * turn;
      b.pitch += (wantPitch - b.pitch) * turn;
      // Close in until the gun is effective, then plant feet and shoot.
      const ideal = range > 400 ? 90 : range < 150 ? 14 : 30;
      const advancing = dist > ideal + 6;
      if (advancing) {
        const yaw = this.avoid(b, wantYaw);
        const speed = dist > ideal * 2.5 ? 5.6 : 4.2;
        b.sprint = speed > 5;
        vx = Math.sin(yaw) * speed;
        vz = Math.cos(yaw) * speed;
        this.setStance(b, "s");
        if (b.mag < stats.mag * 0.6 && b.reloadLeft <= 0) b.reloadLeft = stats.reload;
      } else {
        if (dist < 4) {
          vx = -Math.sin(wantYaw) * 1.5;
          vz = -Math.cos(wantYaw) * 1.5;
        }
        b.aim = dist > 10;
        if (b.crouchPref && dist > 12) this.setStance(b, "c");
      }
      b.reaction -= dt;
      if (!advancing && b.reaction <= 0 && b.reloadLeft <= 0 && Math.abs(wrap(wantYaw - b.yaw)) < 0.12 && !peaceful) {
        if (b.mag <= 0) b.reloadLeft = stats.reload;
        else if (b.burstPause > 0) b.burstPause -= dt;
        else if (b.fireCooldown <= 0) {
          this.fire(b, target, dx / dist, dy / dist, dz / dist, dist);
          if (b.burstLeft <= 0) {
            const [lo, hi] = stats.burst;
            b.burstLeft = Math.round(lo + b.rng() * (hi - lo));
          }
          b.burstLeft--;
          if (b.burstLeft <= 0) b.burstPause = stats.auto ? 0.7 + b.rng() * 1.1 : 0.5 + b.rng() * 0.8;
        }
      }
    } else {
      if (b.state === "chase") {
        b.wx = b.lastSeen.x;
        b.wz = b.lastSeen.z;
      }
      if (b.state === "roam" && !this.host.zone.contains(b.wx, b.wz)) this.pickWaypoint(b);
      const dx = b.wx - b.x;
      const dz = b.wz - b.z;
      if (Math.hypot(dx, dz) < 3) {
        if (b.state === "chase") b.state = "roam";
        this.pickWaypoint(b);
      } else {
        const yaw = this.avoid(b, Math.atan2(dx, dz));
        b.yaw += wrap(yaw - b.yaw) * (1 - Math.exp(-dt * 5));
        b.pitch *= 1 - dt * 3;
        const outside = !this.host.zone.contains(b.x, b.z);
        const speed = outside || b.state === "chase" ? 6 : 4.4;
        b.sprint = speed > 5;
        vx = Math.sin(b.yaw) * speed;
        vz = Math.cos(b.yaw) * speed;
        this.setStance(b, "s");
      }
      if (b.mag < stats.mag * 0.5 && b.reloadLeft <= 0) b.reloadLeft = stats.reload;
    }
    this.move(b, dt, vx, vz, false);

    // Unstick: tried to move but didn't -> hop and pick a new heading.
    b.stuckTimer += dt;
    if (b.stuckTimer > 1.2) {
      const moved = Math.hypot(b.x - b.lastX, b.z - b.lastZ);
      const wanted = Math.hypot(vx, vz) * b.stuckTimer;
      if (wanted > 2 && moved < wanted * 0.15) {
        this.move(b, 0, 0, 0, true);
        if (b.state === "roam") this.pickWaypoint(b);
      }
      b.stuckTimer = 0;
      b.lastX = b.x;
      b.lastZ = b.z;
    }
  }

  private move(b: Bot, dt: number, vx: number, vz: number, jump: boolean) {
    if (jump && b.grounded) {
      b.vy = 5.2;
      b.grounded = false;
    }
    b.vy -= GRAVITY * dt;
    b.controller.computeColliderMovement(b.collider, { x: vx * dt, y: b.vy * dt, z: vz * dt }, undefined, MOVE_FILTER);
    const mv = b.controller.computedMovement();
    const hh = Math.max(0.01, (HEIGHT[b.stance] - RADIUS * 2) / 2);
    b.x += mv.x;
    b.y += mv.y;
    b.z += mv.z;
    // Never fall through the ground.
    const ground = heightAt(b.x, b.z);
    if (b.y < ground - 0.5) b.y = ground + 0.05;
    b.body.setNextKinematicTranslation({ x: b.x, y: b.y + hh + RADIUS, z: b.z });
    b.grounded = b.controller.computedGrounded();
    if (b.grounded && b.vy < 0) b.vy = -1;
    if (dt > 0) {
      b.vx = mv.x / dt;
      b.vz = mv.z / dt;
    }
  }

  /** Bot pulls the trigger: spread, then see whether the round hits a human before the world. */
  private fire(b: Bot, t: Target, dx: number, dy: number, dz: number, dist: number) {
    const stats = WEAPONS[b.weapon];
    b.mag--;
    b.fireCooldown = stats.interval;
    const tSpeed = Math.hypot(t.vx, t.vz);
    const spreadDeg = (1.3 - b.skill * 0.6) * (1.5 + dist / 35) + tSpeed * 0.45 + (t.stance === "p" ? 0.8 : t.stance === "c" ? 0.3 : 0);
    const sp = (spreadDeg * Math.PI) / 180;
    let sx = dx + (b.rng() - 0.5) * 2 * sp;
    let sy = dy + (b.rng() - 0.5) * 2 * sp * 0.7;
    let sz = dz + (b.rng() - 0.5) * 2 * sp;
    const l = Math.hypot(sx, sy, sz);
    sx /= l;
    sy /= l;
    sz /= l;
    const o = { x: b.x, y: b.y + EYE_HEIGHT[b.stance], z: b.z };
    const wall = this.castWorld(o, { x: sx, y: sy, z: sz }, stats.range) ?? stats.range;
    // Nearest human whose body (an upright cylinder) the round passes through first.
    let best: { id: string; t: number; head: boolean } | null = null;
    for (const h of this.host.humans()) {
      if (!h.alive || !h.pos) continue;
      const hit = rayVsSoldier(o, { x: sx, y: sy, z: sz }, h.pos, STANCE_HEIGHT[h.stance]);
      if (hit && hit.t < wall && (!best || hit.t < best.t)) best = { id: h.id, t: hit.t, head: hit.head };
    }
    const tEnd = best ? best.t : wall;
    const e = [o.x + sx * tEnd, o.y + sy * tEnd, o.z + sz * tEnd];
    this.host.shot(b.id, b.weapon, [o.x, o.y, o.z], e, best ? { id: best.id, head: best.head } : null);
  }

  dispose() {
    this.world.free();
  }
}

/** Ray against a soldier modelled as a vertical cylinder; the top 0.28 m is the head. */
function rayVsSoldier(o: V3, d: V3, feet: [number, number, number], height: number) {
  const r = 0.38;
  const ox = o.x - feet[0];
  const oz = o.z - feet[2];
  const a = d.x * d.x + d.z * d.z;
  if (a < 1e-8) return null;
  const bq = 2 * (ox * d.x + oz * d.z);
  const c = ox * ox + oz * oz - r * r;
  const disc = bq * bq - 4 * a * c;
  if (disc < 0) return null;
  const t = (-bq - Math.sqrt(disc)) / (2 * a);
  if (t < 0) return null;
  const y = o.y + d.y * t - feet[1];
  if (y < 0 || y > height) return null;
  return { t, head: y > height - 0.28 };
}
