import { Match, type MatchEvents, type Peer } from "./Match";
import { MAX_HUMANS, MAX_MATCHES, QUEUE_WAIT_MS } from "./rules";

/**
 * Groups queued players into matches. A match starts as soon as 25 players
 * are in, or 60 seconds after the first one queued; bots fill the rest.
 * At most MAX_MATCHES run at once: everyone else waits in line, in order,
 * and the next match forms as soon as one ends.
 */
export class Matchmaker {
  private line: Peer[] = [];
  /** When the next match starts even if it isn't full (set by the first player in line). */
  private deadline = 0;
  private matches = new Set<Match>();
  private ticker: NodeJS.Timeout;

  constructor(private events: MatchEvents) {
    this.ticker = setInterval(() => this.tick(), 1000);
  }

  queue(peer: Peer) {
    if (peer.match || this.line.includes(peer)) return;
    if (this.line.length === 0) this.deadline = Date.now() + QUEUE_WAIT_MS;
    this.line.push(peer);
    this.tick();
  }

  cancel(peer: Peer) {
    const i = this.line.indexOf(peer);
    if (i < 0) return;
    this.line.splice(i, 1);
    peer.send({ t: "queue-left" });
    this.announce();
  }

  /** Socket closed: leave the line or the running match. */
  disconnect(peer: Peer) {
    this.cancel(peer);
    peer.match?.leave(peer);
  }

  /** Matches still being played (a finished one only shows results, so it frees its slot). */
  private live() {
    return [...this.matches].filter((m) => !m.ended);
  }

  private full() {
    return this.live().length >= MAX_MATCHES;
  }

  private tick() {
    if (this.line.length > 0 && !this.full() && (this.line.length >= MAX_HUMANS || Date.now() >= this.deadline)) this.launch();
    this.announce();
  }

  private announce() {
    if (this.line.length === 0) return;
    const full = this.full();
    const startsIn = full ? null : Math.max(0, Math.ceil((this.deadline - Date.now()) / 1000));
    const matches = this.status().matches;
    this.line.forEach((p, i) => {
      // Players beyond the next match's 25 seats wait for the one after.
      const next = i < MAX_HUMANS;
      p.send({
        t: "queue",
        players: Math.min(this.line.length, MAX_HUMANS),
        max: MAX_HUMANS,
        startsIn: next ? startsIn : null,
        full: full || !next,
        position: i + 1,
        matches,
      });
    });
  }

  private launch() {
    const peers = this.line.splice(0, MAX_HUMANS);
    // Whoever is still in line gets a fresh countdown for the next match.
    this.deadline = Date.now() + QUEUE_WAIT_MS;
    // A broken match must never take the whole game server down with it.
    try {
      const match = new Match(peers, this.events, (m) => {
        this.matches.delete(m);
        this.tick();
      });
      this.matches.add(match);
      match.start();
    } catch (err) {
      console.error("Failed to start match:", err);
      for (const p of peers) {
        p.match = null;
        p.send({ t: "match-failed" });
      }
    }
  }

  /** Live matches for the lobby. */
  status() {
    return {
      maxMatches: MAX_MATCHES,
      waiting: this.line.length,
      matches: this.live().map((m) => m.summary()),
    };
  }

  dispose() {
    clearInterval(this.ticker);
    for (const m of [...this.matches]) m.close();
  }
}
