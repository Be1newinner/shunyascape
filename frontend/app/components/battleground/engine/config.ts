/** Tunables shared by the battleground engine and HUD. */

export const MAP_SIZE = 640; // metres, square, centred on the origin
export const MAP_HALF = MAP_SIZE / 2;
export const TERRAIN_SEGMENTS = 256;
export const ASSET_ROOT = "/battleground";

export const BOT_COUNT = 24;
export const PLAYER_MAX_HEALTH = 100;
/** No single bullet takes more than this, so anyone survives at least 5 hits. */
export const MAX_HIT_DAMAGE = 19;

export type Quality = "mobile" | "low" | "medium" | "high";

export interface QualityPreset {
  pixelRatio: number;
  shadowMapSize: number;
  shadows: boolean;
  grassPerChunk: number;
  grassRadius: number; // chunks around the player
  treeLodDistance: number;
  fogFar: number;
  antialias: boolean;
  /** Soldiers closer than this get full animation (hand IK etc). */
  detailDistance: number;
}

export const QUALITY: Record<Quality, QualityPreset> = {
  // Phones: no shadows, short view distance, sparse grass; resolution adapts to keep the frame rate up.
  mobile: { pixelRatio: 1, shadowMapSize: 1024, shadows: false, grassPerChunk: 180, grassRadius: 2, treeLodDistance: 32, fogFar: 280, antialias: false, detailDistance: 35 },
  low: { pixelRatio: 0.75, shadowMapSize: 1024, shadows: false, grassPerChunk: 380, grassRadius: 3, treeLodDistance: 45, fogFar: 380, antialias: false, detailDistance: 50 },
  medium: { pixelRatio: 1, shadowMapSize: 2048, shadows: true, grassPerChunk: 700, grassRadius: 3, treeLodDistance: 70, fogFar: 520, antialias: true, detailDistance: 70 },
  high: { pixelRatio: Math.min(2, typeof window !== "undefined" ? window.devicePixelRatio : 1), shadowMapSize: 4096, shadows: true, grassPerChunk: 1000, grassRadius: 4, treeLodDistance: 110, fogFar: 700, antialias: true, detailDistance: 90 },
};

/** Phones and tablets: touch is the main input. */
export function isTouchDevice() {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(pointer: coarse)").matches || navigator.maxTouchPoints > 1;
}

export type AmmoType = "5.56mm" | "7.62mm" | "9mm";
export type WeaponId = "m416" | "kar98k" | "p92";
export type WeaponSlot = "primary" | "secondary";

export interface WeaponStats {
  id: WeaponId;
  name: string;
  ammo: AmmoType;
  slot: WeaponSlot;
  magSize: number;
  /** Seconds between shots. */
  fireInterval: number;
  auto: boolean;
  damage: number;
  headMultiplier: number;
  /** Furthest a round travels, in metres: it stops there and hits nothing. */
  range: number;
  /** Full damage up to this distance; it fades to 60% at `range`. */
  falloff: number;
  reloadTime: number;
  /** Cone half-angle in degrees. */
  hipSpread: number;
  adsSpread: number;
  /** Camera kick per shot in radians. */
  recoilPitch: number;
  recoilYaw: number;
  /** Field of view while aiming down the iron sights (no scope attached). */
  ironFov: number;
  /** Can take a scope attachment. */
  takesScope: boolean;
  /** Bot reaction: how many shots a bot fires per burst. */
  botBurst: [number, number];
  soundPitch: number;
}

export const WEAPONS: Record<WeaponId, WeaponStats> = {
  m416: {
    id: "m416", name: "M416", ammo: "5.56mm", slot: "primary", magSize: 30, fireInterval: 0.086, auto: true,
    damage: 12, headMultiplier: 1.55, range: 220, falloff: 60, reloadTime: 2.1, hipSpread: 2.6, adsSpread: 0.35,
    recoilPitch: 0.0085, recoilYaw: 0.0045, ironFov: 55, takesScope: true, botBurst: [3, 7], soundPitch: 1,
  },
  kar98k: {
    id: "kar98k", name: "Kar98k", ammo: "7.62mm", slot: "primary", magSize: 5, fireInterval: 1.9, auto: false,
    damage: 18, headMultiplier: 1.1, range: 500, falloff: 500, reloadTime: 3.2, hipSpread: 4.0, adsSpread: 0.03,
    recoilPitch: 0.045, recoilYaw: 0.006, ironFov: 50, takesScope: true, botBurst: [1, 1], soundPitch: 0.72,
  },
  p92: {
    id: "p92", name: "P92", ammo: "9mm", slot: "secondary", magSize: 15, fireInterval: 0.14, auto: false,
    damage: 9, headMultiplier: 1.6, range: 70, falloff: 25, reloadTime: 1.6, hipSpread: 2.2, adsSpread: 0.6,
    recoilPitch: 0.012, recoilYaw: 0.006, ironFov: 58, takesScope: false, botBurst: [2, 5], soundPitch: 1.35,
  },
};

