import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { TiffinMealPriceModel } from "../../src/db/models/TiffinMealPrice.model.js";
import { clearTestDb, seedTiffinMenu, startTestDb, stopTestDb, testEnv } from "./testDb.js";

// Own file so it gets its own signup rate-limit budget — needs 5 fresh signups (the limit is 5/15min).
const env = testEnv();
const app = createApp(env);

beforeAll(async () => {
  await startTestDb();
});

// Dish/add-on resolution now reads from the DB instead of a hardcoded table — every test here
// needs the real menu seeded.
beforeEach(async () => {
  await seedTiffinMenu();
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
    type MenuItem = {
      tier: string;
      mealType: string;
      dietType: string;
      dishName: string;
      carbChoiceRequired: boolean;
      addOns: { name: string; price: number }[];
    };
    const find = (tier: string, mealType: string, dietType: string) =>
      response.body.menu.find((item: MenuItem) => item.tier === tier && item.mealType === mealType && item.dietType === dietType);

    const miniVegLunch: MenuItem = find("mini", "lunch", "veg");
    expect(miniVegLunch.carbChoiceRequired).toBe(true);
    expect(miniVegLunch.dishName).toBeTruthy();
    // Mini reuses Regular's veg lunch sabzi for the same day — the dish name is now always just
    // the bare sabzi, so both tiers show the exact same name. Mini's base meal is still just
    // roti + sabzi, but it offers the same rice/roti/daal add-on catalog as Regular, so the two
    // tiers' add-ons match too — only what's included by default differs, not what's offered.
    const regularVegLunch: MenuItem = find("regular", "lunch", "veg");
    expect(miniVegLunch.dishName).toBe(regularVegLunch.dishName);
    const expectedAddOns = [
      { name: "Rice", price: 20 },
      { name: "Roti", price: 10 },
      { name: "Daal", price: 20 },
      { name: `Extra ${regularVegLunch.dishName}`, price: 30 },
    ];
    expect(miniVegLunch.addOns).toEqual(expectedAddOns);
    expect(regularVegLunch.addOns).toEqual(expectedAddOns);

    expect(find("mini", "breakfast", "veg")).toBeUndefined();
    expect(find("mini", "breakfast", "non-veg")).toBeUndefined();
    // Breakfast is diet-agnostic except Wednesday, where non-veg keeps the old Bread Omelette
    // instead of veg's Upma — "tomorrow" could be any day when this test runs, so branch on it
    // rather than assuming every day matches. Breakfast never offers add-ons either way.
    const vegBreakfast: MenuItem = find("regular", "breakfast", "veg");
    const nonVegBreakfast: MenuItem = find("regular", "breakfast", "non-veg");
    expect(vegBreakfast.addOns).toEqual([]);
    expect(nonVegBreakfast.addOns).toEqual([]);
    if (vegBreakfast.dishName === "Upma") {
      expect(nonVegBreakfast.dishName).toBe("Bread Omelette");
    } else {
      expect(nonVegBreakfast.dishName).toBe(vegBreakfast.dishName);
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
      .send({ tier: "regular", mealType: "lunch", dietType: "veg", quantity: 1, delivery: validDelivery, paymentMethod: "cod" });

    expect(response.status).toBe(201);
    expect(response.body.order.orderNumber).toMatch(/^GTM-/);
    expect(response.body.order.price).toBe(129);
    expect(response.body.order.quantity).toBe(1);
    // No selectedAddOns sent — nothing gets added on by default.
    expect(response.body.order.addOns).toEqual([]);
    expect(response.body.order.status).toBe("placed");

    const mine = await request(app).get("/tiffin/single-meal/orders/mine").set("Authorization", `Bearer ${token}`);
    expect(mine.status).toBe(200);
    expect(mine.body.orders).toHaveLength(1);
    expect(mine.body.orders[0].orderNumber).toBe(response.body.order.orderNumber);
  });

  it("places a non-veg order and snapshots the resolved dish, keeping only the add-ons actually selected — re-priced from the server catalog, unknown names ignored", async () => {
    await seedPrices();
    const token = await signup("nonveg-order@example.com", "9812400053");

    const response = await request(app)
      .post("/tiffin/single-meal/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({
        tier: "regular",
        mealType: "dinner",
        dietType: "non-veg",
        quantity: 1,
        selectedAddOns: ["Rice", "Daal", "Not A Real AddOn"],
        delivery: validDelivery,
        paymentMethod: "cod",
      });

    expect(response.status).toBe(201);
    expect(response.body.order.dietType).toBe("non-veg");
    expect(response.body.order.dishName).toBeTruthy();
    expect(response.body.order.addOns).toEqual([
      { name: "Rice", price: 20 },
      { name: "Daal", price: 20 },
    ]);
  });

  it("orders more than one of the same meal — price stays per-unit, quantity is snapshotted — and rejects going over the max", async () => {
    await seedPrices();
    const token = await signup("quantity-order@example.com", "9812400054");

    const response = await request(app)
      .post("/tiffin/single-meal/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({ tier: "regular", mealType: "lunch", dietType: "veg", quantity: 3, delivery: validDelivery, paymentMethod: "cod" });

    expect(response.status).toBe(201);
    expect(response.body.order.price).toBe(129);
    expect(response.body.order.quantity).toBe(3);

    const tooMany = await request(app)
      .post("/tiffin/single-meal/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({ tier: "regular", mealType: "lunch", dietType: "veg", quantity: 11, delivery: validDelivery, paymentMethod: "cod" });

    expect(tooMany.status).toBe(400);
  });

  it("rejects a mini order without a rice/roti choice", async () => {
    await seedPrices();
    const token = await signup("mini-nochoice@example.com", "9812400051");

    const response = await request(app)
      .post("/tiffin/single-meal/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({ tier: "mini", mealType: "lunch", dietType: "veg", quantity: 1, delivery: validDelivery, paymentMethod: "cod" });

    expect(response.status).toBe(400);
  });

  it("rejects ordering a meal with no active price", async () => {
    await seedPrices();
    const token = await signup("no-price@example.com", "9812400052");

    const response = await request(app)
      .post("/tiffin/single-meal/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({ tier: "premium", mealType: "dinner", dietType: "veg", quantity: 1, delivery: validDelivery, paymentMethod: "cod" });

    expect(response.status).toBe(400);
  });

  it("requires authentication", async () => {
    await seedPrices();
    const response = await request(app)
      .post("/tiffin/single-meal/orders")
      .send({ tier: "regular", mealType: "lunch", dietType: "veg", quantity: 1, delivery: validDelivery, paymentMethod: "cod" });
    expect(response.status).toBe(401);
  });
});
