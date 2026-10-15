// Server-authoritative game economy.
//
// Clients never send coin/XP totals. They report *what happened* (an earn
// reason, an item they want to buy) and the server looks up the amounts in the
// tables below, checks rate limits and balances, and applies the change.

export interface Wallet {
  shunyaCoins: number;
  level: number;
  xp: number;
  wood: number;
  unlockedPermits: string[];
  completedAchievements: string[];
  completedQuests: string[];
}

export type EconomyResult =
  | { ok: true; delta: { coins: number; xp: number; wood: number }; leveledUp: boolean }
  | { ok: false; error: string };

// ── Price tables (must match the store UI in CitySimulator.tsx) ──────────────

export const PERMIT_PRICES: Record<string, number> = {
  road: 50,
  tree: 100,
  house: 250,
  skyscraper: 500,
  restaurant: 200,
  clothshop: 150,
  barbershop: 100,
  policestation: 300,
};
const PERMIT_XP = 10;

export const BUILD_COSTS: Record<string, number> = {
  road: 5,
  tree: 10,
  house: 50,
  skyscraper: 150,
  restaurant: 100,
  clothshop: 80,
  barbershop: 60,
  policestation: 120,
};
export const BUILD_SCALES = [0.5, 1.0, 1.5, 2.0];

export function buildCost(type: string, scale: number): number {
  return Math.round((BUILD_COSTS[type] ?? 0) * scale);
}

/** Shop items. `shop` is the cell type the player must be standing near. */
export const SHOP_ITEMS: Record<string, { cost: number; shop: string }> = {
  "food:burger": { cost: 25, shop: "restaurant" },
  "food:chicken": { cost: 10, shop: "restaurant" },
  "food:water": { cost: 5, shop: "restaurant" },
  "cloth:shirt": { cost: 30, shop: "clothshop" },
  "cloth:pant": { cost: 25, shop: "clothshop" },
  "cloth:shoe": { cost: 20, shop: "clothshop" },
  "hair:#1a1a1a": { cost: 30, shop: "barbershop" },
  "hair:#4a2f13": { cost: 30, shop: "barbershop" },
  "hair:#d9a752": { cost: 30, shop: "barbershop" },
  "hair:#b83b1d": { cost: 30, shop: "barbershop" },
  "hair:#1a44bb": { cost: 40, shop: "barbershop" },
  "hair:#c0c0c0": { cost: 40, shop: "barbershop" },
  "hair:#1a8b1a": { cost: 40, shop: "barbershop" },
  "hair:#e91e8c": { cost: 40, shop: "barbershop" },
};
const SHOP_ITEM_XP = 5;

// ── Rewards ──────────────────────────────────────────────────────────────────

interface Reward {
  coins: number;
  xp: number;
  wood: number;
}

/** Repeatable rewards, throttled by a shared token bucket per `bucket`. */
const EARN_REWARDS: Record<string, Reward & { bucket: string }> = {
  collect_coin: { coins: 10, xp: 3, wood: 0, bucket: "collect" },
  collect_crystal: { coins: 25, xp: 12, wood: 0, bucket: "collect" },
  collect_crate: { coins: 15, xp: 6, wood: 5, bucket: "collect" },
  harvest_tree: { coins: 5, xp: 4, wood: 2, bucket: "harvest" },
};

/**
 * Token buckets. Collectibles respawn every 4 s with at most 12 on the map,
 * so ~15/min is the legitimate ceiling; tree harvests need 3 hits each.
 */
const BUCKETS: Record<string, { capacity: number; refillMs: number }> = {
  collect: { capacity: 15, refillMs: 3000 },
  harvest: { capacity: 5, refillMs: 1000 },
};

/** Jobs must be started with `job-start` and last at least `durationMs`. */
export const JOBS: Record<string, Reward & { durationMs: number; cell: string }> = {
  job_office: { coins: 50, xp: 20, wood: 0, durationMs: 5000, cell: "skyscraper" },
  job_house: { coins: 30, xp: 15, wood: 0, durationMs: 4000, cell: "house" },
  job_construction: { coins: 20, xp: 10, wood: 0, durationMs: 3000, cell: "construction" },
};
const JOB_TOLERANCE_MS = 300;

/** One-time quest rewards. */
const QUEST_REWARDS: Record<string, Reward> = {
  quest_trees: { coins: 100, xp: 30, wood: 0 },
  quest_skyscraper: { coins: 200, xp: 100, wood: 0 },
  quest_fido: { coins: 150, xp: 0, wood: 0 },
};

export const ACHIEVEMENT_XP: Record<string, number> = {
  first_steps: 50,
  wealthy_citizen: 50,
  high_flyer: 50,
  green_guard: 50,
  dev_extraordinaire: 100,
  skyscraper_climber: 100,
  npc_helper: 50,
};

