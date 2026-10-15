/** Lobby profile API (outfit, lifetime stats, level). */

export interface Profile {
  name: string;
  outfit: string;
  level: number;
  xpIntoLevel: number;
  xpForNext: number;
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
