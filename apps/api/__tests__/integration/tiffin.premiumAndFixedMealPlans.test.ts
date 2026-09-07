import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { TiffinPlanModel } from "../../src/db/models/TiffinPlan.model.js";
import { clearTestDb, seedTiffinMenu, startTestDb, stopTestDb, testEnv } from "./testDb.js";

// Own file so it gets its own signup rate-limit budget — needs 5 fresh signups. Covers the
// Premium-tier subscription catalog (a full mirror of Regular's single/twice-daily/thrice-daily
// styles, just priced higher) and the two new fixed-meal styles, lunch-only/dinner-only.
const env = testEnv();
const app = createApp(env);

beforeAll(async () => {
  await startTestDb();
});

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
    .send({ fullName: "Premium Plan Tester", email, phone, password: "password123" });
  return response.body.token;
}

const validDelivery = {
  fullName: "Test Customer",
  phone: "9999999999",
  address: "123 Test St",
  city: "Patna",
  pincode: "800001",
};

describe("Premium-tier subscriptions", () => {
  it("subscribes to a Premium thrice-daily plan — Premium offers breakfast, unlike Mini", async () => {
    const plan = await TiffinPlanModel.create({
      name: "Weekly Premium Veg Plan — Thrice Daily",
      dietType: "veg",
      tier: "premium",
      style: "thrice-daily",
      durationDays: 7,
      price: 3099,
      active: true,
    });
    const token = await signup("premium-thrice@example.com", "9812400070");

    const response = await request(app)
      .post("/tiffin/subscriptions")
      .set("Authorization", `Bearer ${token}`)
      .send({ planId: plan.id, delivery: validDelivery, paymentMethod: "razorpay" });

    expect(response.status).toBe(201);
    expect(response.body.subscription.tier).toBe("premium");
    expect(response.body.subscription.mealTypes).toEqual(["breakfast", "lunch", "dinner"]);
  });

  it("subscribes to a Premium single-style plan, choosing breakfast", async () => {
    const plan = await TiffinPlanModel.create({
      name: "Weekly Premium Non-Veg Plan",
      dietType: "non-veg",
      tier: "premium",
      style: "single",
      durationDays: 7,
      price: 1799,
      active: true,
    });
    const token = await signup("premium-single@example.com", "9812400071");

    const response = await request(app)
      .post("/tiffin/subscriptions")
      .set("Authorization", `Bearer ${token}`)
      .send({ planId: plan.id, mealType: "breakfast", delivery: validDelivery, paymentMethod: "razorpay" });

    expect(response.status).toBe(201);
    expect(response.body.subscription.mealTypes).toEqual(["breakfast"]);
  });
});

describe("Lunch-only / Dinner-only fixed-meal plans", () => {
  it("subscribes to a Lunch Only plan — no mealType choice needed, always resolves to lunch", async () => {
    const plan = await TiffinPlanModel.create({
      name: "Monthly Veg Plan — Lunch Only",
      dietType: "veg",
      tier: "regular",
      style: "lunch-only",
      durationDays: 30,
      price: 2499,
      active: true,
    });
    const token = await signup("lunch-only@example.com", "9812400072");

    const response = await request(app)
      .post("/tiffin/subscriptions")
      .set("Authorization", `Bearer ${token}`)
      .send({ planId: plan.id, delivery: validDelivery, paymentMethod: "razorpay" });

    expect(response.status).toBe(201);
    expect(response.body.subscription.mealTypes).toEqual(["lunch"]);

    const meals = await request(app)
      .get(`/tiffin/subscriptions/${response.body.subscription.id}/meals`)
      .set("Authorization", `Bearer ${token}`);
    expect(meals.body.meals).toHaveLength(30);
    expect(meals.body.meals.every((meal: { mealType: string }) => meal.mealType === "lunch")).toBe(true);
  });

  it("subscribes to a Dinner Only plan — no mealType choice needed, always resolves to dinner", async () => {
    const plan = await TiffinPlanModel.create({
      name: "Monthly Non-Veg Plan — Dinner Only",
      dietType: "non-veg",
      tier: "regular",
      style: "dinner-only",
      durationDays: 30,
      price: 3599,
      active: true,
    });
    const token = await signup("dinner-only@example.com", "9812400073");

    const response = await request(app)
      .post("/tiffin/subscriptions")
      .set("Authorization", `Bearer ${token}`)
      .send({ planId: plan.id, delivery: validDelivery, paymentMethod: "razorpay" });

    expect(response.status).toBe(201);
    expect(response.body.subscription.mealTypes).toEqual(["dinner"]);
  });
});
