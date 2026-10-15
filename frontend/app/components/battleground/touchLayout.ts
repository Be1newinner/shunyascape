/**
 * Custom on-screen control layout (like BGMI's "Customize"): where each
 * button sits (its centre, in % of the screen), how big it is, and how see-
 * through the controls are. Saved on this device.
 */

export type TouchControlId =
  | "fire" | "fireLeft" | "aim" | "jump" | "crouch" | "prone" | "reload" | "switch"
  | "heal" | "nade" | "pick" | "pause" | "stick" | "drop";

export const TOUCH_CONTROLS: Array<{ id: TouchControlId; label: string }> = [
  { id: "fire", label: "Fire (right)" },
  { id: "fireLeft", label: "Fire (left)" },
  { id: "aim", label: "Aim / scope" },
  { id: "jump", label: "Jump" },
  { id: "crouch", label: "Crouch" },
  { id: "prone", label: "Prone" },
  { id: "reload", label: "Reload" },
  { id: "switch", label: "Switch weapon" },
  { id: "heal", label: "Med kit" },
  { id: "nade", label: "Grenade" },
  { id: "pick", label: "Pick up" },
  { id: "pause", label: "Pause" },
  { id: "stick", label: "Joystick" },
  { id: "drop", label: "Jump / parachute" },
];

export interface ControlPlace {
  /** Centre, in % of the screen width / height. */
  x: number;
  y: number;
  /** 1 = default size. */
  size: number;
}

export interface TouchLayout {
  v: 1;
  /** 0.25..1: how solid the controls are. */
  opacity: number;
  controls: Partial<Record<TouchControlId, ControlPlace>>;
}

export const DEFAULT_LAYOUT: TouchLayout = { v: 1, opacity: 1, controls: {} };
export const SIZE_RANGE = [0.6, 1.8] as const;

const KEY = "bg.touchLayout";

export function loadLayout(): TouchLayout {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null") as TouchLayout | null;
    if (raw && raw.v === 1 && typeof raw.opacity === "number" && raw.controls) return raw;
  } catch {
    // Unreadable: defaults.
  }
  return { ...DEFAULT_LAYOUT, controls: {} };
}

export function saveLayout(layout: TouchLayout) {
  try {
    localStorage.setItem(KEY, JSON.stringify(layout));
  } catch {
    // Storage blocked: the layout lasts until the page closes.
  }
}

/** Inline style that moves / resizes a control (none = the built-in spot). */
export function placeStyle(layout: TouchLayout | undefined, id: TouchControlId): React.CSSProperties | undefined {
  const p = layout?.controls[id];
  if (!p) return undefined;
  return {
    left: `${p.x}%`,
    top: `${p.y}%`,
    right: "auto",
    bottom: "auto",
    margin: 0,
    transform: `translate(-50%, -50%) scale(${p.size})`,
  };
}
