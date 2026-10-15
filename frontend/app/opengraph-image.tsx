import { ImageResponse } from "next/og";

// Social share card (Open Graph + Twitter), drawn in the hero's synthwave style.
export const alt = "ShunyaScape — a free multiplayer 3D city builder in your browser";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// [x, width, height] — kept low so the headline sits on open sky
const BUILDINGS = [
  [0, 70, 120], [74, 56, 86], [134, 80, 150], [218, 60, 104], [282, 90, 170], [376, 52, 96],
  [432, 74, 132], [770, 58, 120], [834, 96, 176], [934, 66, 126], [1004, 80, 150], [1088, 112, 110],
];
const GRID_LINES = [0, 1, 2, 3, 4];

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          background: "linear-gradient(to bottom, #0b0718 0%, #1c1036 38%, #4a1650 62%, #a4245c 76%, #0b0718 100%)",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 450,
            top: 300,
            width: 300,
            height: 300,
            borderRadius: 999,
            background: "linear-gradient(to bottom, #ffe066, #ff9f43 45%, #f0458f)",
            boxShadow: "0 0 120px 30px rgba(240,69,143,0.45)",
          }}
        />
        {BUILDINGS.map(([x, w, h]) => (
          <div
            key={x}
            style={{
              position: "absolute",
              left: x,
              bottom: 170,
              width: w,
              height: h,
              background: "#170d2c",
              borderTop: "2px solid #2a1a4a",
            }}
          />
        ))}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 170,
            display: "flex",
            flexDirection: "column",
            background: "#0d0820",
            borderTop: "3px solid #ff6ad5",
            boxShadow: "0 -6px 30px rgba(255,106,213,0.6)",
          }}
        >
          {GRID_LINES.map((i) => (
            <div
              key={i}
              style={{ height: 2, marginTop: 10 + i * 8, background: `rgba(34,211,238,${0.25 + i * 0.12})` }}
            />
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", padding: "64px 72px", position: "relative" }}>
          <div
            style={{
              display: "flex",
              alignSelf: "flex-start",
              padding: "8px 18px",
              borderRadius: 999,
              border: "2px solid rgba(34,211,238,0.6)",
              color: "#5eead4",
              fontSize: 24,
              fontWeight: 700,
            }}
          >
            Free multiplayer 3D city builder
          </div>
          <div style={{ display: "flex", marginTop: 26, fontSize: 104, fontWeight: 700, color: "white", letterSpacing: -3 }}>
            Shunya<span style={{ color: "#22d3ee" }}>Scape</span>
          </div>
          <div style={{ display: "flex", marginTop: 8, fontSize: 36, color: "#e2dcff" }}>
            Build a living city with friends — in your browser.
          </div>
        </div>
      </div>
    ),
    size,
  );
}
