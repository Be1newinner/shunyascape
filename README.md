# ShunyaScape 🌟

**ShunyaScape** is a real-time, gamified 3D simulation and city-building web application built on the MERN stack. Players spawn in a persistent 3D voxel-style city map, explore specialized hubs, collect resources, talk to NPCs, level up through achievements, and build infrastructure using construction permits.

This project is built from the ground up to support highly optimized, real-time multiplayer synchronization and is fully open-source!

---

## 🎮 Game Features & Economy

*   **Real-Time Collaborative Sandbox**: Interact with other players on a live 32x32 voxel grid.
*   **Resource Gathering**: Scavenge the map for ShunyaCoins, Energy Crystals, and Wood.
*   **Gamified Progression**: Earn XP and coins by performing jobs (e.g. tech office worker, renovation helper) or completing quests for NPCs.
*   **Permit Store**: Purchase building permits to construct roads, plant trees, or erect commercial/residential real estate.
*   **NPC Dialogue & Quests**: Talk to citizens (NPCs) with exclamation marks (`!`) to take on custom quests.
*   **Ambient Simulations**: Clouds, weather, and animals (dogs, cats, birds) are rendered client-side to keep network bandwidth minimal.

---

## 🏗️ Architecture & Tech Stack

ShunyaScape is organized as a monorepo utilizing `pnpm` workspaces for clean package management.

```
shunyascape/
├── backend/               # Express.js (v5) + TypeScript backend server
│   ├── src/               # Application source files (routes, models, controllers)
│   └── README.md          # Backend detailed documentation
├── frontend/              # Next.js 16 (App Router) + React 19 client
│   ├── app/               # Next.js page structure and React Three.js canvas
│   └── README.md          # Frontend detailed documentation
├── docs/                  # Detailed gameplay mechanics & technical feature specs
├── scripts/               # Utility scripts (git hooks setup, etc.)
├── package.json           # Root workspace configuration
└── ecosystem.config.cjs   # PM2 configuration for VPS deployments
```

### Key Technical Specs
1.  **WebSocket Sync**: Uses native WebSockets (`ws` library on server, native client on frontend) for low-latency synchronization of player coordinates, NPC movements, build grid modifications, and simulation clock.
2.  **In-Memory Write-Back Cache**: To prevent MongoDB from throttling queries, the server maintains the active simulation state in local memory. Real-time events are dispatched instantly in-memory, and a write-back thread flushes coordinates/states to MongoDB once every **10 seconds** in bulk.
3.  **Spectator Mode**: Guest users can watch the live simulation in spectator mode. They receive WebSocket state broadcasts but cannot modify the grid or post coordinates.
4.  **Touchpad-Optimized Camera Controls**: OrbitControls with a keyboard fallback (`Q` & `E` for horizontal orbital rotation) allowing laptop trackpad users to build and navigate with ease.

---

## 🚀 Quick Start

To run the application locally in development mode:

1.  **Clone the Repo & Install Dependencies**:
    ```bash
    git clone https://github.com/Be1newinner/shunyascape.git
    cd shunyascape
    pnpm install
    ```
2.  **Install the Git pre-push hook** to prevent pushing directly to `main` branch:
    ```bash
    chmod +x scripts/setup-git-hooks.sh
    ./scripts/setup-git-hooks.sh
    ```
3.  **Configure Environment Variables**:
    *   Set up `backend/.env` (using `backend/.env.sample` as template).
    *   Set up `frontend/.env` (using `frontend/.env.sample` as template).
4.  **Run Development Servers**:
    ```bash
    pnpm dev
    ```
    Access the game at [http://localhost:3000](http://localhost:3000).

For full details on local environment configuration and coding standards, read the [CONTRIBUTING.md](file:///mnt/Data/Projects/unthikable/CONTRIBUTING.md) guide.

---

## 🔒 Branch Protection Guide

To safeguard the stability of the production branch, **direct pushes to the `main` branch are blocked**. This is enforced via two layers of protection:

### 1. Local Pre-push Hook (Accidental Push Prevention)
Running `./scripts/setup-git-hooks.sh` configures Git on your machine to block you from typing `git push origin main` directly. If you try, the hook intercepts the command and exits with an error.

### 2. GitHub Remote Branch Protection (Owner Setup)
As the repository owner, you should configure GitHub to enforce this rule on the remote server. Follow these steps:

1.  Go to your repository page on GitHub.
2.  Navigate to **Settings** (gear icon) ➔ **Branches** (under Code and automation in the sidebar).
3.  In the **Branch protection rules** section, click **Add branch protection rule**.
4.  Set the **Branch name pattern** to `main`.
5.  Check the following configuration boxes:
    *   ☑️ **Require a pull request before merging**: This blocks direct pushes to `main`.
        *   ☑️ **Require approvals** (optional: set number of required reviews to 1 if you want validation from peers).
    *   ☑️ **Do not bypass the above settings**: **CRITICAL**. This ensures that these protection rules apply to you (the repository owner/administrator) as well as other developers, meaning even you cannot accidentally push directly via the command line. You must merge changes through a PR.
6.  Click **Create** or **Save changes** at the bottom of the page.

---

## 🤝 Contributing

We welcome contributions from the MERN Stack developer community! Please read our [Contribution Guidelines](file:///mnt/Data/Projects/unthikable/CONTRIBUTING.md) to understand our coding conventions, branch structures, and PR processes.

## 📄 License

This project is open-source. For licensing details, see the [backend/LICENSE](file:///mnt/Data/Projects/unthikable/backend/LICENSE) file.
