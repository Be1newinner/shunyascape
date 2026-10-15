import { BotSim, type Target } from "./BotSim";
import { openPoints } from "./World";
import {
  AIRDROP_AT, AIRDROP_LAND, ARMOR, BOT_NAMES, GRENADE, IDLE_GRACE_SECONDS, MATCH_SIZE, MAX_HEALTH, MAX_HIT_DAMAGE, PEACE_SECONDS,
  SPAWN_GRACE_SECONDS, ServerZone, WEAPONS, airdropItems, armorHit, blastDamage, isWeapon, mulberry32, rangeFalloff,
  type Gear, type WeaponId, MATCH_SECONDS, PODIUM_XP,
} from "./rules";

/** A connected human, as the match sees them. */
export interface Peer {
  userId: string;
  name: string;
  outfit: string;
  /** Player level (bot difficulty follows the lobby's levels). */
  level: number;
  send(msg: object): void;
  match: Match | null;
}

/** What a player did in a match, for daily missions. */
export interface MatchDetail {
  /** Kills by weapon id, plus "grenade". */
  weaponKills: Record<string, number>;
  headshotKills: number;
  /** Airdrop crates they looted from. */
  airdrops: number;
}

export interface HumanResult {
  placement: number;
  kills: number;
  damage: number;
  survived: number;
  /** Still alive when the time limit ended the match. */
  survivor: boolean;
  /** Teams in the match (placement is out of this many). */
  teams: number;
  /** Played in a squad of more than one. */
  squad: boolean;
  detail: MatchDetail;
}

/** What a match reports back to the server (stats are written there, never by clients). */
export interface MatchEvents {
  result(userId: string, result: HumanResult): void;
  /** Extra XP once the match is decided (top-3 killers). */
  award(userId: string, xp: number): void;
}

export interface PodiumEntry {
  id: string;
  name: string;
  bot: boolean;
  kills: number;
  damage: number;
  rank: number;
  /** Bonus XP (players only). */
  xp: number;
}

interface Participant {
  id: string;
  name: string;
  outfit: string;
  bot: boolean;
  /** Squad id: teammates can't hurt each other and are placed together. Solo soldiers are their own team. */
  team: string;
  alive: boolean;
  hp: number;
  kills: number;
  damage: number;
  /** Last movement state a human reported (bots come from the simulation). */
  state: unknown[] | null;
  stateAt: number;
  pos: [number, number, number] | null;
  /** Shots allowed per weapon: a token bucket refilled at the weapon's fire rate. */
  ammoBucket: Map<string, { tokens: number; at: number }>;
  diedAt: number;
  /** Result already recorded (so it's never written twice). */
  finished: boolean;
  /** When the player landed and started playing (ms). */
  activeAt: number | null;
  /** When they last fired (ms); 0 = never. Firing ends spawn protection. */
  lastShotAt: number;
  /** Still in the air at the start (free-fall or parachute): bots leave them alone. */
  dropping: boolean;
  /** Armour a human says they wear, with the durability the server keeps for it. */
  gear: Gear;
  /** After armour breaks, ignore stale reports of it for a moment. */
  gearHoldUntil: number;
  /** Their grenade in the air (one at a time), to check the burst they report. */
  nade: { o: [number, number, number]; at: number } | null;
  detail: MatchDetail;
  crates: Set<string>;
}

const SNAPSHOT_MS = 66;
const BOT_TICK_MS = 50;
/** A human who stops sending (tab hidden, lag, left) stands still after this long. */
const STALE_MS = 600;
const vec3 = (v: unknown): [number, number, number] | null =>
  Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === "number" && Number.isFinite(n) && Math.abs(n) < 2000)
    ? [v[0], v[1], v[2]]
    : null;
const noGear = (): Gear => ({ vest: 0, vestDur: 0, helmet: 0, helmetDur: 0 });

/**
 * One live battleground. The server owns health, damage (armour included),
 * kills, the zone, loot claims, airdrops, results and the bots; clients only
 * send their own movement, shots and grenades. No player is special: bots run
 * here whatever anyone does, and a player who switches tabs or leaves stays in
 * the world until killed. Squads share a team: no friendly fire, one placement.
 */
