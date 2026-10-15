/**
 * Battleground rules the server enforces. Keep in sync with the client's
 * frontend/app/components/battleground/engine/config.ts and Zone.ts.
 */

export const MAX_HUMANS = 25;
export const MIN_BOTS = 5;
export const MATCH_SIZE = MAX_HUMANS + MIN_BOTS; // 30
/** How long matchmaking waits for players (`MATCH_QUEUE_MS` overrides it for testing). */
export const QUEUE_WAIT_MS = Number(process.env.MATCH_QUEUE_MS) || 60_000;
/** Matches the server runs at once; more players wait in line (`MAX_MATCHES` overrides it). */
export const MAX_MATCHES = Number(process.env.MAX_MATCHES) || 2;
export const PEACE_SECONDS = 30;
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

export const WEAPONS: Record<WeaponId, {
  damage: number; head: number; interval: number; range: number;
  mag: number; reload: number; burst: [number, number]; auto: boolean;
}> = {
  m416: { damage: 12, head: 1.55, interval: 0.086, range: 300, mag: 30, reload: 2.1, burst: [3, 7], auto: true },
  kar98k: { damage: 18, head: 1.1, interval: 1.9, range: 600, mag: 5, reload: 3.2, burst: [1, 1], auto: false },
  p92: { damage: 9, head: 1.6, interval: 0.14, range: 120, mag: 15, reload: 1.6, burst: [2, 5], auto: false },
};

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
