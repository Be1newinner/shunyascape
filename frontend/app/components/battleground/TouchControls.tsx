"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { ArrowBigUp, Bomb, ChevronsDown, Crosshair, Hand, HeartPulse, Minus, Pause, RefreshCcw, RotateCw, Scan, Wind } from "lucide-react";
import type { HudState } from "./engine/Game";
import type { Action, Input } from "./engine/Input";
import { placeStyle, type TouchControlId, type TouchLayout } from "./touchLayout";

/** Joystick travel in px, scaled like the CSS controls (`--u`) on short screens. */
const stickRadius = () => 58 * Math.min(1, window.innerHeight / 600);

/** What the layout editor needs from the controls: every button shown, presses become drags. */
export interface ControlsEditing {
  selected: TouchControlId | null;
  /** Which set to lay out: fighting on the ground, or the plane / parachute. */
  scene: "combat" | "drop";
  onDown: (id: TouchControlId, e: ReactPointerEvent<HTMLElement>) => void;
}

interface Props {
  controls: Pick<Input, "setStick" | "look" | "setFire" | "toggleAim" | "press">;
  hud: Pick<HudState, "aiming" | "stance" | "medkits" | "health" | "maxHealth" | "prompt" | "grenades" | "drop">;
  onPause: () => void;
  /** The player's custom layout (positions, sizes, opacity). */
  layout?: TouchLayout;
  /** Layout editor: show every control and let them be dragged. */
  editing?: ControlsEditing;
}

/**
 * BGMI-style on-screen controls: floating joystick on the left, drag anywhere
 * on the right to look, fire buttons that also aim while held, and action
 * buttons around the right thumb. Each finger is tracked separately. Every
 * control can be moved, resized and faded in Settings → Customize controls.
 */
