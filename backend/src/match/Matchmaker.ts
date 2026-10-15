import { Match, type MatchEvents, type Peer } from "./Match";
import { Parties } from "./Party";
import { MAX_HUMANS, MAX_MATCHES, QUEUE_WAIT_MS } from "./rules";

/**
 * Groups queued players into matches. A match starts as soon as 25 players
 * are in, or 30 seconds after the first one queued; bots fill the rest.
 * Squads queue together (their leader starts) and always land in the same
 * match. At most MAX_MATCHES run at once: everyone else waits in line, in
 * order, and the next match forms as soon as one ends.
 */
export class Matchmaker {
  /** Waiting groups in order: a squad, or a single player. */
  private line: Peer[][] = [];
  /** When the next match starts even if it isn't full (set by the first group in line). */
  private deadline = 0;
  private matches = new Set<Match>();
  private ticker: NodeJS.Timeout;
  readonly parties = new Parties();

  constructor(private events: MatchEvents) {
    this.ticker = setInterval(() => this.tick(), 1000);
    // Someone left a squad that's waiting: pull the squad out of the line.
    this.parties.onChange = (party, left) => {
      const i = this.line.findIndex((g) => g.some((p) => p.userId === party.leader || p === left));
      if (i < 0) return;
      const [group] = this.line.splice(i, 1);
      for (const p of group) p.send({ t: "queue-left" });
      this.announce();
    };
  }

  private waiting() {
    return this.line.reduce((n, g) => n + g.length, 0);
  }

  private groupOf(peer: Peer) {
    return this.line.findIndex((g) => g.includes(peer));
  }

  /** Start matchmaking. In a squad only the leader can, and it queues everyone. */
  queue(peer: Peer) {
    if (this.groupOf(peer) >= 0) return;
    const party = this.parties.of(peer);
    let group = [peer];
    if (party && party.members.length > 1) {
      if (party.leader !== peer.userId) {
        peer.send({ t: "party-error", error: "Only the squad leader can start the match." });
        return;
      }
      group = [...party.members];
    }
    for (const m of group) {
      if (this.groupOf(m) >= 0) return;
      if (m.match) {
        // Someone still on the results screen of the last match is free to go.
        if (m.match.isDone(m.userId)) m.match.leave(m);
        else {
          peer.send({ t: "party-error", error: `${m.name} is still in a match.` });
          return;
        }
      }
    }
    if (this.line.length === 0) this.deadline = Date.now() + QUEUE_WAIT_MS;
    this.line.push(group);
    this.tick();
  }

  cancel(peer: Peer) {
    const i = this.groupOf(peer);
    if (i < 0) return;
    const [group] = this.line.splice(i, 1);
    for (const p of group) p.send({ t: "queue-left" });
    this.announce();
  }

  /** Socket closed: leave the line, the squad and the running match. */
  disconnect(peer: Peer) {
    this.cancel(peer);
    this.parties.leave(peer);
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
    if (this.line.length > 0 && !this.full() && (this.waiting() >= MAX_HUMANS || Date.now() >= this.deadline)) this.launch();
    this.announce();
  }

  private announce() {
    if (this.line.length === 0) return;
    const full = this.full();
    const startsIn = full ? null : Math.max(0, Math.ceil((this.deadline - Date.now()) / 1000));
    const matches = this.status().matches;
    let before = 0;
    this.line.forEach((group, i) => {
      // Groups beyond the next match's 25 seats wait for the one after.
      const next = before + group.length <= MAX_HUMANS;
      for (const p of group) {
        p.send({
          t: "queue",
          players: Math.min(this.waiting(), MAX_HUMANS),
          max: MAX_HUMANS,
          startsIn: next ? startsIn : null,
          full: full || !next,
          position: i + 1,
          squad: group.length,
          matches,
        });
      }
      before += group.length;
    });
  }

  private launch() {
    const groups: Peer[][] = [];
    let seats = 0;
    while (this.line.length && seats + this.line[0].length <= MAX_HUMANS) {
      const g = this.line.shift()!;
      groups.push(g);
      seats += g.length;
    }
    if (!groups.length) return;
    // Whoever is still in line gets a fresh countdown for the next match.
    this.deadline = Date.now() + QUEUE_WAIT_MS;
    // A broken match must never take the whole game server down with it.
    try {
      const match = new Match(groups, this.events, (m) => {
        this.matches.delete(m);
        this.tick();
      });
      this.matches.add(match);
      match.start();
    } catch (err) {
      console.error("Failed to start match:", err);
      for (const p of groups.flat()) {
        p.match = null;
        p.send({ t: "match-failed" });
      }
    }
  }

  /** Live matches for the lobby. */
  status() {
    return {
      maxMatches: MAX_MATCHES,
      waiting: this.waiting(),
      matches: this.live().map((m) => m.summary()),
    };
  }

  dispose() {
    clearInterval(this.ticker);
    for (const m of [...this.matches]) m.close();
  }
}
