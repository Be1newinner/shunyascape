"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { ArrowBigUp, ChevronsDown, Crosshair, Hand, HeartPulse, Minus, Pause, RefreshCcw, RotateCw, Scan } from "lucide-react";
import type { HudState } from "./engine/Game";
import type { Action, Input } from "./engine/Input";

/** Joystick travel in px, scaled like the CSS controls (`--u`) on short screens. */
const stickRadius = () => 58 * Math.min(1, window.innerHeight / 600);

interface Props {
  controls: Input;
  hud: HudState;
  onPause: () => void;
}

/**
 * BGMI-style on-screen controls: floating joystick on the left, drag anywhere
 * on the right to look, fire buttons that also aim while held, and action
 * buttons around the right thumb. Each finger is tracked separately.
 */
export default function TouchControls({ controls, hud, onPause }: Props) {
  const [stick, setStick] = useState<{ ox: number; oy: number; kx: number; ky: number; sprint: boolean } | null>(null);
  const stickId = useRef<number | null>(null);
  const lookLast = useRef(new Map<number, { x: number; y: number }>());
  const fireHeld = useRef(new Set<number>());

  // ---- joystick (left side; appears where the thumb lands) ----
  const stickDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (stickId.current !== null) return;
    stickId.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    setStick({ ox: e.clientX, oy: e.clientY, kx: 0, ky: 0, sprint: false });
  };
  const stickMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== stickId.current || !stick) return;
    const STICK_RADIUS = stickRadius();
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

  // Plain render helpers (not components) so re-renders never remount a pressed button.
  const btn = (className: string, label: string, onDown: (e: ReactPointerEvent<HTMLButtonElement>) => void, children: ReactNode, active = false) => (
    <button className={`bg-tc-btn ${className} ${active ? "on" : ""}`} aria-label={label} onPointerDown={onDown}>
      {children}
    </button>
  );

  const fireButton = (className: string) => (
    <button
      className={`bg-tc-btn bg-tc-fire ${className}`}
      aria-label="Fire"
      onPointerDown={fireDown}
      onPointerMove={lookMove}
      onPointerUp={fireUp}
      onPointerCancel={fireUp}
    >
      <Crosshair className="h-1/2 w-1/2" />
    </button>
  );

  return (
    <div className="bg-touch" onContextMenu={(e) => e.preventDefault()}>
      {/* Look area: the right half, under the buttons. */}
      <div className="bg-tc-look" onPointerDown={lookDown} onPointerMove={lookMove} onPointerUp={lookUp} onPointerCancel={lookUp} />

      {/* Joystick area: the lower left. */}
      <div className="bg-tc-stick-zone" onPointerDown={stickDown} onPointerMove={stickMove} onPointerUp={stickUp} onPointerCancel={stickUp}>
        {stick ? (
          <div className="bg-tc-stick" style={{ left: stick.ox, top: stick.oy }}>
            <div className={`bg-tc-knob ${stick.sprint ? "sprint" : ""}`} style={{ transform: `translate(${stick.kx}px, ${stick.ky}px)` }} />
            {stick.sprint && <span className="bg-tc-sprint">Sprint</span>}
          </div>
        ) : (
          <div className="bg-tc-stick idle">
            <div className="bg-tc-knob" />
          </div>
        )}
      </div>

      <button className="bg-tc-btn bg-tc-pause" aria-label="Pause" onPointerDown={(e) => { e.stopPropagation(); onPause(); }}>
        <Pause className="h-5 w-5" />
      </button>

      {fireButton("bg-tc-fire-main")}
      {fireButton("bg-tc-fire-left")}

      {btn("bg-tc-aim", "Aim", (e) => { e.stopPropagation(); controls.toggleAim(); }, <Scan className="h-6 w-6" />, hud.aiming)}
      {btn("bg-tc-jump", "Jump", tap("jump"), <ArrowBigUp className="h-6 w-6" />)}
      {btn("bg-tc-crouch", "Crouch", tap("crouch"), <ChevronsDown className="h-6 w-6" />, hud.stance === "crouch")}
      {btn("bg-tc-prone", "Prone", tap("prone"), <Minus className="h-6 w-6" />, hud.stance === "prone")}
      {btn("bg-tc-reload", "Reload", tap("reload"), <RotateCw className="h-5 w-5" />)}
      {btn("bg-tc-switch", "Switch weapon", tap("switch"), <RefreshCcw className="h-5 w-5" />)}
      {hud.medkits > 0 && hud.health < hud.maxHealth &&
        btn("bg-tc-heal", "Use med kit", tap("heal"), (
          <>
            <HeartPulse className="h-5 w-5" />
            <span className="bg-tc-count">{hud.medkits}</span>
          </>
        ))}
      {hud.prompt && !hud.prompt.startsWith("No ") && (
        <button className="bg-tc-pick" onPointerDown={tap("pickup")}>
          <Hand className="h-5 w-5" /> {hud.prompt}
        </button>
      )}
    </div>
  );
}
