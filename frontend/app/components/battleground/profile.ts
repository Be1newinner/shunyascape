/** Lobby profile API (outfit, lifetime stats, level). */

export interface Mission {
  id: string;
  title: string;
  goal: number;
  xp: number;
  progress: number;
  claimed: boolean;
}

export interface Ranked {
  season: string;
  endsAt: string;
  points: number;
  matches: number;
  peak: number;
  /** This season's leaderboard place (null before the first ranked match). */
  rank: number | null;
  tier: string;
  division: string;
  progress: number;
  nextAt: number | null;
  last: { season: string; points: number; tier: string } | null;
}

export interface Profile {
  name: string;
  outfit: string;
  level: number;
  xpIntoLevel: number;
  xpForNext: number;
  missions: { resetsAt: string; missions: Mission[] };
  streak: { count: number; best: number };
  /** Earned outfits; `lockedOutfits` says which streak day unlocks each. */
  unlocked: string[];
  lockedOutfits: Record<string, number>;
  ranked: Ranked;
  /** What the last online match earned. */
  lastMatchReward: { xp: number; rp: number; points: number; at: string } | null;
  /** Today's login reward (only on the first visit of the day). */
  checkIn: { day: number; xp: number; unlocked: string[] } | null;
  stats: {
    matches: number;
    wins: number;
    kills: number;
    damage: number;
    top10: number;
    bestPlacement: number | null;
    timePlayed: number;
    xp: number;
  };
}

export class UnauthorizedError extends Error {}

/**
 * Fetch JSON from the API. A 401 means the session ended (or the account
 * logged in elsewhere): announce it so the page can send the player home.
 */
async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (res.status === 401) {
    window.dispatchEvent(new CustomEvent("auth-unauthorized"));
    throw new UnauthorizedError("Session expired");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data as T;
}

export function fetchProfile() {
  return api<{ profile: Profile }>("/api/profile").then((d) => d.profile);
}

export function saveOutfit(outfit: string) {
  return api<{ profile: Profile }>("/api/profile/outfit", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ outfit }),
  }).then((d) => d.profile);
}

export function claimMission(id: string) {
  return api<{ xp: number; profile: Profile }>("/api/missions/claim", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
}

export interface LeaderboardRow {
  rank: number;
  name: string;
  outfit: string;
  points: number;
  matches: number;
  level: number;
  tier: string;
  you: boolean;
}

export function fetchLeaderboard() {
  return api<{ season: string; endsAt: string; conquerorTop: number; players: LeaderboardRow[]; you: Ranked }>("/api/leaderboard");
}

/** Badge colours per tier. */
export const TIER_COLORS: Record<string, string> = {
  Bronze: "#c98a55",
  Silver: "#c7d0da",
  Gold: "#f2c14e",
  Platinum: "#6fd3c9",
  Diamond: "#7fb6ff",
  Crown: "#c99bff",
  Ace: "#ff7a6b",
  Conqueror: "#ffd36b",
};
