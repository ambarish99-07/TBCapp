import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { TiffinPlanModel } from "../../src/db/models/TiffinPlan.model.js";
import { clearTestDb, seedTiffinMenu, startTestDb, stopTestDb, testEnv } from "./testDb.js";

const env = testEnv();
const app = createApp(env);

beforeAll(async () => {
  await startTestDb();
});

// Subscribing generates scheduled meals, which now resolve their dish from the DB (see
// tiffinSchedule.ts) instead of a hardcoded table — every test here needs the real menu seeded.
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
    .send({ fullName: "Tiffin Tester", email, phone, password: "password123" });
  return response.body.token;
}

function seedWeeklyVegPlan() {
  return TiffinPlanModel.create({ name: "Weekly Veg Plan", dietType: "veg", style: "single", durationDays: 7, price: 899, active: true });
}

function seedWeeklyNonVegPlan() {
  return TiffinPlanModel.create({ name: "Weekly Non-Veg Plan", dietType: "non-veg", style: "single", durationDays: 7, price: 1399, active: true });
}

const validDelivery = {
  fullName: "Test Customer",
  phone: "9999999999",
  address: "123 Test St",
  city: "Patna",
  pincode: "800001",
};

describe("POST /tiffin/subscriptions", () => {
  it("subscribes to a veg plan and generates one scheduled meal per day of the plan's duration", async () => {
    const plan = await seedWeeklyVegPlan();
    const token = await signup("veg-sub@example.com", "9812400001");

    const response = await request(app)
      .post("/tiffin/subscriptions")
      .set("Authorization", `Bearer ${token}`)
      .send({ planId: plan.id, mealType: "lunch", delivery: validDelivery, paymentMethod: "cod" });

    expect(response.status).toBe(201);
    expect(response.body.subscription.planName).toBe("Weekly Veg Plan");
    expect(response.body.subscription.status).toBe("active");
    expect(response.body.subscription.subscriptionNumber).toMatch(/^GT-/);

    const meals = await request(app)
      .get(`/tiffin/subscriptions/${response.body.subscription.id}/meals`)
      .set("Authorization", `Bearer ${token}`);
    expect(meals.status).toBe(200);
    expect(meals.body.meals).toHaveLength(7);
    expect(meals.body.meals.every((meal: { status: string }) => meal.status === "scheduled")).toBe(true);
  });

  it("subscribes to a non-veg plan", async () => {
    const plan = await seedWeeklyNonVegPlan();
    const token = await signup("nonveg-sub@example.com", "9812400003");

    const response = await request(app)
      .post("/tiffin/subscriptions")
      .set("Authorization", `Bearer ${token}`)
      .send({ planId: plan.id, mealType: "dinner", delivery: validDelivery, paymentMethod: "cod" });

    expect(response.status).toBe(201);
    expect(response.body.subscription.dietType).toBe("non-veg");
    expect(response.body.subscription.mealTypes).toEqual(["dinner"]);
  });

  it("rejects a delivery address outside the supported city", async () => {
    const plan = await seedWeeklyVegPlan();
    const token = await signup("outofzone@example.com", "9812400004");

    const response = await request(app)
      .post("/tiffin/subscriptions")
      .set("Authorization", `Bearer ${token}`)
      .send({ planId: plan.id, mealType: "lunch", delivery: { ...validDelivery, city: "Mumbai" }, paymentMethod: "cod" });

    expect(response.status).toBe(400);
  });

  it("rejects subscribing to an inactive plan", async () => {
    const plan = await TiffinPlanModel.create({
      name: "Retired Plan",
      dietType: "veg",
      style: "single",
      durationDays: 7,
      price: 899,
      active: false,
    });
    const token = await signup("inactive-plan@example.com", "9812400005");

    const response = await request(app)
      .post("/tiffin/subscriptions")
      .set("Authorization", `Bearer ${token}`)
      .send({ planId: plan.id, mealType: "lunch", delivery: validDelivery, paymentMethod: "cod" });

    expect(response.status).toBe(400);
  });

  it("requires authentication", async () => {
    const plan = await seedWeeklyVegPlan();
    const response = await request(app)
      .post("/tiffin/subscriptions")
      .send({ planId: plan.id, mealType: "lunch", delivery: validDelivery, paymentMethod: "cod" });
    expect(response.status).toBe(401);
  });

  it("charges the discounted price, not the plan's listed price, when the plan carries a salePercent", async () => {
    const plan = await TiffinPlanModel.create({
      name: "Weekly Veg Plan — On Sale",
      dietType: "veg",
      style: "single",
      durationDays: 7,
      price: 1000,
      salePercent: 20,
      active: true,
    });
    const token = await signup("discounted-sub@example.com", "9812400006");

    const response = await request(app)
      .post("/tiffin/subscriptions")
      .set("Authorization", `Bearer ${token}`)
      .send({ planId: plan.id, mealType: "lunch", delivery: validDelivery, paymentMethod: "cod" });

    expect(response.status).toBe(201);
    // 1000 listed, 20% off — 800 actually charged and stored, not the raw 1000.
    expect(response.body.subscription.price).toBe(800);
  });
});