export default function TouchControls({ controls, hud, onPause, layout, editing }: Props) {
  const [stick, setStick] = useState<{ ox: number; oy: number; kx: number; ky: number; sprint: boolean } | null>(null);
  const stickId = useRef<number | null>(null);
  const lookLast = useRef(new Map<number, { x: number; y: number }>());
  const fireHeld = useRef(new Set<number>());
  const stickScale = layout?.controls.stick?.size ?? 1;

  // ---- joystick (left side; appears where the thumb lands) ----
  const stickDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (stickId.current !== null) return;
    stickId.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    setStick({ ox: e.clientX, oy: e.clientY, kx: 0, ky: 0, sprint: false });
  };
  const stickMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== stickId.current || !stick) return;
    const STICK_RADIUS = stickRadius() * stickScale;
    let dx = e.clientX - stick.ox;
    let dy = e.clientY - stick.oy;
    const len = Math.hypot(dx, dy);
    // Pushing well past the rim while going forward locks into a sprint.
    const sprint = len > STICK_RADIUS * 1.35 && dy < -STICK_RADIUS * 0.8;
    if (len > STICK_RADIUS) {
      dx = (dx / len) * STICK_RADIUS;
      dy = (dy / len) * STICK_RADIUS;
    }
    controls.setStick(dx / STICK_RADIUS, -dy / STICK_RADIUS, sprint);
    setStick({ ...stick, kx: dx, ky: dy, sprint });
  };
  const stickUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== stickId.current) return;
    stickId.current = null;
    controls.setStick(0, 0, false);
    setStick(null);
  };

  // ---- looking: drag on the right side, or while holding a fire button ----
  const lookDown = (e: ReactPointerEvent<HTMLElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    lookLast.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };
  const lookMove = (e: ReactPointerEvent<HTMLElement>) => {
    const last = lookLast.current.get(e.pointerId);
    if (!last) return;
    controls.look(e.clientX - last.x, e.clientY - last.y);
    lookLast.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };
  const lookUp = (e: ReactPointerEvent<HTMLElement>) => {
    lookLast.current.delete(e.pointerId);
  };

  // Fire buttons: firing while any is held; dragging on them also aims.
  const fireDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    lookDown(e);
    fireHeld.current.add(e.pointerId);
    controls.setFire(true);
  };
  const fireUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    lookUp(e);
    fireHeld.current.delete(e.pointerId);
    if (fireHeld.current.size === 0) controls.setFire(false);
  };

  const tap = (action: Action) => (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    controls.press(action);
  };

  /** Shared props: custom place, and in the editor, presses start a drag instead. */
  const place = (id: TouchControlId) => ({
    "data-ctl": id,
    style: placeStyle(layout, id),
    ...(editing ? { onPointerDown: (e: ReactPointerEvent<HTMLElement>) => editing.onDown(id, e) } : {}),
  });
  const edit = (id: TouchControlId) => (editing ? ` editing ${editing.selected === id ? "selected" : ""}` : "");

  // Plain render helpers (not components) so re-renders never remount a pressed button.
  const btn = (id: TouchControlId, className: string, label: string, onDown: (e: ReactPointerEvent<HTMLButtonElement>) => void, children: ReactNode, active = false) => (
    <button className={`bg-tc-btn ${className} ${active ? "on" : ""}${edit(id)}`} aria-label={label} onPointerDown={onDown} {...place(id)}>
      {children}
    </button>
  );

  const fireButton = (id: "fire" | "fireLeft", className: string) => (
    <button
      className={`bg-tc-btn bg-tc-fire ${className}${edit(id)}`}
      aria-label="Fire"
      onPointerDown={fireDown}
      onPointerMove={lookMove}
      onPointerUp={fireUp}
      onPointerCancel={fireUp}
      {...place(id)}
    >
      <Crosshair className="h-1/2 w-1/2" />
    </button>
  );

  const all = !!editing;
  const dropping = editing ? editing.scene === "drop" : !!hud.drop;
  const canDrop = all || (hud.drop ? (hud.drop.stage === "plane" ? hud.drop.canJump : hud.drop.stage === "fall") : false);

  return (
    <div className={`bg-touch ${all ? "bg-touch-editing" : ""}`} style={{ ["--tc-alpha" as string]: layout?.opacity ?? 1 }} onContextMenu={(e) => e.preventDefault()}>
      {!all && (
        <>
          {/* Look area: the right half, under the buttons. */}
          <div className="bg-tc-look" onPointerDown={lookDown} onPointerMove={lookMove} onPointerUp={lookUp} onPointerCancel={lookUp} />
          {/* Joystick area: the lower left. */}
          <div className="bg-tc-stick-zone" onPointerDown={stickDown} onPointerMove={stickMove} onPointerUp={stickUp} onPointerCancel={stickUp}>
            {stick && (
              <div className="bg-tc-stick" style={{ left: stick.ox, top: stick.oy, transform: `scale(${stickScale})` }}>
                <div className={`bg-tc-knob ${stick.sprint ? "sprint" : ""}`} style={{ transform: `translate(${stick.kx / stickScale}px, ${stick.ky / stickScale}px)` }} />
                {stick.sprint && <span className="bg-tc-sprint">Sprint</span>}
              </div>
            )}
          </div>
        </>
      )}
      {(!stick || all) && (
        <div className={`bg-tc-stick idle${edit("stick")}`} {...place("stick")}>
          <div className="bg-tc-knob" />
        </div>
      )}

      {btn("pause", "bg-tc-pause", "Pause", (e) => { e.stopPropagation(); onPause(); }, <Pause className="h-5 w-5" />)}

      {dropping && canDrop && btn(
        "drop",
        "bg-tc-dropbtn",
        hud.drop?.stage === "fall" ? "Open parachute" : "Jump",
        tap("jump"),
        hud.drop?.stage === "fall" ? (
          <>
            <Wind className="h-7 w-7" />
            <span>Chute</span>
          </>
        ) : (
          <>
            <ArrowBigUp className="h-7 w-7" />
            <span>Jump</span>
          </>
        ),
      )}

      {!dropping && (
        <>
          {fireButton("fire", "bg-tc-fire-main")}
          {fireButton("fireLeft", "bg-tc-fire-left")}
          {btn("aim", "bg-tc-aim", "Aim", (e) => { e.stopPropagation(); controls.toggleAim(); }, <Scan className="h-6 w-6" />, hud.aiming)}
          {btn("jump", "bg-tc-jump", "Jump", tap("jump"), <ArrowBigUp className="h-6 w-6" />)}
          {btn("crouch", "bg-tc-crouch", "Crouch", tap("crouch"), <ChevronsDown className="h-6 w-6" />, hud.stance === "crouch")}
          {btn("prone", "bg-tc-prone", "Prone", tap("prone"), <Minus className="h-6 w-6" />, hud.stance === "prone")}
          {btn("reload", "bg-tc-reload", "Reload", tap("reload"), <RotateCw className="h-5 w-5" />)}
          {btn("switch", "bg-tc-switch", "Switch weapon", tap("switch"), <RefreshCcw className="h-5 w-5" />)}
          {(all || (hud.medkits > 0 && hud.health < hud.maxHealth)) &&
            btn("heal", "bg-tc-heal", "Use med kit", tap("heal"), (
              <>
                <HeartPulse className="h-5 w-5" />
                <span className="bg-tc-count">{hud.medkits}</span>
              </>
            ))}
          {(all || hud.grenades > 0) &&
            btn("nade", "bg-tc-nade", "Throw grenade", tap("throw"), (
              <>
                <Bomb className="h-5 w-5" />
                <span className="bg-tc-count">{hud.grenades}</span>
              </>
            ))}
          {(all || (hud.prompt && !hud.prompt.startsWith("No "))) && (
            <button className={`bg-tc-pick${edit("pick")}`} onPointerDown={tap("pickup")} {...place("pick")}>
              <Hand className="h-5 w-5" /> {hud.prompt ?? "Pick up"}
            </button>
          )}
        </>
      )}
    </div>
  );
}
