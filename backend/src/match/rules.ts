/**
 * Battleground rules the server enforces. Keep in sync with the client's
 * frontend/app/components/battleground/engine/config.ts and Zone.ts.
 */

export const MAX_HUMANS = 25;
export const MIN_BOTS = 5;
export const MATCH_SIZE = MAX_HUMANS + MIN_BOTS; // 30
/** How long matchmaking waits for players (`MATCH_QUEUE_MS` overrides it for testing). */
export const QUEUE_WAIT_MS = Number(process.env.MATCH_QUEUE_MS) || 30_000;
/** Matches the server runs at once; more players wait in line (`MAX_MATCHES` overrides it). */
export const MAX_MATCHES = Number(process.env.MAX_MATCHES) || 2;
export const PEACE_SECONDS = 30;
/**
 * Spawn protection: bots ignore a player until this long after they actually
 * start playing (they may still be loading when the match begins), or until
 * they fire. A player who never starts is fair game after `IDLE_GRACE_SECONDS`.
 */
export const SPAWN_GRACE_SECONDS = 15;
export const IDLE_GRACE_SECONDS = 75;
/**
 * How close a player has to be before a bot notices them (it still needs to
 * see them). Snipers look further. Crouching and lying down shrink it.
 */
export const BOT_NOTICE_RANGE = 55;
export const BOT_NOTICE_RANGE_SNIPER = 95;
export const NOTICE_STANCE = { s: 1, c: 0.7, p: 0.4 } as const;
/** Bots hear gunfire this close and come for the shooter, even without seeing them. */
export const BOT_HEARING_RANGE = 45;
/** At most this many bots hunt the same player at once (more join only if shot). */
export const MAX_HUNTERS = 3;
/** A match lasts at most this long (`MATCH_SECONDS` overrides it for testing). */
export const MATCH_SECONDS = Number(process.env.MATCH_SECONDS) || 600;
/** Bonus XP for still being alive when time runs out. */
export const SURVIVOR_XP = 75;
/** Bonus XP for the top 3 killers of a match. */
export const PODIUM_XP = [150, 100, 50];
export const MAX_HIT_DAMAGE = 19;
export const MAX_HEALTH = 100;
export const MAP_HALF = 320;

export type WeaponId = "m416" | "kar98k" | "p92";

/**
 * `range`: the furthest a round travels (it stops there, hitting nothing).
 * Damage fades from `falloff` metres down to 60% at `range`.
 */
export const WEAPONS: Record<WeaponId, {
  damage: number; head: number; interval: number; range: number; falloff: number;
  mag: number; reload: number; burst: [number, number]; auto: boolean;
}> = {
  m416: { damage: 12, head: 1.55, interval: 0.086, range: 220, falloff: 60, mag: 30, reload: 2.1, burst: [3, 7], auto: true },
  kar98k: { damage: 18, head: 1.1, interval: 1.9, range: 500, falloff: 500, mag: 5, reload: 3.2, burst: [1, 1], auto: false },
  p92: { damage: 9, head: 1.6, interval: 0.14, range: 70, falloff: 25, mag: 15, reload: 1.6, burst: [2, 5], auto: false },
};

/** Damage multiplier at `dist` metres: full up to the gun's falloff distance, 60% at its range. */
export function rangeFalloff(w: WeaponId, dist: number) {
  const s = WEAPONS[w];
  if (dist <= s.falloff) return 1;
  return Math.max(0.6, 1 - (0.4 * (dist - s.falloff)) / Math.max(1, s.range - s.falloff));
}

/** Body armour (level 0 = none). Keep in sync with the client's config.ts. */
export const ARMOR = {
  vest: { reduce: [0, 0.3, 0.4, 0.55], durability: [0, 80, 120, 170] },
  helmet: { reduce: [0, 0.3, 0.4, 0.55], durability: [0, 60, 90, 130] },
} as const;

export interface Gear {
  vest: number;
  vestDur: number;
  helmet: number;
  helmetDur: number;
}

/** Damage after armour, and the wear on each piece (see the client's `armorHit`). */
export function armorHit(raw: number, gear: Gear, part: "head" | "body" | "blast") {
  const slot = part === "head" ? "helmet" : "vest";
  const level = gear[slot];
  if (!level) return { damage: raw, vestWear: 0, helmetWear: 0 };
  const reduce = ARMOR[slot].reduce[level] * (part === "blast" ? 0.5 : 1);
  const wear = raw * (part === "blast" ? 0.5 : 1);
  return { damage: raw * (1 - reduce), vestWear: slot === "vest" ? wear : 0, helmetWear: slot === "helmet" ? wear : 0 };
}

export const GRENADE = { fuse: 3.6, radius: 7.5, maxDamage: 78, throwSpeed: 19, carry: 4 } as const;
export function blastDamage(dist: number) {
  if (dist >= GRENADE.radius) return 0;
  return GRENADE.maxDamage * Math.pow(1 - dist / GRENADE.radius, 1.3);
}

