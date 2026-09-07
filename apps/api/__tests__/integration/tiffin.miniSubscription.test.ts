import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { TiffinPlanModel } from "../../src/db/models/TiffinPlan.model.js";
import { UserModel } from "../../src/db/models/User.model.js";
import jwt from "jsonwebtoken";
import { clearTestDb, seedTiffinMenu, startTestDb, stopTestDb, testEnv } from "./testDb.js";

// Own file (separate signup rate-limit budget) — Mini has no breakfast dish configured anywhere
// in the system, so subscribing to it needs its own set of guardrails distinct from Regular's.
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
    .send({ fullName: "Mini Plan Tester", email, phone, password: "password123" });
  return response.body.token;
}

async function adminToken(): Promise<string> {
  const admin = await UserModel.create({ fullName: "Admin", email: "admin@test.com", passwordHash: "unused", phone: "9888888899", role: "admin" });
  return jwt.sign({ userId: String(admin._id), role: "admin" }, env.JWT_SECRET, { expiresIn: "1h" });
}

const validDelivery = {
  fullName: "Test Customer",
  phone: "9999999999",
  address: "123 Test St",
  city: "Patna",
  pincode: "800001",
};

describe("Mini-tier subscriptions", () => {
  it("subscribes to a Mini twice-daily plan and schedules lunch + dinner every day, tagged with the Mini tier", async () => {
    const plan = await TiffinPlanModel.create({
      name: "Weekly Mini Veg Plan — Twice Daily",
      dietType: "veg",
      tier: "mini",
      style: "twice-daily",
      durationDays: 7,
      price: 1199,
      active: true,
    });
    const token = await signup("mini-twice-daily@example.com", "9812400060");

    const response = await request(app)
      .post("/tiffin/subscriptions")
      .set("Authorization", `Bearer ${token}`)
      .send({ planId: plan.id, delivery: validDelivery, paymentMethod: "razorpay" });

    expect(response.status).toBe(201);
    expect(response.body.subscription.tier).toBe("mini");
    expect(response.body.subscription.mealTypes).toEqual(["lunch", "dinner"]);

    const meals = await request(app)
      .get(`/tiffin/subscriptions/${response.body.subscription.id}/meals`)
      .set("Authorization", `Bearer ${token}`);
    expect(meals.body.meals).toHaveLength(14);
    expect(meals.body.meals.every((meal: { mealType: string }) => meal.mealType === "lunch" || meal.mealType === "dinner")).toBe(true);
  });

  it("lets a Mini single-style plan choose lunch or dinner", async () => {
    const plan = await TiffinPlanModel.create({
      name: "Weekly Mini Veg Plan",
      dietType: "veg",
      tier: "mini",
      style: "single",
      durationDays: 7,
      price: 699,
      active: true,
    });
    const token = await signup("mini-single-lunch@example.com", "9812400061");

    const response = await request(app)
      .post("/tiffin/subscriptions")
      .set("Authorization", `Bearer ${token}`)
      .send({ planId: plan.id, mealType: "lunch", delivery: validDelivery, paymentMethod: "razorpay" });

    expect(response.status).toBe(201);
    expect(response.body.subscription.mealTypes).toEqual(["lunch"]);
  });

  it("rejects subscribing to a Mini single-style plan with breakfast — Mini has no breakfast dish", async () => {
    const plan = await TiffinPlanModel.create({
      name: "Weekly Mini Veg Plan",
      dietType: "veg",
      tier: "mini",
      style: "single",
      durationDays: 7,
      price: 699,
      active: true,
    });
    const token = await signup("mini-single-breakfast@example.com", "9812400062");

    const response = await request(app)
      .post("/tiffin/subscriptions")
      .set("Authorization", `Bearer ${token}`)
      .send({ planId: plan.id, mealType: "breakfast", delivery: validDelivery, paymentMethod: "razorpay" });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/breakfast/i);
  });

  it("rejects creating a Mini thrice-daily plan via the admin panel — Mini has no breakfast dish", async () => {
    const token = await adminToken();
    const response = await request(app)
      .post("/admin/tiffin/plans")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Monthly Mini Veg Plan — Thrice Daily", dietType: "veg", tier: "mini", style: "thrice-daily", durationDays: 30, price: 4999 });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/breakfast/i);
  });

  it("rejects updating an existing Mini plan to thrice-daily via the admin panel", async () => {
    const token = await adminToken();
    const created = await request(app)
      .post("/admin/tiffin/plans")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Monthly Mini Veg Plan — Twice Daily", dietType: "veg", tier: "mini", style: "twice-daily", durationDays: 30, price: 4999 });
    expect(created.status).toBe(201);

    const response = await request(app)
      .put(`/admin/tiffin/plans/${created.body.plan.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ style: "thrice-daily" });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/breakfast/i);
  });

  it("defaults an existing plan created with no tier field to Regular", async () => {
    const token = await adminToken();
    const response = await request(app)
      .post("/admin/tiffin/plans")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Weekly Veg Plan", dietType: "veg", style: "single", durationDays: 7, price: 899 });

    expect(response.status).toBe(201);
    expect(response.body.plan.tier).toBe("regular");
  });
});
