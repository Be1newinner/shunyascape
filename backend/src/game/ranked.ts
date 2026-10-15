import type { HumanResult } from "../match/Match";

/**
 * Ranked: every online match earns or costs Rank Points (RP). Seasons last a
 * week (Monday 00:00 UTC to the next); RP start from zero each season and the
 * last season's tier is kept as a badge. The top 10 Ace players are Conqueror.
 */

export const TIERS = [
  { name: "Bronze", min: 0 },
  { name: "Silver", min: 150 },
  { name: "Gold", min: 350 },
  { name: "Platinum", min: 600 },
  { name: "Diamond", min: 900 },
  { name: "Crown", min: 1250 },
  { name: "Ace", min: 1700 },
] as const;

/** Ace players this high on the season's leaderboard show as Conqueror. */
export const CONQUEROR_TOP = 10;

export interface RankedState {
  season: string;
  points: number;
  matches: number;
  peak: number;
  last: { season: string; points: number; tier: string } | null;
}

/** ISO week of `d`, e.g. "2026-W42": the season id. */
export function seasonId(d = new Date()) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** When the current season ends (next Monday 00:00 UTC). */
export function seasonEnds(d = new Date()) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + (8 - day));
  return t;
}

/** Tier, division (III → I inside a tier) and progress to the next step. */
export function tierFor(points: number, leaderboardRank?: number) {
  let i = 0;
  while (i + 1 < TIERS.length && points >= TIERS[i + 1].min) i++;
  const tier = TIERS[i];
  if (tier.name === "Ace") {
    const conqueror = leaderboardRank !== undefined && leaderboardRank <= CONQUEROR_TOP;
    return { tier: conqueror ? "Conqueror" : "Ace", division: "", progress: 1, nextAt: null as number | null };
  }
  const span = TIERS[i + 1].min - tier.min;
  const into = points - tier.min;
  const step = span / 3;
  const div = Math.min(2, Math.floor(into / step));
  return {
    tier: tier.name,
    division: ["III", "II", "I"][div],
    progress: (into - div * step) / step,
    nextAt: Math.round(tier.min + (div + 1) * step),
  };
}

/**
 * RP for one match: placement matters most (relative to the number of
 * teams), kills add up to +50, surviving to the end +10.
 */
export function rpFor(r: HumanResult) {
  const teams = Math.max(2, r.teams || 30);
  const frac = (r.placement - 1) / (teams - 1); // 0 = winner, 1 = first out
  const place = Math.round(40 - frac * 58);
  const kills = Math.min(50, r.kills * 6);
  return Math.max(-20, place + kills + (r.survivor ? 10 : 0));
}

/** The player's ranked record for this season (a new season starts from zero). */
export function ensureSeason(state: RankedState | null | undefined): RankedState {
  const season = seasonId();
  if (state && state.season === season) return state;
  const last = state && state.matches > 0 ? { season: state.season, points: state.points, tier: tierFor(state.points).tier } : state?.last ?? null;
  return { season, points: 0, matches: 0, peak: 0, last };
}

export function applyRanked(state: RankedState, r: HumanResult) {
  const delta = rpFor(r);
  state.points = Math.max(0, state.points + delta);
  state.matches++;
  state.peak = Math.max(state.peak, state.points);
  return delta;
}