export class Match {
  readonly id: string;
  readonly seed: number;
  private participants = new Map<string, Participant>();
  private peers = new Map<string, Peer>();
  private zone: ServerZone;
  private bots: BotSim;
  private startedAt = Date.now();
  private takenLoot = new Set<string>();
  /** Airdrop loot can only be picked up once its crate has landed. */
  private crates = new Map<string, number>();
  private airdropCount = 0;
  private dropCounter = 0;
  private timers: NodeJS.Timeout[] = [];
  private over = false;
  private closed = false;
  readonly difficulty: number;

  /** `groups`: squads (or single players) who came in together. */
  constructor(
    groups: Peer[][],
    private events: MatchEvents,
    private onClosed: (m: Match) => void,
  ) {
    this.id = Math.random().toString(36).slice(2, 10);
    this.seed = Math.floor(Math.random() * 2 ** 31);
    this.zone = new ServerZone(this.seed);
    const add = (id: string, name: string, outfit: string, bot: boolean, team: string) =>
      this.participants.set(id, {
        id, name, outfit, bot, team, alive: true, hp: MAX_HEALTH, kills: 0, damage: 0,
        state: null, stateAt: 0, pos: null, ammoBucket: new Map(), diedAt: 0, finished: false,
        activeAt: null, lastShotAt: 0, dropping: false, gear: noGear(), gearHoldUntil: 0, nade: null,
        detail: { weaponKills: {}, headshotKills: 0, airdrops: 0 }, crates: new Set(),
      });
    const humans = groups.flat();
    groups.forEach((g, i) => {
      const team = g.length > 1 ? `sq:${i}` : g[0].userId;
      for (const p of g) {
        add(p.userId, p.name, p.outfit, false, team);
        this.peers.set(p.userId, p);
        p.match = this;
      }
    });
    // Bots get tougher with the lobby: level 1 → rookies, level 26+ → elite.
    const avgLevel = humans.reduce((n, p) => n + (p.level || 1), 0) / Math.max(1, humans.length);
    this.difficulty = Math.max(0, Math.min(1, (avgLevel - 1) / 25));
    // Bots fill every seat the humans didn't take: always 30 soldiers in total.
    const rng = mulberry32(this.seed);
    const names = [...BOT_NAMES].sort(() => rng() - 0.5);
    const botIds: string[] = [];
    for (let i = 0; i < MATCH_SIZE - humans.length; i++) {
      const id = `bot:${i}`;
      add(id, names[i % names.length], "", true, id);
      botIds.push(id);
    }
    this.bots = new BotSim(
      {
        zone: this.zone,
        humans: () => this.targets(),
        peaceful: () => (Date.now() - this.startedAt) / 1000 < PEACE_SECONDS,
        shot: (botId, w, o, e, hit) => this.botShot(botId, w, o, e, hit),
      },
      this.seed,
      botIds,
      this.difficulty,
    );
    for (const id of botIds) {
      const p = this.participants.get(id)!;
      p.pos = this.bots.position(id);
      p.gear = this.bots.gear(id) ?? noGear();
    }
  }

  get humanCount() {
    return this.peers.size;
  }

  /** Humans as the bots see them (connected or not: everyone in the world is fair game). */
  private targets(): Target[] {
    const out: Target[] = [];
    const now = Date.now();
    for (const p of this.participants.values()) {
      if (p.bot || !p.alive || !p.pos) continue;
      const st = p.state ?? [];
      const stance = st[5] === "c" ? "c" : st[5] === "p" ? "p" : "s";
      const stale = now - p.stateAt > STALE_MS;
      out.push({
        id: p.id, alive: true, pos: p.pos, stance,
        vx: stale ? 0 : Number(st[7]) || 0, vz: stale ? 0 : Number(st[8]) || 0,
        shielded: p.dropping || (p.lastShotAt === 0 && now < this.graceEnds(p)),
        sinceShot: p.lastShotAt ? (now - p.lastShotAt) / 1000 : Infinity,
      });
    }
    return out;
  }

  /** End of a player's spawn protection (ms): a short while after they land. */
  private graceEnds(p: Participant) {
    return p.activeAt !== null ? p.activeAt + SPAWN_GRACE_SECONDS * 1000 : this.startedAt + IDLE_GRACE_SECONDS * 1000;
  }

  private roster() {
    return [...this.participants.values()].map((p) => ({ id: p.id, name: p.name, outfit: p.outfit, bot: p.bot, team: p.team }));
  }

