# Current Features

ShunyaScape is a browser battle royale (`/battleground`). The earlier city-builder game, its WebSocket sync, NPC simulation, economy and city admin pages were removed.

## 1. Standalone TypeScript Express Backend
* Dedicated Express server on port `8005` (`backend/src/index.ts`), configured with `dotenv` and type-checked with TypeScript. The same port serves the game server's WebSocket at `/ws`.
* Handles accounts and sessions (register, OTP verification, login, Google sign-in, logout, password reset, profile), the battleground profile (outfit, career stats), match tickets, online matches and the admin player list.

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
* Sign-in required (`GET /api/auth/me`; otherwise back to the landing page). Third-person battle royale: online matches of 30 soldiers (see section 10), or offline practice against bots when the game server can't be reached. Code in `frontend/app/components/battleground/` (engine in `engine/`), assets in `frontend/public/battleground/` (about 12 MB, credits in `CREDITS.md`).
* Rendered with three.js `WebGPURenderer` (falls back to WebGL 2; `?renderer=webgl` forces it). Physics and character movement use Rapier (`@dimforge/rapier3d-compat`).
* World: 640 m heightmap terrain with grass/dirt/road/triplanar-rock texturing, nine towns of enterable procedural houses (doors, windows, stairs), roads, EZ-Tree trees with near/far detail levels (far leaves alpha-sharpened so they don't fade), wind-animated grass tufts, Poly Haven props as cover, analytic sky with image-based lighting and sun shadows.
* Controls: mouse look (pointer lock), WASD move, Space jump, Shift sprint, left click shoot, right click aim/scope, U reload, I pick up, J crouch, K prone, O or mouse wheel switch weapon, L med kit, 1–3 weapon slots.
* Weapons: M416 (auto), Kar98k (bolt action), P92 pistol. Three slots (two primaries + pistol), magazines, reserve ammo per calibre, reload, recoil, spread, headshots. No single hit does more than 19 damage (`MAX_HIT_DAMAGE`), so everyone survives at least 5 hits; it takes 6–12 depending on gun and headshots.
* Shooting feel: muzzle flash with light and smoke, ejected brass, short bullet tracers (always for enemy fire, sometimes for yours), sparks on hard surfaces, dust plumes and debris on the ground, directional blood, bullet holes that stay for 25 s, impact sounds, the crack of near misses, a camera jolt when you're hit, and soldiers falling away from the killing shot.
* Movement: quick acceleration and braking, walk/run animations played at the body's real speed (no foot sliding), a forward lean, slight head bob and wider FOV when sprinting.
* Scopes: Red Dot, 2×, 4× and 6× scopes are loot. They mount on the M416 and Kar98k (better scopes replace worse ones; spares go to the backpack and mount on the next gun). Each scope sets its own zoom; magnified scopes show a scope overlay. The Kar98k starts on iron sights.
* Loot: guns, scopes, ammo and med kits in houses and next to crates. Walking over ammo, med kits, scopes — and guns while a matching slot is free — picks them up; I picks up or swaps the nearest gun or scope, even with ammo lying closer. Swapped guns are dropped and their scope goes to the backpack. Dead soldiers drop their gear.
* Bots fight only humans (their bullets pass through other bots) and hold fire for the first 30 seconds. When they spot a player they turn, run toward them until in range for their gun, then stop (sometimes crouch) and fire in bursts; if shot from out of sight they head toward the shooter.
* Shrinking blue zone (six phases) with increasing damage. HUD: compass, minimap with zone circles, alive/kill counters, kill feed, health, weapon slots with ammo and scope, pickup toasts, hit markers, damage direction, reload/heal progress. Result screen: placement, kills, damage, survival time; back to lobby or play again.
* Graphics presets (low / medium / high) and mouse sensitivity are saved in local storage.

## 9. Lobby (home screen)
* The battleground opens on a BGMI-style lobby (`Lobby.tsx`, 3D stage in `engine/LobbyScene.ts`): your soldier on a lit platform (drag to turn), player card with level and XP bar, career stats (matches, wins, kills, K/D, top-10 rate, best placement, average damage, time played) and the last match's XP.
* Wardrobe: eight outfits that tint the soldier; the choice is saved and worn in every match.
* Settings panel: graphics preset, mouse sensitivity and the controls list. **Start** launches a match.
* API: `GET /api/profile`, `PATCH /api/profile/outfit`. Stats come only from online matches and are written by the game server (practice matches don't count). XP: 20 per kill + placement bonus + 100 for a win + survival time; levels need 15% more XP each (`backend/src/game/profile.ts`).

## 10. Online Matches & Matchmaking
* **Start** joins matchmaking (`backend/src/match/`). A match has 30 soldiers: up to 25 players, with bots filling the rest (always at least 5). It starts as soon as 25 players are in, or 60 seconds after the first player queued (`MATCH_QUEUE_MS` overrides the wait). The queue screen shows players found, the countdown and the player/bot split; you can cancel.
* Connection: the client gets a 90-second ticket from `GET /api/match/ticket` and opens `NEXT_PUBLIC_GAME_SERVER_URL` (default `ws(s)://<host>:8005/ws`), so it works when the API and site are on different domains. One game connection per account; a new tab replaces the old one.
* Server authority: health, damage (from the server's own weapon table and the 19-damage cap), kills, placement, the zone (same schedule, seeded per match) and zone damage, loot claims (first come, first served) and results. Shots are checked for fire rate, range and that the hit point is on the target. Bots never damage bots.
* Clients send their movement and pose ~15 times a second; the server relays a snapshot of everyone at 15 Hz and other soldiers are drawn 120 ms behind real time, blended between snapshots. Everyone derives the same map, loot and spawn points from the match seed.
* Bots run on the game server (`backend/src/match/BotSim.ts`), not on any player's machine: they move, hunt and shoot on the server's clock whatever players do, and are relayed to everyone like any other soldier. The server has its own physics world (Rapier) built from `backend/src/match/world.json` — terrain heights plus every wall, floor, prop and tree trunk, exported from the client's map generator (`exportCollisionWorld()` in `engine/Game.ts`; regenerate it whenever map generation changes). Bots resolve their own shots against players' positions and drop their kit when killed.
* Dropped gear (swapped guns, a dead soldier's kit) goes through the server so every player sees the same piles.
* No player gets special treatment. Switching tabs, lagging or leaving doesn't pause anything: your soldier stays in the world (standing still once you stop sending) and can be killed by bots, players or the zone; your result is recorded when that happens. A match ends when one soldier is left or no connected player is still alive in it (soldiers of players who left share the best place still open); each player's result is saved by the server.
* Production: the frontend needs `NEXT_PUBLIC_GAME_SERVER_URL=wss://shunya-api.shipsar.in/ws` at build time; nginx on the VPS already proxies `/ws` (WebSocket upgrade) to the backend container.

## 11. Mobile: On-Screen Controls, Phone Preset & App
* Touch screens (`(pointer: coarse)`) get BGMI-style on-screen controls (`components/battleground/TouchControls.tsx`): a floating joystick on the left (push past the rim to sprint), drag anywhere on the right to look, two fire buttons that also aim while held, and buttons for scope, jump, crouch, prone, reload and switch weapon, plus context buttons for pick-up and med kit and a pause button. Each finger is tracked separately; weapon slots are tappable. Controls scale down on short screens and respect safe areas.
* Touch play goes fullscreen and asks for landscape; portrait shows a "turn your phone" prompt. Look sensitivity is boosted for fingers. The HUD and lobby re-lay out for phone screens.
* `mobile` graphics preset (default on touch devices): no shadows, 280 m view distance, sparse grass, simpler far soldiers. Every preset now scales its rendering resolution automatically (down when frames run slow, back up with headroom); the HUD shows the current resolution.
* Mobile app (`mobile/`, Expo SDK 57, `com.shipsar.shunyascape`): native splash, two onboarding screens (first launch only), one login screen for sign-in and registration (email + password, native "Continue with Google"), email-code verification and password reset — then straight into the lobby in a full-screen WebView. Later launches skip to the lobby.
* Session handoff: with `X-Client: app` the auth endpoints also return the session's refresh token (`appToken`), stored in the device's secure storage and sent as `Authorization: Bearer`. To open the game the app gets a 60-second one-time code from `POST /api/auth/handoff`; the WebView loads `GET /api/auth/handoff?code=…&next=/battleground`, which sets the site's session cookies and redirects into the lobby. Same single-device session: signing in elsewhere ends it.
* The site recognises the app (`ShunyaScapeApp` in the user agent) and reports `auth-required`, `logout` and `session-expired` to the app over the WebView bridge; the app then clears its token and shows its login screen. The lobby has a Log out button.
* Google sign-in in the app needs `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (the backend's `GOOGLE_CLIENT_ID`) and `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` in `mobile/.env`, Android/iOS OAuth clients in Google Cloud, and a development or store build (it can't run in Expo Go).
