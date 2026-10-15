import type { Peer } from "./Match";

/** Most players in one squad. */
export const SQUAD_MAX = 4;
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export interface Party {
  code: string;
  leader: string;
  members: Peer[];
}

/**
 * Squads: a player creates one and shares its code; friends join with the
 * code. The leader starts matchmaking for everyone, and the squad plays as
 * one team (no friendly fire, one placement). Squads last until everyone
 * leaves or disconnects, so they carry over from match to match.
 */
export class Parties {
  private byCode = new Map<string, Party>();
  private byUser = new Map<string, Party>();

  /** Called when someone leaves, so a queued squad can be pulled from the line. */
  onChange: (party: Party, left?: Peer) => void = () => {};

  of(peer: Peer) {
    return this.byUser.get(peer.userId) ?? null;
  }

  create(peer: Peer) {
    this.leave(peer);
    let code = "";
    do {
      code = Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join("");
    } while (this.byCode.has(code));
    const party: Party = { code, leader: peer.userId, members: [peer] };
    this.byCode.set(code, party);
    this.byUser.set(peer.userId, party);
    this.announce(party);
    return party;
  }

  join(peer: Peer, rawCode: string) {
    const code = rawCode.trim().toUpperCase();
    const party = this.byCode.get(code);
    if (!party) return "No squad with that code.";
    const already = party.members.findIndex((m) => m.userId === peer.userId);
    if (already >= 0) {
      // Same player on a new connection: swap in the fresh one.
      party.members[already] = peer;
    } else {
      if (party.members.length >= SQUAD_MAX) return "That squad is full.";
      this.leave(peer);
      party.members.push(peer);
      this.byUser.set(peer.userId, party);
    }
    this.announce(party);
    this.onChange(party);
    return null;
  }

  leave(peer: Peer) {
    const party = this.byUser.get(peer.userId);
    if (!party) return;
    // Only the connection that's actually in the squad can take the player out of it.
    const i = party.members.findIndex((m) => m === peer);
    if (i < 0) return;
    party.members.splice(i, 1);
    this.byUser.delete(peer.userId);
    peer.send({ t: "party", code: null });
    if (party.members.length === 0) {
      this.byCode.delete(party.code);
    } else {
      if (party.leader === peer.userId) party.leader = party.members[0].userId;
      this.announce(party);
    }
    this.onChange(party, peer);
  }

  private announce(party: Party) {
    const msg = {
      t: "party",
      code: party.code,
      leader: party.leader,
      members: party.members.map((m) => ({ id: m.userId, name: m.name, outfit: m.outfit, level: m.level })),
    };
    for (const m of party.members) m.send(msg);
  }
}
