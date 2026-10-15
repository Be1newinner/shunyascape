"use client";

import { useEffect, useState } from "react";

// Scrolling "live from the city" strip under the hero, fed by the game's
// public endpoints. Falls back to static facts if the API is unreachable.

interface CityStatus {
  clock: string;
  citizens: number;
  outside: number;
  players: number;
}

interface NpcSnapshot {
  path: number[];
  indoors: boolean;
}

interface Settings {
  timeOfDay?: number;
  timeSpeed?: number;
  isPlaying?: boolean;
  lastUpdated?: string;
}

function cityClock(s: Settings | undefined): string {
  if (!s || typeof s.timeOfDay !== "number") return "--:--";
  let hour = s.timeOfDay;
  if (s.isPlaying && s.lastUpdated && s.timeSpeed) {
    hour += ((Date.now() - new Date(s.lastUpdated).getTime()) / 1000) * s.timeSpeed * 0.1;
  }
  hour = ((hour % 24) + 24) % 24;
  const h = Math.floor(hour);
  const m = Math.floor((hour - h) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

async function loadStatus(): Promise<CityStatus | null> {
  try {
    const [npcRes, userRes] = await Promise.all([fetch("/api/npcs"), fetch("/api/users")]);
    if (!npcRes.ok || !userRes.ok) return null;
    const { npcs } = (await npcRes.json()) as { npcs: NpcSnapshot[] };
    const { users, settings } = (await userRes.json()) as { users: unknown[]; settings?: Settings };
    return {
      clock: cityClock(settings),
      citizens: npcs.length,
      outside: npcs.filter((n) => !n.indoors || n.path.length > 2).length,
      players: users.length,
    };
  } catch {
    return null;
  }
}

const STATIC_ITEMS = [
  "Free to play in your browser",
  "200×200 shared city",
  "New: sign in with Google",
  "Parties of up to 8",
  "Citizens with daily routines",
];

export default function LiveTicker() {
  const [status, setStatus] = useState<CityStatus | null | "loading">("loading");

  useEffect(() => {
    let alive = true;
    const refresh = () => loadStatus().then((s) => alive && setStatus(s));
    refresh();
    const timer = setInterval(refresh, 30000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  const live =
    status && status !== "loading"
      ? [
          { label: "City time", value: status.clock },
          { label: "Citizens", value: status.citizens.toLocaleString() },
          { label: "Out and about", value: status.outside.toLocaleString() },
          { label: "Players", value: status.players.toLocaleString() },
        ]
      : null;

  const items = (
    <>
      <span className="ls-ticker__live">
        <span className="ls-ticker__dot" aria-hidden="true" />
        {live ? "Live" : "ShunyaScape"}
      </span>
      {status === "loading"
        ? [0, 1, 2, 3].map((i) => <span key={i} className="ls-ticker__skeleton" aria-hidden="true" />)
        : live?.map((s) => (
            <span key={s.label} className="ls-ticker__item">
              {s.label} <strong>{s.value}</strong>
            </span>
          ))}
      {STATIC_ITEMS.map((t) => (
        <span key={t} className="ls-ticker__item">
          {t}
        </span>
      ))}
    </>
  );

  return (
    <section className="ls-ticker" aria-label="Live city status">
      {/* Visible copy for screen readers; the animated track is decorative */}
      <p className="sr-only" aria-live="polite">
        {live ? live.map((s) => `${s.label}: ${s.value}`).join(", ") : STATIC_ITEMS.join(", ")}
      </p>
      <div className="ls-ticker__track" aria-hidden="true">
        <div className="ls-ticker__group">{items}</div>
        <div className="ls-ticker__group">{items}</div>
      </div>
    </section>
  );
}
