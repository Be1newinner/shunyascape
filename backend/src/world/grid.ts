import mongoose from "mongoose";
import GridCell from "../models/GridCell";
import Settings from "../models/Settings";
import { baseCellType, inWorld } from "./layout";

/** A cell that differs from the seeded base layout. */
export interface CellOverride {
  x: number;
  z: number;
  type: string;
  targetType: string;
  constructionProgress: number;
  height: number;
  scale: number;
  /** Store owner's user id and display name (never their email). */
  ownerId: string | null;
  ownerName: string | null;
  /** User who ordered the construction, so their client can count the build. */
  builderId: string | null;
  price: number;
  isPurchased: boolean;
}

/** Bump when the stored world format changes; see migrateWorld(). */
const WORLD_VERSION = 2;

const overrides = new Map<string, CellOverride>();
const key = (x: number, z: number) => `${x}_${z}`;

type CellListener = (before: CellOverride, after: CellOverride) => void;
const listeners: CellListener[] = [];

/** Called after every cell change (used by the NPC simulation). */
export function onCellChange(listener: CellListener) {
  listeners.push(listener);
}

/**
 * v1 stored a random 32x32 grid and NPC positions pushed by the admin's
 * browser. Both are replaced (seeded shared layout, server-run NPCs), and the
 * old data was test data, so v2 starts the world from a clean slate.
 */
async function migrateWorld() {
  const settings = await Settings.findOne({ key: "global" });
  if ((settings?.worldVersion ?? 1) >= WORLD_VERSION) return;

  const cells = await GridCell.deleteMany({});
  const npcs = await mongoose.connection.db?.collection("npcs").deleteMany({});
  await Settings.updateOne({ key: "global" }, { $set: { worldVersion: WORLD_VERSION } }, { upsert: true });
  console.log(
    `World migrated to v${WORLD_VERSION}: cleared ${cells.deletedCount} legacy grid cells and ${npcs?.deletedCount ?? 0} legacy NPCs.`,
  );
}

export async function loadGrid() {
  await migrateWorld();
  overrides.clear();
  const cells = await GridCell.find({}).lean();
  for (const c of cells) {
    if (!inWorld(c.x, c.z)) continue;
    overrides.set(key(c.x, c.z), toOverride(c));
  }
  console.log(`Grid loaded: ${overrides.size} cells differ from the base layout.`);
}

function toOverride(c: Partial<CellOverride> & { x: number; z: number }): CellOverride {
  return {
    x: c.x,
    z: c.z,
    type: c.type ?? "empty",
    targetType: c.targetType ?? c.type ?? "empty",
    constructionProgress: c.constructionProgress ?? 0,
    height: c.height ?? 0,
    scale: c.scale ?? 1,
    ownerId: c.ownerId ?? null,
    ownerName: c.ownerName ?? null,
    builderId: c.builderId ?? null,
    price: c.price ?? 0,
    isPurchased: c.isPurchased ?? false,
  };
}

export function getOverrides(): CellOverride[] {
  return Array.from(overrides.values());
}

/** Current state of a cell: its override if any, else the base layout. */
export function getCell(x: number, z: number): CellOverride {
  const o = overrides.get(key(x, z));
  if (o) return o;
  const type = baseCellType(x, z);
  return toOverride({ x, z, type, targetType: type, constructionProgress: type === "empty" ? 0 : 100 });
}

/** Just the type, without allocating (hot path for pathfinding). */
export function getCellType(x: number, z: number): string {
  return overrides.get(key(x, z))?.type ?? baseCellType(x, z);
}

export async function setCell(cell: CellOverride): Promise<CellOverride> {
  const next = toOverride(cell);
  const before = getCell(next.x, next.z);
  overrides.set(key(next.x, next.z), next);
  for (const listener of listeners) listener(before, next);
  await GridCell.updateOne({ x: next.x, z: next.z }, { $set: next }, { upsert: true });
  return next;
}

/** True if a cell of `type` is within `radius` cells (Chebyshev) of (x, z). */
export function isNear(x: number, z: number, type: string, radius: number): boolean {
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dz = -radius; dz <= radius; dz++) {
      const cx = x + dx;
      const cz = z + dz;
      if (inWorld(cx, cz) && getCellType(cx, cz) === type) return true;
    }
  }
  return false;
}
