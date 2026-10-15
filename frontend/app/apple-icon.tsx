import { ImageResponse } from "next/og";
import { LOGO_COLORS, LOGO_FACES } from "./lib/logo";

// iOS home-screen icon: the logo mark on the brand's dark badge.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
        <svg width="136" height="136" viewBox="0 0 64 64">
          <g transform="translate(0 3)">
            {LOGO_FACES.map((f, i) => (
              <path key={i} d={f.d} fill={f.fill} />
            ))}
          </g>
        </svg>
      </div>
    ),
    size,
  );
}