// ── Per-user transient state (rate limits, running job) ──────────────────────

interface RateState {
  tokens: Record<string, { count: number; updatedAt: number }>;
  job: { id: string; startedAt: number } | null;
}

const rateStates = new Map<string, RateState>();

function rateState(userId: string): RateState {
  let s = rateStates.get(userId);
  if (!s) {
    s = { tokens: {}, job: null };
    rateStates.set(userId, s);
  }
  return s;
}

export function forgetRateState(userId: string) {
  rateStates.delete(userId);
}

function takeToken(userId: string, bucket: string, now: number): boolean {
  const cfg = BUCKETS[bucket];
  const s = rateState(userId);
  const b = s.tokens[bucket] ?? { count: cfg.capacity, updatedAt: now };
  const refilled = Math.floor((now - b.updatedAt) / cfg.refillMs);
  if (refilled > 0) {
    b.count = Math.min(cfg.capacity, b.count + refilled);
    b.updatedAt += refilled * cfg.refillMs;
  }
  if (b.count >= cfg.capacity) b.updatedAt = now;
  s.tokens[bucket] = b;
  if (b.count <= 0) return false;
  b.count--;
  return true;
}

// ── Wallet operations ────────────────────────────────────────────────────────

function apply(w: Wallet, r: Reward): EconomyResult {
  const startLevel = w.level;
  w.shunyaCoins += r.coins;
  w.wood += r.wood;
  w.xp += r.xp;
  while (w.xp >= w.level * 100) {
    w.xp -= w.level * 100;
    w.level++;
  }
  return { ok: true, delta: { coins: r.coins, xp: r.xp, wood: r.wood }, leveledUp: w.level > startLevel };
}

export function earn(userId: string, w: Wallet, reason: string, now = Date.now()): EconomyResult {
  const reward = EARN_REWARDS[reason];
  if (reward) {
    if (!takeToken(userId, reward.bucket, now)) return { ok: false, error: "Slow down!" };
    return apply(w, reward);
  }

  const job = JOBS[reason];
  if (job) {
    const s = rateState(userId);
    if (!s.job || s.job.id !== reason) return { ok: false, error: "No job in progress" };
    if (now - s.job.startedAt < job.durationMs - JOB_TOLERANCE_MS) {
      return { ok: false, error: "Job not finished yet" };
    }
    s.job = null;
    return apply(w, job);
  }

  const quest = QUEST_REWARDS[reason];
  if (quest) {
    if (w.completedQuests.includes(reason)) return { ok: false, error: "Quest already completed" };
    w.completedQuests = [...w.completedQuests, reason];
    return apply(w, quest);
  }

  return { ok: false, error: "Unknown reward" };
}

export function startJob(userId: string, jobId: string, now = Date.now()): boolean {
  if (!JOBS[jobId]) return false;
  rateState(userId).job = { id: jobId, startedAt: now };
  return true;
}

export function unlockAchievement(w: Wallet, key: string): EconomyResult {
  const xp = ACHIEVEMENT_XP[key];
  if (xp === undefined) return { ok: false, error: "Unknown achievement" };
  if (w.completedAchievements.includes(key)) return { ok: false, error: "Already unlocked" };
  if (key === "wealthy_citizen" && w.shunyaCoins < 500) {
    return { ok: false, error: "Not wealthy enough yet" };
  }
  w.completedAchievements = [...w.completedAchievements, key];
  return apply(w, { coins: 0, xp, wood: 0 });
}

export function spend(w: Wallet, cost: number, xp = 0): EconomyResult {
  if (!Number.isFinite(cost) || cost < 0) return { ok: false, error: "Invalid cost" };
  if (w.shunyaCoins < cost) return { ok: false, error: `Not enough ShunyaCoins! Need ${cost} SC.` };
  return apply(w, { coins: -cost, xp, wood: 0 });
}

export function buyPermit(w: Wallet, permit: string): EconomyResult {
  const price = PERMIT_PRICES[permit];
  if (price === undefined) return { ok: false, error: "Unknown permit" };
  if (w.unlockedPermits.includes(permit)) return { ok: false, error: "Permit already owned" };
  const res = spend(w, price, PERMIT_XP);
  if (res.ok) w.unlockedPermits = [...w.unlockedPermits, permit];
  return res;
}

export function buyShopItem(w: Wallet, item: string): EconomyResult {
  const entry = SHOP_ITEMS[item];
  if (!entry) return { ok: false, error: "Unknown item" };
  return spend(w, entry.cost, SHOP_ITEM_XP);
}

/** Starvation: progression is wiped, as the client already showed the player. */
export function resetProgress(w: Wallet) {
  w.shunyaCoins = 0;
  w.level = 1;
  w.xp = 0;
  w.wood = 0;
  w.unlockedPermits = [];
  w.completedAchievements = [];
  w.completedQuests = [];
}
