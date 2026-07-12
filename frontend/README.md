# ShunyaScape Frontend Client 🌐

This is the web client for **ShunyaScape**, a real-time gamified 3D city-builder and multiplayer simulation. Built on **Next.js 16** (App Router, React 19) and styled with **Tailwind CSS v4**, it uses **Three.js** to render a high-performance voxel-style grid directly in the browser.

---

## 📂 Project Structure

```
frontend/
├── app/
│   ├── admin/             # Administrator configuration tools
│   ├── components/        # Main layout overlays
│   │   ├── AuthModal.tsx  # User Sign-in, Sign-up, Password Recovery, and OTP prompts
│   │   ├── CitySimulator.tsx # React container orchestrating Three.js canvas & game overlays
│   │   └── simulation/    # Modular 3D scene files
│   │       ├── Audio.ts        # Dynamic background scores and sound effects
│   │       ├── Camera.ts       # Main orthographic/perspective camera setups
│   │       ├── Collectibles.ts # Spawning animations for ShunyaCoins & Crystals
│   │       ├── NPCAnimals.ts   # Ambient animals (dogs, cats, birds) simulated client-side
│   │       ├── NPCHuman.ts     # Server-synced active citizen nodes (smoothly interpolated)
│   │       ├── ThreeCity.ts    # Main WebGL canvas initialization and tick loops
│   │       ├── Weather.ts      # Cloud movement, sun/moon trajectories & day-night cycles
│   │       └── ...
│   ├── world/             # Dedicated spectator/world routes
│   ├── globals.css        # Tailwind CSS imports and global styles
│   └── page.tsx           # Dashboard dashboard overlays & initial loading gate
├── public/                # Static assets (3D model GLTFs, sound effects)
├── proxy.ts               # Next.js development API proxy to port 8005
├── next.config.ts         # Next.js configurations
└── tsconfig.json          # TypeScript configurations
```

---

## ⚙️ Key Subsystems

### 1. Three.js Canvas Orchestrator (`ThreeCity.ts`)
Creates the WebGL context, initializes lights, shadows, grids, and manages the main animation loop.
*   Interacts directly with individual modules (`Road.ts`, `Trees.ts`, `Home.ts`, `SpecialBuildings.ts`) to update block models based on server-synced grid changes.

### 2. Client-Side Rendering Optimization
*   **NPC Humans** positions are received via WebSockets and smoothly interpolated frame-by-frame (`NPCHuman.ts`), avoiding jittery network movements.
*   **NPC Animals** (Cows, Dogs, Cats, Birds) and **Weather Clouds** are simulated *entirely locally* on each client to conserve network bandwidth and improve rendering performance.

### 3. Keyboard & Trackpad camera handling
*   Use `W`, `A`, `S`, `D` or **Arrow Keys** to move the player character.
*   Use the mouse to click, gather resources, or place buildings using purchased permits.
*   Use the `Q` and `E` keys to rotate the camera azimuthal angle horizontally. This provides trackpad-based laptop users an alternative to mouse dragging when constructing/demolishing cells.

---

## 🔀 API Request Proxying

The client uses `proxy.ts` rather than a standard `middleware.ts` to manage API requests:
*   In development, any requests prefixed with `/api` are automatically proxied to the local backend server running on `http://localhost:8005`.
*   In production, they are rewritten using the `BACKEND_API_URL` environment variable.

---

## 🛠️ Developer Scripts

To manage the frontend workspace:

### 1. Local Development
Start the Next.js dev server with 4GB heap space allocation (to prevent compilation OOM errors):
```bash
pnpm dev
```
*(Runs inside monorepo root or via `pnpm -C frontend dev`)*

### 2. Build for Production
Precompile and generate static production bundles (allocated with 2GB heap limit):
```bash
pnpm build
```

### 3. Start Production Server
Boot up the pre-built static application:
```bash
pnpm start
```

### 4. Running Lint Checks
Analyze pages and components with Next.js pre-configured ESLint rules:
```bash
pnpm run lint
```
