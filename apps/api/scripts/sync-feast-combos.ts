/**
 * Writes just the Feast combos (and removes the retired cross-brand combo) in whatever database
 * MONGODB_URI points at — without seed.ts's coupon/tiffin resets, so it's safe against a live DB.
 * Usage: pnpm --filter @tbc/api sync-feast-combos
 */
import "dotenv/config";
import { loadEnv } from "../src/config/env.js";
import { connectToDatabase, disconnectFromDatabase } from "../src/db/connection.js";
import { syncFeastCombos } from "../src/db/feastCombos.js";

async function main() {
  const env = loadEnv();
  await connectToDatabase(env.MONGODB_URI);
  try {
    await syncFeastCombos();
  } finally {
    await disconnectFromDatabase();
  }
}

main().catch((err) => {
  console.error("sync-feast-combos failed:", err);
  process.exit(1);
});
