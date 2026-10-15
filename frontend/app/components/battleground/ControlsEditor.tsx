"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Keyboard, Move, RotateCcw, Smartphone, X } from "lucide-react";
import TouchControls from "./TouchControls";
import { BIND_LABELS, DEFAULT_BINDINGS, keyLabel, rebind, type BindAction, type Bindings } from "./engine/bindings";
import { SIZE_RANGE, TOUCH_CONTROLS, type ControlPlace, type TouchControlId, type TouchLayout } from "./touchLayout";

interface Props {
  /** Start on the touch layout (phones / tablets) or the keyboard (desktop). */
  touch: boolean;
  bindings: Bindings;
  layout: TouchLayout;
  onSave: (bindings: Bindings, layout: TouchLayout) => void;
  onClose: () => void;
}

const noop = () => {};
const NO_CONTROLS = { setStick: noop, look: noop, setFire: noop, toggleAim: noop, press: noop };
/** A HUD that makes every on-screen control appear. */
const DEMO_HUD = {
  aiming: false, stance: "stand", medkits: 2, health: 60, maxHealth: 100, prompt: "Pick up M416", grenades: 2, drop: null,
} as const;

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/**
 * Settings → Customize controls. Touch: drag any button to move it, pick one
 * to resize it, fade them all with the opacity slider. Keyboard: click an
 * action, then press the key you want for it.
 */
export default function ControlsEditor({ touch, bindings, layout, onSave, onClose }: Props) {
  const [tab, setTab] = useState<"touch" | "keys">(touch ? "touch" : "keys");
  const [draft, setDraft] = useState<TouchLayout>(() => ({ ...layout, controls: { ...layout.controls } }));
  const [keys, setKeys] = useState<Bindings>(bindings);
  const [selected, setSelected] = useState<TouchControlId | null>(null);
  const [scene, setScene] = useState<"combat" | "drop">("combat");
  const [listening, setListening] = useState<BindAction | null>(null);
  const drag = useRef<{ id: TouchControlId; dx: number; dy: number; pointer: number } | null>(null);
  const surface = useRef<HTMLDivElement>(null);

  /** Where a control is right now (its saved place, or measured from the screen). */
  const placeOf = (id: TouchControlId): ControlPlace | null => {
    const saved = draft.controls[id];
    if (saved) return saved;
    const el = surface.current?.querySelector<HTMLElement>(`[data-ctl="${id}"]`);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: ((r.left + r.width / 2) / window.innerWidth) * 100, y: ((r.top + r.height / 2) / window.innerHeight) * 100, size: 1 };
  };

  const setPlace = (id: TouchControlId, p: ControlPlace) => setDraft((d) => ({ ...d, controls: { ...d.controls, [id]: p } }));

  const onDown = (id: TouchControlId, e: ReactPointerEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setSelected(id);
    const r = e.currentTarget.getBoundingClientRect();
    drag.current = { id, dx: e.clientX - (r.left + r.width / 2), dy: e.clientY - (r.top + r.height / 2), pointer: e.pointerId };
    surface.current?.setPointerCapture(e.pointerId);
  };

  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointer) return;
    const size = draft.controls[d.id]?.size ?? 1;
    setPlace(d.id, {
      x: clamp(((e.clientX - d.dx) / window.innerWidth) * 100, 2, 98),
      y: clamp(((e.clientY - d.dy) / window.innerHeight) * 100, 3, 97),
      size,
    });
  };
  const onUp = () => {
    drag.current = null;
  };

  const resize = (size: number) => {
    if (!selected) return;
    const p = placeOf(selected);
    if (p) setPlace(selected, { ...p, size });
  };

  const resetSelected = () => {
    if (!selected) return;
    setDraft((d) => {
      const controls = { ...d.controls };
      delete controls[selected];
      return { ...d, controls };
    });
  };

  // Rebinding: the next key pressed goes to the chosen action (Esc cancels).
  useEffect(() => {
    if (!listening) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.code !== "Escape") setKeys((k) => rebind(k, listening, e.code));
      setListening(null);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [listening]);

  const selectedLabel = TOUCH_CONTROLS.find((c) => c.id === selected)?.label;
  const size = selected ? draft.controls[selected]?.size ?? 1 : 1;

  return (
    <div className="bg-ce" role="dialog" aria-label="Customize controls">
      {tab === "touch" ? (
        <div ref={surface} className="bg-ce-surface" onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onPointerDown={() => setSelected(null)}>
          <TouchControls controls={NO_CONTROLS} hud={DEMO_HUD} onPause={noop} layout={draft} editing={{ selected, scene, onDown }} />
        </div>
      ) : (
        <div className="bg-ce-keys">
          <p className="bg-panel-sub">Click an action, then press the key you want. A key that&apos;s taken swaps over. Mouse: left click shoots, right click aims.</p>
          <ul>
            {(Object.keys(BIND_LABELS) as BindAction[]).map((a) => (
              <li key={a}>
                <span>{BIND_LABELS[a]}</span>
                <button className={listening === a ? "listening" : ""} onClick={() => setListening(listening === a ? null : a)}>
                  {listening === a ? "Press a key…" : keyLabel(keys[a])}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-ce-bar">
        <div className="bg-ce-tabs">
          <button className={tab === "touch" ? "on" : ""} onClick={() => setTab("touch")}>
            <Smartphone aria-hidden="true" /> Touch layout
          </button>
          <button className={tab === "keys" ? "on" : ""} onClick={() => setTab("keys")}>
            <Keyboard aria-hidden="true" /> Keyboard
          </button>
        </div>
        {tab === "touch" ? (
          <>
            <div className="bg-ce-tabs">
              <button className={scene === "combat" ? "on" : ""} onClick={() => { setScene("combat"); setSelected(null); }}>Combat</button>
              <button className={scene === "drop" ? "on" : ""} onClick={() => { setScene("drop"); setSelected(null); }}>Plane &amp; parachute</button>
            </div>
            <p className="bg-ce-hint">
              <Move aria-hidden="true" /> {selectedLabel ? <b>{selectedLabel}</b> : "Drag any button to move it; tap one to resize it"}
            </p>
            <label className={selected ? "" : "off"}>
              <span>Size {Math.round(size * 100)}%</span>
              <input type="range" min={SIZE_RANGE[0]} max={SIZE_RANGE[1]} step={0.05} value={size} disabled={!selected} onChange={(e) => resize(Number(e.target.value))} />
            </label>
            <label>
              <span>Opacity {Math.round(draft.opacity * 100)}%</span>
              <input type="range" min={0.25} max={1} step={0.05} value={draft.opacity} onChange={(e) => setDraft((d) => ({ ...d, opacity: Number(e.target.value) }))} />
            </label>
            <div className="bg-ce-actions">
              <button onClick={resetSelected} disabled={!selected}><RotateCcw aria-hidden="true" /> This one</button>
              <button onClick={() => setDraft({ v: 1, opacity: 1, controls: {} })}><RotateCcw aria-hidden="true" /> All</button>
            </div>
          </>
        ) : (
          <div className="bg-ce-actions">
            <button onClick={() => setKeys({ ...DEFAULT_BINDINGS })}><RotateCcw aria-hidden="true" /> Default keys</button>
          </div>
        )}
        <div className="bg-ce-actions end">
          <button onClick={onClose}><X aria-hidden="true" /> Cancel</button>
          <button className="primary" onClick={() => onSave(keys, draft)}>Save</button>
        </div>
      </div>
    </div>
  );
}