/** Damage multiplier at `dist` metres (same formula as the game server). */
export function rangeFalloff(stats: WeaponStats, dist: number) {
  if (dist <= stats.falloff) return 1;
  return Math.max(0.6, 1 - (0.4 * (dist - stats.falloff)) / Math.max(1, stats.range - stats.falloff));
}

/**
 * Bots notice a player who comes this close (and is in sight); snipers look
 * further, crouching / lying down shrinks it. Once a bot has noticed you it
 * hunts you until one of you is dead. Same numbers as the game server.
 */
export const BOT_NOTICE_RANGE = 55;
export const BOT_NOTICE_RANGE_SNIPER = 95;
export const NOTICE_STANCE = { stand: 1, crouch: 0.7, prone: 0.4 } as const;
/** Bots hear gunfire this close and come for the shooter. */
export const BOT_HEARING_RANGE = 45;
/** At most this many bots hunt the same player at once (more only if shot). */
export const MAX_HUNTERS = 3;

export type ScopeId = "reddot" | "2x" | "4x" | "6x";

export interface ScopeStats {
  id: ScopeId;
  name: string;
  /** Field of view when aiming through it. */
  fov: number;
  /** Magnified scopes fill the screen with a scope mask. */
  magnified: boolean;
  rank: number;
}

export const SCOPES: Record<ScopeId, ScopeStats> = {
  reddot: { id: "reddot", name: "Red Dot", fov: 50, magnified: false, rank: 1 },
  "2x": { id: "2x", name: "2× Scope", fov: 34, magnified: true, rank: 2 },
  "4x": { id: "4x", name: "4× Scope", fov: 17, magnified: true, rank: 3 },
  "6x": { id: "6x", name: "6× Scope", fov: 11.5, magnified: true, rank: 4 },
};

export const AMMO_PICKUP: Record<AmmoType, number> = { "5.56mm": 60, "7.62mm": 20, "9mm": 30 };
export const MEDKIT_HEAL_TIME = 4.5;

/** Keyboard layout requested for the battleground: WASD + U I J K O L + Space. */
export const CONTROLS = [
  { keys: "W A S D", action: "Move" },
  { keys: "Mouse", action: "Look around" },
  { keys: "Left click", action: "Shoot" },
  { keys: "Right click", action: "Aim / scope" },
  { keys: "Space", action: "Jump" },
  { keys: "Shift", action: "Sprint" },
  { keys: "U", action: "Reload" },
  { keys: "I", action: "Pick up" },
  { keys: "J", action: "Crouch" },
  { keys: "K", action: "Prone" },
  { keys: "O", action: "Switch weapon" },
  { keys: "L", action: "Use med kit" },
  { keys: "1 / 2 / 3", action: "Weapon slots" },
  { keys: "Mouse wheel", action: "Next weapon" },
] as const;

export const BOT_NAMES = [
  "Ravi_OP", "NinjaArjun", "xSniperKing", "DesiDragon", "Ghost_Vikram", "ShadowPriya", "Thunder_Kabir",
  "MaverickRaj", "ViperAnaya", "BlazeRohan", "SilentIshaan", "FalconMeera", "Rogue_Aditya", "TitanVeer",
  "PhoenixDiya", "Cobra_Nikhil", "StormTara", "Havoc_Aman", "LoneWolfDev", "RaptorZoya", "Spectre_Om",
  "Mamba_Riya", "Bullseye_Yash", "IronKaran", "Nova_Sana", "Reaper_Jay",
];
