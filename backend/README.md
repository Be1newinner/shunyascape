# ShunyaScape Backend Service 🖥️

This is the backend service for **ShunyaScape**, a real-time multiplayer 3D simulation server. It is built as a standalone Express server using **TypeScript**, native **WebSockets**, **MongoDB** via Mongoose, and **Nodemailer** for email verification.

To prevent database bottlenecking during real-time movement and actions, the backend implements an **in-memory database write-back caching system** that flushes state changes to MongoDB in batches once every 10 seconds.

---

## 📂 Project Structure

```
backend/
├── src/
│   ├── config/
│   │   └── db.ts          # Mongoose database connection setup
│   ├── middlewares/
│   │   └── auth.ts        # Authentication & email verification enforcement middleware
│   ├── models/
│   │   ├── GridCell.ts    # Model for voxel 32x32 city grid (roads, houses, permissions)
│   │   ├── Group.ts       # Model for user/player group relations
│   │   ├── Npc.ts         # Model for active NPCs (coordinates, actions)
│   │   ├── Settings.ts    # Model for global simulation variables (speed, time of day)
│   │   └── User.ts        # Model for accounts, game inventory (XP, SC, wood, coordinates)
│   ├── utils/
│   │   ├── auth.ts        # Utilities for password hashing and OTP generation
│   │   └── mailer.ts      # Nodemailer OAuth2 configurations for sending OTPs
│   └── index.ts           # Core server entry: boots Express, WebSockets, and database syncer loop
├── esbuild.config.js      # Production build bundling configuration
├── tsconfig.json          # TypeScript compiler options
└── package.json           # Scripts, dependencies, and ESLint configs
```

---

## ⚙️ Core Modules & Features

### 1. In-Memory Write-Back Database Syncer
To support high-frequency coordinate and grid updates without triggering MongoDB API limits or causing latency spikes:
*   Active user coordinates and NPC states are modified in **server-side memory** and instantly broadcasted to WebSocket clients.
*   A background timer runs every **10 seconds** to flush all accumulated local coordinate changes to the MongoDB database using a bulk write operation (`bulkWrite`).
*   When a user closes their WebSocket connection, a cleanup handler immediately flushes their final coordinates to MongoDB.

### 2. Native WebSocket Event Handlers
The WebSocket server runs side-by-side with the Express app on port `8005`:
*   `player-move` / `player-moved`: Propagates player world positions in real-time.
*   `npc-sync` / `npcs-updated`: Replicates NPC positions across all connected user clients (driven by the admin client's browser simulation).
*   `settings-update` / `settings-updated`: Syncs environmental metrics like play speed, time-of-day clock, and paused state.
*   `grid-update` / `grid-updated`: Broad-casts changes to the 32x32 construction map cells.

### 3. Secure OTP Email Authentication
Instead of sending credentials directly, registration and logins are protected:
*   **OTP Gated**: Unverified registrations/logins prompt a One-Time Password generation sent to the user's email.
*   **Mailer Utility**: Uses `nodemailer` with Gmail OAuth2 or basic SMTP settings to deliver OTP codes.
*   **Access Control**: The auth middleware intercepts requests to verify both JWT authenticity and verified status.

---

## 🛰️ API Endpoints (Express)

The Express server exposes the following authentication and state REST routes (prefixed implicitly or proxied):

*   `POST /api/auth/register` - Create an account. Sends OTP code to email.
*   `POST /api/auth/verify-otp` - Verify the OTP code to activate the account.
*   `POST /api/auth/login` - Authenticate using email and password. Generates session JWT.
*   `POST /api/auth/logout` - Clear the session cookie.
*   `GET /api/auth/me` - Get profile info of current logged-in user.
*   `POST /api/auth/forgot-password` - Request a password reset OTP.
*   `POST /api/auth/reset-password` - Reset password using verified OTP.
*   `GET /api/settings` - Retrieve current environment settings.

---

## 🛠️ Developer Commands

### 1. Local Development
Runs the server with hot-reload support using `tsx` (TypeScript Execute):
```bash
pnpm dev
```
*(Runs inside monorepo root or via `pnpm -C backend dev`)*

### 2. Linting & Formatting
Run ESLint to check for stylistic and program code guidelines:
```bash
pnpm run lint
```
To fix simple issues automatically:
```bash
pnpm run lint:fix
```

### 3. Compile-checking (TypeScript)
Run `tsc` in check mode without emitting files:
```bash
pnpm run check
```

### 4. Build for Production
Bundle and transpile TypeScript code using `esbuild`:
```bash
pnpm run build
```
This generates the optimized bundle in `dist/index.js`.

### 5. Production Start
Run the compiled JavaScript bundle:
```bash
pnpm start
```
*(Typically managed using PM2 via `ecosystem.config.cjs` in VPS staging/production environments)*