  private aliveCount() {
    let n = 0;
    for (const p of this.participants.values()) if (p.alive) n++;
    return n;
  }

  private aliveTeams() {
    const teams = new Set<string>();
    for (const p of this.participants.values()) if (p.alive) teams.add(p.team);
    return teams;
  }

  private teamCount() {
    return new Set([...this.participants.values()].map((p) => p.team)).size;
  }

  private broadcast(msg: object, except?: string) {
    for (const [id, peer] of this.peers) if (id !== except) peer.send(msg);
  }

  start() {
    this.startedAt = Date.now();
    const roster = this.roster();
    const teams = this.teamCount();
    for (const peer of this.peers.values()) {
      peer.send({
        t: "start", match: this.id, seed: this.seed, you: peer.userId, host: null, roster, peace: PEACE_SECONDS,
        grace: SPAWN_GRACE_SECONDS, limit: MATCH_SECONDS, difficulty: this.difficulty, teams,
      });
    }
    let last = Date.now();
    // An error in one tick is logged, never allowed to crash the game server.
    const guard = (name: string, fn: () => void) => () => {
      try {
        fn();
      } catch (err) {
        console.error(`Match ${this.id} ${name} tick failed:`, err);
      }
    };
    this.timers.push(setInterval(guard("bots", () => {
      const now = Date.now();
      const dt = Math.min(0.2, (now - last) / 1000);
      last = now;
      this.botTick(dt);
    }), BOT_TICK_MS));
    this.timers.push(setInterval(guard("snapshot", () => this.snapshot()), SNAPSHOT_MS));
    this.timers.push(setInterval(guard("zone", () => this.zoneTick(1)), 1000));
  }

  private botTick(dt: number) {
    if (this.over) return;
    this.bots.update(dt);
    for (const p of this.participants.values()) if (p.bot && p.alive) p.pos = this.bots.position(p.id);
  }

  /** Everyone's latest movement, ~15 times a second. */
  private snapshot() {
    const now = Date.now();
    const s: unknown[] = [];
    for (const p of this.participants.values()) {
      if (!p.alive) continue;
      if (p.bot) {
        const st = this.bots.state(p.id);
        if (st) s.push([p.id, ...st]);
      } else if (p.state) {
        const st = [...p.state];
        // Not heard from lately (tab hidden, lag, gone): standing still where they were.
        if (now - p.stateAt > STALE_MS) {
          st[6] = (Number(st[6]) || 0) & 4;
          st[7] = 0;
          st[8] = 0;
        }
        s.push([p.id, ...st]);
      }
    }
    this.broadcast({ t: "snap", s, alive: this.aliveCount() });
  }

  private elapsed() {
    return Math.floor((Date.now() - this.startedAt) / 1000);
  }

  private zoneTick(dt: number) {
    if (this.over) return;
    // Time's up: everyone still standing survives the match.
    if (this.elapsed() >= MATCH_SECONDS) {
      this.end("time");
      return;
    }
    this.zone.update(dt);
    this.broadcast({ t: "zone", ...this.zone.state(), elapsed: this.elapsed() });
    if (this.airdropCount < AIRDROP_AT.length && this.elapsed() >= AIRDROP_AT[this.airdropCount]) this.airdrop();
    const idleUntil = this.startedAt + IDLE_GRACE_SECONDS * 1000;
    for (const p of this.participants.values()) {
      // Someone who never jumped out of the plane is put on the ground, in play like everyone else.
      if (!p.bot && p.alive && !p.pos && Date.now() > idleUntil + 30_000) {
        const pt = openPoints[Math.floor(Math.random() * openPoints.length)];
        p.pos = [pt[0], 0, pt[1]];
      }
      if (!p.alive || !p.pos) continue;
      if (!this.zone.contains(p.pos[0], p.pos[2])) this.applyDamage(p, this.zone.dps, null, "body", "Blue zone");
    }
  }

