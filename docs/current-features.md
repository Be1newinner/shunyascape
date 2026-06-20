# Current Features

## 1. Standalone TypeScript Express Backend
* Migrated from Next.js serverless Vercel API routes to a dedicated server-based backend running on port `8005`.
* Configured using `dotenv` and type-checked using TypeScript configurations with paths resolution.
* Manages user registration, login, logout, password resets, active user coordinates, NPCs, and global settings.

## 2. Real-Time WebSocket Synchronization
* Implemented instant synchronization of the simulation state using native WebSockets (`ws` library on the server and native browser `WebSocket` client on the frontend).
* **Synchronized Event Types**:
  * `player-move` / `player-moved`: Synchronizes player world coordinate movements across clients in real-time.
  * `npc-sync` / `npcs-updated`: Propagates NPC coordinates driven by the admin client to other clients.
  * `settings-update` / `settings-updated`: Synchronizes simulation time of day, play speed, and pause state instantly.
  * `grid-update` / `grid-updated`: Propagates grid build, demolish, and construction progress updates across clients.
* **Auto-Reconnection**: The client-side WebSocket wrapper features an automatic 3-second reconnect handler to withstand server restarts.

## 3. High-Performance In-Memory DB Caching
* Maintains active player coordinates, NPC arrays, and global environment states in local server memory.
* Broadcasts real-time events immediately in-memory without blocking on database I/O.
* A background write-back thread runs every **5 seconds** to flush modified cached data in bulk (using MongoDB `bulkWrite`) to MongoDB, preventing database write throttling.
* Triggers an immediate database flush of a user's final coordinates when their WebSocket connection terminates to guarantee data consistency.

## 4. Spectator Mode for Guest Sessions
* Allows guest (unauthenticated) users to establish a spectator WebSocket connection.
* Spectators receive all real-time player, NPC, settings, and grid cell updates to view the simulation in real time but are restricted from emitting updates or executing administrative actions.
