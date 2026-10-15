import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { LOGO_FACES } from "./lib/logo";

// Social share card (Open Graph + Twitter): logo, headline and a real
// gameplay screenshot. Rendered once at build time.
export const alt = "ShunyaScape — free 3D battle royale in your browser";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const OG_DIR = join(process.cwd(), "app", "og");

export default async function OpengraphImage() {
  const [black, semi, shot] = await Promise.all([
    readFile(join(OG_DIR, "outfit-latin-900-normal.woff")),
    readFile(join(OG_DIR, "outfit-latin-600-normal.woff")),
    readFile(join(OG_DIR, "gameplay.jpg")),
  ]);
  const shotSrc = `data:image/jpeg;base64,${shot.toString("base64")}`;
  const gold = "#FFD25E";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          fontFamily: "Outfit",
          color: "white",
          background: "linear-gradient(135deg, #1b1038 0%, #120b26 55%, #0d0820 100%)",
        }}
      >
        {/* Glows */}
        <div
          style={{
            position: "absolute",
            left: -160,
            top: -200,
            width: 640,
            height: 640,
            borderRadius: 999,
            background: "radial-gradient(circle, rgba(139,92,246,0.45), rgba(139,92,246,0) 70%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: -120,
            bottom: -260,
            width: 720,
            height: 720,
            borderRadius: 999,
            background: "radial-gradient(circle, rgba(255,210,94,0.32), rgba(255,210,94,0) 70%)",
          }}
        />

        {/* Gameplay screenshot in a tilted gold frame */}
        <div
          style={{
            position: "absolute",
            left: 600,
            top: 110,
            display: "flex",
            padding: 6,
            borderRadius: 18,
            background: `linear-gradient(135deg, ${gold}, #8b5cf6 55%, #22d3ee)`,
            transform: "rotate(-4deg)",
            boxShadow: "0 40px 80px rgba(0,0,0,0.55)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={shotSrc} width={660} height={276} style={{ borderRadius: 13, objectFit: "cover" }} alt="" />
        </div>

        {/* Text column */}
        <div style={{ display: "flex", flexDirection: "column", padding: "62px 0 0 70px", width: 620 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 72,
                height: 72,
                borderRadius: 20,
                background: "linear-gradient(160deg, #2a1a52, #120b26)",
                border: "2px solid rgba(255,210,94,0.45)",
              }}
            >
              <svg width="56" height="56" viewBox="0 0 64 64">
                <g transform="translate(0 3)">
                  {LOGO_FACES.map((f, i) => (
                    <path key={i} d={f.d} fill={f.fill} />
                  ))}
                </g>
              </svg>
            </div>
            <div style={{ display: "flex", fontSize: 44, fontWeight: 900, letterSpacing: -1 }}>
              Shunya<span style={{ color: gold }}>Scape</span>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              marginTop: 46,
              fontSize: 76,
              fontWeight: 900,
              lineHeight: 0.98,
              letterSpacing: -3,
            }}
          >
            <span>Drop in.</span>
            <span>Loot up.</span>
            <span style={{ color: gold }}>Be #1.</span>
          </div>

          <div style={{ display: "flex", marginTop: 26, fontSize: 28, fontWeight: 600, color: "#d9d3ff" }}>
            Free 3D battle royale vs 24 AI soldiers
          </div>

          <div style={{ display: "flex", marginTop: 30 }}>
            <div
              style={{
                display: "flex",
                padding: "14px 30px",
                borderRadius: 14,
                fontSize: 28,
                fontWeight: 900,
                color: "#3b2400",
                background: `linear-gradient(180deg, #fff1a8, ${gold} 50%, #f0a71c)`,
                boxShadow: "0 6px 0 #8a5a00",
              }}
            >
              PLAY FREE IN YOUR BROWSER
            </div>
          </div>
        </div>

        {/* Bottom stat strip */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 58,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 34,
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: 2,
            color: "#d9d3ff",
            background: "rgba(13,8,32,0.85)",
            borderTop: `2px solid rgba(255,210,94,0.5)`,
          }}
        >
          <span>220+ CITIZENS</span>
          <span style={{ color: gold }}>•</span>
          <span>200×200 SHARED CITY</span>
          <span style={{ color: gold }}>•</span>
          <span>PARTIES OF 8</span>
          <span style={{ color: gold }}>•</span>
          <span>FREE TO PLAY</span>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Outfit", data: black, weight: 900, style: "normal" },
        { name: "Outfit", data: semi, weight: 600, style: "normal" },
      ],
    },
  );
}
