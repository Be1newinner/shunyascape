"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, Crown, Crosshair, Flame, Lock, Medal, Settings, Share2, Shirt, Swords, Target, Trophy, Users, X } from "lucide-react";
import { type Quality } from "./engine/config";
import { controlsList, type Bindings } from "./engine/bindings";
import type { TouchLayout } from "./touchLayout";
import ControlsEditor from "./ControlsEditor";
import type { LobbyScene } from "./engine/LobbyScene";
import { OUTFITS, outfitTint } from "./engine/outfits";
import { TIER_COLORS, fetchLeaderboard, type LeaderboardRow, type Profile } from "./profile";
import type { SquadMember } from "./engine/MatchClient";
import LiveMatches, { serverFull, useServerStatus } from "./LiveMatches";
import InstallPrompt from "../InstallPrompt";

interface Props {
  profile: Profile | null;
  outfit: string;
  onOutfit: (id: string) => void;
  quality: Quality;
  onQuality: (q: Quality) => void;
  sensitivity: number;
  onSensitivity: (v: number) => void;
  onStart: () => void;
  /** Offline match against bots (doesn't count). */
  onPractice?: () => void;
  squad: { code: string; leader: string; members: SquadMember[] } | null;
  squadError: string | null;
  /** Our account id on the game server (to know if we lead the squad). */
  you: string | null;
  onCreateSquad: () => void;
  onJoinSquad: (code: string) => void;
  onLeaveSquad: () => void;
  onClaimMission: (id: string) => Promise<void>;
  bindings: Bindings;
  touchLayout: TouchLayout;
  onSaveControls: (bindings: Bindings, layout: TouchLayout) => void;
  lastMatch: { placement: number; kills: number; xpGained: number; rp?: number } | null;
  touch?: boolean;
  onLogout?: () => void;
  /** Permanently deletes the account; resolves to an error message on failure. */
  onDeleteAccount?: () => Promise<string | null>;
}

