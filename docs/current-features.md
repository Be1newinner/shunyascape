# Current Features

## 1. Standalone TypeScript Express Backend
* Migrated from Next.js serverless Vercel API routes to a dedicated server-based backend running on port `8005`.
* Configured using `dotenv` and type-checked using TypeScript configurations with paths resolution.
* Manages user registration, login, logout, password resets, active user coordinates, NPCs, and global settings.

## 2. Real-Time WebSocket Synchronization
* Implemented instant synchronization of the simulation state using native WebSockets (`ws` library on the server and native browser `WebSocket` client on the frontend).
* **Synchronized Event Types**:
  * `player-move` / `player-moved`: Synchronizes player world coordinate movements across clients in real-time.
  * `npc-paths` / `npcs-added`: Routes of the server-simulated city NPCs (see section 13).
  * `settings-update` / `settings-updated`: Synchronizes simulation time of day, play speed, and pause state instantly.
  * `grid-update` / `grid-updated`: Propagates grid build, demolish, and construction progress updates across clients.
* **Auto-Reconnection**: The client-side WebSocket wrapper features an automatic 3-second reconnect handler to withstand server restarts.

## 3. High-Performance In-Memory DB Caching
* Maintains active player coordinates, NPC arrays, and global environment states in local server memory.
* Broadcasts real-time events immediately in-memory without blocking on database I/O.
* A background write-back thread runs every **10 seconds** to flush modified cached data in bulk (using MongoDB `bulkWrite`) to MongoDB, preventing database write throttling.
* Triggers an immediate database flush of a user's final coordinates when their WebSocket connection terminates to guarantee data consistency.

## 4. Spectator Mode for Guest Sessions
* Allows guest (unauthenticated) users to establish a spectator WebSocket connection.
* Spectators receive all real-time player, NPC, settings, and grid cell updates to view the simulation in real time but are restricted from emitting updates or executing administrative actions.

## 5. Touchpad & Keyboard Camera Controls
* Added `touchAction: 'none'` styling on the main 3D canvas container to prevent the browser from capturing scroll/pinch trackpad gestures, routing them to OrbitControls instead.
* Implemented `Q` and `E` key listeners in the simulation tick loop to rotate the camera azimuthal angle horizontally around the target, providing trackpad/laptop users an easy navigation alternative when mouse dragging is occupied by construction tools.

## 6. Database Write & Sync Frequency Optimization
* **10-Second Database Writes**: Reduced database write-back flush operations on the Express server to a maximum frequency of once every 10 seconds.
* **HTTP Sync Fallbacks**: In the event of a WebSocket disconnect, the frontend uses a fallback HTTP synchronization mechanism. Fallback position updates for players are throttled to a safe frequency of once every **10 seconds** to avoid database bloat and query throttling.
* **Bandwidth & State Optimization**:
  * **NPC Humans**: Simulated on the server; clients receive a path and start time per decision and animate the walk locally (see section 13).
  * **NPC Animals**: Cows, Dogs, Cats, and Birds are simulated locally on each client's browser as ambient animations. This entirely removes the need to sync animals over the network.
  * **Clouds & Weather**: Clouds are generated and simulated client-side. The network only synchronizes Time of Day and Play Speed settings parameters.

## 7. Secure Email OTP Authentication
* Migrated from instant JWT issuing to a mandatory email-based One-Time Password (OTP) verification system using `nodemailer`.
* Blocks unverified logins and intercepts them to redirect users seamlessly to an OTP verification modal.
* Provides full flows for Account Registration (with email verification), Password Recovery (Forgot Password), and Reset Password.

## 8. Server-Authoritative Economy
* Clients no longer send coin/XP/permit totals. The old `progress-update` and `admin-revenue` socket events are removed.
* Clients send **actions** and the server applies amounts from its own tables (`backend/src/game/economy.ts`):
  * `earn` (`collect_coin`, `collect_crystal`, `collect_crate`, `harvest_tree`, jobs, one-time quests), rate-limited with token buckets.
  * `job-start` → `earn job_*`: the server times each job and checks the player is next to the right building.
  * `achievement`, `buy-permit`, `buy-item` (food, clothes, haircut; the player must be at the shop), `progress-reset` (starvation).
  * Construction costs are deducted by the server when it accepts a build order.
* The server replies with `progress` (authoritative totals) or `action-rejected` (reason shown as a toast). Quest completions are stored per user (`completedQuests`) so rewards can't be re-claimed after a reload.

## 9. Shared City Layout
* The 200×200 city is generated once on the server from a fixed seed (`backend/src/world/layout.ts`) and served by `GET /api/world` as a compact layout string plus every changed cell. Every player now sees the same city.
* MongoDB stores only cells that differ from the base layout. The old "wipe and regenerate the grid when the cell count isn't 1024" logic is removed.
* Grid changes are validated against the current world state: players can only order construction on empty cells they hold a permit for, advance a construction site, or complete it. Admins can set any cell.
* Building looks (height, colour, rotation) are derived from the cell coordinates, so they match between players.
* One-time migration (`worldVersion` 2): the legacy 32×32 grid and the old admin-pushed NPC records are cleared (they were test data).
* Land expansion is disabled until it can be applied to the whole world at once.

