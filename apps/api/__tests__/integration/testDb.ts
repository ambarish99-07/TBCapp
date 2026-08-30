import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { TiffinAddOnPriceModel } from "../../src/db/models/TiffinAddOnPrice.model.js";
import { TiffinDishModel } from "../../src/db/models/TiffinDish.model.js";
import { TIFFIN_ADD_ON_PRICE_SEED_DATA, TIFFIN_DISH_SEED_DATA } from "../../src/db/tiffinDishSeedData.js";

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

/** Seeds the full real GG Tiffin single-meal weekly rotation + add-on prices — needed by any test
 * that creates a subscription or single-meal order, since dish/add-on resolution now reads from
 * these DB collections instead of hardcoded tables. `clearTestDb` wipes them like everything else,
 * so call this again (e.g. in a per-file `beforeEach`) after every test that needs it. */
export async function seedTiffinMenu(): Promise<void> {
  await TiffinDishModel.insertMany(TIFFIN_DISH_SEED_DATA.map(({ imageSlug: _imageSlug, ...dish }) => dish));
  await TiffinAddOnPriceModel.insertMany(TIFFIN_ADD_ON_PRICE_SEED_DATA);
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
