import type http from "http";
import { WebSocketServer, WebSocket } from "ws";
import { verifyToken } from "../utils/auth";
import { Matchmaker } from "./Matchmaker";
import type { MatchEvents, Peer } from "./Match";

/** Close code telling a client its session was replaced by a newer connection. */
const WS_CLOSE_REPLACED = 4001;
const WS_CLOSE_UNAUTHORIZED = 4401;

interface TicketClaims {
  kind?: string;
  userId?: string;
  name?: string;
  outfit?: string;
}

/**
 * Game server on `/ws`. Clients authenticate with a short-lived ticket from
 * `GET /api/match/ticket` (works across domains, unlike cookies).
 */
export function attachMatchServer(server: http.Server, events: MatchEvents) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });
  const matchmaker = new Matchmaker(events);
  const sockets = new Map<string, WebSocket>();
  const alive = new WeakSet<WebSocket>();

  server.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url || "", "http://localhost");
    if (url.pathname !== "/ws") {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(request, socket, head, (ws) => wss.emit("connection", ws, url.searchParams.get("ticket")));
  });

  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!alive.has(ws)) {
        ws.terminate();
        continue;
      }
      alive.delete(ws);
      ws.ping();
    }
  }, 20_000);

  wss.on("connection", (ws: WebSocket, ticket: string | null) => {
    const claims = (ticket ? verifyToken(ticket) : null) as TicketClaims | null;
    if (!claims || claims.kind !== "match" || !claims.userId) {
      ws.close(WS_CLOSE_UNAUTHORIZED, "Invalid ticket");
      return;
    }
    alive.add(ws);
    ws.on("pong", () => alive.add(ws));
    ws.on("error", (err) => console.warn("Match socket error:", err.message));

    const userId = claims.userId;
    // One game connection per account: a new tab replaces the old one.
    const previous = sockets.get(userId);
    if (previous && previous.readyState === WebSocket.OPEN) previous.close(WS_CLOSE_REPLACED, "Opened elsewhere");
    sockets.set(userId, ws);

    const peer: Peer = {
      userId,
      name: String(claims.name ?? "Player").slice(0, 24),
      outfit: String(claims.outfit ?? "classic").slice(0, 16),
      match: null,
      send: (msg) => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
      },
    };
    peer.send({ t: "hello", you: userId });

    let messages = 0;
    const budget = setInterval(() => (messages = 0), 1000);
    ws.on("message", (raw) => {
      // Generous cap: movement at ~20/s plus bursts of shots.
      if (++messages > 120) return;
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(String(raw));
      } catch {
        return;
      }
      if (!msg || typeof msg !== "object") return;
      if (msg.t === "queue") matchmaker.queue(peer);
      else if (msg.t === "cancel") matchmaker.cancel(peer);
      else if (msg.t === "leave") peer.match?.leave(peer);
      else peer.match?.handle(peer, msg);
    });

    ws.on("close", () => {
      clearInterval(budget);
      if (sockets.get(userId) === ws) sockets.delete(userId);
      matchmaker.disconnect(peer);
    });
  });

  wss.on("close", () => {
    clearInterval(heartbeat);
    matchmaker.dispose();
  });
  return { matchmaker };
}
