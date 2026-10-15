/** Keyboard layout: which key does what. Players can rebind every action in Settings. */

export type BindAction =
  | "forward" | "back" | "left" | "right"
  | "jump" | "sprint" | "reload" | "pickup" | "crouch" | "prone" | "switch" | "heal" | "throw"
  | "slot1" | "slot2" | "slot3";

export type Bindings = Record<BindAction, string>;

/** The requested layout: WASD move, U I J K O L actions, Space jump, G grenade. */
export const DEFAULT_BINDINGS: Bindings = {
  forward: "KeyW", back: "KeyS", left: "KeyA", right: "KeyD",
  jump: "Space", sprint: "ShiftLeft",
  reload: "KeyU", pickup: "KeyI", crouch: "KeyJ", prone: "KeyK", switch: "KeyO", heal: "KeyL", throw: "KeyG",
  slot1: "Digit1", slot2: "Digit2", slot3: "Digit3",
};

/** Classic PC keys that also work, as long as nothing else is bound to them. */
export const SECONDARY_KEYS: Partial<Record<string, BindAction>> = {
  KeyR: "reload", KeyF: "pickup", KeyC: "crouch", KeyZ: "prone", ShiftRight: "sprint",
};

export const BIND_LABELS: Record<BindAction, string> = {
  forward: "Move forward", back: "Move back", left: "Move left", right: "Move right",
  jump: "Jump / leave plane / parachute", sprint: "Sprint (hold)", reload: "Reload", pickup: "Pick up",
  crouch: "Crouch", prone: "Prone", switch: "Switch weapon", heal: "Use med kit", throw: "Throw grenade",
  slot1: "Weapon slot 1", slot2: "Weapon slot 2", slot3: "Weapon slot 3 (pistol)",
};

/** "KeyW" → "W", "ShiftLeft" → "Shift", "Digit1" → "1". */
export function keyLabel(code: string) {
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Numpad")) return `Num ${code.slice(6)}`;
  const names: Record<string, string> = {
    ShiftLeft: "Shift", ShiftRight: "R-Shift", ControlLeft: "Ctrl", ControlRight: "R-Ctrl", AltLeft: "Alt", AltRight: "R-Alt",
    Space: "Space", Tab: "Tab", CapsLock: "Caps", Backquote: "`", Minus: "-", Equal: "=", BracketLeft: "[", BracketRight: "]",
    Semicolon: ";", Quote: "'", Comma: ",", Period: ".", Slash: "/", Backslash: "\\", Enter: "Enter", Backspace: "Backspace",
    ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→",
  };
  return names[code] ?? code;
}

const KEY = "bg.bindings";

export function loadBindings(): Bindings {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "{}") as Partial<Bindings>;
    return { ...DEFAULT_BINDINGS, ...saved };
  } catch {
    return { ...DEFAULT_BINDINGS };
  }
}

export function saveBindings(b: Bindings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(b));
  } catch {
    // Storage blocked: the layout lasts until the page closes.
  }
}

/** Bind `action` to `code`; whatever had that key gets this action's old key (a swap). */
export function rebind(b: Bindings, action: BindAction, code: string): Bindings {
  const next = { ...b };
  const other = (Object.keys(next) as BindAction[]).find((a) => a !== action && next[a] === code);
  if (other) next[other] = next[action];
  next[action] = code;
  return next;
}

/** The controls list shown on the start card, in the player's own keys. */
export function controlsList(b: Bindings) {
  const k = keyLabel;
  return [
    { keys: `${k(b.forward)} ${k(b.left)} ${k(b.back)} ${k(b.right)}`, action: "Move" },
    { keys: "Mouse", action: "Look around" },
    { keys: "Left click", action: "Shoot" },
    { keys: "Right click", action: "Aim / scope" },
    { keys: k(b.jump), action: "Jump · leave plane · parachute" },
    { keys: k(b.sprint), action: "Sprint" },
    { keys: k(b.reload), action: "Reload" },
    { keys: k(b.pickup), action: "Pick up" },
    { keys: k(b.crouch), action: "Crouch" },
    { keys: k(b.prone), action: "Prone" },
    { keys: k(b.switch), action: "Switch weapon" },
    { keys: k(b.heal), action: "Use med kit" },
    { keys: k(b.throw), action: "Throw grenade" },
    { keys: `${k(b.slot1)} / ${k(b.slot2)} / ${k(b.slot3)}`, action: "Weapon slots" },
    { keys: "Mouse wheel", action: "Next weapon" },
  ];
}
