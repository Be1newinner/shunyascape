// Facts about the game shared by the landing page copy, metadata and JSON-LD,
// so search engines and AI answer engines see the same claims as players.

/** Public origin of the site, e.g. https://play.example.com (no trailing slash). */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");

export const SITE_NAME = "ShunyaScape";
export const SITE_TITLE = "ShunyaScape — Free 3D Battle Royale in Your Browser";
export const SITE_DESCRIPTION =
  "Drop into a realistic 3D battleground, loot guns, ammo and med kits, and outfight 24 AI soldiers as the zone closes in. Free, third-person, and it runs right in your browser.";

export const KEYWORDS = [
  "browser battle royale",
  "free battle royale game",
  "third-person shooter browser",
  "3D shooter no download",
  "WebGPU game",
  "battle royale with bots",
  "ShunyaScape",
];

/** Short, citable definition used in the "What is" section and llms.txt. */
export const DEFINITION =
  "ShunyaScape is a free third-person battle royale shooter that runs in the web browser. Each match drops you onto a 640-metre map of towns, fields, forests and hills with 24 AI soldiers. You loot guns, ammo and med kits from houses and crates, and fight to be the last one standing while a blue zone shrinks the play area.";

export const STATS = [
  { value: "25", label: "soldiers in every match" },
  { value: "640 m", label: "map of towns, forests and hills" },
  { value: "6", label: "zone phases to survive" },
  { value: "Free", label: "in your browser, no download" },
] as const;

export type Rarity = "common" | "rare" | "epic" | "legendary";

/** Weapons and gear, styled as an in-game item card list. */
export const ARSENAL: { name: string; stat: string; detail: string; rarity: Rarity }[] = [
  { name: "P92", stat: "9mm · 15", detail: "Sidearm you drop in with. Quick to aim, semi-auto.", rarity: "common" },
  { name: "Ammo box", stat: "×30–60", detail: "5.56mm, 7.62mm or 9mm. Picked up as you walk over it.", rarity: "common" },
  { name: "Med kit", stat: "100 HP", detail: "Restores full health in 4.5 seconds. Don't get caught healing.", rarity: "rare" },
  { name: "M416", stat: "5.56mm · 30", detail: "Full-auto rifle with a red-dot sight. The all-rounder.", rarity: "epic" },
  { name: "Kar98k", stat: "7.62mm · 5", detail: "Bolt-action with a 4× scope. One headshot is enough.", rarity: "legendary" },
];

export const CONTROLS = [
  { keys: ["W", "A", "S", "D"], action: "Move" },
  { keys: ["Mouse"], action: "Look around" },
  { keys: ["Left click"], action: "Shoot" },
  { keys: ["Right click"], action: "Aim / scope" },
  { keys: ["Space"], action: "Jump" },
  { keys: ["Shift"], action: "Sprint" },
  { keys: ["U"], action: "Reload" },
  { keys: ["I"], action: "Pick up" },
  { keys: ["J", "K"], action: "Crouch / prone" },
  { keys: ["O"], action: "Switch weapon" },
  { keys: ["L"], action: "Use med kit" },
] as const;

export const FAQ = [
  {
    q: "What is ShunyaScape?",
    a: DEFINITION,
  },
  {
    q: "Is ShunyaScape free to play?",
    a: "Yes. ShunyaScape is free and runs directly in a modern web browser, so there is nothing to download or install. You only need a free account, which you can create with Google or an email address.",
  },
  {
    q: "Who do I fight against?",
    a: "Every match has 24 AI soldiers. They roam the map, move into the safe zone, strafe while fighting, fire in bursts and reload. They only hunt you, so every soldier left alive is a threat to you.",
  },
  {
    q: "How does the zone work?",
    a: "The match starts with a 30-second ceasefire to grab a gun. Then a blue zone shrinks the play area in six phases. Outside it you lose health every second, and the damage grows with each phase.",
  },
  {
    q: "Can I play with friends?",
    a: "Not yet. Matches are currently you against AI soldiers. Online multiplayer is planned.",
  },
  {
    q: "Do I need a powerful computer?",
    a: "No. The game uses WebGPU when your browser supports it and falls back to WebGL 2 otherwise. Low, medium and high graphics presets let it run on most recent laptops and desktops.",
  },
  {
    q: "Where do the 3D models come from?",
    a: "Props, rocks, guns and ground textures are photo-scanned CC0 assets from Poly Haven, compressed for the web. Trees are generated with EZ-Tree, and the soldier comes from the three.js examples.",
  },
] as const;