  /** A crate comes down somewhere inside the next safe zone. */
  private airdrop() {
    const n = ++this.airdropCount;
    const z = this.zone.state();
    const r = Math.max(10, z.nRadius * 0.6);
    const near = openPoints.filter((p) => Math.hypot(p[0] - z.nx, p[1] - z.nz) < r);
    const pt = near.length ? near[Math.floor(Math.random() * near.length)] : [z.nx, z.nz];
    const id = `A${n}`;
    const items = airdropItems(n).map((item, k) => ({ id: `${id}-${k}`, item }));
    this.crates.set(id, Date.now() + AIRDROP_LAND * 1000);
    this.broadcast({ t: "airdrop", id, x: pt[0], z: pt[1], items, land: AIRDROP_LAND });
    this.bots.addPoi(pt[0], pt[1]);
  }

  handle(peer: Peer, msg: Record<string, unknown>) {
    if (this.over) return;
    const me = this.participants.get(peer.userId);
    if (!me) return;
    switch (msg.t) {
      case "s": {
        if (!me.alive || !Array.isArray(msg.d)) return;
        const d = msg.d as unknown[];
        const pos = vec3(d.slice(0, 3));
        if (!pos || d.length > 16) return;
        me.state = d;
        me.stateAt = Date.now();
        me.pos = pos;
        me.dropping = ((Number(d[6]) || 0) & 96) !== 0;
        this.reportedGear(me, Number(d[11]) || 0);
        break;
      }
      case "shot":
        this.humanShot(peer, me, msg);
        break;
      case "play":
        // Landed: spawn protection runs out shortly.
        me.activeAt ??= Date.now();
        me.dropping = false;
        break;
      case "nade":
        this.grenadeThrown(peer, me, msg);
        break;
      case "boom":
        this.grenadeBurst(peer, me, msg);
        break;
      case "pick": {
        const id = String(msg.id ?? "");
        if (!me.alive || !id || id.length > 32) return;
        const crate = id.startsWith("A") ? id.split("-")[0] : null;
        const landsAt = crate ? this.crates.get(crate) : undefined;
        if (this.takenLoot.has(id) || (landsAt !== undefined && Date.now() < landsAt - 1500)) {
          peer.send({ t: "pick-denied", id });
          return;
        }
        this.takenLoot.add(id);
        if (crate && landsAt !== undefined && !me.crates.has(crate)) {
          me.crates.add(crate);
          me.detail.airdrops++;
        }
        this.broadcast({ t: "taken", id, by: me.id });
        break;
      }
      case "drop": {
        // Gear a player puts on the ground (swapped guns, their kit when they die).
        const pos = vec3(msg.pos);
        if (!pos || typeof msg.item !== "object" || msg.item === null) return;
        if (JSON.stringify(msg.item).length > 200) return;
        this.spawnLoot(msg.item, pos);
        break;
      }
    }
  }

  /**
   * Armour a player reports (vest + helmet × 4). Putting on a better piece
   * starts it at full durability; the server keeps wearing it down from there.
   */
  private reportedGear(p: Participant, code: number) {
    if (Date.now() < p.gearHoldUntil) return;
    const vest = Math.max(0, Math.min(3, Math.floor(code % 4)));
    const helmet = Math.max(0, Math.min(3, Math.floor(code / 4)));
    if (vest !== p.gear.vest) p.gear = { ...p.gear, vest, vestDur: ARMOR.vest.durability[vest] };
    if (helmet !== p.gear.helmet) p.gear = { ...p.gear, helmet, helmetDur: ARMOR.helmet.durability[helmet] };
  }

  private spawnLoot(item: unknown, pos: [number, number, number]) {
    this.broadcast({ t: "spawn", id: `d${++this.dropCounter}`, item, pos });
  }

  /** Fire-rate check with a little slack for network bunching. */
  private allowShot(p: Participant, w: WeaponId) {
    const stats = WEAPONS[w];
    const now = Date.now();
    const bucket = p.ammoBucket.get(w) ?? { tokens: 3, at: now };
    bucket.tokens = Math.min(3, bucket.tokens + (now - bucket.at) / 1000 / (stats.interval * 0.85));
    bucket.at = now;
    p.ammoBucket.set(w, bucket);
    if (bucket.tokens < 1) return false;
    bucket.tokens -= 1;
    return true;
  }

