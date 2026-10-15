import { Match, type HumanResult, type Peer } from "./Match";
import { MAX_HUMANS, QUEUE_WAIT_MS } from "./rules";

/**
 * Groups queued players into matches. A match starts as soon as 25 players
 * are in, or 60 seconds after the first one queued; bots fill the rest.
 */
export class Matchmaker {
  private forming: { peers: Set<Peer>; deadline: number; timer: NodeJS.Timeout } | null = null;
  private matches = new Set<Match>();
  private ticker: NodeJS.Timeout;

  constructor(private onHumanResult: (userId: string, result: HumanResult) => void) {
    this.ticker = setInterval(() => this.announce(), 1000);
  }

  queue(peer: Peer) {
    if (peer.match) return;
    if (!this.forming) {
      const deadline = Date.now() + QUEUE_WAIT_MS;
      this.forming = { peers: new Set(), deadline, timer: setTimeout(() => this.launch(), QUEUE_WAIT_MS) };
    }
    this.forming.peers.add(peer);
    if (this.forming.peers.size >= MAX_HUMANS) this.launch();
    else this.announce();
  }

  cancel(peer: Peer) {
    if (!this.forming?.peers.delete(peer)) return;
    peer.send({ t: "queue-left" });
    if (this.forming.peers.size === 0) {
      clearTimeout(this.forming.timer);
      this.forming = null;
    } else this.announce();
  }

  /** Socket closed: leave the queue or the running match. */
  disconnect(peer: Peer) {
    this.cancel(peer);
    peer.match?.leave(peer);
  }

  private announce() {
    if (!this.forming) return;
    const msg = {
      t: "queue",
      players: this.forming.peers.size,
      max: MAX_HUMANS,
      startsIn: Math.max(0, Math.ceil((this.forming.deadline - Date.now()) / 1000)),
    };
    for (const p of this.forming.peers) p.send(msg);
  }

  private launch() {
    const f = this.forming;
    if (!f) return;
    clearTimeout(f.timer);
    this.forming = null;
    const peers = [...f.peers];
    if (peers.length === 0) return;
    const match = new Match(peers, this.onHumanResult, (m) => this.matches.delete(m));
    this.matches.add(match);
    match.start();
  }

  stats() {
    return { queued: this.forming?.peers.size ?? 0, matches: this.matches.size };
  }

  dispose() {
    clearInterval(this.ticker);
    if (this.forming) clearTimeout(this.forming.timer);
    for (const m of this.matches) m.close();
  }
}
