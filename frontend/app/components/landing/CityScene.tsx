import type { CSSProperties } from "react";

// Layered synthwave city for the landing hero. Rendered on the server as static
// SVG/CSS; LandingEffects moves the layers on scroll and pointer by setting
// --sy / --mx / --my. Each layer's --depth sets how far it moves.

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Building {
  x: number;
  w: number;
  h: number;
  windows: { x: number; y: number; warm: boolean }[];
  antenna: boolean;
}

function skyline(seed: number, minH: number, maxH: number, litChance: number): Building[] {
  const rand = mulberry32(seed);
  const buildings: Building[] = [];
  let x = -20;
  while (x < SKYLINE_WIDTH + 20) {
    const w = 46 + Math.floor(rand() * 70);
    const h = minH + Math.floor(rand() * (maxH - minH));
    const windows: Building["windows"] = [];
    for (let wy = 16; wy < h - 12; wy += 18) {
      for (let wx = 10; wx < w - 12; wx += 14) {
        if (rand() < litChance) windows.push({ x: x + wx, y: 400 - h + wy, warm: rand() < 0.7 });
      }
    }
    buildings.push({ x, w, h, windows, antenna: rand() < 0.25 });
    x += w + Math.floor(rand() * 10);
  }
  return buildings;
}

// Wide enough that "slice" trims the sides instead of the rooftops on most screens
const SKYLINE_WIDTH = 3200;
const FAR = skyline(7, 110, 260, 0.12);
const NEAR = skyline(42, 150, 330, 0.2);

const layer = (depth: number): CSSProperties => ({ "--depth": depth } as CSSProperties);

function Skyline({ buildings, tone, className }: { buildings: Building[]; tone: string; className: string }) {
  return (
    <svg
      className={className}
      viewBox={`0 0 ${SKYLINE_WIDTH} 400`}
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
    >
      {buildings.map((b, i) => (
        <g key={i}>
          <rect x={b.x} y={400 - b.h} width={b.w} height={b.h} fill={tone} />
          {b.antenna && (
            <>
              <rect x={b.x + b.w / 2 - 1} y={400 - b.h - 26} width={2} height={26} fill={tone} />
              <circle className="ls-beacon" cx={b.x + b.w / 2} cy={400 - b.h - 27} r={2.5} />
            </>
          )}
          {b.windows.map((w, j) => (
            <rect
              key={j}
              x={w.x}
              y={w.y}
              width={6}
              height={8}
              rx={1}
              className={w.warm ? "ls-window-warm" : "ls-window-cool"}
            />
          ))}
        </g>
      ))}
    </svg>
  );
}

const HUD_CHIPS = [
  { text: "+25 SC · Energy crystal", className: "ls-chip--coin", style: { top: "24%", left: "7%" } },
  { text: "Maya is heading to work", className: "ls-chip--npc", style: { top: "38%", right: "6%" } },
  { text: "Level up! Lv. 3", className: "ls-chip--xp", style: { top: "62%", left: "12%" } },
  { text: "Skyscraper built", className: "ls-chip--build", style: { top: "70%", right: "14%" } },
];

export default function CityScene() {
  return (
    <div className="ls-scene" aria-hidden="true">
      <div className="ls-layer ls-sky" style={layer(0.02)}>
        <div className="ls-stars" />
      </div>
      <div className="ls-layer" style={layer(0.08)}>
        <div className="ls-sun" />
      </div>
      <div className="ls-layer ls-mountains" style={layer(0.16)}>
        <svg viewBox="0 0 1600 300" preserveAspectRatio="none">
          <path
            className="ls-mountain-back"
            d="M0 300 L0 190 L120 120 L230 175 L360 80 L480 160 L610 110 L760 190 L900 70 L1040 165 L1180 105 L1320 175 L1460 95 L1600 160 L1600 300 Z"
          />
          <path
            className="ls-mountain-front"
            d="M0 300 L0 230 L150 175 L300 225 L450 160 L620 230 L780 180 L950 240 L1120 170 L1300 230 L1450 190 L1600 225 L1600 300 Z"
          />
        </svg>
      </div>
      <div className="ls-layer ls-skyline" style={layer(0.3)}>
        <Skyline buildings={FAR} tone="hsl(262 45% 16%)" className="ls-skyline-svg" />
      </div>
      <div className="ls-layer ls-skyline ls-skyline--near" style={layer(0.5)}>
        <Skyline buildings={NEAR} tone="hsl(258 50% 9%)" className="ls-skyline-svg" />
        <div className="ls-traffic">
          <span className="ls-car" style={{ animationDelay: "0s" }} />
          <span className="ls-car ls-car--rev" style={{ animationDelay: "-2.5s" }} />
          <span className="ls-car" style={{ animationDelay: "-5s" }} />
          <span className="ls-car ls-car--rev" style={{ animationDelay: "-7s" }} />
        </div>
      </div>
      <div className="ls-layer ls-floor" style={layer(0.85)}>
        <div className="ls-grid" />
      </div>
      <div className="ls-layer ls-hud" style={layer(1.2)}>
        {HUD_CHIPS.map((chip) => (
          <span key={chip.text} className={`ls-chip ${chip.className}`} style={chip.style}>
            {chip.text}
          </span>
        ))}
      </div>
      <div className="ls-fade" />
    </div>
  );
}
