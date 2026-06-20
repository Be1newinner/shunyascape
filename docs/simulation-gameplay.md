# ShunyaScape 3D Simulation: Gameplay & Progression System

## 1. Core Purpose
Currently, players in ShunyaScape spawn in a small 3D city (20x20 grid) where they can only walk around, jump, punch/kick, and sit. If they are not an administrator, they cannot build or interact with the world, leading to boredom within a few minutes. 

To solve this, we are introducing a **Gamified Progression & Economy System** called **"ShunyaScape: Builder & Explorer"**. The main goal of a player is to:
1. **Explore** the city, interact with citizens (NPCs), and complete quests.
2. **Collect resources** (ShunyaCoins, Wood, Energy Crystals) scattered around the map.
3. **Earn ShunyaCoins (SC)** by completing jobs, questing, and collecting.
4. **Purchase Building Permits** in the Permit Store to unlock construction tools.
5. **Build and design** their own portion of the persistent city, earning experience points (XP) to level up.
6. **Unlock achievements** and climb the server leaderboard.

---

## 2. World Expansion
We will double the size of the world map to make exploration meaningful:
* **Grid Expansion**: Increase the grid from `20x20` (400 cells) to `32x32` (1024 cells).
* **Environment**: Create specialized zones (Downtown, Residental Hub, Forestry/Nature reserve, Waterfront).
* **Collectible Node Spawner**: Automatically spawn interactive items on empty ground cells:
  * **ShunyaCoins (+10 SC)**: Gold spinning coins.
  * **Energy Crystals (+25 SC, +10 XP)**: Blue glowing floating crystals.
  * **Material Boxes (+15 SC, +5 Wood)**: Red/yellow wooden crates.

---

## 3. Interactive Actions & Jobs
Players can interact with the city environment using action keys or an **Interaction Overlay**:
1. **Tree Harvesting (Gathering)**: Kicking or punching a tree (U or I keys) drops wood chips, plays sound effects, and awards wood materials or coins after 3 hits.
2. **Working Jobs**: Standing on an active commercial building (Skyscraper) or residential building (House) and interacting triggers a job.
   * *Skyscraper Job*: "Work in Tech Office" (lasts 5 seconds, plays typing animation, awards +50 SC and +20 XP).
   * *House Job*: "Help Renovate / Repair" (lasts 4 seconds, plays hammering animation, awards +30 SC and +15 XP).
3. **Helping Construction**: Interacting with active construction sites speeds up build progress (accelerates construction speed by 3x) and awards +20 SC.
4. **NPC Quests**: NPCs will have floating exclamation marks (`!`) when they have active quests. Players can click them or walk up and interact to initiate dialog:
   * **Quest 1: "The Lost Dog"**: Find a wandering voxel dog (labeled "Fido") and walk near it to return it. Reward: +150 SC, +50 XP.
   * **Quest 2: "Afforestation"**: Plant/build at least 3 trees. Reward: +100 SC, +30 XP.
   * **Quest 3: "Skyscraper Climber"**: Climb on top of a skyscraper or building. Reward: +200 SC, +100 XP.

---

## 4. Permit Store (Progression)
To break the admin-only building restriction, players can purchase temporary or permanent permits using their hard-earned ShunyaCoins:
* **Road Builder Permit** (50 SC): Allows building roads.
* **Arborist Permit** (100 SC): Allows planting trees.
* **Residential Developer Permit** (250 SC): Allows building houses.
* **Commercial Tycoon Permit** (500 SC): Allows building skyscrapers.
Once purchased, the respective build tools are unlocked in the player's bottom tool drawer.

---

## 5. Achievement System
Unlocking achievements awards massive XP and plays confetti particles:
* **First Steps**: Walk a total distance of 150 units.
* **Wealthy Citizen**: Accumulate 500 total ShunyaCoins.
* **Green Guard**: Plant 5 trees.
* **NPC Helper**: Complete 1 quest.
* **High Flyer**: Perform 30 jumps.
* **Skyscraper Climber**: Reach a height of 5 units.
* **Developer Extraordinaire**: Build 10 structures.
* **Animal Friend**: Pet (walk near) 3 different animals.

---

## 6. Premium UI HUD (Next.js & Tailwind CSS)
We will build a high-end Glassmorphic overlay for the HUD:
1. **Top Header**:
   * Player Level Badge (e.g. Level 3) with an XP progress bar.
   * ShunyaCoin Counter (with gold icon and micro-animations).
   * Wood Materials Counter.
2. **Left Panel: Achievements List**:
   * Shows a list of locked/unlocked achievements with checkboxes and completion percentages.
3. **Right Panel: Quests Tracker**:
   * Lists current active quest details (e.g., "Find Fido (1/1)" or "Plant Trees (0/3)").
4. **Bottom Center Dialog Bar**:
   * Beautiful chat box overlay when speaking to NPCs, showing their name, face avatar, and interactive dialog responses.
5. **Permit Store Modal**:
   * Pop-up store that lets players buy permits using ShunyaCoins. Includes a feedback alert when purchased.
6. **Toast Notification System**:
   * Small floating slides on the screen: `+10 SC`, `Level Up!`, `Achievement Unlocked!`.
