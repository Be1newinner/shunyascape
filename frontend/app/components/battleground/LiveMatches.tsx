"use client";

import { useEffect, useState } from "react";

export interface MatchSummary {
  id: string;
  /** Seconds since the match started. */
  elapsed: number;
  humans: number;
  humansAlive: number;
  alive: number;
  over: boolean;
}

export interface ServerStatus {
  maxMatches: number;
  waiting: number;
  matches: MatchSummary[];
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** Polls the game server's live matches while the lobby is open. */
export function useServerStatus(intervalMs = 4000) {
  const [status, setStatus] = useState<ServerStatus | null>(null);
  useEffect(() => {
    let stopped = false;
    const load = async () => {
      try {
        const res = await fetch("/api/match/status", { cache: "no-store" });
        if (res.ok && !stopped) setStatus((await res.json()) as ServerStatus);
      } catch {
        // Offline or server restarting: keep the last known state.
      }
    };
    load();
    const t = setInterval(load, intervalMs);
    return () => {
      stopped = true;
      clearInterval(t);
    };
  }, [intervalMs]);
  return status;
}

export function serverFull(status: ServerStatus | null) {
  return !!status && status.matches.length >= status.maxMatches;
}

/** One box per match slot: live matches with real players still alive, or an open slot. */
export default function LiveMatches({ status, compact }: { status: ServerStatus | null; compact?: boolean }) {
  if (!status) return null;
  const slots = Array.from({ length: status.maxMatches }, (_, i) => status.matches[i] ?? null);
  return (
    <div className={`bg-live ${compact ? "compact" : ""}`} aria-label="Live matches">
      {slots.map((m, i) =>
        m ? (
          <div key={m.id} className="bg-live-slot on">
            <span className="bg-live-tag">{m.over ? "Ending" : "Live"}</span>
            <b>Match {i + 1}</b>
            <span>
              {m.humansAlive} of {m.humans} {m.humans === 1 ? "player" : "players"} alive · {clock(m.elapsed)}
            </span>
          </div>
        ) : (
          <div key={`free${i}`} className="bg-live-slot">
            <span className="bg-live-tag free">Open</span>
            <b>Match {i + 1}</b>
            <span>Ready for the next squad</span>
          </div>
        ),
      )}
    </div>
  );
}