  private humanShot(peer: Peer, shooter: Participant, msg: Record<string, unknown>) {
    if (!shooter.alive || String(msg.by ?? "") !== shooter.id) return;
    const w = msg.w;
    if (!isWeapon(w)) return;
    const o = vec3(msg.o);
    const e = vec3(msg.e);
    if (!o || !e || !this.allowShot(shooter, w)) return;
    shooter.lastShotAt = Date.now();
    const hit = msg.hit as { id?: unknown; head?: unknown } | undefined;
    this.broadcast({ t: "fx", by: shooter.id, w, o, e, h: hit ? 1 : 0 }, peer.userId);
    if (!hit || typeof hit.id !== "string") return;
    const target = this.participants.get(hit.id);
    if (!target || !target.alive || target === shooter || !target.pos) return;
    if (target.team === shooter.team) return; // no friendly fire
    // The claimed impact point has to be on the target, within the gun's range.
    const [tx, ty, tz] = target.pos;
    if (Math.hypot(e[0] - tx, e[2] - tz) > 3 || e[1] < ty - 0.8 || e[1] > ty + 2.6) return;
    const dist = Math.hypot(o[0] - tx, o[1] - ty, o[2] - tz);
    if (dist > WEAPONS[w].range + 15) return;
    const head = hit.head === true;
    if (target.bot) this.bots.wasHit(target.id, shooter.id);
    const raw = Math.min(MAX_HIT_DAMAGE, WEAPONS[w].damage * (head ? WEAPONS[w].head : 1) * rangeFalloff(w, dist));
    this.applyDamage(target, raw, shooter, head ? "head" : "body", w);
  }

  private botShot(botId: string, w: WeaponId, o: number[], e: number[], hit: { id: string; head: boolean } | null) {
    const bot = this.participants.get(botId);
    if (!bot || !bot.alive) return;
    const r = (n: number) => Math.round(n * 100) / 100;
    this.broadcast({ t: "fx", by: botId, w, o: o.map(r), e: e.map(r), h: hit ? 1 : 0 });
    if (!hit) return;
    const target = this.participants.get(hit.id);
    if (!target || target.bot || !target.alive) return;
    const dist = Math.hypot(e[0] - o[0], e[1] - o[1], e[2] - o[2]);
    const raw = Math.min(MAX_HIT_DAMAGE, WEAPONS[w].damage * (hit.head ? WEAPONS[w].head : 1) * rangeFalloff(w, dist));
    this.applyDamage(target, raw, bot, hit.head ? "head" : "body", w);
  }

  /** Thrown: everyone else sees the grenade fly. One at a time per player. */
  private grenadeThrown(peer: Peer, p: Participant, msg: Record<string, unknown>) {
    const o = vec3(msg.o);
    const v = vec3(msg.v);
    if (!p.alive || !o || !v || !p.pos) return;
    if (p.nade && Date.now() - p.nade.at < 1000) return;
    if (Math.hypot(o[0] - p.pos[0], o[2] - p.pos[2]) > 4 || Math.hypot(...v) > GRENADE.throwSpeed + 2) return;
    p.nade = { o, at: Date.now() };
    p.lastShotAt = Date.now();
    this.broadcast({ t: "nade", by: p.id, o, v }, peer.userId);
  }

  /** The thrower's grenade burst: it has to be near where it was thrown, after a plausible fuse. */
  private grenadeBurst(peer: Peer, p: Participant, msg: Record<string, unknown>) {
    const pos = vec3(msg.pos);
    const nade = p.nade;
    if (!pos || !nade) return;
    const age = (Date.now() - nade.at) / 1000;
    if (age < GRENADE.fuse - 1.2 || age > GRENADE.fuse + 3) return;
    if (Math.hypot(pos[0] - nade.o[0], pos[2] - nade.o[2]) > 70) return;
    p.nade = null;
    this.broadcast({ t: "boom", by: p.id, pos }, peer.userId);
    const from = { x: pos[0], y: pos[1] + 0.3, z: pos[2] };
    for (const t of this.participants.values()) {
      if (!t.alive || !t.pos) continue;
      if (t !== p && t.team === p.team) continue;
      const chest = { x: t.pos[0], y: t.pos[1] + 1.1, z: t.pos[2] };
      const d = Math.hypot(chest.x - from.x, chest.y - from.y, chest.z - from.z);
      if (d >= GRENADE.radius || !this.bots.lineOfSight(from, chest)) continue;
      if (t.bot) this.bots.wasHit(t.id, p.id);
      this.applyDamage(t, blastDamage(d), p, "blast", "grenade");
    }
  }

