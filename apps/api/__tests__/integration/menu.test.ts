import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { ComboModel } from "../../src/db/models/Combo.model.js";
import { MenuItemModel } from "../../src/db/models/MenuItem.model.js";
import { clearTestDb, startTestDb, stopTestDb, testEnv } from "./testDb.js";

const env = testEnv();
const app = createApp(env);

beforeAll(async () => {
  await startTestDb();
});

afterEach(async () => {
  await clearTestDb();
});

afterAll(async () => {
  await stopTestDb();
});

/**
 * Regression test: GET /menu and GET /menu/combos must return an `id` field
 * matching the Mongo `_id` — not `_id` itself. Mongoose's `.lean()` docs never
 * get remapped automatically, and a mismatch here is silent and dangerous: the
 * client's `item.id === x` comparisons all evaluate to `undefined === x`, which
 * is false for every real id but happens to be TRUE when compared against
 * another equally-broken `undefined` (e.g. an unset route param) — so a whole
 * class of "always resolves to the first item in the list" bugs can hide
 * behind an app that otherwise looks like it's working.
 */
describe("GET /menu — response shape", () => {
  it("returns each menu item's real id as `id`, not `_id`", async () => {
    await MenuItemModel.create({
      _id: "choco-crush",
      signatureName: "Choco Crush",
      commonName: "Rich Chocolate Shake",
      description: "desc",
      price: 220,
      category: "signature-shakes",
      image: "https://example.com/a.jpg",
      flavorBadges: [],
    });

    const response = await request(app).get("/menu");

    expect(response.status).toBe(200);
    expect(response.body.items[0].id).toBe("choco-crush");
    expect(response.body.items[0]._id).toBeUndefined();
  });
});

describe("GET /menu/combos — response shape", () => {
  it("returns each combo's real id as `id`, not `_id`", async () => {
    await ComboModel.create({
      _id: "chocolate-duo",
      type: "curated",
      name: "Chocolate Duo",
      description: "desc",
      itemIds: ["choco-crush", "oreo-blast"],
    });

    const response = await request(app).get("/menu/combos");

    expect(response.status).toBe(200);
    expect(response.body.combos[0].id).toBe("chocolate-duo");
    expect(response.body.combos[0]._id).toBeUndefined();
  });
});