function fmtHours(seconds: number) {
  const m = Math.round(seconds / 60);
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

/** BGMI-style home screen: your soldier, your record, the wardrobe and the Start button. */
export default function Lobby(props: Props) {
  const { profile, outfit, onOutfit, quality, onQuality, sensitivity, onSensitivity, onStart, lastMatch, touch, onLogout, onDeleteAccount } = props;
  const { squad, squadError, you, onCreateSquad, onJoinSquad, onLeaveSquad, onClaimMission, onPractice } = props;
  const [joinCode, setJoinCode] = useState("");
  const [customizing, setCustomizing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [board, setBoard] = useState<{ players: LeaderboardRow[]; endsAt: string } | null>(null);
  const [checkInSeen, setCheckInSeen] = useState(false);
  const inSquad = !!squad && squad.members.length > 1;
  const leader = !squad || squad.leader === you;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const status = useServerStatus();
  const full = serverFull(status);
  const stageRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<LobbyScene | null>(null);
  const [panel, setPanel] = useState<"none" | "wardrobe" | "settings" | "missions" | "ranked" | "squad">("none");
  const [stageError, setStageError] = useState(false);
  // Latest outfit for the stage, which loads asynchronously.
  const outfitRef = useRef(outfit);
  useEffect(() => {
    outfitRef.current = outfit;
  }, [outfit]);

  useEffect(() => {
    let scene: LobbyScene | null = null;
    let cancelled = false;
    (async () => {
      try {
        const { LobbyScene } = await import("./engine/LobbyScene");
        if (cancelled || !stageRef.current) return;
        scene = new LobbyScene(stageRef.current);
        sceneRef.current = scene;
        await scene.init(outfitTint(outfitRef.current));
      } catch (e) {
        console.error(e);
        if (!cancelled) setStageError(true);
      }
    })();
    return () => {
      cancelled = true;
      try {
        scene?.dispose();
      } catch (e) {
        console.warn("[bg] lobby dispose", e);
      }
      sceneRef.current = null;
    };
    // The stage is built once; outfit changes are applied below without a rebuild.
  }, []);

  useEffect(() => {
    sceneRef.current?.setTint(outfitTint(outfit));
  }, [outfit]);

  const s = profile?.stats;
  const deaths = s ? Math.max(1, s.matches - s.wins) : 1;
  const stats = s
    ? [
        { label: "Matches", value: s.matches },
        { label: "Wins", value: s.wins },
        { label: "Kills", value: s.kills },
        { label: "K/D", value: (s.kills / deaths).toFixed(2) },
        { label: "Top 10", value: s.matches ? `${Math.round((s.top10 / s.matches) * 100)}%` : "—" },
        { label: "Best", value: s.bestPlacement ? `#${s.bestPlacement}` : "—" },
        { label: "Avg damage", value: s.matches ? Math.round(s.damage / s.matches) : 0 },
        { label: "Time played", value: fmtHours(s.timePlayed) },
      ]
    : [];
  const xpPct = profile ? Math.round((profile.xpIntoLevel / profile.xpForNext) * 100) : 0;
  const ranked = profile?.ranked;
  const tierName = ranked ? `${ranked.tier}${ranked.division ? ` ${ranked.division}` : ""}` : "";
  const missionsReady = profile?.missions.missions.filter((m) => m.progress >= m.goal && !m.claimed).length ?? 0;

  // The leaderboard loads when its panel opens.
  useEffect(() => {
    if (panel !== "ranked") return;
    let live = true;
    fetchLeaderboard()
      .then((b) => live && setBoard({ players: b.players, endsAt: b.endsAt }))
      .catch((e) => console.warn("[bg] leaderboard", e));
    return () => {
      live = false;
    };
  }, [panel]);

  const toggle = (p: typeof panel) => setPanel(panel === p ? "none" : p);
  const inviteLink = squad && typeof window !== "undefined" ? `${window.location.origin}/battleground?squad=${squad.code}` : "";
  const shareInvite = async () => {
    if (!squad) return;
    const text = `Join my ShunyaScape squad: code ${squad.code}`;
    try {
      if (navigator.share) await navigator.share({ title: "ShunyaScape squad", text, url: inviteLink });
      else {
        await navigator.clipboard.writeText(`${text} · ${inviteLink}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }
    } catch {
      // Share sheet dismissed.
    }
  };

  return (
    <div className="bg-lobby">
      <div className="bg-lobby-bg" aria-hidden="true" />
      <div ref={stageRef} className="bg-lobby-stage" />
      {stageError && <div className="bg-lobby-stage-error">3D preview unavailable</div>}
      <InstallPrompt placement="lobby" />
      {customizing && (
        <ControlsEditor
          touch={!!touch}
          bindings={props.bindings}
          layout={props.touchLayout}
          onClose={() => setCustomizing(false)}
          onSave={(b, l) => {
            props.onSaveControls(b, l);
            setCustomizing(false);
          }}
        />
      )}
      {profile?.checkIn && !checkInSeen && (
        <button className="bg-checkin" onClick={() => setCheckInSeen(true)}>
          <Flame aria-hidden="true" />
          <span>
            <b>Day {profile.checkIn.day} login streak</b>
            <em>
              +{profile.checkIn.xp} XP
              {profile.checkIn.unlocked.length > 0 && ` · unlocked ${profile.checkIn.unlocked.map((id) => OUTFITS.find((o) => o.id === id)?.name ?? id).join(", ")}`}
            </em>
          </span>
        </button>
      )}

      {/* Top bar: player card + level */}
      <header className="bg-lobby-top">
        <div className="bg-player-card">
          <div className="bg-avatar" style={{ background: outfitTint(outfit) }}>
            {(profile?.name ?? "?").charAt(0).toUpperCase()}
          </div>
          <div className="bg-player-meta">
            <b>{profile?.name ?? "Loading…"}</b>
            <div className="bg-level">
              <span className="bg-level-badge">Lv {profile?.level ?? 1}</span>
              <div className="bg-xp"><div style={{ width: `${xpPct}%` }} /></div>
              <span className="bg-xp-num">{profile ? `${profile.xpIntoLevel}/${profile.xpForNext} XP` : ""}</span>
            </div>
          </div>
          {ranked && (
            <button className="bg-tier-chip" style={{ ["--tier" as string]: TIER_COLORS[ranked.tier] }} onClick={() => toggle("ranked")}>
              <Medal aria-hidden="true" />
              <span>{tierName}</span>
              <b>{ranked.points} RP</b>
            </button>
          )}
        </div>
        <nav className="bg-lobby-tabs">
          <button className={panel === "missions" ? "on" : ""} onClick={() => toggle("missions")}>
            <Target className="h-4 w-4" aria-hidden="true" /> Missions
            {missionsReady > 0 && <span className="bg-tab-dot">{missionsReady}</span>}
          </button>
          <button className={panel === "ranked" ? "on" : ""} onClick={() => toggle("ranked")}>
            <Trophy className="h-4 w-4" aria-hidden="true" /> Ranked
          </button>
          <button className={panel === "squad" ? "on" : ""} onClick={() => toggle("squad")}>
            <Users className="h-4 w-4" aria-hidden="true" /> Squad
            {inSquad && <span className="bg-tab-dot">{squad!.members.length}</span>}
          </button>
          <button className={panel === "wardrobe" ? "on" : ""} onClick={() => setPanel(panel === "wardrobe" ? "none" : "wardrobe")}>
            <Shirt className="h-4 w-4" aria-hidden="true" /> Wardrobe
          </button>
          <button className={panel === "settings" ? "on" : ""} onClick={() => setPanel(panel === "settings" ? "none" : "settings")}>
            <Settings className="h-4 w-4" aria-hidden="true" /> Settings
          </button>
        </nav>
      </header>

      {/* Left: career stats */}
      <aside className="bg-career">
        <h2><Trophy className="h-4 w-4" aria-hidden="true" /> Career</h2>
        <div className="bg-career-grid">
          {stats.map((st) => (
            <div key={st.label}>
              <b>{st.value}</b>
              <span>{st.label}</span>
            </div>
          ))}
        </div>
        {lastMatch && (
          <div className="bg-last-match">
            <span>Last match</span>
            <b>#{lastMatch.placement} · {lastMatch.kills} kills</b>
            <em>+{lastMatch.xpGained} XP{lastMatch.rp !== undefined ? ` · ${lastMatch.rp >= 0 ? "+" : ""}${lastMatch.rp} RP` : ""}</em>
          </div>
        )}
      </aside>

      {/* Right: wardrobe / settings panel */}
      {panel !== "none" && (
        <aside className="bg-side-panel">
          <button className="bg-panel-close" onClick={() => setPanel("none")} aria-label="Close">
            <X className="h-4 w-4" />
          </button>
          {panel === "missions" ? (
            <MissionsPanel profile={profile} claiming={claiming} onClaim={async (id) => {
              setClaiming(id);
              try {
                await onClaimMission(id);
              } catch (e) {
                console.warn("[bg] claim", e);
              }
              setClaiming(null);
            }} />
          ) : panel === "ranked" ? (
            <RankedPanel profile={profile} board={board} />
          ) : panel === "squad" ? (
            <>
              <h2><Users className="h-4 w-4" aria-hidden="true" /> Squad</h2>
              {squad ? (
                <>
                  <p className="bg-panel-sub">Share the code: friends who join land in your match, on your team. No friendly fire.</p>
                  <div className="bg-squad-code">
                    <b>{squad.code}</b>
                    <button onClick={shareInvite} aria-label="Share invite">
                      {copied ? <Check aria-hidden="true" /> : typeof navigator !== "undefined" && "share" in navigator ? <Share2 aria-hidden="true" /> : <Copy aria-hidden="true" />}
                    </button>
                  </div>
                  <ul className="bg-squad-list">
                    {squad.members.map((m) => (
                      <li key={m.id}>
                        <span className="bg-avatar small" style={{ background: outfitTint(m.outfit) }}>{m.name.charAt(0).toUpperCase()}</span>
                        <b>{m.name}{m.id === you ? " (you)" : ""}</b>
                        <em>Lv {m.level}</em>
                        {m.id === squad.leader && <Crown className="bg-squad-crown" aria-label="Leader" />}
                      </li>
                    ))}
                    {Array.from({ length: Math.max(0, 4 - squad.members.length) }, (_, i) => (
                      <li key={`open${i}`} className="open">Open slot</li>
                    ))}
                  </ul>
                  {!leader && <p className="bg-panel-sub">Waiting for the squad leader to start.</p>}
                  <button className="bg-cta ghost" onClick={onLeaveSquad}>Leave squad</button>
                </>
              ) : (
                <>
                  <p className="bg-panel-sub">Play with up to 3 friends as one team: same match, no friendly fire, one placement.</p>
                  <button className="bg-cta" onClick={onCreateSquad}>Create squad</button>
                  <form
                    className="bg-squad-join"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (joinCode.trim()) onJoinSquad(joinCode.trim());
                    }}
                  >
                    <input
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 5))}
                      placeholder="CODE"
                      aria-label="Squad code"
                      autoCapitalize="characters"
                      spellCheck={false}
                    />
                    <button className="bg-cta ghost" type="submit">Join</button>
                  </form>
                </>
              )}
              {squadError && <p className="bg-delete-error">{squadError}</p>}
            </>
          ) : panel === "wardrobe" ? (
            <>
              <h2><Shirt className="h-4 w-4" aria-hidden="true" /> Wardrobe</h2>
              <p className="bg-panel-sub">Your outfit shows in every match.</p>
              <div className="bg-outfits">
                {OUTFITS.map((o) => {
                  const needs = profile?.lockedOutfits[o.id];
                  const locked = needs !== undefined && !profile?.unlocked.includes(o.id);
                  return (
                    <button
                      key={o.id}
                      className={`bg-outfit ${o.id === outfit ? "on" : ""} ${locked ? "locked" : ""}`}
                      onClick={() => !locked && onOutfit(o.id)}
                      disabled={locked}
                      title={locked ? `Log in ${needs} days in a row to unlock` : undefined}
                    >
                      <span className="bg-outfit-swatch" style={{ background: `linear-gradient(135deg, ${o.tint}, color-mix(in srgb, ${o.tint} 55%, black))` }}>
                        {locked && <Lock aria-hidden="true" />}
                      </span>
                      <span>{o.name}</span>
                      {locked && <em>{needs}-day streak</em>}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <h2><Settings className="h-4 w-4" aria-hidden="true" /> Settings</h2>
              <div className="bg-settings">
                <label>
                  <span>Graphics</span>
                  <div className="bg-seg">
                    {((touch ? ["mobile", "low", "medium", "high"] : ["low", "medium", "high"]) as Quality[]).map((q) => (
                      <button key={q} className={q === quality ? "on" : ""} onClick={() => onQuality(q)}>
                        {q}
                      </button>
                    ))}
                  </div>
                </label>
                <label>
                  <span>Mouse sensitivity · {sensitivity.toFixed(2)}</span>
                  <input type="range" min={0.3} max={3} step={0.05} value={sensitivity} onChange={(e) => onSensitivity(Number(e.target.value))} />
                </label>
              </div>
              <button className="bg-cta bg-customize" onClick={() => setCustomizing(true)}>
                {touch ? "Customize touch controls" : "Customize controls"}
              </button>
              {onLogout && (
                <button className="bg-cta ghost bg-logout" onClick={onLogout}>
                  Log out
                </button>
              )}
              {onDeleteAccount &&
                (confirmDelete ? (
                  <div className="bg-delete-confirm" role="alertdialog" aria-label="Delete account">
                    <p>
                      Delete your account for good? Your profile, level, stats and outfit are erased and can&apos;t be
                      recovered.
                    </p>
                    {deleteError && <p className="bg-delete-error">{deleteError}</p>}
                    <div className="bg-delete-actions">
                      <button className="bg-cta ghost" onClick={() => setConfirmDelete(false)} disabled={deleting}>
                        Cancel
                      </button>
                      <button
                        className="bg-cta bg-danger"
                        disabled={deleting}
                        onClick={async () => {
                          setDeleting(true);
                          setDeleteError(await onDeleteAccount());
                          setDeleting(false);
                        }}
                      >
                        {deleting ? "Deleting…" : "Delete forever"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button className="bg-link-danger" onClick={() => { setDeleteError(null); setConfirmDelete(true); }}>
                    Delete account
                  </button>
                ))}
              {!touch && <ul className="bg-controls">
                {controlsList(props.bindings).map((c) => (
                  <li key={c.action}>
                    <kbd>{c.keys}</kbd>
                    <span>{c.action}</span>
                  </li>
                ))}
              </ul>}
            </>
          )}
        </aside>
      )}

      {/* Bottom: mode + start */}
      <footer className="bg-lobby-bottom">
        <div className="bg-mode">
          <Crosshair className="h-5 w-5" aria-hidden="true" />
          <div>
            <b>Classic · {inSquad ? `Squad of ${squad!.members.length}` : "Solo"}</b>
            <span>{inSquad ? "Your squad vs everyone" : "Battleground · 30 soldiers"}</span>
          </div>
        </div>
        <div className="bg-lobby-go">
          <LiveMatches status={status} />
          {full && <p className="bg-go-note">Both matches are running. Join the line to play next.</p>}
          <button className={`bg-start ${full ? "waiting" : ""}`} onClick={onStart} disabled={!leader}>
            <Swords className="h-6 w-6" aria-hidden="true" />
            {!leader ? "Leader starts" : full ? "Join line" : "Start"}
          </button>
          {onPractice && leader && (
            <button className="bg-practice" onClick={onPractice}>Practice vs bots</button>
          )}
        </div>
      </footer>
    </div>
  );
}

function untilText(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "soon";
  const h = Math.floor(ms / 3_600_000);
  if (h >= 48) return `${Math.floor(h / 24)}d ${h % 24}h`;
  return `${h}h ${Math.floor((ms % 3_600_000) / 60_000)}m`;
}

/** Login streak and today's three missions. */
function MissionsPanel({ profile, claiming, onClaim }: { profile: Profile | null; claiming: string | null; onClaim: (id: string) => void }) {
  if (!profile) return <p className="bg-panel-sub">Loading…</p>;
  const streak = profile.streak.count;
  return (
    <>
      <h2><Target className="h-4 w-4" aria-hidden="true" /> Daily missions</h2>
      <div className="bg-streak" aria-label={`${streak}-day login streak`}>
        {Array.from({ length: 7 }, (_, i) => {
          const day = i + 1;
          const reward = Object.entries(profile.lockedOutfits).find(([, d]) => d === day);
          return (
            <div key={day} className={`${streak % 7 >= day || (streak >= 7 && streak % 7 === 0) ? "done" : ""} ${reward ? "prize" : ""}`}>
              <Flame aria-hidden="true" />
              <span>Day {day}</span>
              <em>{20 + 10 * Math.min(6, i)} XP{reward ? " + outfit" : ""}</em>
            </div>
          );
        })}
      </div>
      <p className="bg-panel-sub">{streak > 0 ? `${streak}-day streak (best ${profile.streak.best}). Come back tomorrow to keep it.` : "Log in every day to build a streak."}</p>
      <ul className="bg-missions">
        {profile.missions.missions.map((m) => {
          const done = m.progress >= m.goal;
          return (
            <li key={m.id} className={m.claimed ? "claimed" : done ? "done" : ""}>
              <div>
                <b>{m.title}</b>
                <div className="bg-mission-bar"><div style={{ width: `${(m.progress / m.goal) * 100}%` }} /></div>
                <span>{m.progress}/{m.goal} · +{m.xp} XP</span>
              </div>
              {m.claimed ? (
                <Check className="bg-mission-check" aria-label="Claimed" />
              ) : (
                <button className="bg-cta" disabled={!done || claiming === m.id} onClick={() => onClaim(m.id)}>
                  {claiming === m.id ? "…" : "Claim"}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <p className="bg-panel-sub">New missions in {untilText(profile.missions.resetsAt)}. Only online matches count.</p>
    </>
  );
}

/** Your tier this season and the leaderboard. */
function RankedPanel({ profile, board }: { profile: Profile | null; board: { players: LeaderboardRow[]; endsAt: string } | null }) {
  const r = profile?.ranked;
  if (!r) return <p className="bg-panel-sub">Loading…</p>;
  const color = TIER_COLORS[r.tier] ?? "#fff";
  return (
    <>
      <h2><Trophy className="h-4 w-4" aria-hidden="true" /> Ranked · Season {r.season.split("-W")[1]}</h2>
      <div className="bg-rank-card" style={{ ["--tier" as string]: color }}>
        <div className="bg-rank-badge"><Medal aria-hidden="true" /></div>
        <div>
          <b>{r.tier}{r.division ? ` ${r.division}` : ""}</b>
          <span>{r.points} RP{r.rank ? ` · #${r.rank} this season` : ""}</span>
          {r.nextAt !== null && (
            <>
              <div className="bg-mission-bar"><div style={{ width: `${r.progress * 100}%` }} /></div>
              <em>{r.nextAt - r.points} RP to the next division</em>
            </>
          )}
        </div>
      </div>
      <p className="bg-panel-sub">
        Season ends in {untilText(r.endsAt)}; RP start over each week. Placement earns the most, kills add up to +50.
        {r.last ? ` Last season: ${r.last.tier} (${r.last.points} RP).` : ""}
      </p>
      <ol className="bg-board">
        {!board && <li className="empty">Loading leaderboard…</li>}
        {board && board.players.length === 0 && <li className="empty">No ranked matches yet this season. Be the first.</li>}
        {board?.players.map((p) => (
          <li key={p.rank} className={p.you ? "me" : ""} style={{ ["--tier" as string]: TIER_COLORS[p.tier] }}>
            <span className="bg-board-rank">{p.rank}</span>
            <span className="bg-avatar small" style={{ background: outfitTint(p.outfit) }}>{p.name.charAt(0).toUpperCase()}</span>
            <b>{p.name}</b>
            <em>{p.tier}</em>
            <span className="bg-board-rp">{p.points}</span>
          </li>
        ))}
      </ol>
    </>
  );
}
