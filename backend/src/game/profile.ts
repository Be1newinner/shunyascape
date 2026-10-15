import { SURVIVOR_XP } from "../match/rules";
/** Battleground profile rules: outfits, match rewards and levels. */

// "ember" and "gold" are earned with the login streak (game/missions.ts STREAK_OUTFITS).
export const OUTFITS = ["classic", "desert", "woodland", "urban", "night", "crimson", "arctic", "royal", "ember", "gold"] as const;
export type Outfit = (typeof OUTFITS)[number];

export interface MatchResult {
  placement: number;
  kills: number;
  damage: number;
  survived: number;
  /** Still alive when the match's time ran out. */
  survivor?: boolean;
}

/** Base XP for a match (podium bonuses are awarded separately when the match ends). */
export function matchXp(m: MatchResult) {
  return (
    m.kills * 20 +
    (31 - m.placement) * 4 +
    (m.placement === 1 ? 100 : 0) +
    Math.floor(m.survived / 30) +
    (m.survivor ? SURVIVOR_XP : 0)
  );
}

/** Level curve: each level needs a bit more XP than the last. */
export function levelFor(xp: number) {
  let level = 1;
  let need = 100;
  let left = xp;
  while (left >= need) {
    left -= need;
    level++;
    need = Math.round(need * 1.15);
  }
  return { level, xpIntoLevel: left, xpForNext: need };
}