/** Soldier heights by stance (feet to top of head), as on the client. */
export const STANCE_HEIGHT = { s: 1.8, c: 1.25, p: 0.62 } as const;
export const EYE_HEIGHT = { s: 1.62, c: 1.12, p: 0.42 } as const;

export function isWeapon(w: unknown): w is WeaponId {
  return typeof w === "string" && w in WEAPONS;
}

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Phase {
  wait: number;
  shrink: number;
  radius: number;
  dps: number;
}

/** Same schedule as the client's Zone.ts. */
export const PHASES: Phase[] = [
  { wait: 75, shrink: 50, radius: 210, dps: 1 },
  { wait: 60, shrink: 40, radius: 130, dps: 2 },
  { wait: 50, shrink: 35, radius: 75, dps: 4 },
  { wait: 40, shrink: 30, radius: 38, dps: 7 },
  { wait: 30, shrink: 25, radius: 14, dps: 10 },
  { wait: 25, shrink: 20, radius: 0, dps: 14 },
];

export interface ZoneState {
  cx: number;
  cz: number;
  radius: number;
  nx: number;
  nz: number;
  nRadius: number;
  phase: number;
  shrinking: boolean;
  timer: number;
  dps: number;
}

/** Shrinking safe zone, advanced by the match clock. */
export class ServerZone {
  cx = 0;
  cz = 0;
  radius = 340;
  nx = 0;
  nz = 0;
  nRadius = PHASES[0].radius;
  phase = 0;
  shrinking = false;
  timer = PHASES[0].wait;
  private fromX = 0;
  private fromZ = 0;
  private fromR = 340;
  private rng: () => number;

  constructor(seed: number) {
    this.rng = mulberry32(seed ^ 0x5eed);
    this.pickNext();
  }

  private pickNext() {
    const p = PHASES[this.phase];
    if (!p) return;
    const maxOff = Math.max(0, this.radius - p.radius) * 0.85;
    const a = this.rng() * Math.PI * 2;
    const r = Math.sqrt(this.rng()) * maxOff;
    this.nx = this.cx + Math.cos(a) * r;
    this.nz = this.cz + Math.sin(a) * r;
    this.nRadius = p.radius;
  }

  get dps() {
    return PHASES[Math.min(this.phase, PHASES.length - 1)].dps;
  }

  update(dt: number) {
    const p = PHASES[this.phase];
    if (!p) return;
    this.timer -= dt;
    if (!this.shrinking && this.timer <= 0) {
      this.shrinking = true;
      this.timer = p.shrink;
      this.fromX = this.cx;
      this.fromZ = this.cz;
      this.fromR = this.radius;
    } else if (this.shrinking) {
      const t = 1 - Math.max(0, this.timer) / p.shrink;
      this.cx = this.fromX + (this.nx - this.fromX) * t;
      this.cz = this.fromZ + (this.nz - this.fromZ) * t;
      this.radius = this.fromR + (this.nRadius - this.fromR) * t;
      if (this.timer <= 0) {
        this.shrinking = false;
        this.phase++;
        const next = PHASES[this.phase];
        if (next) {
          this.timer = next.wait;
          this.pickNext();
        }
      }
    }
  }

  contains(x: number, z: number) {
    return Math.hypot(x - this.cx, z - this.cz) <= this.radius;
  }

  state(): ZoneState {
    return {
      cx: this.cx, cz: this.cz, radius: this.radius,
      nx: this.nx, nz: this.nz, nRadius: this.nRadius,
      phase: this.phase + 1, shrinking: this.shrinking, timer: Math.max(0, this.timer), dps: this.dps,
    };
  }
}

export const BOT_NAMES = [
  "Ravi_OP", "NinjaArjun", "xSniperKing", "DesiDragon", "Ghost_Vikram", "ShadowPriya", "Thunder_Kabir",
  "MaverickRaj", "ViperAnaya", "BlazeRohan", "SilentIshaan", "FalconMeera", "Rogue_Aditya", "TitanVeer",
  "PhoenixDiya", "Cobra_Nikhil", "StormTara", "Havoc_Aman", "LoneWolfDev", "RaptorZoya", "Spectre_Om",
  "Mamba_Riya", "Bullseye_Yash", "IronKaran", "Nova_Sana", "Reaper_Jay", "Hawk_Neel", "Saber_Isha",
  "Tusker_Ajay", "Blitz_Kiara",
];

/** Airdrops land at these points of the match clock (seconds), inside the next zone. */
export const AIRDROP_AT = [140, 290];
/** Seconds from the announcement until the crate touches down (the client's plane + parachute). */
export const AIRDROP_LAND = 32;

/** What's in airdrop crate number `n` (same as the client's `airdropItems`). */
export function airdropItems(n: number): object[] {
  const gun =
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
