/**
 * Is this browser already signed in? The session lives in HTTP-only cookies
 * (access token 1 day, refresh token 30 days, rotated on every refresh), so
 * only the API can tell. Cached briefly so every Play button shares one check.
 */
let cached: { at: number; ok: Promise<boolean> } | null = null;

export function hasSession(): Promise<boolean> {
  if (cached && Date.now() - cached.at < 30_000) return cached.ok;
  const ok = fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store" })
    .then((r) => r.ok)
    .catch(() => false);
  cached = { at: Date.now(), ok };
  return ok;
}

/** Forget the cached answer (after signing in or out). */
export function resetSessionCheck() {
  cached = null;
}
