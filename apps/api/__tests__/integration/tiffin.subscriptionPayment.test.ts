import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { TiffinPlanModel } from "../../src/db/models/TiffinPlan.model.js";
import { clearTestDb, seedTiffinMenu, startTestDb, stopTestDb, testEnv } from "./testDb.js";

// Own file so it gets its own signup rate-limit budget — needs 4 fresh signups. GG Tiffin
// subscriptions are razorpay-only, weekly and monthly alike (see
// tiffin.service.ts#createSubscription) — this covers both durations for both outcomes.
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
    .send({ fullName: "Tiffin Tester", email, phone, password: "password123" });
  return response.body.token;
}

const validDelivery = {
  fullName: "Test Customer",
  phone: "9999999999",
  address: "123 Test St",
  city: "Patna",
  pincode: "800001",
};

describe("GG Tiffin subscriptions are razorpay-only", () => {
  it("rejects Cash on Delivery for a weekly plan", async () => {
    const plan = await TiffinPlanModel.create({ name: "Weekly Veg Plan", dietType: "veg", style: "single", durationDays: 7, price: 899, active: true });
    const token = await signup("weekly-cod@example.com", "9812400040");

    const response = await request(app)
      .post("/tiffin/subscriptions")
      .set("Authorization", `Bearer ${token}`)
      .send({ planId: plan.id, mealType: "lunch", delivery: validDelivery, paymentMethod: "cod" });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/cash on delivery/i);
  });

  it("rejects Cash on Delivery for a monthly plan", async () => {
    const plan = await TiffinPlanModel.create({ name: "Monthly Veg Plan", dietType: "veg", style: "single", durationDays: 30, price: 3199, active: true });
    const token = await signup("monthly-cod@example.com", "9812400041");

    const response = await request(app)
      .post("/tiffin/subscriptions")
      .set("Authorization", `Bearer ${token}`)
      .send({ planId: plan.id, mealType: "lunch", delivery: validDelivery, paymentMethod: "cod" });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/cash on delivery/i);
  });

  it("allows Razorpay for a weekly plan", async () => {
    const plan = await TiffinPlanModel.create({ name: "Weekly Veg Plan", dietType: "veg", style: "single", durationDays: 7, price: 899, active: true });
    const token = await signup("weekly-razorpay@example.com", "9812400042");

    const response = await request(app)
      .post("/tiffin/subscriptions")
      .set("Authorization", `Bearer ${token}`)
      .send({ planId: plan.id, mealType: "lunch", delivery: validDelivery, paymentMethod: "razorpay" });

    expect(response.status).toBe(201);
  });

  it("allows Razorpay for a monthly plan", async () => {
    const plan = await TiffinPlanModel.create({ name: "Monthly Veg Plan", dietType: "veg", style: "single", durationDays: 30, price: 3199, active: true });
    const token = await signup("monthly-razorpay@example.com", "9812400043");

    const response = await request(app)
      .post("/tiffin/subscriptions")
      .set("Authorization", `Bearer ${token}`)
      .send({ planId: plan.id, mealType: "lunch", delivery: validDelivery, paymentMethod: "razorpay" });

    expect(response.status).toBe(201);
  });
});
