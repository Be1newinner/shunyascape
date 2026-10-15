// Facts about the game shared by the landing page copy, metadata and JSON-LD,
// so search engines and AI answer engines see the same claims as players.

/** Public origin of the site, e.g. https://play.example.com (no trailing slash). */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");

export const SITE_NAME = "ShunyaScape";
export const SITE_TITLE = "ShunyaScape — Free Multiplayer 3D City Builder in Your Browser";
export const SITE_DESCRIPTION =
  "Build a living 3D city with friends, free in your browser. Earn coins at jobs, buy building permits, raise skyscrapers and watch 220+ citizens live their daily routines in a shared real-time world.";

export const KEYWORDS = [
  "multiplayer city builder",
  "browser city building game",
  "free 3D city builder",
  "online city simulation",
  "city builder with friends",
  "WebGL game",
  "life simulation game",
  "ShunyaScape",
];

/** Short, citable definition used in the "What is" section and llms.txt. */
export const DEFINITION =
  "ShunyaScape is a free multiplayer 3D city-building and life-simulation game that runs in the web browser. Players share one persistent 200×200 city, earn ShunyaCoins by working jobs, collecting resources and completing quests, buy permits to build roads, homes, shops and skyscrapers, and live alongside a population of computer-controlled citizens who follow daily routines.";

export const STATS = [
  { value: "200×200", label: "shared city grid" },
  { value: "220+", label: "citizens with daily routines" },
  { value: "8", label: "players per party" },
  { value: "Free", label: "in your browser, no download" },
] as const;

export const PERMITS = [
  { name: "Road Builder", cost: 50 },
  { name: "Barber Shop", cost: 100 },
  { name: "Arborist", cost: 100 },
  { name: "Cloth Shop", cost: 150 },
  { name: "Restaurant", cost: 200 },
  { name: "Residential", cost: 250 },
  { name: "Police Station", cost: 300 },
  { name: "Commercial (skyscrapers)", cost: 500 },
] as const;

export const CONTROLS = [
  { keys: ["↑", "↓", "←", "→"], action: "Walk" },
  { keys: ["Shift"], action: "Sprint" },
  { keys: ["Space"], action: "Jump" },
  { keys: ["W", "A", "S", "D"], action: "Orbit the camera" },
  { keys: ["Q", "E"], action: "Zoom in / out" },
  { keys: ["R"], action: "Talk, shop or work" },
  { keys: ["U", "I"], action: "Punch / kick trees for wood" },
] as const;

export const FAQ = [
  {
    q: "What is ShunyaScape?",
    a: DEFINITION,
  },
  {
    q: "Is ShunyaScape free to play?",
    a: "Yes. ShunyaScape is free and runs directly in a modern web browser using WebGL, so there is nothing to download or install. You only need a free account to save your progress.",
  },
  {
    q: "Can I play with friends?",
    a: "Yes. Everyone plays in the same persistent city in real time. You can see other players walk around, build next to each other, and form a party of up to 8 players.",
  },
  {
    q: "How do I earn ShunyaCoins?",
    a: "Work jobs inside skyscrapers and houses, help speed up construction sites, collect coins, energy crystals and crates around the map, harvest wood from trees, and complete quests and achievements. Spend coins on building permits, food, clothes and haircuts.",
  },
  {
    q: "What do the citizens in the city do?",
    a: "More than 220 computer-controlled citizens follow a daily schedule on the server: they sleep at home, commute to work, take lunch at restaurants, run errands at shops, walk in Central Park and head home at night. Builder citizens walk to new construction sites and build them.",
  },
  {
    q: "Do I need a powerful computer?",
    a: "No. ShunyaScape has low, medium and high graphics presets and adjusts automatically. Any recent laptop or desktop with a WebGL-capable browser can play.",
  },
  {
    q: "What happens if my character gets hungry?",
    a: "Hunger drops each in-game day. Eat at a restaurant to restore it; going three in-game days without food resets your progress, so plan your coins.",
  },
] as const;
