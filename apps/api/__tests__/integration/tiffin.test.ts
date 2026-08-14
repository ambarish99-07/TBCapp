import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { TiffinPlanModel } from "../../src/db/models/TiffinPlan.model.js";
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

async function signup(email: string, phone: string): Promise<string> {
  const response = await request(app)
    .post("/auth/signup")
    .send({ fullName: "Tiffin Tester", email, phone, password: "password123" });
  return response.body.token;
}

function seedWeeklyVegPlan() {
  return TiffinPlanModel.create({ name: "Weekly Veg Plan", dietType: "veg", mealType: "lunch", durationDays: 7, price: 899, active: true });
}

function seedWeeklyNonVegPlan() {
  return TiffinPlanModel.create({ name: "Weekly Non-Veg Plan", dietType: "non-veg", mealType: "lunch", durationDays: 7, price: 1399, active: true });
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
      .send({ planId: plan.id, sundayVegChoice: "chole", delivery: validDelivery });

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

  it("rejects subscribing to a veg plan without a Sunday paneer/chole choice", async () => {
    const plan = await seedWeeklyVegPlan();
    const token = await signup("veg-nochoice@example.com", "9812400002");

    const response = await request(app)
      .post("/tiffin/subscriptions")
      .set("Authorization", `Bearer ${token}`)
      .send({ planId: plan.id, delivery: validDelivery });

    expect(response.status).toBe(400);
  });

  it("subscribes to a non-veg plan with no Sunday choice needed", async () => {
    const plan = await seedWeeklyNonVegPlan();
    const token = await signup("nonveg-sub@example.com", "9812400003");

    const response = await request(app)
      .post("/tiffin/subscriptions")
      .set("Authorization", `Bearer ${token}`)
      .send({ planId: plan.id, delivery: validDelivery });

    expect(response.status).toBe(201);
    expect(response.body.subscription.dietType).toBe("non-veg");
  });

  it("rejects a delivery address outside the supported city", async () => {
    const plan = await seedWeeklyVegPlan();
    const token = await signup("outofzone@example.com", "9812400004");

    const response = await request(app)
      .post("/tiffin/subscriptions")
      .set("Authorization", `Bearer ${token}`)
      .send({ planId: plan.id, sundayVegChoice: "paneer", delivery: { ...validDelivery, city: "Mumbai" } });

    expect(response.status).toBe(400);
  });

  it("rejects subscribing to an inactive plan", async () => {
    const plan = await TiffinPlanModel.create({
      name: "Retired Plan",
      dietType: "veg",
      mealType: "lunch",
      durationDays: 7,
      price: 899,
      active: false,
    });
    const token = await signup("inactive-plan@example.com", "9812400005");

    const response = await request(app)
      .post("/tiffin/subscriptions")
      .set("Authorization", `Bearer ${token}`)
      .send({ planId: plan.id, sundayVegChoice: "paneer", delivery: validDelivery });

    expect(response.status).toBe(400);
  });

  it("requires authentication", async () => {
    const plan = await seedWeeklyVegPlan();
    const response = await request(app)
      .post("/tiffin/subscriptions")
      .send({ planId: plan.id, sundayVegChoice: "paneer", delivery: validDelivery });
    expect(response.status).toBe(401);
  });
});
