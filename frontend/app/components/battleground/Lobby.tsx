"use client";

import { useEffect, useRef, useState } from "react";
import { Crosshair, Settings, Shirt, Swords, Trophy, X } from "lucide-react";
import { CONTROLS, type Quality } from "./engine/config";
import type { LobbyScene } from "./engine/LobbyScene";
import { OUTFITS, outfitTint } from "./engine/outfits";
import type { Profile } from "./profile";

interface Props {
  profile: Profile | null;
  outfit: string;
  onOutfit: (id: string) => void;
  quality: Quality;
  onQuality: (q: Quality) => void;
  sensitivity: number;
  onSensitivity: (v: number) => void;
  onStart: () => void;
  lastMatch: { placement: number; kills: number; xpGained: number } | null;
  touch?: boolean;
  onLogout?: () => void;
}

function fmtHours(seconds: number) {
  const m = Math.round(seconds / 60);
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

/** BGMI-style home screen: your soldier, your record, the wardrobe and the Start button. */
export default function Lobby(props: Props) {
  const { profile, outfit, onOutfit, quality, onQuality, sensitivity, onSensitivity, onStart, lastMatch, touch, onLogout } = props;
  const stageRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<LobbyScene | null>(null);
  const [panel, setPanel] = useState<"none" | "wardrobe" | "settings">("none");
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
      scene?.dispose();
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

  return (
    <div className="bg-lobby">
      <div className="bg-lobby-bg" aria-hidden="true" />
      <div ref={stageRef} className="bg-lobby-stage" />
      {stageError && <div className="bg-lobby-stage-error">3D preview unavailable</div>}

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
        </div>
        <nav className="bg-lobby-tabs">
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
            <em>+{lastMatch.xpGained} XP</em>
          </div>
        )}
      </aside>

      {/* Right: wardrobe / settings panel */}
      {panel !== "none" && (
        <aside className="bg-side-panel">
          <button className="bg-panel-close" onClick={() => setPanel("none")} aria-label="Close">
            <X className="h-4 w-4" />
          </button>
          {panel === "wardrobe" ? (
            <>
              <h2><Shirt className="h-4 w-4" aria-hidden="true" /> Wardrobe</h2>
              <p className="bg-panel-sub">Your outfit shows in every match.</p>
              <div className="bg-outfits">
                {OUTFITS.map((o) => (
                  <button key={o.id} className={`bg-outfit ${o.id === outfit ? "on" : ""}`} onClick={() => onOutfit(o.id)}>
                    <span className="bg-outfit-swatch" style={{ background: `linear-gradient(135deg, ${o.tint}, color-mix(in srgb, ${o.tint} 55%, black))` }} />
                    <span>{o.name}</span>
                  </button>
                ))}
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
              {onLogout && (
                <button className="bg-cta ghost bg-logout" onClick={onLogout}>
                  Log out
                </button>
              )}
              {!touch && <ul className="bg-controls">
                {CONTROLS.map((c) => (
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
            <b>Classic · Solo</b>
            <span>Battleground · you vs 24 soldiers</span>
          </div>
        </div>
        <button className="bg-start" onClick={onStart}>
          <Swords className="h-6 w-6" aria-hidden="true" />
          Start
        </button>
      </footer>
    </div>
  );
}
