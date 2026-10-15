import type { HumanResult } from "../match/Match";

/**
 * Daily missions and the login streak. Three missions a day (UTC), picked
 * per player from a pool; progress comes only from the game server's match
 * results, and the XP is paid out when the player taps Claim.
 */

interface MissionDef {
  id: string;
  title: string;
  goal: number;
  xp: number;
  /** Easy ones: every day has at least one of these. */
  easy?: boolean;
  /** How much one match moves it. */
  progress(r: HumanResult): number;
}

const POOL: MissionDef[] = [
  { id: "play3", title: "Play 3 matches", goal: 3, xp: 100, easy: true, progress: () => 1 },
  { id: "survive5", title: "Survive 5 minutes in a match", goal: 1, xp: 110, easy: true, progress: (r) => (r.survived >= 300 ? 1 : 0) },
  { id: "top10x2", title: "Finish in the top 10 twice", goal: 2, xp: 140, easy: true, progress: (r) => (r.placement <= 10 ? 1 : 0) },
  { id: "kills3", title: "Get 3 kills", goal: 3, xp: 120, progress: (r) => r.kills },
  { id: "kills8", title: "Get 8 kills", goal: 8, xp: 220, progress: (r) => r.kills },
  { id: "dmg600", title: "Deal 600 damage", goal: 600, xp: 150, progress: (r) => r.damage },
  { id: "kar2", title: "Get 2 kills with the Kar98k", goal: 2, xp: 170, progress: (r) => r.detail.weaponKills.kar98k ?? 0 },
  { id: "m416x4", title: "Get 4 kills with the M416", goal: 4, xp: 150, progress: (r) => r.detail.weaponKills.m416 ?? 0 },
  { id: "p92x1", title: "Get a kill with the P92 pistol", goal: 1, xp: 120, progress: (r) => r.detail.weaponKills.p92 ?? 0 },
  { id: "head3", title: "Land 3 headshot kills", goal: 3, xp: 180, progress: (r) => r.detail.headshotKills },
  { id: "nade1", title: "Get a grenade kill", goal: 1, xp: 170, progress: (r) => r.detail.weaponKills.grenade ?? 0 },
  { id: "crate1", title: "Loot an airdrop crate", goal: 1, xp: 170, progress: (r) => r.detail.airdrops },
  { id: "win1", title: "Win a match or survive to the end", goal: 1, xp: 300, progress: (r) => (r.placement === 1 || r.survivor ? 1 : 0) },
  { id: "squad1", title: "Play a match with your squad", goal: 1, xp: 100, progress: (r) => (r.squad ? 1 : 0) },
];

export interface MissionState {
  id: string;
  progress: number;
  claimed: boolean;
}

export interface DailyState {
  day: string;
  missions: MissionState[];
}

export interface StreakState {
  count: number;
  best: number;
  lastDay: string | null;
}

/** Outfits you earn with the login streak (the rest of the wardrobe is free). */
export const STREAK_OUTFITS: Record<string, number> = { ember: 3, gold: 7 };

export function utcDay(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Today's three missions for this player (one easy, two others). */
function pick(day: string, userId: string): MissionState[] {
  let h = hash(`${day}:${userId}`);
  const next = () => (h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0);
  const easy = POOL.filter((m) => m.easy);
  const rest = POOL.filter((m) => !m.easy);
  const chosen = [easy[next() % easy.length]];
  while (chosen.length < 3) {
    const m = rest[next() % rest.length];
    if (!chosen.includes(m)) chosen.push(m);
  }
  return chosen.map((m) => ({ id: m.id, progress: 0, claimed: false }));
}

/** The player's missions for today, starting fresh after UTC midnight. */
export function ensureDaily(daily: DailyState | null | undefined, userId: string): DailyState {
  const day = utcDay();
  if (daily && daily.day === day && Array.isArray(daily.missions)) return daily;
  return { day, missions: pick(day, userId) };
}

/** Move today's missions along with a match result. */
export function applyResult(daily: DailyState, r: HumanResult) {
  for (const m of daily.missions) {
    const def = POOL.find((d) => d.id === m.id);
    if (!def || m.claimed) continue;
    m.progress = Math.min(def.goal, m.progress + Math.max(0, def.progress(r)));
  }
}

/** Claim a finished mission; returns the XP to add, or an error. */
export function claim(daily: DailyState, id: string): { xp: number } | { error: string } {
  const m = daily.missions.find((x) => x.id === id);
  const def = POOL.find((d) => d.id === id);
  if (!m || !def) return { error: "Unknown mission" };
  if (m.claimed) return { error: "Already claimed" };
  if (m.progress < def.goal) return { error: "Not finished yet" };
  m.claimed = true;
  return { xp: def.xp };
}

/** Missions as the lobby shows them. */
export function describe(daily: DailyState) {
  const tomorrow = new Date(`${daily.day}T00:00:00Z`).getTime() + 86_400_000;
  return {
    resetsAt: new Date(tomorrow).toISOString(),
    missions: daily.missions.map((m) => {
      const def = POOL.find((d) => d.id === m.id)!;
      return { id: m.id, title: def.title, goal: def.goal, xp: def.xp, progress: Math.min(def.goal, Math.round(m.progress)), claimed: m.claimed };
    }),
  };
}

/** XP for logging in on day `n` of a streak: 20 on day 1 up to 80 from day 7. */
export function streakXp(n: number) {
  return 20 + 10 * Math.min(6, Math.max(0, n - 1));
}

/**
 * Daily check-in when the lobby opens: continues the streak if the last
 * visit was yesterday, else starts over. Returns the reward the first time each day.
 */
export function checkIn(streak: StreakState | null | undefined) {
  const today = utcDay();
  const yesterday = utcDay(new Date(Date.now() - 86_400_000));
  const s: StreakState = { count: streak?.count ?? 0, best: streak?.best ?? 0, lastDay: streak?.lastDay ?? null };
  if (s.lastDay === today) return { streak: s, reward: null };
  s.count = s.lastDay === yesterday ? s.count + 1 : 1;
  s.best = Math.max(s.best, s.count);
  s.lastDay = today;
  const unlocked = Object.entries(STREAK_OUTFITS).filter(([, day]) => day === s.count).map(([id]) => id);
  return { streak: s, reward: { day: s.count, xp: streakXp(s.count), unlocked } };
}
