# ShunyaScape 3D Simulation: Complete Feature & Gameplay Guide

Welcome to **ShunyaScape**, a real-time, gamified 3D simulation and city-building web application. This document outlines the core gameplay loops, interactive features, progression economy, and the robust technical backend that powers the multiplayer experience.

## 1. Core Gameplay & Objectives
Players spawn in a persistent 3D voxel-style city map (32x32 grid, 1024 cells) where they can navigate the world, interact with the environment, and collaborate (or just observe) with others. 

The main objectives for players are:
* **Explore**: Navigate the city, interact with citizens (NPCs), and discover specialized zones (e.g., Downtown, Residential Hub, Forestry, Waterfront).
* **Collect Resources**: Scavenge the map for ShunyaCoins (gold coins), Wood (from trees), and Energy Crystals.
* **Work & Quest**: Earn experience (XP) and money (SC) by taking on jobs in buildings or completing quests given by NPCs.
* **Build & Expand**: Purchase permits from the store to unlock tools for building roads, planting trees, or constructing residential and commercial real estate.
* **Level Up**: Gain XP to climb the server leaderboard and unlock achievements.

## 2. Gamified Economy & Progression

### Collectibles & Gathering
Interactive nodes randomly spawn on empty ground cells:
* **ShunyaCoins (+10 SC)**: Spinning gold coins.
* **Energy Crystals (+25 SC, +10 XP)**: Glowing blue crystals floating on the map.
* **Material Boxes (+15 SC, +5 Wood)**: Wooden crates.
* **Tree Harvesting**: Kicking/punching trees drops wood chips and awards wood/coins after multiple hits.

### Working Jobs & Interaction
Players can interact with constructed buildings to perform jobs:
* **Tech Office (Skyscraper)**: Awards +50 SC and +20 XP after a 5-second typing animation.
* **Renovation (House)**: Awards +30 SC and +15 XP after a 4-second hammering animation.
* **Construction Helper**: Interacting with active construction sites accelerates building speed by 3x and awards +20 SC.

### NPC Quests
NPCs with floating exclamation marks (`!`) offer interactive dialogs and quests:
* **The Lost Dog**: Find a wandering voxel dog. (Reward: +150 SC, +50 XP).
* **Afforestation**: Plant at least 3 trees. (Reward: +100 SC, +30 XP).
* **Skyscraper Climber**: Reach the top of a tall building. (Reward: +200 SC, +100 XP).

### The Permit Store
By default, non-admin players cannot alter the world. They must use hard-earned ShunyaCoins to buy permits:
* **Road Builder Permit (50 SC)**: Unlocks road construction.
* **Arborist Permit (100 SC)**: Unlocks tree planting.
* **Residential Developer Permit (250 SC)**: Unlocks house building.
* **Commercial Tycoon Permit (500 SC)**: Unlocks skyscraper construction.

### Achievements
Completing milestones awards massive XP and celebratory confetti:
* *First Steps*, *Wealthy Citizen*, *Green Guard*, *NPC Helper*, *High Flyer*, *Skyscraper Climber*, *Developer Extraordinaire*, and *Animal Friend*.

## 3. Real-Time Multiplayer Backend & Technical Features

ShunyaScape isn't just a client-side game; it is a fully persistent, real-time multiplayer world powered by a highly optimized Express/Node.js backend and MongoDB.

### Real-Time WebSocket Synchronization
The simulation state is synchronized instantly across all connected clients via native WebSockets:
* **Player Movement**: Live world coordinates (`player-moved`).
* **NPC Synchronization**: Server-coordinated AI NPC movements (`npcs-updated`).
* **Environment Settings**: Instant syncing of Time of Day, Play Speed, and Pause states.
* **World Building**: Live grid cell updates when roads or buildings are placed or demolished.
* **Auto-Reconnect**: Clients automatically reconnect gracefully if the server restarts.

### High-Performance In-Memory DB Caching
To prevent database throttling and provide instant game response:
* The server stores all active player coordinates, NPC arrays, and global environment states in local memory.
* Broadcasts real-time events immediately via WebSockets.
* A background loop flushes modified data in bulk to MongoDB exactly once every **10 seconds**.
* Instantly flushes a user's final state when they disconnect.

### Spectator Mode
Unauthenticated guest users can connect via WebSockets as spectators. They receive real-time updates for players, NPCs, and buildings but cannot emit updates or modify the world.

### Bandwidth & Rendering Optimizations
* **Animals & Weather**: Dogs, Cats, Birds, Cows, and Clouds are simulated entirely client-side as ambient animations to save network bandwidth. Only time and weather configuration variables are synced.
* **NPC Interpolation**: Clients smoothly interpolate NPC positions between server updates.

### Secure Authentication
* **Email OTP Verification**: JWT token authentication is gated behind a mandatory `nodemailer` Email OTP verification.
* Full flows for Registration, Password Recovery, and secure login, ensuring progress is safely tied to a verified account.

## 4. Premium UI & Controls
The Next.js and Tailwind CSS frontend features a sleek, glassmorphic HUD overlay to track the player's journey:
* **Top Header**: Displays Level, XP Bar, ShunyaCoins, and Wood inventory.
* **Side Panels**: Tracks unlocked achievements and active quests.
* **Interactive Dialog**: Beautiful chat box overlays when speaking to NPCs.
* **Toast Notifications**: Floating alerts for earning SC, XP, or leveling up.
* **Controls**: Seamless OrbitControls with `Q/E` keyboard rotation alternatives for trackpad users, and full WASD movement integration.
