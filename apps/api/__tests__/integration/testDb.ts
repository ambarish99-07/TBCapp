import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

let mongod: MongoMemoryServer | undefined;

export async function startTestDb(): Promise<void> {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
}

export async function stopTestDb(): Promise<void> {
  await mongoose.disconnect();
  await mongod?.stop();
}

export async function clearTestDb(): Promise<void> {
  const collections = mongoose.connection.collections;
  for (const collection of Object.values(collections)) {
    await collection.deleteMany({});
  }
}

export function testEnv(overrides: Partial<Record<string, string>> = {}) {
  return {
    MONGODB_URI: "unused-in-tests",
    JWT_SECRET: "test-secret-at-least-16-chars",
    JWT_EXPIRES_IN: "7d",
    PORT: 4000,
    NODE_ENV: "test" as const,
    CORS_ORIGINS: "",
    ...overrides,
  };
}
