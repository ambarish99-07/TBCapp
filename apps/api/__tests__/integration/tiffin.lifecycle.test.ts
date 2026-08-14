import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { TiffinPlanModel } from "../../src/db/models/TiffinPlan.model.js";
import { clearTestDb, startTestDb, stopTestDb, testEnv } from "./testDb.js";

// Split into its own file (separate from tiffin.test.ts) so each file gets its own signup
// rate-limit budget (5 per 15min) — this file alone needs 5 fresh signups.
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

async function subscribeToWeeklyVeg(token: string) {
  const plan = await TiffinPlanModel.create({ name: "Weekly Veg Plan", dietType: "veg", style: "single", durationDays: 7, price: 899, active: true });
  const response = await request(app)
    .post("/tiffin/subscriptions")
    .set("Authorization", `Bearer ${token}`)
    .send({ planId: plan.id, mealType: "lunch", sundayVegChoice: "paneer", delivery: validDelivery, paymentMethod: "cod" });
  const meals = await request(app)
    .get(`/tiffin/subscriptions/${response.body.subscription.id}/meals`)
    .set("Authorization", `Bearer ${token}`);
  return { subscription: response.body.subscription, meals: meals.body.meals as { id: string; date: string; status: string }[] };
}

describe("skip / pause / resume", () => {
  it("skips a far-enough-in-advance future meal", async () => {
    const token = await signup("skip-ok@example.com", "9812400010");
    const { subscription, meals } = await subscribeToWeeklyVeg(token);
    // Day index 3 is always well over the 12h deadline, regardless of what time of day the test runs.
    const target = meals[3];

    const response = await request(app)
      .post(`/tiffin/subscriptions/${subscription.id}/meals/${target.id}/skip`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.meal.status).toBe("skipped");
  });

  it("restores a skipped meal back to scheduled — a change of mind before the deadline", async () => {
    const token = await signup("unskip-ok@example.com", "9812400014");
    const { subscription, meals } = await subscribeToWeeklyVeg(token);
    const target = meals[3];
    await request(app)
      .post(`/tiffin/subscriptions/${subscription.id}/meals/${target.id}/skip`)
      .set("Authorization", `Bearer ${token}`);

    const response = await request(app)
      .post(`/tiffin/subscriptions/${subscription.id}/meals/${target.id}/unskip`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.meal.status).toBe("scheduled");
  });

  it("rejects skipping today's meal — inside the skip deadline", async () => {
    const token = await signup("skip-late@example.com", "9812400011");
    const { subscription, meals } = await subscribeToWeeklyVeg(token);
    const today = meals[0];

    const response = await request(app)
      .post(`/tiffin/subscriptions/${subscription.id}/meals/${today.id}/skip`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(400);
  });

  it("pauses a range of future meals, extends the subscription, then resumes without losing or duplicating meals", async () => {
    const token = await signup("pause-resume@example.com", "9812400012");
    const { subscription, meals } = await subscribeToWeeklyVeg(token);
    const pauseFrom = meals[3].date;
    const pauseUntil = meals[4].date;

    const pauseResponse = await request(app)
      .post(`/tiffin/subscriptions/${subscription.id}/pause`)
      .set("Authorization", `Bearer ${token}`)
      .send({ from: pauseFrom, until: pauseUntil });

    expect(pauseResponse.status).toBe(200);
    expect(pauseResponse.body.subscription.status).toBe("paused");
    expect(pauseResponse.body.subscription.endDate > subscription.endDate).toBe(true);

    const afterPauseMeals = await request(app)
      .get(`/tiffin/subscriptions/${subscription.id}/meals`)
      .set("Authorization", `Bearer ${token}`);
    // Original 7 + 2 extension days for the 2 paused days = 9, none lost.
    expect(afterPauseMeals.body.meals).toHaveLength(9);
    const pausedMeals = afterPauseMeals.body.meals.filter((meal: { date: string }) => meal.date === pauseFrom || meal.date === pauseUntil);
    expect(pausedMeals.every((meal: { status: string }) => meal.status === "skipped")).toBe(true);

    const resumeResponse = await request(app)
      .post(`/tiffin/subscriptions/${subscription.id}/resume`)
      .set("Authorization", `Bearer ${token}`);
    expect(resumeResponse.status).toBe(200);
    expect(resumeResponse.body.subscription.status).toBe("active");

    const afterResumeMeals = await request(app)
      .get(`/tiffin/subscriptions/${subscription.id}/meals`)
      .set("Authorization", `Bearer ${token}`);
    expect(afterResumeMeals.body.meals).toHaveLength(9);
    const restoredMeals = afterResumeMeals.body.meals.filter((meal: { date: string }) => meal.date === pauseFrom || meal.date === pauseUntil);
    expect(restoredMeals.every((meal: { status: string }) => meal.status === "scheduled")).toBe(true);
  });

  it("rejects pausing a subscription that isn't active", async () => {
    const token = await signup("double-pause@example.com", "9812400013");
    const { subscription, meals } = await subscribeToWeeklyVeg(token);
    await request(app)
      .post(`/tiffin/subscriptions/${subscription.id}/pause`)
      .set("Authorization", `Bearer ${token}`)
      .send({ from: meals[3].date, until: meals[4].date });

    const secondPause = await request(app)
      .post(`/tiffin/subscriptions/${subscription.id}/pause`)
      .set("Authorization", `Bearer ${token}`)
      .send({ from: meals[3].date, until: meals[4].date });

    expect(secondPause.status).toBe(400);
  });
});
