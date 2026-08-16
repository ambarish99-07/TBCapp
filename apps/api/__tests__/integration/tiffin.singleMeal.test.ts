import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { TiffinMealPriceModel } from "../../src/db/models/TiffinMealPrice.model.js";
import { clearTestDb, startTestDb, stopTestDb, testEnv } from "./testDb.js";

// Own file so it gets its own signup rate-limit budget — needs 3 fresh signups.
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

async function signup(email: string, phone: string): Promise<string> {
  const response = await request(app)
    .post("/auth/signup")
    .send({ fullName: "Single Meal Tester", email, phone, password: "password123" });
  return response.body.token;
}

async function seedPrices() {
  await TiffinMealPriceModel.insertMany([
    { tier: "regular", mealType: "breakfast", price: 79, active: true },
    { tier: "regular", mealType: "lunch", price: 129, active: true },
    { tier: "regular", mealType: "dinner", price: 129, active: true },
    { tier: "mini", mealType: "lunch", price: 99, active: true },
    { tier: "mini", mealType: "dinner", price: 99, active: true },
    { tier: "premium", mealType: "lunch", price: 169, active: true },
    { tier: "premium", mealType: "dinner", price: 169, active: false },
  ]);
}

const validDelivery = {
  fullName: "Test Customer",
  phone: "9999999999",
  address: "123 Test St",
  city: "Patna",
  pincode: "800001",
};

describe("GET /tiffin/single-meal/menu", () => {
  it("returns tomorrow's menu for every active price, resolved from the curated real menu — no auth needed", async () => {
    await seedPrices();

    const response = await request(app).get("/tiffin/single-meal/menu");

    expect(response.status).toBe(200);
    // 6 active rows seeded above, veg + non-veg each — the inactive premium dinner row is excluded.
    expect(response.body.menu).toHaveLength(12);
    type MenuItem = { tier: string; mealType: string; dietType: string; dishName: string; carbChoiceRequired: boolean };
    const find = (tier: string, mealType: string, dietType: string) =>
      response.body.menu.find((item: MenuItem) => item.tier === tier && item.mealType === mealType && item.dietType === dietType);

    const miniVegLunch = find("mini", "lunch", "veg");
    expect(miniVegLunch.carbChoiceRequired).toBe(true);
    expect(miniVegLunch.dishName).toBeTruthy();
    // Mini reuses Regular's veg lunch sabzi for the same day, but composes its own full name —
    // "Roti {sabzi}" (no rice/daal), vs Regular's "Rice Roti Daal {sabzi}".
    const regularVegLunch: string = find("regular", "lunch", "veg").dishName;
    const sabzi = regularVegLunch.replace(/^Rice Roti Daal /, "");
    expect(miniVegLunch.dishName).toBe(`Roti ${sabzi}`);

    expect(find("mini", "breakfast", "veg")).toBeUndefined();
    expect(find("mini", "breakfast", "non-veg")).toBeUndefined();
    // Breakfast is diet-agnostic except Wednesday, where non-veg keeps the old Bread Omelette
    // instead of veg's Upma — "tomorrow" could be any day when this test runs, so branch on it
    // rather than assuming every day matches.
    const vegBreakfast = find("regular", "breakfast", "veg").dishName;
    const nonVegBreakfast = find("regular", "breakfast", "non-veg").dishName;
    if (vegBreakfast === "Upma") {
      expect(nonVegBreakfast).toBe("Bread Omelette");
    } else {
      expect(nonVegBreakfast).toBe(vegBreakfast);
    }
  });
});

describe("POST /tiffin/single-meal/orders", () => {
  it("places a COD order for a regular meal and lists it under mine", async () => {
    await seedPrices();
    const token = await signup("regular-order@example.com", "9812400050");

    const response = await request(app)
      .post("/tiffin/single-meal/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({ tier: "regular", mealType: "lunch", dietType: "veg", delivery: validDelivery, paymentMethod: "cod" });

    expect(response.status).toBe(201);
    expect(response.body.order.orderNumber).toMatch(/^GTM-/);
    expect(response.body.order.price).toBe(129);
    expect(response.body.order.status).toBe("placed");

    const mine = await request(app).get("/tiffin/single-meal/orders/mine").set("Authorization", `Bearer ${token}`);
    expect(mine.status).toBe(200);
    expect(mine.body.orders).toHaveLength(1);
    expect(mine.body.orders[0].orderNumber).toBe(response.body.order.orderNumber);
  });

  it("places a non-veg order and snapshots the resolved dish", async () => {
    await seedPrices();
    const token = await signup("nonveg-order@example.com", "9812400053");

    const response = await request(app)
      .post("/tiffin/single-meal/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({ tier: "regular", mealType: "dinner", dietType: "non-veg", delivery: validDelivery, paymentMethod: "cod" });

    expect(response.status).toBe(201);
    expect(response.body.order.dietType).toBe("non-veg");
    expect(response.body.order.dishName).toBeTruthy();
  });

  it("rejects a mini order without a rice/roti choice", async () => {
    await seedPrices();
    const token = await signup("mini-nochoice@example.com", "9812400051");

    const response = await request(app)
      .post("/tiffin/single-meal/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({ tier: "mini", mealType: "lunch", dietType: "veg", delivery: validDelivery, paymentMethod: "cod" });

    expect(response.status).toBe(400);
  });

  it("rejects ordering a meal with no active price", async () => {
    await seedPrices();
    const token = await signup("no-price@example.com", "9812400052");

    const response = await request(app)
      .post("/tiffin/single-meal/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({ tier: "premium", mealType: "dinner", dietType: "veg", delivery: validDelivery, paymentMethod: "cod" });

    expect(response.status).toBe(400);
  });

  it("requires authentication", async () => {
    await seedPrices();
    const response = await request(app)
      .post("/tiffin/single-meal/orders")
      .send({ tier: "regular", mealType: "lunch", dietType: "veg", delivery: validDelivery, paymentMethod: "cod" });
    expect(response.status).toBe(401);
  });
});
