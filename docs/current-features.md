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
* **HTTP Sync Fallbacks**: In the event of a WebSocket disconnect, the frontend uses a fallback HTTP synchronization mechanism. Fallback position updates (for both active players and NPC coordination driven by the admin client) are throttled to a safe frequency of once every **10 seconds** to avoid database bloat and query throttling.
* **Bandwidth & State Optimization**:
  * **NPC Humans**: Admin coordinates and pushes updates to the server cache; non-admin clients interpolate coordinates smoothly to ensure accurate positioning without direct DB polling.
  * **NPC Animals**: Cows, Dogs, Cats, and Birds are simulated locally on each client's browser as ambient animations. This entirely removes the need to sync animals over the network.
  * **Clouds & Weather**: Clouds are generated and simulated client-side. The network only synchronizes Time of Day and Play Speed settings parameters.

## 7. Secure Email OTP Authentication
* Migrated from instant JWT issuing to a mandatory email-based One-Time Password (OTP) verification system using `nodemailer`.
* Blocks unverified logins and intercepts them to redirect users seamlessly to an OTP verification modal.
* Provides full flows for Account Registration (with email verification), Password Recovery (Forgot Password), and Reset Password.
