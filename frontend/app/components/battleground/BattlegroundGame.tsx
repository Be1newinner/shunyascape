"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CONTROLS, type Quality } from "./engine/config";
import type { Game, GamePhase, HudState } from "./engine/Game";
import { outfitTint } from "./engine/outfits";
import Hud from "./Hud";
import Lobby from "./Lobby";
import { fetchProfile, reportMatch, saveOutfit, type Profile } from "./profile";
import "./battleground.css";

const SENS_KEY = "bg.sensitivity";
const QUALITY_KEY = "bg.quality";

function readPref<T extends string>(key: string, fallback: T): T {
  try {
    return (localStorage.getItem(key) as T) ?? fallback;
  } catch {
    return fallback;
  }
}

function writePref(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage blocked: settings just won't persist.
  }
}

export default function BattlegroundGame() {
  const router = useRouter();
  const mountRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  // Client-only component (loaded with ssr: false), so storage is readable on first render.
  const [quality, setQuality] = useState<Quality>(() => readPref<Quality>(QUALITY_KEY, "medium"));
  const [sensitivity, setSensitivity] = useState(() => Number(readPref(SENS_KEY, "1")) || 1);
  const [screen, setScreen] = useState<"lobby" | "match">("lobby");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [outfit, setOutfit] = useState("classic");
  const [lastMatch, setLastMatch] = useState<{ placement: number; kills: number; xpGained: number } | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [phase, setPhase] = useState<GamePhase>("loading");
  const [progress, setProgress] = useState({ fraction: 0, label: "" });
  const [hud, setHud] = useState<HudState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [minimap, setMinimap] = useState("");
  const [round, setRound] = useState(0);
  const reportedRound = useRef(-1);

  // Session ended or the account signed in elsewhere: stop the game and send the player home.
  useEffect(() => {
    const onUnauthorized = () => {
      try {
        localStorage.removeItem("shunyascape_user");
      } catch {
        // ignore
      }
      gameRef.current?.dispose();
      gameRef.current = null;
      setSessionExpired(true);
    };
    window.addEventListener("auth-unauthorized", onUnauthorized);
    return () => window.removeEventListener("auth-unauthorized", onUnauthorized);
  }, []);

  useEffect(() => {
    fetchProfile()
      .then((p) => {
        setProfile(p);
        setOutfit(p.outfit);
      })
      .catch((e) => console.warn("[bg] profile", e));
  }, []);

  // Boot the engine for each match.
  useEffect(() => {
    if (screen !== "match" || !mountRef.current) return;
    let cancelled = false;
    let game: Game | null = null;
    setPhase("loading");
    setError(null);
    setHud(null);
    (async () => {
      try {
        const { Game } = await import("./engine/Game");
        if (cancelled) return;
        game = new Game(
          mountRef.current!,
          (p) => setPhase(p),
          (fraction, label) => setProgress({ fraction, label }),
        );
        gameRef.current = game;
        // Handy for poking at the engine from the dev console.
        if (process.env.NODE_ENV !== "production") (window as unknown as { __bg?: Game }).__bg = game;
        await game.init(quality, { name: profile?.name, tint: outfitTint(outfit) });
        if (cancelled) return;
        game.setSensitivity(0.0022 * sensitivity);
        setMinimap(game.minimap);
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
      game?.dispose();
      gameRef.current = null;
    };
    // Settings and outfit are read when a match boots; sensitivity is applied live below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, round]);

  useEffect(() => {
    gameRef.current?.setSensitivity(0.0022 * sensitivity);
  }, [sensitivity]);

  // Poll HUD state ~20 times a second.
  useEffect(() => {
    if (screen !== "match") return;
    let raf = 0;
    let last = 0;
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      if (t - last < 50) return;
      last = t;
      const g = gameRef.current;
      if (g && phase !== "loading") setHud(g.getHud());
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [screen, phase]);

  // Record the match once it ends.
  useEffect(() => {
    if ((phase !== "dead" && phase !== "won") || reportedRound.current === round) return;
    const g = gameRef.current;
    if (!g) return;
    reportedRound.current = round;
    const h = g.getHud();
    const result = { placement: h.placement, kills: h.kills, damage: h.damageDealt, survived: Math.max(0, h.survived) };
    reportMatch(result)
      .then(({ profile: p, xpGained }) => {
        setProfile(p);
        setLastMatch({ placement: result.placement, kills: result.kills, xpGained });
      })
      .catch((e) => console.warn("[bg] match report", e));
  }, [phase, round]);

  const play = useCallback(() => gameRef.current?.play(), []);

  const startMatch = () => {
    setScreen("match");
    setRound((r) => r + 1);
  };

  const backToLobby = () => {
    gameRef.current?.dispose();
    gameRef.current = null;
    setHud(null);
    setScreen("lobby");
  };

  const changeOutfit = (id: string) => {
    setOutfit(id);
    saveOutfit(id)
      .then(setProfile)
      .catch((e) => console.warn("[bg] outfit", e));
  };

  if (sessionExpired) {
    return (
      <div className="bg-root">
        <div className="bg-overlay bg-menu">
          <div className="bg-menu-card compact">
            <h2 className="bg-title small">Session expired</h2>
            <p className="bg-sub">You were signed out, or your account was opened on another device.</p>
            <button className="bg-cta" onClick={() => router.replace("/")}>Sign in again</button>
          </div>
        </div>
      </div>
    );
  }

  if (screen === "lobby") {
    return (
      <div className="bg-root">
        <Lobby
          profile={profile}
          outfit={outfit}
          onOutfit={changeOutfit}
          quality={quality}
          onQuality={(q) => {
            setQuality(q);
            writePref(QUALITY_KEY, q);
          }}
          sensitivity={sensitivity}
          onSensitivity={(v) => {
            setSensitivity(v);
            writePref(SENS_KEY, String(v));
          }}
          onStart={startMatch}
          lastMatch={lastMatch}
        />
      </div>
    );
  }

  return (
    <div className="bg-root">
      <div ref={mountRef} className="bg-canvas" />

      {phase === "loading" && !error && (
        <div className="bg-overlay bg-loading">
          <div className="bg-loading-card">
            <p className="bg-eyebrow">Deploying</p>
            <div className="bg-bar"><div style={{ width: `${Math.round(progress.fraction * 100)}%` }} /></div>
            <p className="bg-loading-label">{progress.fraction < 1 ? `Loading ${progress.label.replace(/_/g, " ")}…` : "Building the world…"}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-overlay">
          <div className="bg-menu-card">
            <h2 className="bg-title small">Couldn&apos;t start the game</h2>
            <p className="bg-sub">{error}</p>
            <p className="bg-sub">Use a recent Chrome, Edge or Safari with hardware acceleration turned on.</p>
            <button className="bg-cta" onClick={backToLobby}>Back to lobby</button>
          </div>
        </div>
      )}

      {hud && phase !== "loading" && <Hud hud={hud} minimap={minimap} />}

      {(phase === "ready" || phase === "paused") && (
        <div className="bg-overlay bg-click" onClick={play}>
          <div className="bg-menu-card compact">
            <h2 className="bg-title small">{phase === "ready" ? "Ready to drop" : "Paused"}</h2>
            <p className="bg-sub">Click to {phase === "ready" ? "start" : "resume"}. Press Esc to free the mouse.</p>
            <ControlsList />
            {phase === "paused" && (
              <button className="bg-cta ghost" onClick={(e) => { e.stopPropagation(); backToLobby(); }}>
                Leave match
              </button>
            )}
          </div>
        </div>
      )}

      {(phase === "dead" || phase === "won") && hud && (
        <div className="bg-overlay bg-result">
          <div className={`bg-result-card ${phase}`}>
            <p className="bg-eyebrow">{phase === "won" ? "Last one standing" : "Eliminated"}</p>
            <h2 className="bg-place">#{hud.placement}<span>/25</span></h2>
            <div className="bg-stats">
              <div><b>{hud.kills}</b><span>Kills</span></div>
              <div><b>{hud.damageDealt}</b><span>Damage</span></div>
              <div><b>{Math.floor(hud.survived / 60)}:{String(hud.survived % 60).padStart(2, "0")}</b><span>Survived</span></div>
            </div>
            <div className="bg-result-actions">
              <button className="bg-cta ghost" onClick={backToLobby}>Lobby</button>
              <button className="bg-cta" onClick={startMatch}>Play again</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ControlsList() {
  return (
    <ul className="bg-controls">
      {CONTROLS.map((c) => (
        <li key={c.action}>
          <kbd>{c.keys}</kbd>
          <span>{c.action}</span>
        </li>
      ))}
    </ul>
  );
}
