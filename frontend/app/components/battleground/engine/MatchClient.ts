import type { Stance } from "./Character";
import type { ScopeId, WeaponId } from "./config";
import type { LootItem } from "./Loot";

/** One soldier in the match roster, in spawn order. */
export interface RosterEntry {
  id: string;
  name: string;
  outfit: string;
  bot: boolean;
}

export interface MatchStart {
  match: string;
  seed: number;
  you: string;
  host: string | null;
  roster: RosterEntry[];
  peace: number;
}

export interface ZoneSync {
  cx: number;
  cz: number;
  radius: number;
  nx: number;
  nz: number;
  nRadius: number;
  phase: number;
  shrinking: boolean;
  timer: number;
  dps: number;
}

/** Movement + pose a client reports for its soldier (and the host for bots). */
export interface NetState {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  stance: Stance;
  sprint: boolean;
  aim: boolean;
  grounded: boolean;
  reload: boolean;
  heal: boolean;
  vx: number;
  vz: number;
  weapon: WeaponId | null;
  scope: ScopeId | null;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function encodeState(s: NetState): unknown[] {
  const flags = (s.sprint ? 1 : 0) | (s.aim ? 2 : 0) | (s.grounded ? 4 : 0) | (s.reload ? 8 : 0) | (s.heal ? 16 : 0);
  return [r2(s.x), r2(s.y), r2(s.z), r2(s.yaw), r2(s.pitch), s.stance[0], flags, r2(s.vx), r2(s.vz), s.weapon, s.scope];
}

export function decodeState(d: unknown[]): NetState | null {
  if (!Array.isArray(d) || d.length < 11) return null;
  const n = (i: number) => (typeof d[i] === "number" ? (d[i] as number) : 0);
  const flags = n(6);
  const st = d[5] === "c" ? "crouch" : d[5] === "p" ? "prone" : "stand";
  return {
    x: n(0), y: n(1), z: n(2), yaw: n(3), pitch: n(4), stance: st,
    sprint: !!(flags & 1), aim: !!(flags & 2), grounded: !!(flags & 4), reload: !!(flags & 8), heal: !!(flags & 16),
    vx: n(7), vz: n(8),
    weapon: (typeof d[9] === "string" ? d[9] : null) as WeaponId | null,
    scope: (typeof d[10] === "string" ? d[10] : null) as ScopeId | null,
  };
}

/** Messages the game server sends. */
export type ServerMessage =
  | { t: "hello"; you: string }
  | { t: "queue"; players: number; max: number; startsIn: number }
  | { t: "queue-left" }
  | ({ t: "start" } & MatchStart)
  | { t: "snap"; s: unknown[][]; alive: number }
  | ({ t: "zone" } & ZoneSync)
  | { t: "fx"; by: string; w: WeaponId; o: number[]; e: number[]; h: number }
  | { t: "hp"; id: string; hp: number; by: string | null; head: boolean }
  | { t: "kill"; victim: string; killer: string | null; w: string; head: boolean; alive: number }
  | { t: "taken"; id: string; by: string }
  | { t: "pick-denied"; id: string }
  | { t: "spawn"; id: string; item: LootItem; pos: number[] }
  | { t: "result"; placement: number; kills: number; damage: number; survived: number }
  | { t: "end"; winner: string | null };

type Listener = (msg: ServerMessage) => void;

/** Where the game server lives: `NEXT_PUBLIC_GAME_SERVER_URL`, else port 8005 on this host. */
function serverUrl() {
  const configured = process.env.NEXT_PUBLIC_GAME_SERVER_URL;
  if (configured) return configured.replace(/\/$/, "");
  const secure = window.location.protocol === "https:";
  return `${secure ? "wss" : "ws"}://${window.location.hostname}:8005/ws`;
}

/**
 * WebSocket link to the match server. Authenticates with a short-lived ticket
 * from the API (cookies don't cross to the game server's origin).
 */
export class MatchClient {
  private ws: WebSocket | null = null;
  private listeners = new Set<Listener>();
  onClose: (code: number) => void = () => {};

  async connect(): Promise<void> {
    const res = await fetch("/api/match/ticket");
    if (res.status === 401) {
      window.dispatchEvent(new CustomEvent("auth-unauthorized"));
      throw new Error("Session expired");
    }
    if (!res.ok) throw new Error("Couldn't get a match ticket");
    const { ticket } = (await res.json()) as { ticket: string };
    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(`${serverUrl()}?ticket=${encodeURIComponent(ticket)}`);
      this.ws = ws;
      const timer = setTimeout(() => reject(new Error("Game server didn't answer")), 8000);
      ws.onopen = () => {
        clearTimeout(timer);
        resolve();
      };
      ws.onerror = () => {
        clearTimeout(timer);
        reject(new Error("Couldn't reach the game server"));
      };
      ws.onmessage = (ev) => {
        let msg: ServerMessage;
        try {
          msg = JSON.parse(String(ev.data));
        } catch {
          return;
        }
        for (const l of this.listeners) l(msg);
      };
      ws.onclose = (ev) => this.onClose(ev.code);
    });
  }

  on(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  send(msg: object) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  queue() {
    this.send({ t: "queue" });
  }
  cancel() {
    this.send({ t: "cancel" });
  }
  leave() {
    this.send({ t: "leave" });
  }

  close() {
    this.listeners.clear();
    this.onClose = () => {};
    this.ws?.close();
    this.ws = null;
  }
}