  private applyDamage(target: Participant, raw: number, by: Participant | null, part: "head" | "body" | "blast", weapon: string) {
    if (!target.alive) return;
    // Zone damage ignores armour; bullets and blasts don't.
    const hit = by ? armorHit(raw, target.gear, part) : { damage: raw, vestWear: 0, helmetWear: 0 };
    const g = target.gear;
    const hadGear = g.vest + g.helmet;
    if (hit.vestWear && g.vest) {
      g.vestDur -= hit.vestWear;
      if (g.vestDur <= 0) g.vest = g.vestDur = 0;
    }
    if (hit.helmetWear && g.helmet) {
      g.helmetDur -= hit.helmetWear;
      if (g.helmetDur <= 0) g.helmet = g.helmetDur = 0;
    }
    if (g.vest + g.helmet < hadGear) target.gearHoldUntil = Date.now() + 2000;
    // Count only the health actually taken (no overkill).
    const dmg = Math.min(target.hp, hit.damage);
    target.hp = Math.max(0, target.hp - dmg);
    if (by && by !== target) by.damage += dmg;
    const r = (n: number) => Math.round(n * 10) / 10;
    this.broadcast({
      t: "hp", id: target.id, hp: r(target.hp), by: by?.id ?? null, head: part === "head",
      ...(!target.bot && hadGear ? { ar: [g.vest, r(g.vestDur), g.helmet, r(g.helmetDur)] } : {}),
    });
    if (target.hp <= 0) this.kill(target, by, weapon, part === "head");
  }

  private kill(victim: Participant, killer: Participant | null, weapon: string, head: boolean) {
    victim.alive = false;
    victim.diedAt = Date.now();
    if (killer && killer !== victim) {
      killer.kills++;
      if (!killer.bot) {
        killer.detail.weaponKills[weapon] = (killer.detail.weaponKills[weapon] ?? 0) + 1;
        if (head) killer.detail.headshotKills++;
      }
    }
    this.broadcast({ t: "kill", victim: victim.id, killer: killer?.id ?? null, w: weapon, head, alive: this.aliveCount() });
    if (victim.bot) {
      // A dead bot's kit goes on the ground for anyone to loot.
      const kit = this.bots.loadout(victim.id);
      const pos = this.bots.position(victim.id);
      this.bots.kill(victim.id);
      if (kit && pos) {
        const ammo = kit.weapon === "m416" ? "5.56mm" : kit.weapon === "kar98k" ? "7.62mm" : "9mm";
        this.spawnLoot({ kind: "weapon", weapon: kit.weapon, mag: kit.mag, scope: kit.scope }, [pos[0] + 0.8, pos[1] + 0.02, pos[2]]);
        this.spawnLoot({ kind: "ammo", ammo, amount: Math.round(WEAPONS[kit.weapon].mag * 1.5) }, [pos[0] + 0.5, pos[1] + 0.02, pos[2] + 0.6]);
        if (Math.random() < 0.35) this.spawnLoot({ kind: "medkit" }, [pos[0] - 0.6, pos[1] + 0.02, pos[2] + 0.5]);
        const g = victim.gear;
        if (g.vest) this.spawnLoot({ kind: "armor", slot: "vest", level: g.vest, dur: Math.round(g.vestDur) }, [pos[0] + 0.2, pos[1] + 0.02, pos[2] - 0.7]);
        if (g.helmet) this.spawnLoot({ kind: "armor", slot: "helmet", level: g.helmet, dur: Math.round(g.helmetDur) }, [pos[0] - 0.5, pos[1] + 0.02, pos[2] - 0.5]);
      }
    } else if (!this.teamAlive(victim.team)) {
      // The last of their squad went down: the whole squad is placed now.
      this.finishTeam(victim.team, this.aliveTeams().size + 1);
    }
    this.checkEnd();
  }

  private teamAlive(team: string) {
    for (const p of this.participants.values()) if (p.team === team && p.alive) return true;
    return false;
  }

  /** Record the result of every player in `team` not already done. */
  private finishTeam(team: string, placement: number, survivors = false) {
    for (const p of this.participants.values()) {
      if (p.team === team && !p.bot) this.finishHuman(p, placement, survivors && p.alive);
    }
  }

