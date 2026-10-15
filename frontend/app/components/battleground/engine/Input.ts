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
  | "slot1"
  | "slot2"
  | "slot3";

// Requested layout: WASD move, U I J K O L actions, Space jump. Classic PC keys also work.
const ACTION_KEYS: Record<string, Action> = {
  Space: "jump",
  KeyU: "reload",
  KeyR: "reload",
  KeyI: "pickup",
  KeyF: "pickup",
  KeyJ: "crouch",
  KeyC: "crouch",
  KeyK: "prone",
  KeyZ: "prone",
  KeyO: "switch",
  KeyL: "heal",
  Digit1: "slot1",
  Digit2: "slot2",
  Digit3: "slot3",
};

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

  constructor(private element: HTMLElement) {
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
    const f = (this.keys.has("KeyW") ? 1 : 0) - (this.keys.has("KeyS") ? 1 : 0) + this.stickY;
    const r = (this.keys.has("KeyD") ? 1 : 0) - (this.keys.has("KeyA") ? 1 : 0) + this.stickX;
    return { f: Math.max(-1, Math.min(1, f)), r: Math.max(-1, Math.min(1, r)) };
  }

  get sprintHeld() {
    return this.keys.has("ShiftLeft") || this.keys.has("ShiftRight") || this.stickSprint;
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
    if (e.code === "Tab" || e.code === "Space") e.preventDefault();
    if (!e.repeat) {
      const a = ACTION_KEYS[e.code];
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
