import jwt from "jsonwebtoken";
import request from "supertest";
import { afterEach, beforeAll, afterAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { MenuItemModel } from "../../src/db/models/MenuItem.model.js";
import { UserModel } from "../../src/db/models/User.model.js";
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

async function adminToken(): Promise<string> {
  const admin = await UserModel.create({ fullName: "Admin", email: "admin@test.com", passwordHash: "unused", role: "admin" });
  return jwt.sign({ userId: String(admin._id), role: "admin" }, env.JWT_SECRET, { expiresIn: "1h" });
}

async function seedItems() {
  await MenuItemModel.create([
    { _id: "choco-crush", brandId: "tbc", signatureName: "Choco Crush", commonName: "Rich Chocolate Shake", description: "d", price: 220, category: "signature-shakes", image: "https://example.com/a.jpg", flavorBadges: [] },
    { _id: "mango-tango", brandId: "tbc", signatureName: "Mango Tango", commonName: "Mango Shake", description: "d", price: 240, category: "signature-shakes", image: "https://example.com/b.jpg", flavorBadges: [] },
    { _id: "cold-brew", brandId: "tbc", signatureName: "Cold Brew", commonName: "Cold Brew Coffee", description: "d", price: 200, category: "cold-coffee", image: "https://example.com/c.jpg", flavorBadges: [] },
  ]);
}

const validCurated = {
  id: "chocolate-duo",
  brandId: "tbc",
  type: "curated" as const,
  name: "Chocolate Duo",
  description: "Two chocolatey favorites",
  itemIds: ["choco-crush", "mango-tango"],
};

describe("PUT /menu/combos (admin upsert)", () => {
  it("rejects a non-admin caller", async () => {
    const customer = await UserModel.create({ fullName: "Customer", passwordHash: "x", role: "customer" });
    const token = jwt.sign({ userId: String(customer._id), role: "customer" }, env.JWT_SECRET, { expiresIn: "1h" });

    const response = await request(app).put("/menu/combos").set("Authorization", `Bearer ${token}`).send(validCurated);
    expect(response.status).toBe(403);
  });

  it("rejects a curated combo with fewer than 2 itemIds", async () => {
    const token = await adminToken();
    const response = await request(app)
      .put("/menu/combos")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...validCurated, itemIds: ["choco-crush"] });
    expect(response.status).toBe(400);
  });

  it("rejects a choose-n combo missing chooseCount", async () => {
    const token = await adminToken();
    const response = await request(app)
      .put("/menu/combos")
      .set("Authorization", `Bearer ${token}`)
      .send({ id: "pick-two", brandId: "tbc", type: "choose-n", name: "Pick Two", description: "d", eligibleItemIds: ["choco-crush", "mango-tango"] });
    expect(response.status).toBe(400);
  });

  it("creates a curated combo, updates its discount, then deletes it", async () => {
    await seedItems();
    const token = await adminToken();
    const authHeader = `Bearer ${token}`;

    const created = await request(app).put("/menu/combos").set("Authorization", authHeader).send(validCurated);
    expect(created.status).toBe(200);
    expect(created.body.combo.id).toBe("chocolate-duo");
    expect(created.body.combo.itemIds).toEqual(["choco-crush", "mango-tango"]);
    expect(created.body.combo.discountPercent).toBeUndefined();

    const updated = await request(app)
      .put("/menu/combos")
      .set("Authorization", authHeader)
      .send({ ...validCurated, discountPercent: 25 });
    expect(updated.status).toBe(200);
    expect(updated.body.combo.discountPercent).toBe(25);

    // Explicit null clears the override back to the global default — omitting the field
    // entirely (as a real client's JSON.stringify would for `undefined`) must NOT clear it.
    const untouched = await request(app)
      .put("/menu/combos")
      .set("Authorization", authHeader)
      .send({ ...validCurated });
    expect(untouched.status).toBe(200);
    expect(untouched.body.combo.discountPercent).toBe(25);

    const cleared = await request(app)
      .put("/menu/combos")
      .set("Authorization", authHeader)
      .send({ ...validCurated, discountPercent: null });
    expect(cleared.status).toBe(200);
    expect(cleared.body.combo.discountPercent).toBeUndefined();

    const listBeforeDelete = await request(app).get("/menu/combos").query({ brandId: "tbc" });
    expect(listBeforeDelete.body.combos).toHaveLength(1);

    const deleted = await request(app).delete("/menu/combos/chocolate-duo").set("Authorization", authHeader);
    expect(deleted.status).toBe(204);

    const listAfterDelete = await request(app).get("/menu/combos").query({ brandId: "tbc" });
    expect(listAfterDelete.body.combos).toHaveLength(0);
  });

  it("creates a choose-n combo and clears stale curated fields if the type ever changes", async () => {
    await seedItems();
    const token = await adminToken();
    const authHeader = `Bearer ${token}`;

    const created = await request(app)
      .put("/menu/combos")
      .set("Authorization", authHeader)
      .send({
        id: "pick-two",
        brandId: "tbc",
        type: "choose-n",
        name: "Pick Two",
        description: "Choose any two",
        chooseCount: 2,
        eligibleItemIds: ["choco-crush", "mango-tango", "cold-brew"],
      });
    expect(created.status).toBe(200);
    expect(created.body.combo.chooseCount).toBe(2);
    expect(created.body.combo.eligibleItemIds).toEqual(["choco-crush", "mango-tango", "cold-brew"]);
    expect(created.body.combo.itemIds).toBeUndefined();

    const switched = await request(app)
      .put("/menu/combos")
      .set("Authorization", authHeader)
      .send({ ...validCurated, id: "pick-two" });
    expect(switched.status).toBe(200);
    expect(switched.body.combo.type).toBe("curated");
    expect(switched.body.combo.itemIds).toEqual(["choco-crush", "mango-tango"]);
    expect(switched.body.combo.chooseCount).toBeUndefined();
    expect(switched.body.combo.eligibleItemIds).toBeUndefined();
  });
});
