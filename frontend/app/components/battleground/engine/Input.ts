/**
 * Keyboard + mouse state with pointer lock, plus a touch mode fed by the
 * on-screen controls. Edge-triggered actions are queued.
 */

export type Action =
  | "jump"
  | "reload"
  | "pickup"
  | "crouch"
  | "prone"
  | "switch"
  | "heal"
  | "throw"
  | "slot1"
  | "slot2"
  | "slot3";

import { DEFAULT_BINDINGS, SECONDARY_KEYS, type BindAction, type Bindings } from "./bindings";

/** One-shot actions a key can trigger (movement and sprint are held, not queued). */
const ONE_SHOT: BindAction[] = ["jump", "reload", "pickup", "crouch", "prone", "switch", "heal", "throw", "slot1", "slot2", "slot3"];

export class Input {
  private keys = new Set<string>();
  private queue: Action[] = [];
  mouseDX = 0;
  mouseDY = 0;
  fire = false;
  firePressed = false;
  aim = false;
  locked = false;
  onLockChange: (locked: boolean) => void = () => {};
  /** On-screen controls drive input (phones and tablets). */
  touch = false;
  /** Joystick: x = right, y = forward, each -1..1. */
  stickX = 0;
  stickY = 0;
  /** Joystick pushed past its rim: sprint. */
  stickSprint = false;

  private bindings: Bindings = { ...DEFAULT_BINDINGS };
  /** key code → one-shot action, from the player's bindings plus unclaimed classic keys. */
  private actionKeys: Record<string, Action> = {};

  /** Use the player's own key layout. */
  setBindings(b: Bindings) {
    this.bindings = { ...b };
    const map: Record<string, Action> = {};
    const used = new Set(Object.values(b));
    for (const [code, action] of Object.entries(SECONDARY_KEYS)) if (!used.has(code) && action && action !== "sprint") map[code] = action as Action;
    for (const a of ONE_SHOT) map[b[a]] = a as Action;
    this.actionKeys = map;
  }

  constructor(private element: HTMLElement) {
    this.setBindings(this.bindings);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    element.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mouseup", this.onMouseUp);
    window.addEventListener("mousemove", this.onMouseMove);
    element.addEventListener("contextmenu", this.prevent);
    element.addEventListener("wheel", this.onWheel, { passive: true });
    document.addEventListener("pointerlockchange", this.onPointerLock);
  }

  requestLock() {
    const req = this.element.requestPointerLock?.bind(this.element);
    if (!req) return;
    try {
      // unadjustedMovement gives raw mouse input where supported.
      const p = (req as (o?: object) => Promise<void> | void)({ unadjustedMovement: true });
      if (p && typeof (p as Promise<void>).catch === "function") (p as Promise<void>).catch(() => req());
    } catch {
      req();
    }
  }

  exitLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  down(code: string) {
    return this.keys.has(code);
  }

  /** Movement intent: forward / right in -1..1, from keys or the joystick. */
  moveAxis() {
    const b = this.bindings;
    const f = (this.keys.has(b.forward) ? 1 : 0) - (this.keys.has(b.back) ? 1 : 0) + this.stickY;
    const r = (this.keys.has(b.right) ? 1 : 0) - (this.keys.has(b.left) ? 1 : 0) + this.stickX;
    return { f: Math.max(-1, Math.min(1, f)), r: Math.max(-1, Math.min(1, r)) };
  }

  get sprintHeld() {
    const secondarySprint = !Object.values(this.bindings).includes("ShiftRight") && this.keys.has("ShiftRight");
    return this.keys.has(this.bindings.sprint) || secondarySprint || this.stickSprint;
  }

  // ---- on-screen controls ----

  setStick(x: number, y: number, sprint: boolean) {
    this.stickX = x;
    this.stickY = y;
    this.stickSprint = sprint;
  }

  /** Finger drag on the look area (screen pixels). */
  look(dx: number, dy: number) {
    this.mouseDX += dx;
    this.mouseDY += dy;
  }

  setFire(on: boolean) {
    if (on && !this.fire) this.firePressed = true;
    this.fire = on;
  }

  toggleAim() {
    this.aim = !this.aim;
  }

  press(action: Action) {
    this.queue.push(action);
  }

  /** Drains queued one-shot actions. */
  actions(): Action[] {
    const q = this.queue;
    this.queue = [];
    return q;
  }

  consumeMouse() {
    const d = [this.mouseDX, this.mouseDY] as const;
    this.mouseDX = 0;
    this.mouseDY = 0;
    const fp = this.firePressed;
    this.firePressed = false;
    return { dx: d[0], dy: d[1], firePressed: fp };
  }

  private prevent = (e: Event) => e.preventDefault();

  private onKeyDown = (e: KeyboardEvent) => {
    if (!this.locked) return;
    if (e.code === "Tab" || e.code === "Space" || this.actionKeys[e.code]) e.preventDefault();
    if (!e.repeat) {
      const a = this.actionKeys[e.code];
      if (a) this.queue.push(a);
    }
    this.keys.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private onBlur = () => {
    this.keys.clear();
    this.fire = false;
    this.aim = false;
    this.setStick(0, 0, false);
  };

  private onMouseDown = (e: MouseEvent) => {
    if (!this.locked) return;
    if (e.button === 0) {
      this.fire = true;
      this.firePressed = true;
    }
    if (e.button === 2) this.aim = !this.aim; // BGMI-style: tap right click to toggle scope
  };

  private onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) this.fire = false;
  };

  private onMouseMove = (e: MouseEvent) => {
    if (!this.locked) return;
    // Ignore the occasional giant jump some browsers emit on lock.
    if (Math.abs(e.movementX) > 400 || Math.abs(e.movementY) > 400) return;
    this.mouseDX += e.movementX;
    this.mouseDY += e.movementY;
  };

  private lastWheel = 0;
  private onWheel = () => {
    if (!this.locked) return;
    const now = performance.now();
    if (now - this.lastWheel < 180) return; // one switch per notch burst
    this.lastWheel = now;
    this.queue.push("switch");
  };

  private onPointerLock = () => {
    this.locked = document.pointerLockElement === this.element;
    if (!this.locked) {
      this.keys.clear();
      this.fire = false;
    }
    this.onLockChange(this.locked);
  };

  dispose() {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    this.element.removeEventListener("mousedown", this.onMouseDown);
    window.removeEventListener("mouseup", this.onMouseUp);
    window.removeEventListener("mousemove", this.onMouseMove);
    this.element.removeEventListener("contextmenu", this.prevent);
    this.element.removeEventListener("wheel", this.onWheel);
    document.removeEventListener("pointerlockchange", this.onPointerLock);
    this.exitLock();
  }
}
