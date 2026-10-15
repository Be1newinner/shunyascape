import { ImageResponse } from "next/og";
import { LOGO_COLORS, LOGO_FACES } from "./logo";

/**
 * The app icon as a PNG: the logo mark on the brand's dark badge. `inset` is
 * how much of the square the mark fills (maskable icons need a wider margin,
 * since launchers crop them to circles and squircles).
 */
export function renderAppIcon(size: number, inset = 0.76) {
  const mark = Math.round(size * inset);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: `linear-gradient(160deg, #2a1a52, ${LOGO_COLORS.badge})`,
        }}
      >
        <svg width={mark} height={mark} viewBox="0 0 64 64">
          <g transform="translate(0 3)">
            {LOGO_FACES.map((f, i) => (
              <path key={i} d={f.d} fill={f.fill} />
            ))}
          </g>
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}