## 10. Connection & Stability Fixes
* WebSocket hardening: 64 KB message limit, ping/pong heartbeat, per-socket error handler (a malformed frame used to crash the server), position validation.
* Opening the game in a second tab closes the first with code `4001`; that client stops reconnecting instead of fighting the new tab every 3 seconds. A replaced socket no longer unregisters the new one.
* OTP codes use `crypto.randomInt`; logout flushes unsaved progress instead of dropping it.
* Distance walked updates React state once per second instead of every frame.

## 11. Player Privacy
* Emails are never sent to other players. `GET /api/users`, the WebSocket `init` and `player-connected` messages carry only public fields (`publicUser()` in `backend/src/index.ts`).
* Clients identify players by user id. Store cells record `ownerId` / `ownerName` instead of the owner's email, plus `builderId` for whoever ordered the build.
* Admins get emails from `GET /api/admin/users` (admin role required), used by the admin panel.

## 12. Password & Token Security
* Passwords are hashed with scrypt and a random per-user salt (`scrypt$<salt>$<hash>`), asynchronously so logins don't block the server.
* Accounts with a hash from the old fixed-salt scheme get `403 { requiresPasswordReset: true }` on login and must use "Forgot password".
* `JWT_SECRET` is required in production; development uses a random per-process secret instead of a hard-coded one. Token signatures are compared in constant time.

## 13. Server-Simulated City Population
* ~220 NPCs (up to 320) are simulated by the backend (`backend/src/world/npcs.ts`), so they keep living when no admin is online.
* Each NPC has a home, a role (worker, shopkeeper, builder, resident), a walking speed and a personal daily schedule tied to the shared clock: sleep at home, go to work, lunch at a nearby restaurant, errands at shops, walks in Central Park, strolls, a few night owls.
* Paths use A* over the city grid (`backend/src/world/pathfinding.ts`): roads and the park are preferred, grass costs more, buildings and trees block. Each NPC walks with a small lateral offset so crowds don't move single file.
* NPCs inside a building (home, work, shop) are hidden; clients only render people who are outside.
* Builder NPCs walk to new construction sites and build them (10%/s each); unattended sites still finish slowly. Finished houses get 1–2 new residents.
* Clients receive `npc-paths` only when an NPC makes a new decision and animate the walk against the server clock; nothing is streamed per frame.
* NPC chat lines reflect what the NPC is doing (going to work, lunch, errands, the park, building).

## 14. Landing Page, SEO & GEO
* The home page (`frontend/app/page.tsx`) is a server component and is prerendered as static HTML; only the motion effects (`components/landing/LandingEffects.tsx`) and the sign-in buttons (`PlayButton.tsx`) are client islands.
* Game-style hero: a layered synthwave city (sky, sun, mountains, two skyline layers with lit windows and blinking beacons, traffic, a moving neon grid floor, floating HUD chips) with scroll and pointer parallax. Feature cards tilt toward the pointer; sections reveal on scroll; the final call to action has an animated gradient border. All motion is disabled under `prefers-reduced-motion`, and content stays visible without JavaScript.
* SEO: title/description/keywords, canonical URL, Open Graph and Twitter cards, a generated 1200×630 share image (`app/opengraph-image.tsx`), `robots.txt` (blocks `/world`, `/admin`, `/api/`), `sitemap.xml`, semantic landmarks, one H1 and a proper heading outline.
* Structured data (JSON-LD): `VideoGame`, `WebSite` and `FAQPage`.
* GEO (answer engines): a citable "What is ShunyaScape?" definition, concrete facts (prices, controls, schedule), an FAQ mirrored in JSON-LD, and `public/llms.txt`. Facts live in `app/lib/site.ts` so the copy, metadata and structured data stay in sync.
* Set `NEXT_PUBLIC_SITE_URL` (e.g. `https://your-domain`) so canonical links, the sitemap and social cards use absolute URLs.
* Fonts: Outfit (display) and Inter (text) via `next/font`, self-hosted at build time.
* Fix: the page body is scrollable again (it was locked with `overflow: hidden` for the game); the game page now locks scroll itself.

## 15. Sign in with Google
* "Continue with Google" / "Sign up with Google" in the landing sign-in modal and the in-game sign-in form (`frontend/app/components/GoogleSignInButton.tsx`), using Google Identity Services in popup mode.
* The browser gets a Google-signed ID token; `POST /api/auth/google` verifies its signature, issuer, expiry and audience with `google-auth-library` (`backend/src/utils/google.ts`) and starts the usual single-device cookie session. No client secret is needed.
* New Google users are created already verified (no OTP email). An existing account with the same verified email is linked. If that account was never verified, its password is cleared, so whoever registered the email can't keep access.
* Google-only accounts have no password; a password login gets a "use Google" message, and "Forgot password" can add one later.
* Configuration: set `GOOGLE_CLIENT_ID` on the backend only. The frontend reads it from `GET /api/auth/config`, and the button stays hidden when it isn't set.
