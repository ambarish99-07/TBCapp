import "dotenv/config";
import { loadEnv } from "../src/config/env.js";
import { connectToDatabase, disconnectFromDatabase } from "../src/db/connection.js";
import { UserModel } from "../src/db/models/User.model.js";

/** Dev-only convenience: promote an existing account to admin by email. */
async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: tsx scripts/promote-admin.ts <email>");
    process.exit(1);
  }

  const env = loadEnv();
  await connectToDatabase(env.MONGODB_URI);

  const user = await UserModel.findOneAndUpdate({ email: email.toLowerCase() }, { role: "admin" }, { new: true });
  if (!user) {
    console.error(`No user found with email ${email}`);
  } else {
    console.log(`Promoted ${user.email} to admin.`);
  }

  await disconnectFromDatabase();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