  private finishHuman(p: Participant, placement: number, survivor = false) {
    if (p.finished) return;
    p.finished = true;
    const squad = [...this.participants.values()].filter((q) => q.team === p.team).length > 1;
    const result: HumanResult = {
      placement,
      kills: p.kills,
      damage: Math.round(p.damage),
      survived: Math.round(((p.diedAt || Date.now()) - this.startedAt) / 1000),
      survivor,
      teams: this.teamCount(),
      squad,
      detail: p.detail,
    };
    this.peers.get(p.id)?.send({ t: "result", ...result });
    this.events.result(p.id, result);
  }

  /** Top 3 by kills (damage breaks ties); players on it earn bonus XP. */
  private podium(): PodiumEntry[] {
    return [...this.participants.values()]
      .filter((p) => p.kills > 0)
      .sort((a, b) => b.kills - a.kills || b.damage - a.damage)
      .slice(0, 3)
      .map((p, i) => ({
        id: p.id,
        name: p.name,
        bot: p.bot,
        kills: p.kills,
        damage: Math.round(p.damage),
        rank: i + 1,
        xp: p.bot ? 0 : PODIUM_XP[i],
      }));
  }

  private checkEnd() {
    if (this.over) return;
    const teams = this.aliveTeams();
    const watching = [...this.peers.keys()].some((id) => this.participants.get(id)?.alive);
    // Over when one team is left, or no connected player is still in it.
    if (teams.size > 1 && watching) return;
    this.end(teams.size === 1 ? "last" : "abandoned");
  }

  /**
   * The match is decided: last team standing, time ran out, or no connected
   * player is left in it.
   */
  private end(reason: "last" | "time" | "abandoned") {
    if (this.over) return;
    this.over = true;
    const alive = [...this.participants.values()].filter((p) => p.alive);
    const teams = [...new Set(alive.map((p) => p.team))];
    let winnerTeam: string | null = null;
    if (reason === "last" && teams.length === 1) {
      winnerTeam = teams[0];
      this.finishTeam(winnerTeam, 1);
    } else if (reason === "time") {
      // Time's up: surviving teams are ranked by their kills (then damage) for places 1, 2, 3…
      const score = (team: string) => {
        let k = 0;
        let d = 0;
        for (const p of this.participants.values()) {
          if (p.team !== team) continue;
          k += p.kills;
          d += p.damage;
        }
        return k * 1e6 + d;
      };
      teams.sort((a, b) => score(b) - score(a)).forEach((t, i) => this.finishTeam(t, i + 1, true));
    } else {
      // Players who left but were never killed share the best place still open.
      for (const t of teams) this.finishTeam(t, teams.length);
    }
    const podium = this.podium();
    for (const p of podium) if (p.xp > 0) this.events.award(p.id, p.xp);
    const winner = winnerTeam ? alive.find((p) => p.team === winnerTeam)?.id ?? null : null;
    this.broadcast({ t: "end", winner, winnerTeam, reason, podium, survivors: alive.length });
    // Leave a moment for the result screens, then free the room.
    setTimeout(() => this.close(), 15_000);
  }

  /** Decided (only the results screen is left): its slot can host the next match. */
  get ended() {
    return this.over;
  }

  /** Can this player leave without abandoning anyone (dead, result recorded)? */
  isDone(userId: string) {
    const p = this.participants.get(userId);
    return !p || !p.alive || this.over;
  }

  /** What the lobby shows about this match (no player names). */
  summary() {
    let humansAlive = 0;
    let humans = 0;
    let alive = 0;
    for (const p of this.participants.values()) {
      if (p.alive) alive++;
      if (p.bot) continue;
      humans++;
      if (p.alive) humansAlive++;
    }
    const elapsed = Math.round((Date.now() - this.startedAt) / 1000);
    return { id: this.id, elapsed, humans, humansAlive, alive, over: this.over };
  }

  /** A player disconnected or left: their soldier stays in the world until someone kills it. */
  leave(peer: Peer) {
    this.peers.delete(peer.userId);
    peer.match = null;
    if (this.peers.size === 0 && this.over) this.close();
    else this.checkEnd();
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.over = true;
    for (const t of this.timers) clearInterval(t);
    this.timers = [];
    for (const p of this.peers.values()) p.match = null;
    this.peers.clear();
    this.bots.dispose();
    this.onClosed(this);
  }
}
