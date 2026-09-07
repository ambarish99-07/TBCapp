import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { TiffinPlanModel } from "../../src/db/models/TiffinPlan.model.js";
import { TiffinSubscriptionModel } from "../../src/db/models/TiffinSubscription.model.js";
import { clearTestDb, seedTiffinMenu, startTestDb, stopTestDb, testEnv } from "./testDb.js";

// Own file so it gets its own signup rate-limit budget — needs 3 fresh signups. The
// COD/weekly/monthly acceptance-and-rejection cases live in tiffin.subscriptionPayment.test.ts
// instead, for the same reason (keeping each file's signup count comfortably under the 5/15min cap).
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

async function signup(email: string, phone: string): Promise<{ userId: string; token: string }> {
  const response = await request(app)
    .post("/auth/signup")
    .send({ fullName: "Tiffin Tester", email, phone, password: "password123" });
  return { userId: response.body.user.id, token: response.body.token };
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
    // Subscriptions are razorpay-only end to end now (see tiffin.service.ts#createSubscription),
    // so a COD subscription can no longer be reached through the real API — write one directly,
    // same idea premiumMembership.test.ts uses for states Razorpay-only endpoints make unreachable
    // through HTTP without real Razorpay keys, just to exercise the razorpay-order endpoint's own
    // guard against a non-razorpay subscription.
    const plan = await TiffinPlanModel.create({ name: "Weekly Veg Plan", dietType: "veg", style: "single", durationDays: 7, price: 899, active: true });
    const { userId, token } = await signup("cod-subscriber@example.com", "9812400030");
    const subscription = await TiffinSubscriptionModel.create({
      subscriptionNumber: "GT-TEST-COD01",
      userId,
      planId: plan._id,
      planName: plan.name,
      dietType: "veg",
      tier: "regular",
      style: "single",
      mealTypes: ["lunch"],
      durationDays: 7,
      startDate: "2026-09-08",
      endDate: "2026-09-14",
      delivery: validDelivery,
      price: 899,
      payment: { method: "cod", status: "pending" },
    });

    const response = await request(app)
      .post(`/tiffin/subscriptions/${subscription.id}/razorpay-order`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(400);
  });

  it("rejects creating a Razorpay order for a subscription the caller doesn't own", async () => {
    const plan = await TiffinPlanModel.create({ name: "Weekly Veg Plan", dietType: "veg", style: "single", durationDays: 7, price: 899, active: true });
    const owner = await signup("owner@example.com", "9812400031");
    const other = await signup("other@example.com", "9812400032");

    const subscribeResponse = await request(app)
      .post("/tiffin/subscriptions")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ planId: plan.id, mealType: "lunch", sundayVegChoice: "paneer", delivery: validDelivery, paymentMethod: "razorpay" });

    const response = await request(app)
      .post(`/tiffin/subscriptions/${subscribeResponse.body.subscription.id}/razorpay-order`)
      .set("Authorization", `Bearer ${other.token}`);

    expect(response.status).toBe(400);
  });
});
