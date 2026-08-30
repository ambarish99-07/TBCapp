import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { TiffinPlanModel } from "../../src/db/models/TiffinPlan.model.js";
import { TiffinSubscriptionModel } from "../../src/db/models/TiffinSubscription.model.js";
import { clearTestDb, seedTiffinMenu, startTestDb, stopTestDb, testEnv } from "./testDb.js";

// Own file so it gets its own signup rate-limit budget — needs 4 fresh signups.
const env = testEnv();
const app = createApp(env);

beforeAll(async () => {
  await startTestDb();
});

// Subscribing generates scheduled meals, which now resolve their dish from the DB instead of a
// hardcoded table — every test here needs the real menu seeded.
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

describe("Subscription cancellation", () => {
  it("rejects cancelling a weekly plan", async () => {
    const plan = await TiffinPlanModel.create({ name: "Weekly Veg Plan", dietType: "veg", style: "single", durationDays: 7, price: 899, active: true });
    const token = await signup("weekly-cancel@example.com", "9812400040");

    const subscribeResponse = await request(app)
      .post("/tiffin/subscriptions")
      .set("Authorization", `Bearer ${token}`)
      .send({ planId: plan.id, mealType: "lunch", sundayVegChoice: "paneer", delivery: validDelivery, paymentMethod: "cod" });

    const response = await request(app)
      .post(`/tiffin/subscriptions/${subscribeResponse.body.subscription.id}/cancel`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(400);
  });

  it("refunds 50% cancelling a paid monthly plan within the 15-day window", async () => {
    const plan = await TiffinPlanModel.create({ name: "Monthly Veg Plan", dietType: "veg", style: "single", durationDays: 30, price: 3000, active: true });
    const token = await signup("monthly-early-cancel@example.com", "9812400041");

    const subscribeResponse = await request(app)
      .post("/tiffin/subscriptions")
      .set("Authorization", `Bearer ${token}`)
      .send({ planId: plan.id, mealType: "lunch", sundayVegChoice: "paneer", delivery: validDelivery, paymentMethod: "razorpay" });
    const subscriptionId = subscribeResponse.body.subscription.id;

    // Simulate a completed Razorpay payment directly — actually creating the Razorpay order
    // requires live network credentials this test environment doesn't have (see tiffin.razorpay.test.ts).
    await TiffinSubscriptionModel.findByIdAndUpdate(subscriptionId, { "payment.status": "paid" });

    const response = await request(app)
      .post(`/tiffin/subscriptions/${subscriptionId}/cancel`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.subscription.status).toBe("cancelled");
    expect(response.body.subscription.payment.status).toBe("refunded");
    expect(response.body.subscription.payment.refundAmount).toBe(1500);
  });

  it("refunds nothing cancelling a paid monthly plan after the 15-day window", async () => {
    const plan = await TiffinPlanModel.create({ name: "Monthly Veg Plan", dietType: "veg", style: "single", durationDays: 30, price: 3000, active: true });
    const token = await signup("monthly-late-cancel@example.com", "9812400042");

    const subscribeResponse = await request(app)
      .post("/tiffin/subscriptions")
      .set("Authorization", `Bearer ${token}`)
      .send({ planId: plan.id, mealType: "lunch", sundayVegChoice: "paneer", delivery: validDelivery, paymentMethod: "razorpay" });
    const subscriptionId = subscribeResponse.body.subscription.id;

    // Backdate the start date so >= 15 days have "elapsed" since it began — subscribing and
    // waiting 15 real days isn't practical in a test.
    const backdated = new Date();
    backdated.setUTCDate(backdated.getUTCDate() - 16);
    await TiffinSubscriptionModel.findByIdAndUpdate(subscriptionId, {
      "payment.status": "paid",
      startDate: backdated.toISOString().slice(0, 10),
    });

    const response = await request(app)
      .post(`/tiffin/subscriptions/${subscriptionId}/cancel`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.subscription.status).toBe("cancelled");
    expect(response.body.subscription.payment.status).toBe("paid");
    expect(response.body.subscription.payment.refundAmount).toBeUndefined();
  });

  it("rejects cancelling an already-cancelled subscription", async () => {
    const plan = await TiffinPlanModel.create({ name: "Monthly Veg Plan", dietType: "veg", style: "single", durationDays: 30, price: 3000, active: true });
    const token = await signup("monthly-double-cancel@example.com", "9812400043");

    const subscribeResponse = await request(app)
      .post("/tiffin/subscriptions")
      .set("Authorization", `Bearer ${token}`)
      .send({ planId: plan.id, mealType: "lunch", sundayVegChoice: "paneer", delivery: validDelivery, paymentMethod: "razorpay" });
    const subscriptionId = subscribeResponse.body.subscription.id;

    await request(app).post(`/tiffin/subscriptions/${subscriptionId}/cancel`).set("Authorization", `Bearer ${token}`);
    const response = await request(app).post(`/tiffin/subscriptions/${subscriptionId}/cancel`).set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(400);
  });
});
