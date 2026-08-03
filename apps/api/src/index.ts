import "dotenv/config";
import { createApp } from "./app.js";
import { loadEnv } from "./config/env.js";
import { connectToDatabase } from "./db/connection.js";

async function main() {
  const env = loadEnv();
  await connectToDatabase(env.MONGODB_URI);

  const app = createApp(env);
  const server = app.listen(env.PORT, () => {
    console.log(`TBC API listening on port ${env.PORT}`);
  });

  const shutdown = () => {
    server.close(() => process.exit(0));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("Failed to start TBC API:", err);
  process.exit(1);
});
