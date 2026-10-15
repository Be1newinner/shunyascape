/**
 * One-off cleanup after removing the city-builder game.
 *
 * Drops the city collections (grid cells, parties, simulation settings, old
 * NPC records) and removes city fields from user documents. Accounts, logins
 * and battleground profiles are kept.
 *
 *   pnpm cleanup:city            # dry run: shows what would change
 *   pnpm cleanup:city --apply    # actually deletes
 */
import "dotenv/config";
import mongoose from "mongoose";

const CITY_COLLECTIONS = ["gridcells", "groups", "settings", "npcs"];
const CITY_USER_FIELDS = [
  "x", "z", "lastX", "lastZ", "clothingColor", "shunyaCoins", "level", "xp", "wood",
  "unlockedPermits", "completedAchievements", "completedQuests", "groupId",
];

async function main() {
  const apply = process.argv.includes("--apply");
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");
  await mongoose.connect(uri);
  const db = mongoose.connection.db!;
  // Host and database only; never print credentials.
  const { host, name } = mongoose.connection;
  console.log(`Connected to database "${name}" on ${host}${apply ? "" : "  (dry run)"}`);

  const existing = new Set((await db.listCollections().toArray()).map((c) => c.name));
  for (const coll of CITY_COLLECTIONS) {
    if (!existing.has(coll)) continue;
    const count = await db.collection(coll).countDocuments();
    console.log(`${apply ? "Dropping" : "Would drop"} collection "${coll}" (${count} documents)`);
    if (apply) await db.collection(coll).drop();
  }

  const users = db.collection("users");
  const filter = { $or: CITY_USER_FIELDS.map((f) => ({ [f]: { $exists: true } })) };
  const affected = await users.countDocuments(filter);
  const total = await users.countDocuments();
  console.log(`${apply ? "Removing" : "Would remove"} city fields from ${affected} of ${total} users: ${CITY_USER_FIELDS.join(", ")}`);
  if (apply && affected) {
    const unset = Object.fromEntries(CITY_USER_FIELDS.map((f) => [f, ""]));
    const res = await users.updateMany(filter, { $unset: unset });
    console.log(`Updated ${res.modifiedCount} users`);
  }
  if (!apply) console.log("Nothing changed. Run again with --apply to delete.");
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
