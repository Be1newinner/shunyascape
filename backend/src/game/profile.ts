/** Battleground profile rules: outfits, match rewards and levels. */

export const OUTFITS = ["classic", "desert", "woodland", "urban", "night", "crimson", "arctic", "royal"] as const;
export type Outfit = (typeof OUTFITS)[number];

export const MATCH_SIZE = 25;
/** A match can't be reported sooner than this after the previous one. */
export const MIN_MATCH_GAP_MS = 20_000;

export interface MatchResult {
  placement: number;
  kills: number;
  damage: number;
  survived: number;
}

/** Validate a client-reported match; returns null if anything is out of range. */
export function parseMatch(body: unknown): MatchResult | null {
  const b = (body ?? {}) as Record<string, unknown>;
  const int = (v: unknown, min: number, max: number) => {
    const n = Number(v);
    return Number.isInteger(n) && n >= min && n <= max ? n : null;
  };
  const placement = int(b.placement, 1, MATCH_SIZE);
  const kills = int(b.kills, 0, MATCH_SIZE - 1);
  const damage = int(b.damage, 0, 10_000);
  const survived = int(b.survived, 0, 3 * 3600);
  if (placement === null || kills === null || damage === null || survived === null) return null;
  // Winning means everyone else is dead, and you can't kill more soldiers than there were.
  if (placement === 1 && kills > MATCH_SIZE - 1) return null;
  return { placement, kills, damage, survived };
}

export function matchXp(m: MatchResult) {
  return m.kills * 20 + (MATCH_SIZE + 1 - m.placement) * 4 + (m.placement === 1 ? 100 : 0) + Math.floor(m.survived / 30);
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
