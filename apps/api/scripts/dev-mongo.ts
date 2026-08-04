import { MongoMemoryServer } from "mongodb-memory-server";

/**
 * Dev-only convenience: no local MongoDB/Docker is installed on this machine,
 * so this stands in as a real MongoDB instance to develop/demo against. Not
 * meant for anything beyond local development — data does not persist across
 * restarts. Production should point MONGODB_URI at a real MongoDB Atlas cluster.
 */
async function main() {
  const mongod = await MongoMemoryServer.create({
    instance: { port: 27117, dbName: "tbc" },
  });

  console.log(`Dev MongoDB running at ${mongod.getUri()}`);
  console.log("Press Ctrl+C to stop.");

  const shutdown = async () => {
    await mongod.stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("Failed to start dev MongoDB:", err);
  process.exit(1);
});
