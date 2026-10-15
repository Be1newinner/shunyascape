"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { isTouchDevice, type Quality } from "./engine/config";
import { controlsList, loadBindings, saveBindings, type Bindings } from "./engine/bindings";
import { loadLayout, saveLayout, type TouchLayout } from "./touchLayout";
import type { Game, GamePhase, HudState } from "./engine/Game";
import { outfitTint } from "./engine/outfits";
import Hud from "./Hud";
import Lobby from "./Lobby";
import TouchControls from "./TouchControls";
import LiveMatches from "./LiveMatches";
import type { MatchClient, MatchStart, ServerMessage, SquadMember } from "./engine/MatchClient";
import { claimMission, fetchProfile, saveOutfit, type Profile } from "./profile";
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
  const [bindings, setBindings] = useState<Bindings>(() => loadBindings());
  const [touchLayout, setTouchLayout] = useState<TouchLayout>(() => loadLayout());
  const [screen, setScreenState] = useState<"lobby" | "queue" | "match">("lobby");
  const setScreen = useCallback((s: "lobby" | "queue" | "match") => {
    screenRef.current = s;
    setScreenState(s);
  }, []);
  const clientRef = useRef<MatchClient | null>(null);
  const [online, setOnline] = useState<{ client: MatchClient; start: MatchStart } | null>(null);
  const [queueInfo, setQueueInfo] = useState<Extract<ServerMessage, { t: "queue" }> | null>(null);
  const [netError, setNetError] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [outfit, setOutfit] = useState("classic");
  const [lastMatch, setLastMatch] = useState<{ placement: number; kills: number; xpGained: number; rp?: number; tier?: string } | null>(null);
  /** Squad (party) we're in, if any. */
  const [squad, setSquad] = useState<{ code: string; leader: string; members: SquadMember[] } | null>(null);
  const [squadError, setSquadError] = useState<string | null>(null);
  const youRef = useRef<string | null>(null);
  const [you, setYou] = useState<string | null>(null);
  const screenRef = useRef<"lobby" | "queue" | "match">("lobby");
  const [spectating, setSpectating] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [phase, setPhase] = useState<GamePhase>("loading");
  const [progress, setProgress] = useState({ fraction: 0, label: "" });
  const [hud, setHud] = useState<HudState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [minimap, setMinimap] = useState("");
  const [round, setRound] = useState(0);
  const reportedKey = useRef("");

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
    setSpectating(false);
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
        await game.init(quality, { name: profile?.name, tint: outfitTint(outfit), touch, level: profile?.level }, online ?? undefined);
        if (cancelled) return;
        game.setSensitivity(0.0022 * sensitivity);
        game.controls.setBindings(bindings);
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

  // Poll HUD state ~20 times a second while playing; menus and results need far less
  // (re-rendering them 20×/s on a busy phone made their buttons feel unresponsive).
  useEffect(() => {
    if (screen !== "match") return;
    let raf = 0;
    let last = 0;
    const every = phase === "playing" ? 50 : 300;
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      if (t - last < every) return;
      last = t;
      const g = gameRef.current;
      if (g && phase !== "loading") setHud(g.getHud());
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [screen, phase]);

  // XP before this match, to show what it earned.
  const xpAtStart = useRef(0);
  useEffect(() => {
    if (screen === "match") xpAtStart.current = profile?.stats.xp ?? 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);

  // Online results are recorded by the game server; refresh the lobby numbers once the match is
  // decided for us (squads: when the whole squad is out or the match ends).
  const resultKey = hud?.matchEnd ? "end" : hud && !hud.awaitingSquad ? "out" : "";
  useEffect(() => {
    if ((phase !== "dead" && phase !== "won") || !online || !resultKey) return;
    const key = `${round}:${resultKey}`;
    if (reportedKey.current === key) return;
    reportedKey.current = key;
    const g = gameRef.current;
    if (!g) return;
    const h = g.getHud();
    const t = setTimeout(() => {
      fetchProfile()
        .then((p) => {
          setProfile(p);
          const reward = p.lastMatchReward;
          setLastMatch({
            placement: h.placement,
            kills: h.kills,
            xpGained: Math.max(0, p.stats.xp - xpAtStart.current),
            rp: reward?.rp,
            tier: `${p.ranked.tier}${p.ranked.division ? ` ${p.ranked.division}` : ""}`,
          });
        })
        .catch((e) => console.warn("[bg] profile", e));
    }, 2500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, round, resultKey]);

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
    setSquad(null);
  };

  /** Server messages that matter outside a match: queue, start, squad. */
  const onMessage = useCallback((client: MatchClient, msg: ServerMessage) => {
    if (msg.t === "hello") {
      youRef.current = msg.you;
      setYou(msg.you);
    }
    if (msg.t === "queue") {
      setQueueInfo(msg);
      // Squad members follow their leader into the queue.
      if (screenRef.current === "lobby") {
        setNetError(null);
        setScreen("queue");
      }
    }
    if (msg.t === "queue-left" && screenRef.current === "queue") setScreen("lobby");
    if (msg.t === "match-failed") setNetError("Couldn't start the match. Please try again.");
    if (msg.t === "party") {
      setSquad(msg.code ? { code: msg.code, leader: msg.leader!, members: msg.members ?? [] } : null);
      setSquadError(null);
    }
    if (msg.t === "party-error") setSquadError(msg.error);
    if (msg.t === "start") {
      setOnline({ client, start: msg });
      setScreen("match");
      setRound((r) => r + 1);
    }
  }, [setScreen]);

  /** One connection to the game server, kept open from the lobby through matches (squads live on it). */
  const ensureClient = useCallback(async () => {
    const existing = clientRef.current;
    if (existing?.open) return existing;
    existing?.close();
    const { MatchClient } = await import("./engine/MatchClient");
    const client = new MatchClient();
    clientRef.current = client;
    client.on((msg) => onMessage(client, msg));
    client.onClose = (code) => {
      if (clientRef.current !== client) return;
      clientRef.current = null;
      setSquad(null);
      if (screenRef.current !== "lobby") {
        setNetError(code === 4001 ? "The game was opened in another tab." : "Lost connection to the game server.");
      }
    };
    await client.connect();
    return client;
  }, [onMessage]);

  /** Join matchmaking; the server starts the match when it's full or after 30 seconds. */
  const findMatch = async () => {
    disposeGame();
    setHud(null);
    setOnline(null);
    setNetError(null);
    setQueueInfo(null);
    setScreen("queue");
    try {
      const client = await ensureClient();
      client.leave();
      client.queue();
    } catch (e) {
      setNetError(e instanceof Error ? e.message : "Couldn't reach the game server");
    }
  };

  const squadAction = async (fn: (c: MatchClient) => void) => {
    setSquadError(null);
    try {
      fn(await ensureClient());
    } catch (e) {
      setSquadError(e instanceof Error ? e.message : "Couldn't reach the game server");
    }
  };

  // Invite links (`/battleground?squad=CODE`) drop you straight into the squad.
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("squad");
    if (!code) return;
    window.history.replaceState(null, "", window.location.pathname);
    const t = setTimeout(() => void squadAction((c) => c.joinSquad(code)), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cancelQueue = () => {
    clientRef.current?.cancel();
    setScreen("lobby");
  };

  /** Offline match against bots (when the game server is unavailable). Doesn't count toward stats. */
  const practice = () => {
    clientRef.current?.cancel();
    setOnline(null);
    setNetError(null);
    setScreen("match");
    setRound((r) => r + 1);
  };

  const backToLobby = () => {
    // Leaving a live online match counts as being eliminated. The connection stays (squads live on it).
    clientRef.current?.leave();
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

  /** Deletes the account for good, then leaves like a logout. Returns an error message on failure. */
  const deleteAccount = async (): Promise<string | null> => {
    try {
      const res = await fetch("/api/profile", { method: "DELETE" });
      if (!res.ok) return "Couldn't delete your account. Please try again.";
    } catch {
      return "Couldn't reach the server. Please try again.";
    }
    closeClient();
    disposeGame();
    try {
      localStorage.removeItem("shunyascape_user");
    } catch {
      // ignore
    }
    if (isNativeApp()) postToApp("logout");
    else router.replace("/");
    return null;
  };

  const claim = async (id: string) => {
    const { profile: p } = await claimMission(id);
    setProfile(p);
  };

  const isLeader = !squad || squad.members.length <= 1 || squad.leader === you;
  /** In a squad, only the leader starts; members go back to the lobby to wait. */
  const playAgain = () => {
    if (!online) practice();
    else if (isLeader) void findMatch();
    else backToLobby();
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
          onPractice={practice}
          squad={squad}
          squadError={squadError}
          you={you}
          onCreateSquad={() => squadAction((c) => c.createSquad())}
          onJoinSquad={(code) => squadAction((c) => c.joinSquad(code))}
          onLeaveSquad={() => squadAction((c) => c.leaveSquad())}
          onClaimMission={claim}
          bindings={bindings}
          touchLayout={touchLayout}
          onSaveControls={(b, l) => {
            setBindings(b);
            setTouchLayout(l);
            saveBindings(b);
            saveLayout(l);
          }}
          onLogout={logout}
          onDeleteAccount={deleteAccount}
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
                <p className="bg-eyebrow">Classic · {queueInfo?.squad && queueInfo.squad > 1 ? `Squad of ${queueInfo.squad}` : "Solo"}</p>
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
                  30 soldiers per match: {players} {players === 1 ? "player" : "players"} + {30 - players} bots. Starts when 25 players join, or in 30 seconds.
                </p>
              </>
            )}
            {!netError && (isLeader ? (
              <button className="bg-cta ghost" onClick={cancelQueue}>Cancel</button>
            ) : (
              <p className="bg-sub">Your squad leader started the match.</p>
            ))}
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
        <TouchControls controls={liveGame.controls} hud={hud} onPause={() => liveGame.pause()} layout={touchLayout} />
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
            {hud && (
              <p className="bg-sub bg-ready-meta">
                You board the plane: jump when it&apos;s over the spot you want. Bots: <b>{hud.difficulty}</b>
                {hud.teams < hud.total || hud.squad.length ? ` · ${hud.teams} teams` : ""}
              </p>
            )}
            {!touch && <ControlsList bindings={bindings} />}
            {phase === "paused" && (
              <button className="bg-cta ghost" onClick={(e) => { e.stopPropagation(); backToLobby(); }}>
                Leave match
              </button>
            )}
          </div>
        </div>
      )}

      {hud?.killcam && phase === "dead" && (
        <div className="bg-killcam">
          <span>Eliminated by</span>
          <b>
            {hud.killcam.killer}
            {hud.killcam.bot && <em> · bot</em>}
          </b>
          <em>
            {hud.killcam.weapon}
            {hud.killcam.distance > 0 ? ` · ${hud.killcam.distance} m` : ""}
            {hud.killcam.headshot ? " · headshot" : ""}
            {hud.killcam.killerHp > 0 ? ` · ${hud.killcam.killerHp} HP left` : ""}
          </em>
        </div>
      )}

      {spectating && hud?.spectating && liveGame && (
        <div className="bg-spectate">
          <div className="bg-spectate-who">
            <span>{hud.spectating.mate ? "Spectating squad mate" : "Spectating"}</span>
            <b>{hud.spectating.name}{hud.spectating.bot ? " · bot" : ""}</b>
            <em>{hud.spectating.hp} HP · {hud.spectating.kills} {hud.spectating.kills === 1 ? "kill" : "kills"}</em>
          </div>
          <button className="bg-cta ghost" onClick={() => liveGame.nextSpectate()}>Next</button>
          <button className="bg-cta" onClick={() => { liveGame.stopSpectate(); setSpectating(false); }}>Results</button>
        </div>
      )}

      {(phase === "dead" || phase === "won") && hud && !hud.killcam && !spectating && (
        <div className="bg-overlay bg-result">
          <div className={`bg-result-card ${phase}`}>
            <p className="bg-eyebrow">
              {hud.survivor
                ? "Time's up · You survived"
                : phase === "won"
                  ? hud.squad.length ? "Squad victory" : "Last one standing"
                  : hud.awaitingSquad ? "You're out · squad still fighting" : "Eliminated"}
            </p>
            <h2 className="bg-place">#{hud.placement}<span>/{hud.total}</span></h2>
            {!hud.online && <p className="bg-sub">Practice match: not counted toward your stats.</p>}
            <div className="bg-stats">
              <div><b>{hud.kills}</b><span>Kills</span></div>
              <div><b>{hud.damageDealt}</b><span>Damage</span></div>
              <div><b>{Math.floor(hud.survived / 60)}:{String(hud.survived % 60).padStart(2, "0")}</b><span>Survived</span></div>
            </div>
            {hud.awaitingSquad && <p className="bg-squad-wait">Your squad is still fighting: your final place comes when they&apos;re done.</p>}
            {hud.survivor && <p className="bg-award">+75 XP survivor bonus</p>}
            {hud.online && lastMatch && lastMatch.rp !== undefined && hud.matchEnd && (
              <p className="bg-award">
                +{lastMatch.xpGained} XP · {lastMatch.rp >= 0 ? "+" : ""}{lastMatch.rp} RP · {lastMatch.tier}
              </p>
            )}
            {hud.online && <Podium hud={hud} />}
            <div className={`bg-result-actions ${phase === "dead" && hud.alive > 1 ? "three" : ""}`}>
              <button className="bg-cta ghost" onClick={backToLobby}>Lobby</button>
              {phase === "dead" && hud.alive > 1 && liveGame && (
                <button className="bg-cta ghost" onClick={() => { liveGame.startSpectate(); setSpectating(true); }}>Spectate</button>
              )}
              <button className="bg-cta" onClick={playAgain}>{online && !isLeader ? "Back to squad" : "Play again"}</button>
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

function ControlsList({ bindings }: { bindings: Bindings }) {
  return (
    <ul className="bg-controls">
      {controlsList(bindings).map((c) => (
        <li key={c.action}>
          <kbd>{c.keys}</kbd>
          <span>{c.action}</span>
        </li>
      ))}
    </ul>
  );
}
