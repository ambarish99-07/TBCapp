import jwt from "jsonwebtoken";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { TiffinFestivalSpecialModel } from "../../src/db/models/TiffinFestivalSpecial.model.js";
import { TiffinMealPriceModel } from "../../src/db/models/TiffinMealPrice.model.js";
import { UserModel } from "../../src/db/models/User.model.js";
import { clearTestDb, seedTiffinMenu, startTestDb, stopTestDb, testEnv } from "./testDb.js";

const env = testEnv();
const app = createApp(env);

beforeAll(async () => {
  await startTestDb();
});

beforeEach(async () => {
  await seedTiffinMenu();
  await TiffinMealPriceModel.create({ tier: "regular", mealType: "breakfast", price: 79, active: true });
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

async function signup(email: string, phone: string): Promise<string> {
  const response = await request(app).post("/auth/signup").send({ fullName: "Festival Tester", email, phone, password: "password123" });
  return response.body.token;
}

const validDelivery = {
  fullName: "Test Customer",
  phone: "9999999999",
  address: "123 Test St",
  city: "Patna",
  pincode: "800001",
};

type MenuItem = { tier: string; mealType: string; dietType: string; date: string; dishName: string; specialLabel?: string };

describe("Admin festival specials CRUD", () => {
  it("rejects a non-admin caller", async () => {
    const customer = await UserModel.create({ fullName: "Customer", passwordHash: "x", role: "customer" });
    const token = jwt.sign({ userId: String(customer._id), role: "customer" }, env.JWT_SECRET, { expiresIn: "1h" });
    const response = await request(app).get("/admin/tiffin/festival-specials").set("Authorization", `Bearer ${token}`);
    expect(response.status).toBe(403);
  });

  it("creates, lists, updates, and deletes a festival special", async () => {
    const token = await adminToken();
    const authHeader = `Bearer ${token}`;
    const payload = {
      date: "2026-11-08",
      label: "🪔 Diwali Special",
      tier: "regular",
      dietType: "veg",
      mealType: "breakfast",
      dishName: "Diwali Special Thali",
      hasAddOns: false,
    };

    const created = await request(app).put("/admin/tiffin/festival-specials").set("Authorization", authHeader).send(payload);
    expect(created.status).toBe(200);
    expect(created.body.special.dishName).toBe("Diwali Special Thali");
    expect(created.body.special.active).toBe(true);

    const list = await request(app).get("/admin/tiffin/festival-specials").set("Authorization", authHeader);
    expect(list.status).toBe(200);
    expect(list.body.specials).toHaveLength(1);

    const updated = await request(app)
      .put("/admin/tiffin/festival-specials")
      .set("Authorization", authHeader)
      .send({ ...payload, dishName: "Diwali Grand Thali" });
    expect(updated.status).toBe(200);
    expect(updated.body.special.dishName).toBe("Diwali Grand Thali");
    expect(updated.body.special.id).toBe(created.body.special.id);

    const deleted = await request(app).delete(`/admin/tiffin/festival-specials/${created.body.special.id}`).set("Authorization", authHeader);
    expect(deleted.status).toBe(204);

    const listAfterDelete = await request(app).get("/admin/tiffin/festival-specials").set("Authorization", authHeader);
    expect(listAfterDelete.body.specials).toHaveLength(0);
  });
});

describe("Festival specials on the live single-meal menu", () => {
  it("overrides only the matching (date, tier, dietType, mealType) slot, leaving every other slot untouched", async () => {
    const before = await request(app).get("/tiffin/single-meal/menu");
    const vegBreakfastBefore: MenuItem = before.body.menu.find(
      (item: MenuItem) => item.tier === "regular" && item.dietType === "veg" && item.mealType === "breakfast"
    );
    const targetDate = vegBreakfastBefore.date;
    expect(vegBreakfastBefore.specialLabel).toBeUndefined();

    await TiffinFestivalSpecialModel.create({
      date: targetDate,
      label: "🪔 Diwali Special",
      tier: "regular",
      dietType: "veg",
      mealType: "breakfast",
      dishName: "Diwali Special Thali",
      hasAddOns: false,
      active: true,
    });

    const after = await request(app).get("/tiffin/single-meal/menu");
    const vegBreakfastAfter: MenuItem = after.body.menu.find(
      (item: MenuItem) => item.tier === "regular" && item.dietType === "veg" && item.mealType === "breakfast"
    );
    expect(vegBreakfastAfter.dishName).toBe("Diwali Special Thali");
    expect(vegBreakfastAfter.specialLabel).toBe("🪔 Diwali Special");

    // Non-veg breakfast (a different dietType, same date/tier/mealType) is unaffected.
    const nonVegBreakfastAfter: MenuItem = after.body.menu.find(
      (item: MenuItem) => item.tier === "regular" && item.dietType === "non-veg" && item.mealType === "breakfast"
    );
    expect(nonVegBreakfastAfter.specialLabel).toBeUndefined();
    expect(nonVegBreakfastAfter.dishName).not.toBe("Diwali Special Thali");
  });

  it("deactivating a special reverts that slot back to the regular dish", async () => {
    const before = await request(app).get("/tiffin/single-meal/menu");
    const vegBreakfastBefore: MenuItem = before.body.menu.find(
      (item: MenuItem) => item.tier === "regular" && item.dietType === "veg" && item.mealType === "breakfast"
    );
    const originalDishName = vegBreakfastBefore.dishName;

    await TiffinFestivalSpecialModel.create({
      date: vegBreakfastBefore.date,
      label: "🪔 Diwali Special",
      tier: "regular",
      dietType: "veg",
      mealType: "breakfast",
      dishName: "Diwali Special Thali",
      hasAddOns: false,
      active: false,
    });

    const after = await request(app).get("/tiffin/single-meal/menu");
    const vegBreakfastAfter: MenuItem = after.body.menu.find(
      (item: MenuItem) => item.tier === "regular" && item.dietType === "veg" && item.mealType === "breakfast"
    );
    expect(vegBreakfastAfter.dishName).toBe(originalDishName);
    expect(vegBreakfastAfter.specialLabel).toBeUndefined();
  });

  it("snapshots the special onto a placed order", async () => {
    const before = await request(app).get("/tiffin/single-meal/menu");
    const vegBreakfastBefore: MenuItem = before.body.menu.find(
      (item: MenuItem) => item.tier === "regular" && item.dietType === "veg" && item.mealType === "breakfast"
    );

    await TiffinFestivalSpecialModel.create({
      date: vegBreakfastBefore.date,
      label: "🪔 Diwali Special",
      tier: "regular",
      dietType: "veg",
      mealType: "breakfast",
      dishName: "Diwali Special Thali",
      hasAddOns: false,
      active: true,
    });

    const token = await signup("festival-order@example.com", "9812366123");
    const response = await request(app)
      .post("/tiffin/single-meal/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({ tier: "regular", mealType: "breakfast", dietType: "veg", quantity: 1, delivery: validDelivery, paymentMethod: "cod" });

    expect(response.status).toBe(201);
    expect(response.body.order.dishName).toBe("Diwali Special Thali");
    expect(response.body.order.specialLabel).toBe("🪔 Diwali Special");
  });
});
