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
* Rotating refresh tokens (`backend/src/middlewares/auth.ts`): when the 1-day access token has expired, the refresh cookie buys a new access token **and a new 30-day refresh token** (the old one is kept as `previousRefreshToken` and still accepted for 60 s, so parallel requests don't sign you out; rotation is atomic). Players stay signed in as long as they come back within 30 days. Every refresh token has a unique `jti`; a refresh token is never accepted as an access token.
* The mobile app's bearer token is valid while its session is (a new sign-in or logout ends it); every launch gets a fresh 30-day token from `POST /api/auth/handoff` (`appToken`), stored silently.
* The landing page's Play / Sign in buttons check the session first (`app/lib/session.ts`): signed-in visitors go straight to `/battleground` instead of the sign-in modal.
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
* Bullet range per gun: a round stops at its gun's range and hits nothing beyond it — M416 220 m, Kar98k 500 m, P92 70 m (shown on each weapon slot). Damage is full up to the gun's falloff distance (M416 60 m, P92 25 m, Kar98k none) and fades to 60% at max range. Same numbers on the game server.
* Bots fight only humans (their bullets pass through other bots) and hold fire for the first 30 seconds.
* Bot notice range: a bot notices a player who comes within 55 m (95 m for Kar98k snipers) and is in its field of view and line of sight. Crouching shrinks that to 70%, lying down to 40%. Bots also hear gunfire within 45 m and turn on whoever shoots them.
* Once a bot has noticed you it hunts you until one of you is dead: it keeps tracking you even when you break line of sight or run, fights whenever you're in sight and in its gun's range, and only goes back to roaming when its target dies. At most 3 bots hunt the same player at once (more only if you shoot them).
* Spawn protection (online): bots ignore you until 15 s after you leave the "Ready to drop" screen — loading time no longer eats into it — or until you fire. Someone who never presses start is fair game after 75 s. The HUD banner counts it down.
* Shrinking blue zone (six phases) with increasing damage. HUD: compass, minimap with zone circles, alive/kill counters, kill feed, health, weapon slots with ammo and scope, pickup toasts, hit markers, damage direction, reload/heal progress. Result screen: placement, kills, damage, survival time; back to lobby or play again.
* Graphics presets (low / medium / high) and mouse sensitivity are saved in local storage.
* Houses: the ground-floor slab sits 1.5 cm above the foundation and door/window frames are nudged off the wall edges, so indoor floors no longer z-fight (flicker, or flash white for seconds, worst on phones).

## 9. Lobby (home screen)
* The battleground opens on a BGMI-style lobby (`Lobby.tsx`, 3D stage in `engine/LobbyScene.ts`): your soldier on a lit platform (drag to turn), player card with level and XP bar, career stats (matches, wins, kills, K/D, top-10 rate, best placement, average damage, time played) and the last match's XP.
* Wardrobe: eight outfits that tint the soldier; the choice is saved and worn in every match.
* Settings panel: graphics preset, mouse sensitivity and the controls list. **Start** launches a match.
* Live matches: one box per match slot next to Start, polled from `GET /api/match/status` every 4 s — a running match shows how many real players are still alive and its clock; a free slot shows "Open". When every slot is busy the button becomes **Join line**.
* API: `GET /api/profile`, `PATCH /api/profile/outfit`. Stats come only from online matches and are written by the game server (practice matches don't count). XP: 20 per kill + placement bonus + 100 for a win + survival time, +75 for surviving to the time limit, and +150 / +100 / +50 for the match's top 3 killers; levels need 15% more XP each (`backend/src/game/profile.ts`).

## 10. Online Matches & Matchmaking
* **Start** joins matchmaking (`backend/src/match/`). A match has 30 soldiers: up to 25 players, with bots filling the rest (always at least 5). It starts as soon as 25 players are in, or 30 seconds after the first player queued (`MATCH_QUEUE_MS` overrides the wait). The queue screen shows players found, the countdown and the player/bot split; you can cancel.
* Server capacity: at most `MAX_MATCHES` (default 2) matches run at once. When all are running, new players wait in line in order — the queue screen shows "Server busy", your place in line and the live matches — and the next match forms as soon as one is decided (its 15-second results screen doesn't hold the slot). A match that fails to start tells its players instead of crashing the server, and errors in a match's ticks are logged, never fatal.
* Time limit: a match lasts at most 10 minutes (`MATCH_SECONDS`). The HUD shows the time left at the top right (red in the last minute). When time runs out, everyone still alive survives: survivors are placed by kills (then damage) and earn the survivor bonus.
* Results: when a match is decided every player's results screen shows the top 3 killers (bots included, marked as bots); players on it get bonus XP.
* Connection: the client gets a 90-second ticket from `GET /api/match/ticket` and opens `NEXT_PUBLIC_GAME_SERVER_URL` (default `ws(s)://<host>:8005/ws`), so it works when the API and site are on different domains. One game connection per account; a new tab replaces the old one.
* Server authority: health, damage (from the server's own weapon table and the 19-damage cap), kills, placement, the zone (same schedule, seeded per match) and zone damage, loot claims (first come, first served) and results. Shots are checked for fire rate, range and that the hit point is on the target. Bots never damage bots.
* Clients send their movement and pose ~15 times a second; the server relays a snapshot of everyone at 15 Hz and other soldiers are drawn 120 ms behind real time, blended between snapshots. Everyone derives the same map, loot and spawn points from the match seed.
* Bots run on the game server (`backend/src/match/BotSim.ts`), not on any player's machine: they move, hunt and shoot on the server's clock whatever players do, and are relayed to everyone like any other soldier. The server has its own physics world (Rapier) built from `backend/src/match/world.json` — terrain heights plus every wall, floor, prop and tree trunk, exported from the client's map generator (`exportCollisionWorld()` in `engine/Game.ts`; regenerate it whenever map generation changes). Bots resolve their own shots against players' positions and drop their kit when killed.
* Dropped gear (swapped guns, a dead soldier's kit) goes through the server so every player sees the same piles.
* No player gets special treatment. Switching tabs, lagging or leaving doesn't pause anything: your soldier stays in the world (standing still once you stop sending) and can be killed by bots, players or the zone; your result is recorded when that happens. A match ends when one soldier is left, when time runs out, or as soon as no connected real player is still alive in it (soldiers of players who left share the best place still open); each player's result is saved by the server.
* Production: the frontend needs `NEXT_PUBLIC_GAME_SERVER_URL=wss://shunya-api.shipsar.in/ws` at build time; nginx on the VPS already proxies `/ws` (WebSocket upgrade) to the backend container.

## 11. Mobile: On-Screen Controls, Phone Preset & App
* Touch screens (`(pointer: coarse)`) get BGMI-style on-screen controls (`components/battleground/TouchControls.tsx`): a floating joystick on the left (push past the rim to sprint), drag anywhere on the right to look, two fire buttons that also aim while held, and buttons for scope, jump, crouch, prone, reload and switch weapon, plus context buttons for pick-up and med kit and a pause button. Each finger is tracked separately; weapon slots are tappable. Controls scale down on short screens and respect safe areas.
* Menus, the results screen and the queue scroll and take taps on phones: only the play surface (canvas + on-screen controls) blocks touch gestures. On short (landscape phone) screens the results card switches to two columns so Lobby / Play again are always visible; behind it the 3D view drops to ~12 fps and the HUD refreshes 3×/s instead of 20×/s so buttons respond straight away.
* Touch play goes fullscreen and asks for landscape; portrait shows a "turn your phone" prompt. Look sensitivity is boosted for fingers. The HUD and lobby re-lay out for phone screens.
* `mobile` graphics preset (default on touch devices): no shadows, no antialiasing, 1× resolution, 280 m view distance, sparse grass, simpler far soldiers. On touch devices the lobby's 3D stage also renders without antialiasing at 1× (on a Mali-G52 tablet: 17 → ~53 fps). Every preset now scales its rendering resolution automatically (down when frames run slow, back up with headroom); the HUD shows the current resolution.
* Mobile app (`mobile/`, Expo SDK 57, `com.shipsar.shunyascape`): native splash, two onboarding screens (first launch only), one login screen for sign-in and registration (email + password, native "Continue with Google"), email-code verification and password reset — then straight into the lobby in a full-screen WebView. Later launches skip to the lobby.
* Session handoff: with `X-Client: app` the auth endpoints also return the session's refresh token (`appToken`), stored in the device's secure storage and sent as `Authorization: Bearer`. To open the game the app gets a 60-second one-time code from `POST /api/auth/handoff`; the WebView loads `GET /api/auth/handoff?code=…&next=/battleground`, which sets the site's session cookies and redirects into the lobby. Same single-device session: signing in elsewhere ends it.
* The site recognises the app (`ShunyaScapeApp` in the user agent) and reports `auth-required`, `logout` and `session-expired` to the app over the WebView bridge; the app then clears its token and shows its login screen. The lobby has a Log out button.
* Google sign-in in the app needs `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (the backend's `GOOGLE_CLIENT_ID`) and `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` in `mobile/.env`, Android/iOS OAuth clients in Google Cloud, and a development or store build (it can't run in Expo Go).

## 12. Install as an App (PWA)
* The site is installable: web app manifest (`app/manifest.ts`, opens `/battleground` full screen), PNG install icons at `/pwa-icon/192`, `/pwa-icon/512` and a maskable `/pwa-icon/maskable-512` (`app/pwa-icon/[variant]/route.tsx`, drawn by `app/lib/appIcon.tsx`, which the Apple icon shares), and a service worker (`public/sw.js`, production only) that caches nothing and shows an offline page when a page load fails.
* "Install ShunyaScape" card (`components/InstallPrompt.tsx`) slides in a moment after someone arrives — on every page from the root layout, and in the battleground lobby (not during a match). **Install** opens the browser's install dialog (Chrome, Edge, Samsung Internet); on iPhone/iPad Safari it explains Share → Add to Home Screen. **Skip** hides it for 7 days (local storage). Never shown inside the native app or once installed.

## 13. Dropping In: Plane & Parachute
* Every match starts in a transport plane (`engine/Drop.ts`) flying a straight line across the map (same route for everyone, from the match seed; each player boards when they press start). Space / the on-screen JUMP button leaves the plane while it's over the island; you're thrown out at the far edge otherwise.
* Free-fall: push forward to dive (fast and steep), pull back to float, steer sideways. The parachute opens with Space / CHUTE, or by itself 85 m above the ground; under the canopy you glide down and steer to your spot. Roofs and trees stop you.
* HUD: altimeter, prompts, the flight path on the minimap. Others see you fall and your canopy (network flags). You send no position while in the plane; bots ignore players who are still in the air, and spawn protection (15 s, online) starts when you land. Practice bots hold fire until 20 s after you land. Nobody takes zone damage before landing.

## 14. Armour, Grenades & Airdrops
* Helmets and vests, levels 1–3 (sand, olive, black-and-gold): they soak 30 / 40 / 55% of a hit (helmet: headshots, vest: body; half of that against blasts) and wear down until they break. Shown on the soldier (`engine/Gear.ts`) and under the health bar with durability. Better armour is picked up by walking over it; the old piece drops. Dead soldiers drop theirs. Bots wear more armour in tougher lobbies.
* Frag grenades (G, or the grenade button; carry up to 4): a thrown arc that bounces and rolls (`engine/Grenades.ts`), bursting after 3.6 s — up to 78 damage within 7.5 m if you're not behind cover (blasts are exempt from the 19-damage bullet cap). Everyone sees the throw; online the server checks the burst (one grenade at a time, plausible fuse and distance) and applies the damage with its own line-of-sight test. Squad mates are never hurt; the thrower can be.
* Airdrops at 2:20 and 4:50 of the match clock: a plane flies over a spot inside the next zone, a red crate floats down (32 s) and lands trailing red smoke. Inside: level-3 vest and helmet, a scoped rifle (Kar98k + 6× or M416 + 4×) with ammo, 2 grenades and 2 med kits. Marked on the minimap and on screen. The server owns the contents and refuses pickups before landing; nearby bots go for it too.
* Server authority: armour levels come from the player's state, durability is kept by the server (`hp` messages carry it back); damage formula shared in `rules.ts` / `config.ts` (`armorHit`, `blastDamage`).

## 15. Combat Feedback, Kill-cam & Spectating
* Floating damage numbers over whoever you hit (yellow for headshots, red for kills; quick hits merge), the server's numbers online.
* Callouts: First blood, Headshot, Double / Triple / Quad kill, Rampage (10 s window), with a rising sting, plus "Airdrop incoming". Phones vibrate on hits, kills, getting hurt and nearby blasts.
* Red dot where a shot at you came from (hits and close misses), on the minimap and on screen, fading over 6 s.
* Bullet tracers that pass within 4 m of the camera aren't drawn (they looked like giant white arrows flying at you), and none show during the kill-cam. Crosshair, pick-up prompt and damage arcs hide once you're dead.
* Kill-cam: for 4 s after death the camera zooms in on whoever killed you ("Eliminated by", weapon, distance, headshot, their HP left), then the results. **Spectate** follows a living soldier from behind (squad mates first, then your killer, then the nearest); Next cycles, Results returns.

## 16. Squads, Missions, Ranked & Bot Difficulty
* Squads (`backend/src/match/Party.ts`, lobby Squad tab): create one and share its 5-letter code or invite link (`/battleground?squad=CODE`, native share sheet on phones); up to 4 players. The leader starts matchmaking for everyone; the squad lands in the same match as one team: no friendly fire (bullets or grenades), name tags and health bars over mates, a squad list and minimap dots. A player who dies spectates while the squad fights on; the squad is placed together when its last member falls ("Squad victory" if it wins). The lobby keeps one game-server connection open for this.
* Daily missions (`backend/src/game/missions.ts`, Missions tab): three a day (UTC) from a pool of 14 (kills, weapon kills, headshots, grenade kill, damage, top 10, survive, win, loot an airdrop, play with your squad…), progress only from online match results, XP paid on **Claim**. Login streak: XP every day (20 → 80 by day 7); 3 and 7 days in a row unlock the Ember and Gold Elite outfits. A toast greets the day's first visit.
* Ranked (`backend/src/game/ranked.ts`, Ranked tab + tier chip): RP per online match from placement (relative to the number of teams, −18…+40) plus kills (up to +50) and +10 for surviving; tiers Bronze → Silver → Gold → Platinum → Diamond → Crown → Ace (divisions III–I), top 10 Ace players are Conqueror. Weekly seasons (ISO week, reset Monday 00:00 UTC), last season's tier kept. `GET /api/leaderboard` (top 50 + your place), `POST /api/missions/claim`. The results screen shows the match's XP and RP.
* Adaptive bots: difficulty from the lobby's average level (level 1 → Rookie … 26+ → Elite) sharpens bots' aim, reactions and notice range and gives them more armour; practice uses your own level. Shown on the start card.
* Stats writes use atomic `$inc` so a podium bonus, a mission claim and a match result never overwrite each other.

## 17. Customize Controls
* Lobby → Settings → **Customize controls** (`ControlsEditor.tsx`). Touch layout: every on-screen control (fire ×2, aim, jump, crouch, prone, reload, switch, med kit, grenade, pick up, pause, joystick, and the plane/parachute button) can be dragged anywhere, resized (60–180%) and faded (opacity 25–100%), with separate Combat and Plane & parachute views; reset one or all. Saved on the device (`bg.touchLayout`).
* Keyboard: click an action and press the key you want (a taken key swaps over); defaults are WASD, Space, Shift, U I J K O L, G, 1–3. Saved in `bg.bindings`; the start card and settings show your own keys.

