import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { TiffinPlanModel } from "../../src/db/models/TiffinPlan.model.js";
import { clearTestDb, startTestDb, stopTestDb, testEnv } from "./testDb.js";

// Split into its own file (separate from tiffin.test.ts / tiffin.lifecycle.test.ts) so this
// file gets its own signup rate-limit budget (5 per 15min) — it only needs 2.
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

describe("plan style", () => {
  it("schedules both lunch and dinner every day for a twice-daily plan", async () => {
    const plan = await TiffinPlanModel.create({
      name: "Weekly Veg Plan — Twice Daily",
      dietType: "veg",
      style: "twice-daily",
      durationDays: 7,
      price: 1699,
      active: true,
    });
    const token = await signup("twice-daily@example.com", "9812400020");

    const response = await request(app)
      .post("/tiffin/subscriptions")
      .set("Authorization", `Bearer ${token}`)
      // mealType is irrelevant for a twice-daily plan — omitted deliberately.
      .send({ planId: plan.id, sundayVegChoice: "paneer", delivery: validDelivery, paymentMethod: "cod" });

    expect(response.status).toBe(201);
    expect(response.body.subscription.mealTypes).toEqual(["lunch", "dinner"]);

    const meals = await request(app)
      .get(`/tiffin/subscriptions/${response.body.subscription.id}/meals`)
      .set("Authorization", `Bearer ${token}`);
    // 7 days x 2 meals/day.
    expect(meals.body.meals).toHaveLength(14);
    const day1 = meals.body.meals.filter((meal: { date: string }) => meal.date === meals.body.meals[0].date);
    expect(day1.map((meal: { mealType: string }) => meal.mealType).sort()).toEqual(["dinner", "lunch"]);
    // Both meals that day share the same dish.
    expect(new Set(day1.map((meal: { dishName: string }) => meal.dishName)).size).toBe(1);
  });

  it("rejects subscribing to a single-style plan without choosing lunch or dinner", async () => {
    const plan = await TiffinPlanModel.create({
      name: "Weekly Veg Plan",
      dietType: "veg",
      style: "single",
      durationDays: 7,
      price: 899,
      active: true,
    });
    const token = await signup("no-mealtype@example.com", "9812400021");

    const response = await request(app)
      .post("/tiffin/subscriptions")
      .set("Authorization", `Bearer ${token}`)
      .send({ planId: plan.id, sundayVegChoice: "paneer", delivery: validDelivery });

    expect(response.status).toBe(400);
  });
});
