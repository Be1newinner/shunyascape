"use client";

import { MAP_HALF, MAP_SIZE } from "./engine/config";
import type { HudState } from "./engine/Game";
import { Bomb, Box, HardHat, Shield } from "lucide-react";

const MINI = 190; // px
const MINI_METRES = 220;

function fmtTime(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function Compass({ heading }: { heading: number }) {
  const labels: Record<number, string> = { 0: "N", 45: "NE", 90: "E", 135: "SE", 180: "S", 225: "SW", 270: "W", 315: "NW" };
  const ticks = [];
  const span = 100; // degrees visible
  for (let d = Math.ceil((heading - span / 2) / 15) * 15; d <= heading + span / 2; d += 15) {
    const deg = ((d % 360) + 360) % 360;
    const x = ((d - heading) / span) * 100 + 50;
    ticks.push(
      <div key={d} className={`bg-compass-tick ${labels[deg] ? "major" : ""}`} style={{ left: `${x}%` }}>
        <span>{labels[deg] ?? deg}</span>
      </div>,
    );
  }
  return (
    <div className="bg-compass">
      {ticks}
      <div className="bg-compass-needle">{Math.round(heading)}</div>
    </div>
  );
}

function Minimap({ hud, src }: { hud: HudState; src: string }) {
  const scale = MINI / MINI_METRES;
  const toMini = (wx: number, wz: number) => ({
    x: (wx - hud.player.x) * scale + MINI / 2,
    y: (wz - hud.player.z) * scale + MINI / 2,
  });
  const z = hud.zone;
  const cur = toMini(z.cx, z.cz);
  const next = toMini(z.nx, z.nz);
  const bgSize = MAP_SIZE * scale;
  return (
    <div className="bg-minimap" style={{ width: MINI, height: MINI }}>
      <div
        className="bg-minimap-img"
        style={{
          backgroundImage: src ? `url(${src})` : undefined,
          backgroundSize: `${bgSize}px ${bgSize}px`,
          backgroundPosition: `${-(hud.player.x + MAP_HALF) * scale + MINI / 2}px ${-(hud.player.z + MAP_HALF) * scale + MINI / 2}px`,
        }}
      />
      <svg width={MINI} height={MINI} className="bg-minimap-svg">
        <defs>
          <mask id="bg-zone-mask">
            <rect width={MINI} height={MINI} fill="white" />
            <circle cx={cur.x} cy={cur.y} r={z.radius * scale} fill="black" />
          </mask>
        </defs>
        <rect width={MINI} height={MINI} fill="hsla(220, 90%, 45%, 0.35)" mask="url(#bg-zone-mask)" />
        <circle cx={cur.x} cy={cur.y} r={z.radius * scale} fill="none" stroke="hsl(212, 100%, 66%)" strokeWidth={2} />
        <circle cx={next.x} cy={next.y} r={z.nRadius * scale} fill="none" stroke="white" strokeWidth={1.5} strokeDasharray="4 3" />
        {!z.inside && <line x1={MINI / 2} y1={MINI / 2} x2={next.x} y2={next.y} stroke="white" strokeWidth={1} strokeDasharray="2 3" />}
        {hud.drop && (() => {
          const a = toMini(hud.drop.path.ax, hud.drop.path.az);
          const b = toMini(hud.drop.path.bx, hud.drop.path.bz);
          return <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="hsl(45 100% 70%)" strokeWidth={2} strokeDasharray="6 4" />;
        })()}
        {hud.airdrops.map((a) => {
          const p = toMini(a.x, a.z);
          return (
            <g key={a.id} transform={`translate(${p.x} ${p.y})`}>
              <rect x={-4.5} y={-4.5} width={9} height={9} rx={2} fill="hsl(4 80% 55%)" stroke="white" strokeWidth={1.5} />
              {!a.landed && <circle r={8} fill="none" stroke="hsl(4 80% 65%)" strokeWidth={1.2} className="bg-mini-pulse" />}
            </g>
          );
        })}
        {hud.squad.filter((m) => m.alive).map((m, i) => {
          const p = toMini(m.x, m.z);
          return <circle key={m.id} cx={p.x} cy={p.y} r={4} fill={MATE_COLORS[i % MATE_COLORS.length]} stroke="black" strokeWidth={1} />;
        })}
        {hud.threats.map((t) => {
          const p = toMini(t.x, t.z);
          return <circle key={t.id} cx={p.x} cy={p.y} r={3.5} fill="hsl(358 95% 55%)" stroke="hsl(0 0% 100% / 0.8)" strokeWidth={1} opacity={1 - t.age * 0.7} />;
        })}
      </svg>
      <div className="bg-minimap-me" style={{ transform: `translate(-50%, -50%) rotate(${hud.heading}deg)` }} />
    </div>
  );
}

const MATE_COLORS = ["hsl(186 90% 55%)", "hsl(120 70% 55%)", "hsl(300 75% 68%)"];

/** Things drawn over the 3D view where they are in the world: damage numbers, squad mates, crates, shooters. */
function WorldMarkers({ hud }: { hud: HudState }) {
  return (
    <>
      {hud.damageNumbers.map((d) => (
        <div
          key={d.id}
          className={`bg-dmgnum ${d.kind}`}
          style={{ left: `${d.x}%`, top: `${d.y}%`, opacity: Math.max(0, 1 - Math.max(0, d.age - 0.55) / 0.55) }}
        >
          {d.text}
        </div>
      ))}
      {hud.squad.map((m, i) =>
        m.screen ? (
          <div key={m.id} className="bg-mate" style={{ left: `${m.screen.x}%`, top: `${m.screen.y}%`, ["--mate" as string]: MATE_COLORS[i % MATE_COLORS.length] }}>
            <span>{m.name}</span>
            <i><b style={{ width: `${m.hp}%` }} /></i>
            {m.distance > 25 && <em>{m.distance} m</em>}
          </div>
        ) : null,
      )}
      {hud.airdrops.map((a) =>
        a.screen ? (
          <div key={a.id} className="bg-crate-mark" style={{ left: `${a.screen.x}%`, top: `${a.screen.y}%` }}>
            <Box aria-hidden="true" />
            <em>{a.distance} m</em>
          </div>
        ) : null,
      )}
      {hud.threats.map((t) =>
        t.screen ? (
          <div key={t.id} className="bg-threat" style={{ left: `${t.screen.x}%`, top: `${t.screen.y}%`, opacity: 1 - t.age * 0.7 }} title={`${t.distance} m`} />
        ) : null,
      )}
    </>
  );
}

/** Altitude, jump / parachute prompts while dropping in. */
function DropHud({ drop, touch }: { drop: NonNullable<HudState["drop"]>; touch: boolean }) {
  const key = touch ? null : <kbd>Space</kbd>;
  return (
    <>
      <div className="bg-altimeter">
        <span>Altitude</span>
        <b>{drop.altitude} m</b>
        <div className="bg-altimeter-bar"><div style={{ height: `${Math.min(100, (drop.altitude / 180) * 100)}%` }} /></div>
      </div>
      <div className="bg-drop-prompt">
        {drop.stage === "plane" ? (
          drop.canJump ? (
            <>
              {key} {touch ? "Tap JUMP" : "Jump"} to drop · auto-jump in {drop.timeLeft}s
            </>
          ) : (
            <>Approaching the island…</>
          )
        ) : drop.stage === "fall" ? (
          <>
            {touch ? "Push the stick up to dive · tap CHUTE" : "W to dive · "}{key}{!touch && " open parachute"}
          </>
        ) : (
          <>Steer to your landing spot</>
        )}
      </div>
    </>
  );
}

export default function Hud({ hud, minimap, onSlot }: { hud: HudState; minimap: string; onSlot?: (index: number) => void }) {
  const hp = hud.health / hud.maxHealth;
  const active = hud.slots.find((s) => s?.active) ?? null;
  const hitAge = hud.hitMarker ? hud.now - hud.hitMarker.time : 99;
  const spread = Math.min(80, Math.max(6, hud.spreadPx));
  const lowHp = hp < 0.3;

  return (
    <div className={`bg-hud ${hud.scoped ? "scoped" : ""}`}>
      {/* First so the rest of the HUD draws on top of the scope mask. */}
      {hud.scoped && (
        <div className="bg-scope">
          <div className="bg-scope-reticle" />
          {hud.zoom && <span className="bg-scope-zoom">{hud.zoom.replace("x", "×")}</span>}
        </div>
      )}
      <Compass heading={hud.heading} />
      <WorldMarkers hud={hud} />
      {hud.callout && (
        <div className="bg-callout" key={hud.callout.id}>
          <b>{hud.callout.text}</b>
          {hud.callout.sub && <span>{hud.callout.sub}</span>}
        </div>
      )}
      {hud.drop && <DropHud drop={hud.drop} touch={hud.touch} />}
      {hud.squad.length > 0 && (
        <div className="bg-squad">
          {hud.squad.map((m, i) => (
            <div key={m.id} className={m.alive ? "" : "out"} style={{ ["--mate" as string]: MATE_COLORS[i % MATE_COLORS.length] }}>
              <span>{m.name}</span>
              <i><b style={{ width: `${m.hp}%` }} /></i>
            </div>
          ))}
        </div>
      )}

      <div className="bg-topright">
        <Minimap hud={hud} src={minimap} />
        <div className="bg-counters">
          {hud.timeLeft !== null && (
            <div className={`bg-timer ${hud.timeLeft <= 60 ? "low" : ""}`} title="Match ends when time runs out">
              <span>Time</span>
              <b>{Math.floor(hud.timeLeft / 60)}:{String(hud.timeLeft % 60).padStart(2, "0")}</b>
            </div>
          )}
          <div><span>Alive</span><b>{hud.alive}</b></div>
          <div><span>Kills</span><b>{hud.kills}</b></div>
        </div>
        <div className="bg-tech">{hud.backend} · {hud.fps} fps · {hud.resolution}%</div>
      </div>

      <div className="bg-killfeed">
        {hud.killFeed.map((k) => (
          <div key={k.id} className={`bg-kill ${k.byPlayer ? "mine" : ""}`}>
            <b>{k.killer}</b>
            <span className="bg-kill-gun">{k.headshot ? "⌖ " : ""}{k.weapon}</span>
            <b>{k.victim}</b>
          </div>
        ))}
      </div>

      <div className="bg-zone-info">
        {hud.peaceful > 0 && (
          <div className="bg-banner">
            {hud.online ? `Bots ignore you for ${hud.peaceful}s · grab a gun (firing gives you away)` : `Bots hold fire for ${hud.peaceful}s, grab a gun`}
          </div>
        )}
        <div className={`bg-zone-pill ${hud.zone.shrinking ? "warn" : ""}`}>
          {hud.zone.shrinking ? "Zone shrinking" : `Zone ${hud.zone.phase} shrinks in`} <b>{fmtTime(hud.zone.timer)}</b>
        </div>
        {!hud.zone.inside && !hud.drop && <div className="bg-zone-pill danger">Outside the zone · {Math.round(hud.zone.distance)} m · −{hud.zone.dps} HP/s</div>}
      </div>

      {/* Crosshair */}
      {!hud.scoped && !hud.sprinting && !hud.drop && hud.phase === "playing" && (
        hud.aiming ? (
          <div className={`bg-dot ${hud.sight === "iron" ? "iron" : ""}`} />
        ) : (
          <div className="bg-cross" style={{ ["--s" as string]: `${spread}px` }}>
            <i className="t" /><i className="b" /><i className="l" /><i className="r" />
          </div>
        )
      )}
      {hitAge < 0.25 && <div className={`bg-hit ${hud.hitMarker?.kind}`}><i /><i /><i /><i /></div>}

      {hud.phase === "playing" && hud.damageDirs.map((d, i) => (
        <div key={i} className="bg-dmg" style={{ transform: `translate(-50%, -50%) rotate(${(-d.angle * 180) / Math.PI}deg)`, opacity: Math.max(0, 1 - (hud.now - d.time) / 1.6) }} />
      ))}
      {lowHp && <div className="bg-vignette" />}

      {(hud.reload > 0 || hud.heal > 0) && (
        <div className="bg-progress">
          <svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="16" pathLength={100} style={{ strokeDashoffset: 100 - (hud.reload || hud.heal) * 100 }} /></svg>
          <span>{hud.reload > 0 ? "Reloading" : "Using med kit"}</span>
        </div>
      )}

      {hud.pickup && <div className="bg-toast" key={hud.pickup.time}>+ {hud.pickup.text}</div>}

      {hud.prompt && !hud.touch && hud.phase === "playing" && (
        <div className="bg-prompt"><kbd>I</kbd>{hud.prompt}</div>
      )}

      <div className="bg-bottom">
        <div className="bg-health">
          <div className="bg-health-meta">
            <span className="bg-stance">{hud.stance === "stand" ? (hud.sprinting ? "Sprint" : "Stand") : hud.stance === "crouch" ? "Crouch" : "Prone"}</span>
            <span className="bg-meds">{!hud.touch && <kbd>L</kbd>} Med kit ×{hud.medkits}</span>
          </div>
          <div className={`bg-health-bar ${lowHp ? "low" : ""}`}>
            <div style={{ width: `${hp * 100}%` }} />
          </div>
          <div className="bg-armor">
            <ArmorPip icon={<HardHat aria-hidden="true" />} label="Helmet" level={hud.armor.helmet} pct={hud.armor.helmetPct} />
            <ArmorPip icon={<Shield aria-hidden="true" />} label="Vest" level={hud.armor.vest} pct={hud.armor.vestPct} />
            <div className={`bg-armor-pip ${hud.grenades ? "" : "none"}`} title="Frag grenades">
              <Bomb aria-hidden="true" />
              <b>{hud.grenades}</b>
              {!hud.touch && <kbd>G</kbd>}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-weapons">
        {active && (
          <div className="bg-ammo">
            <b className={active.mag === 0 ? "empty" : ""}>{active.mag}</b>
            <span>/ {active.reserve}</span>
          </div>
        )}
        <div className="bg-slots">
          {hud.slots.map((s, i) => (
            <div
              key={i}
              className={`bg-slot ${s?.active ? "active" : ""} ${s ? "" : "empty"} ${onSlot ? "tappable" : ""}`}
              onPointerDown={onSlot && s ? (e) => { e.stopPropagation(); onSlot(i); } : undefined}
            >
              <kbd>{i + 1}</kbd>
              <div>
                <b>{s ? s.name : i === 2 ? "Pistol" : "Empty"}</b>
                <span>{s ? `${s.mag}/${s.magSize} · ${s.ammo} · ${s.range} m${s.scope ? ` · ${s.scope}` : ""}` : "—"}</span>
              </div>
            </div>
          ))}
        </div>
        {hud.spareScopes.length > 0 && <div className="bg-hint">Backpack: {hud.spareScopes.join(", ")}</div>}
        {!hud.touch && <div className="bg-hint"><kbd>O</kbd> switch · <kbd>U</kbd> reload{hud.switching ? " · switching…" : ""}</div>}
      </div>
    </div>
  );
}

function ArmorPip({ icon, label, level, pct }: { icon: React.ReactNode; label: string; level: number; pct: number }) {
  return (
    <div className={`bg-armor-pip lv${level} ${level ? "" : "none"}`} title={level ? `${label} level ${level} · ${Math.round(pct * 100)}%` : `No ${label.toLowerCase()}`}>
      {icon}
      <b>{level ? `Lv${level}` : "—"}</b>
      {level > 0 && <i><u style={{ width: `${pct * 100}%` }} /></i>}
    </div>
  );
}
