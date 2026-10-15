"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CONTROLS, isTouchDevice, type Quality } from "./engine/config";
import type { Game, GamePhase, HudState } from "./engine/Game";
import { outfitTint } from "./engine/outfits";
import Hud from "./Hud";
import Lobby from "./Lobby";
import TouchControls from "./TouchControls";
import LiveMatches from "./LiveMatches";
import type { MatchClient, MatchStart, ServerMessage } from "./engine/MatchClient";
import { fetchProfile, saveOutfit, type Profile } from "./profile";
import { isNativeApp, postToApp } from "../../lib/nativeApp";
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
  /** The running game, for rendering the on-screen controls. */
  const [liveGame, setLiveGame] = useState<Game | null>(null);
  // Client-only component (loaded with ssr: false), so storage is readable on first render.
  // Touch screens get on-screen controls and the phone graphics preset by default.
  const [touch] = useState(() => isTouchDevice());
  const [quality, setQuality] = useState<Quality>(() => readPref<Quality>(QUALITY_KEY, isTouchDevice() ? "mobile" : "medium"));
  const [sensitivity, setSensitivity] = useState(() => Number(readPref(SENS_KEY, "1")) || 1);
  const [screen, setScreen] = useState<"lobby" | "queue" | "match">("lobby");
  const clientRef = useRef<MatchClient | null>(null);
  const [online, setOnline] = useState<{ client: MatchClient; start: MatchStart } | null>(null);
  const [queueInfo, setQueueInfo] = useState<Extract<ServerMessage, { t: "queue" }> | null>(null);
  const [netError, setNetError] = useState<string | null>(null);
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
      // In the app, its native login screen takes over.
      if (isNativeApp()) postToApp("session-expired");
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
        await game.init(quality, { name: profile?.name, tint: outfitTint(outfit), touch }, online ?? undefined);
        if (cancelled) return;
        game.setSensitivity(0.0022 * sensitivity);
        setMinimap(game.minimap);
        setLiveGame(game);
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
      // A failure while tearing down the 3D scene must never take the page down with it.
      try {
        game?.dispose();
      } catch (e) {
        console.warn("[bg] dispose", e);
      }
      gameRef.current = null;
      setLiveGame(null);
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

  // Online results are recorded by the game server; refresh the lobby numbers when a match ends.
  useEffect(() => {
    if ((phase !== "dead" && phase !== "won") || reportedRound.current === round) return;
    const g = gameRef.current;
    if (!g) return;
    reportedRound.current = round;
    if (!online) return; // practice matches don't count
    const h = g.getHud();
    const before = profile?.stats.xp ?? 0;
    setTimeout(() => {
      fetchProfile()
        .then((p) => {
          setProfile(p);
          setLastMatch({ placement: h.placement, kills: h.kills, xpGained: Math.max(0, p.stats.xp - before) });
        })
        .catch((e) => console.warn("[bg] profile", e));
    }, 1500);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, round]);

  const play = useCallback(() => gameRef.current?.play(), []);

  const disposeGame = () => {
    try {
      gameRef.current?.dispose();
    } catch (e) {
      console.warn("[bg] dispose", e);
    }
    gameRef.current = null;
  };

  const closeClient = () => {
    clientRef.current?.close();
    clientRef.current = null;
  };

  /** Join matchmaking; the server starts the match when it's full or after a minute. */
  const findMatch = async () => {
    closeClient();
    disposeGame();
    setHud(null);
    setOnline(null);
    setNetError(null);
    setQueueInfo(null);
    setScreen("queue");
    try {
      const { MatchClient } = await import("./engine/MatchClient");
      const client = new MatchClient();
      clientRef.current = client;
      client.on((msg) => {
        if (msg.t === "queue") setQueueInfo(msg);
        if (msg.t === "match-failed") setNetError("Couldn't start the match. Please try again.");
        if (msg.t === "start") {
          setOnline({ client, start: msg });
          setScreen("match");
          setRound((r) => r + 1);
        }
      });
      client.onClose = (code) => {
        if (clientRef.current !== client) return;
        setNetError(code === 4001 ? "The game was opened in another tab." : "Lost connection to the game server.");
      };
      await client.connect();
      client.queue();
    } catch (e) {
      setNetError(e instanceof Error ? e.message : "Couldn't reach the game server");
    }
  };

  const cancelQueue = () => {
    clientRef.current?.cancel();
    closeClient();
    setScreen("lobby");
  };

  /** Offline match against bots (when the game server is unavailable). Doesn't count toward stats. */
  const practice = () => {
    closeClient();
    setOnline(null);
    setNetError(null);
    setScreen("match");
    setRound((r) => r + 1);
  };

  const backToLobby = () => {
    // Leaving a live online match counts as being eliminated.
    clientRef.current?.leave();
    closeClient();
    setOnline(null);
    disposeGame();
    setHud(null);
    setNetError(null);
    setScreen("lobby");
  };

  useEffect(() => () => clientRef.current?.close(), []);

  const logout = async () => {
    closeClient();
    disposeGame();
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    try {
      localStorage.removeItem("shunyascape_user");
    } catch {
      // ignore
    }
    if (isNativeApp()) postToApp("logout");
    else router.replace("/");
  };

  const changeOutfit = (id: string) => {
    setOutfit(id);
    saveOutfit(id)
      .then(setProfile)
      .catch((e) => console.warn("[bg] outfit", e));
  };

  if (sessionExpired) {
    return (
      <div className={`bg-root ${touch ? "touch" : ""}`}>
        <div className="bg-overlay bg-menu">
          <div className="bg-menu-card compact">
            <h2 className="bg-title small">Session expired</h2>
            <p className="bg-sub">You were signed out, or your account was opened on another device.</p>
            {!isNativeApp() && <button className="bg-cta" onClick={() => router.replace("/")}>Sign in again</button>}
          </div>
        </div>
      </div>
    );
  }

  if (screen === "lobby") {
    return (
      <div className={`bg-root ${touch ? "touch" : ""}`}>
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
          onStart={findMatch}
          onLogout={logout}
          lastMatch={lastMatch}
          touch={touch}
        />
      </div>
    );
  }

  if (screen === "queue") {
    const players = queueInfo?.players ?? 1;
    return (
      <div className={`bg-root ${touch ? "touch" : ""}`}>
        <div className="bg-overlay bg-menu">
          <div className="bg-menu-card compact bg-queue">
            {netError ? (
              <>
                <p className="bg-eyebrow">Matchmaking</p>
                <h2 className="bg-title small">Game server unavailable</h2>
                <p className="bg-sub">{netError}</p>
                <button className="bg-cta" onClick={findMatch}>Try again</button>
                <button className="bg-cta ghost" onClick={practice}>Practice offline vs bots</button>
                <button className="bg-cta ghost" onClick={cancelQueue}>Back to lobby</button>
              </>
            ) : queueInfo?.full ? (
              <>
                <p className="bg-eyebrow">Server busy</p>
                <h2 className="bg-title small">You&apos;re #{queueInfo.position} in line</h2>
                <LiveMatches
                  status={{ maxMatches: Math.max(queueInfo.matches.length, 2), waiting: 0, matches: queueInfo.matches }}
                  compact
                />
                <p className="bg-sub">
                  Both matches are in progress. Stay on this screen: you&apos;ll join the next match as soon as one ends.
                </p>
              </>
            ) : (
              <>
                <p className="bg-eyebrow">Classic · Solo</p>
                <h2 className="bg-title small">Finding players</h2>
                <div className="bg-queue-ring" aria-hidden="true">
                  <span>{queueInfo?.startsIn != null ? `0:${String(queueInfo.startsIn).padStart(2, "0")}` : "…"}</span>
                </div>
                <div className="bg-queue-count">
                  <b>{players}</b>
                  <span>/ {queueInfo?.max ?? 25} players</span>
                </div>
                <div className="bg-bar"><div style={{ width: `${(players / (queueInfo?.max ?? 25)) * 100}%` }} /></div>
                <p className="bg-sub">
                  30 soldiers per match: {players} {players === 1 ? "player" : "players"} + {30 - players} bots. Starts when 25 players join, or in a minute.
                </p>
              </>
            )}
            {!netError && <button className="bg-cta ghost" onClick={cancelQueue}>Cancel</button>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-root ${touch ? "touch" : ""}`}>
      <div ref={mountRef} className="bg-canvas" />

      {netError && phase !== "dead" && phase !== "won" && (
        <div className="bg-overlay bg-result">
          <div className="bg-result-card">
            <p className="bg-eyebrow">Disconnected</p>
            <p className="bg-sub">{netError}</p>
            <button className="bg-cta" onClick={backToLobby}>Back to lobby</button>
          </div>
        </div>
      )}

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

      {hud && phase !== "loading" && (
        <Hud hud={hud} minimap={minimap} onSlot={touch && liveGame ? (i) => liveGame.controls.press(`slot${i + 1}` as "slot1") : undefined} />
      )}
      {touch && hud && phase === "playing" && liveGame && (
        <TouchControls controls={liveGame.controls} hud={hud} onPause={() => liveGame.pause()} />
      )}
      {touch && <div className="bg-rotate">Turn your phone sideways to play</div>}

      {(phase === "ready" || phase === "paused") && (
        <div className="bg-overlay bg-click" onClick={play}>
          <div className="bg-menu-card compact">
            <h2 className="bg-title small">{phase === "ready" ? "Ready to drop" : "Paused"}</h2>
            <p className="bg-sub">
              {touch
                ? `Tap to ${phase === "ready" ? "start" : "resume"}. Left thumb moves, drag on the right to look.`
                : `Click to ${phase === "ready" ? "start" : "resume"}. Press Esc to free the mouse.`}
            </p>
            {!touch && <ControlsList />}
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
            <p className="bg-eyebrow">
              {hud.survivor ? "Time's up · You survived" : phase === "won" ? "Last one standing" : "Eliminated"}
            </p>
            <h2 className="bg-place">#{hud.placement}<span>/{hud.total}</span></h2>
            {!hud.online && <p className="bg-sub">Practice match: not counted toward your stats.</p>}
            <div className="bg-stats">
              <div><b>{hud.kills}</b><span>Kills</span></div>
              <div><b>{hud.damageDealt}</b><span>Damage</span></div>
              <div><b>{Math.floor(hud.survived / 60)}:{String(hud.survived % 60).padStart(2, "0")}</b><span>Survived</span></div>
            </div>
            {hud.survivor && <p className="bg-award">+75 XP survivor bonus</p>}
            {hud.online && <Podium hud={hud} />}
            <div className="bg-result-actions">
              <button className="bg-cta ghost" onClick={backToLobby}>Lobby</button>
              <button className="bg-cta" onClick={online ? findMatch : practice}>Play again</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Top 3 killers of the match, shown once it's decided. */
function Podium({ hud }: { hud: HudState }) {
  const end = hud.matchEnd;
  if (!end) return <p className="bg-sub bg-podium-wait">The match is still on. Top killers are announced when it ends.</p>;
  if (end.podium.length === 0) return null;
  return (
    <div className="bg-podium">
      <p className="bg-eyebrow">Top killers</p>
      <ol>
        {end.podium.map((p) => (
          <li key={p.id} className={`rank${p.rank} ${p.id === hud.you ? "me" : ""}`}>
            <span className="bg-podium-rank">{p.rank}</span>
            <span className="bg-podium-name">
              {p.name}
              {p.bot && <em> bot</em>}
            </span>
            <b>{p.kills} {p.kills === 1 ? "kill" : "kills"}</b>
            {p.xp > 0 && <span className="bg-podium-xp">+{p.xp} XP</span>}
          </li>
        ))}
      </ol>
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
