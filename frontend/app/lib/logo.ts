// ShunyaScape logo mark: three isometric city towers on a 64×64 grid.
// Shared by the site header (Logo.tsx), the favicon (app/icon.svg is generated
// from this), the Apple touch icon and the social share image.

export interface LogoFace {
  d: string;
  fill: string;
}

export const LOGO_COLORS = {
  top: "#FFD25E",
  topBack: "#FFE59A",
  left: "#22D3EE",
  leftBack: "#8B5CF6",
  right: "#3A1F78",
  rightBack: "#2A1660",
  window: "#FFD25E",
  badge: "#120B26",
  badgeEdge: "#2E1F55",
} as const;

/** Isometric box (2:1) standing on (cx, baseY): half-width w, height h. */
function prism(cx: number, baseY: number, w: number, h: number, colors: { top: string; left: string; right: string }) {
  const top = baseY - h;
  const p = (x: number, y: number) => `${+x.toFixed(2)} ${+y.toFixed(2)}`;
  return [
    { d: `M${p(cx - w, top)} L${p(cx, top + w / 2)} L${p(cx, baseY + w / 2)} L${p(cx - w, baseY)}Z`, fill: colors.left },
    { d: `M${p(cx + w, top)} L${p(cx, top + w / 2)} L${p(cx, baseY + w / 2)} L${p(cx + w, baseY)}Z`, fill: colors.right },
    { d: `M${p(cx, top - w / 2)} L${p(cx + w, top)} L${p(cx, top + w / 2)} L${p(cx - w, top)}Z`, fill: colors.top },
  ];
}

const c = LOGO_COLORS;

/** Faces in paint order (back tower first). */
export const LOGO_FACES: LogoFace[] = [
  ...prism(32, 33, 11, 21, { top: c.topBack, left: c.leftBack, right: c.rightBack }),
  // Lit windows on the tall tower
  { d: "M35 17.5 L39 15.5 L39 19 L35 21Z", fill: c.window },
  { d: "M35 24.5 L39 22.5 L39 26 L35 28Z", fill: c.window },
  ...prism(20.5, 46, 10, 9, { top: c.top, left: c.left, right: c.right }),
  ...prism(43.5, 46, 10, 15, { top: c.top, left: c.left, right: c.right }),
];

/** Standalone SVG (with a dark rounded badge) for favicons and touch icons. */
export function logoSvg({ badge = true }: { badge?: boolean } = {}): string {
  const paths = LOGO_FACES.map((f) => `<path d="${f.d}" fill="${f.fill}"/>`).join("");
  const bg = badge
    ? `<rect x="1" y="1" width="62" height="62" rx="15" fill="${c.badge}" stroke="${c.badgeEdge}" stroke-width="2"/>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${bg}<g transform="translate(0 3)">${paths}</g></svg>`;
}
