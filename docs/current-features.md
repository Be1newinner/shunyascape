# Current Features

ShunyaScape is a browser battle royale (`/battleground`). The earlier city-builder game, its WebSocket sync, NPC simulation, economy and city admin pages were removed.

## 1. Standalone TypeScript Express Backend
* Dedicated Express server on port `8005` (`backend/src/index.ts`), configured with `dotenv` and type-checked with TypeScript.
* Handles accounts and sessions (register, OTP verification, login, Google sign-in, logout, password reset, profile), the battleground profile (outfit, career stats, match results) and the admin player list.

## 2. Secure Email OTP Authentication
* Mandatory email One-Time Password (OTP) verification using `nodemailer`; OTP codes use `crypto.randomInt`.
* Unverified logins get a new OTP and are sent to the OTP verification modal.
* Full flows for registration (with email verification), Forgot Password and Reset Password.

## 3. Sessions: Single-Device Login
* Access token (1 day) and refresh token (30 days) in HTTP-only, SameSite=Lax cookies.
* Each login rotates `currentSessionId` / `currentRefreshToken`; every authenticated call checks them, so signing in elsewhere ends the old session with `401`.
* The game listens for the `auth-unauthorized` event (fired on any `401`), stops the match, clears local storage and shows a "Session expired" screen.

## 4. Password & Token Security
* Passwords are hashed with scrypt and a random per-user salt (`scrypt$<salt>$<hash>`), asynchronously so logins don't block the server.
* Accounts with a hash from the old fixed-salt scheme get `403 { requiresPasswordReset: true }` on login and must use "Forgot password".
* `JWT_SECRET` is required in production; development uses a random per-process secret. Token signatures are compared in constant time.

## 5. Sign in with Google
* "Continue with Google" / "Sign up with Google" in the sign-in modal (`frontend/app/components/GoogleSignInButton.tsx`), using Google Identity Services in popup mode.
* `POST /api/auth/google` verifies the Google ID token (signature, issuer, expiry, audience) with `google-auth-library` (`backend/src/utils/google.ts`) and starts the usual single-device session. No client secret is needed.
* New Google users are created already verified. An existing account with the same verified email is linked; if that account was never verified, its password is cleared.
* Google-only accounts have no password; a password login gets a "use Google" message, and "Forgot password" can add one later.
* Configuration: set `GOOGLE_CLIENT_ID` on the backend only. The frontend reads it from `GET /api/auth/config`; the button stays hidden when it isn't set.

## 6. Admin Panel (`/admin`)
* Admin-only (role checked on the server). One page, **Players**: every account with email, sign-in method (Google / email, verified or not), role and sign-up date.
* Actions: toggle admin role, delete a player. `GET /api/admin/users` and `POST /api/admin/users` (`changeRole`, `delete`).
* The first account ever created becomes the admin.

## 7. Landing Page, SEO & GEO
* The home page (`frontend/app/page.tsx`) is a server component prerendered as static HTML; motion effects (`components/landing/LandingEffects.tsx`) and the sign-in buttons (`PlayButton.tsx`) are client islands.
* Battle royale content: hero over a real in-game screenshot with pointer/scroll parallax, gameplay screenshots, feature bento, a "match timeline" scrollytelling section, first-match steps, controls and an arsenal card list, FAQ and a final call to action. All motion is disabled under `prefers-reduced-motion`.
* Screenshots in `public/images/landing/bg-*.webp` are captured from the game itself.
* SEO: title/description/keywords, canonical URL, Open Graph and Twitter cards, generated share image (`app/opengraph-image.tsx`), `robots.txt` (blocks `/battleground`, `/admin`, `/api/`), `sitemap.xml`, semantic landmarks and heading outline.
* Structured data (JSON-LD): `VideoGame`, `WebSite`, `FAQPage`. GEO: a citable definition, concrete facts and an FAQ in `app/lib/site.ts` (single source for copy, metadata and JSON-LD), plus `public/llms.txt`.
* Set `NEXT_PUBLIC_SITE_URL` so canonical links, the sitemap and social cards use absolute URLs.
* Signing in sends players to `/battleground`.

## 8. Battleground (`/battleground`)
* Sign-in required (`GET /api/auth/me`; otherwise back to the landing page). Single-player, third-person battle royale against 24 AI soldiers. Code in `frontend/app/components/battleground/` (engine in `engine/`), assets in `frontend/public/battleground/` (about 12 MB, credits in `CREDITS.md`).
* Rendered with three.js `WebGPURenderer` (falls back to WebGL 2; `?renderer=webgl` forces it). Physics and character movement use Rapier (`@dimforge/rapier3d-compat`).
* World: 640 m heightmap terrain with grass/dirt/road/triplanar-rock texturing, nine towns of enterable procedural houses (doors, windows, stairs), roads, EZ-Tree trees with near/far detail levels (far leaves alpha-sharpened so they don't fade), wind-animated grass tufts, Poly Haven props as cover, analytic sky with image-based lighting and sun shadows.
* Controls: mouse look (pointer lock), WASD move, Space jump, Shift sprint, left click shoot, right click aim/scope, U reload, I pick up, J crouch, K prone, O or mouse wheel switch weapon, L med kit, 1–3 weapon slots.
* Weapons: M416 (auto), Kar98k (bolt action), P92 pistol. Three slots (two primaries + pistol), magazines, reserve ammo per calibre, reload, recoil, spread, headshots. Short bullet tracers (always for bots' shots, occasionally for yours).
* Scopes: Red Dot, 2×, 4× and 6× scopes are loot. They mount on the M416 and Kar98k (better scopes replace worse ones; spares go to the backpack and mount on the next gun). Each scope sets its own zoom; magnified scopes show a scope overlay. The Kar98k starts on iron sights.
* Loot: guns, scopes, ammo and med kits in houses and next to crates. Walking over ammo, med kits, scopes — and guns while a matching slot is free — picks them up; I picks up or swaps the nearest gun or scope, even with ammo lying closer. Swapped guns are dropped and their scope goes to the backpack. Dead soldiers drop their gear.
* Bots fight only the player (their bullets pass through other bots) and hold fire for the first 30 seconds. When they spot you they turn, run toward you until in range for their gun, then stop (sometimes crouch) and fire in bursts; if shot from out of sight they head toward the shooter.
* Shrinking blue zone (six phases) with increasing damage. HUD: compass, minimap with zone circles, alive/kill counters, kill feed, health, weapon slots with ammo and scope, pickup toasts, hit markers, damage direction, reload/heal progress. Result screen: placement, kills, damage, survival time; back to lobby or play again.
* Graphics presets (low / medium / high) and mouse sensitivity are saved in local storage.

## 9. Lobby (home screen)
* The battleground opens on a BGMI-style lobby (`Lobby.tsx`, 3D stage in `engine/LobbyScene.ts`): your soldier on a lit platform (drag to turn), player card with level and XP bar, career stats (matches, wins, kills, K/D, top-10 rate, best placement, average damage, time played) and the last match's XP.
* Wardrobe: eight outfits that tint the soldier; the choice is saved and worn in every match.
* Settings panel: graphics preset, mouse sensitivity and the controls list. **Start** launches a match.
* API: `GET /api/profile`, `PATCH /api/profile/outfit`, `POST /api/matches` (placement, kills, damage, time survived; validated and rate-limited to one report per 20 s). XP: 20 per kill + placement bonus + 100 for a win + survival time; levels need 15% more XP each (`backend/src/game/profile.ts`).
* Match results are reported by the client, so stats can be faked by a determined player; fine for a single-player mode, revisit before any leaderboards.
