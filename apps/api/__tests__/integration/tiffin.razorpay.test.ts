import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { TiffinPlanModel } from "../../src/db/models/TiffinPlan.model.js";
import { clearTestDb, startTestDb, stopTestDb, testEnv } from "./testDb.js";

// Own file so it gets its own signup rate-limit budget — needs 4 fresh signups.
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

const validDelivery = {
  fullName: "Test Customer",
  phone: "9999999999",
  address: "123 Test St",
  city: "Patna",
  pincode: "800001",
};

describe("Tiffin Razorpay endpoints", () => {
  it("rejects creating a Razorpay order for a subscription that's paying by COD", async () => {
    const plan = await TiffinPlanModel.create({ name: "Weekly Veg Plan", dietType: "veg", style: "single", durationDays: 7, price: 899, active: true });
    const token = await signup("cod-subscriber@example.com", "9812400030");

    const subscribeResponse = await request(app)
      .post("/tiffin/subscriptions")
      .set("Authorization", `Bearer ${token}`)
      .send({ planId: plan.id, mealType: "lunch", sundayVegChoice: "paneer", delivery: validDelivery, paymentMethod: "cod" });

    const response = await request(app)
      .post(`/tiffin/subscriptions/${subscribeResponse.body.subscription.id}/razorpay-order`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(400);
  });

  it("rejects creating a Razorpay order for a subscription the caller doesn't own", async () => {
    const plan = await TiffinPlanModel.create({ name: "Weekly Veg Plan", dietType: "veg", style: "single", durationDays: 7, price: 899, active: true });
    const ownerToken = await signup("owner@example.com", "9812400031");
    const otherToken = await signup("other@example.com", "9812400032");

    const subscribeResponse = await request(app)
      .post("/tiffin/subscriptions")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ planId: plan.id, mealType: "lunch", sundayVegChoice: "paneer", delivery: validDelivery, paymentMethod: "razorpay" });

    const response = await request(app)
      .post(`/tiffin/subscriptions/${subscribeResponse.body.subscription.id}/razorpay-order`)
      .set("Authorization", `Bearer ${otherToken}`);

    expect(response.status).toBe(400);
  });

  it("rejects Cash on Delivery for a monthly plan", async () => {
    const plan = await TiffinPlanModel.create({ name: "Monthly Veg Plan", dietType: "veg", style: "single", durationDays: 30, price: 3199, active: true });
    const token = await signup("monthly-cod@example.com", "9812400033");

    const response = await request(app)
      .post("/tiffin/subscriptions")
      .set("Authorization", `Bearer ${token}`)
      .send({ planId: plan.id, mealType: "lunch", sundayVegChoice: "paneer", delivery: validDelivery, paymentMethod: "cod" });

    expect(response.status).toBe(400);
  });

  it("allows Razorpay for a monthly plan", async () => {
    const plan = await TiffinPlanModel.create({ name: "Monthly Veg Plan", dietType: "veg", style: "single", durationDays: 30, price: 3199, active: true });
    const token = await signup("monthly-razorpay@example.com", "9812400034");

    const response = await request(app)
      .post("/tiffin/subscriptions")
      .set("Authorization", `Bearer ${token}`)
      .send({ planId: plan.id, mealType: "lunch", sundayVegChoice: "paneer", delivery: validDelivery, paymentMethod: "razorpay" });

    expect(response.status).toBe(201);
  });
});
