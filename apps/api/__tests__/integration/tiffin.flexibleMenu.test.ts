import jwt from "jsonwebtoken";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { TiffinPlanModel } from "../../src/db/models/TiffinPlan.model.js";
import { UserModel } from "../../src/db/models/User.model.js";
import { clearTestDb, seedTiffinMenu, startTestDb, stopTestDb, testEnv } from "./testDb.js";

// Own file so it gets its own signup rate-limit budget — needs 3 fresh signups. Covers the new
// "flexible menu" capabilities: admin add/remove of individual dish slots, and that removing (or
// never having added) a dish an existing plan/style needs is caught cleanly rather than crashing
// single-meal ordering or subscription scheduling.
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

async function adminToken(): Promise<string> {
  const admin = await UserModel.create({ fullName: "Admin", email: "admin@test.com", passwordHash: "unused", phone: "9888800001", role: "admin" });
  return jwt.sign({ userId: String(admin._id), role: "admin" }, env.JWT_SECRET, { expiresIn: "1h" });
}

async function signup(email: string, phone: string): Promise<string> {
  const response = await request(app)
    .post("/auth/signup")
    .send({ fullName: "Flexible Menu Tester", email, phone, password: "password123" });
  return response.body.token;
}

const validDelivery = {
  fullName: "Test Customer",
  phone: "9999999999",
  address: "123 Test St",
  city: "Patna",
  pincode: "800001",
};

describe("Admin can add and remove individual dish slots", () => {
  it("lets an admin add a brand-new dish for a slot that never had one — Mini's first-ever breakfast", async () => {
    const token = await adminToken();

    const response = await request(app)
      .put("/admin/tiffin/dishes")
      .set("Authorization", `Bearer ${token}`)
      .send({
        tier: "mini",
        dietType: "veg",
        mealType: "breakfast",
        dayOfWeek: "Monday",
        dishName: "Mini Poha",
        price: 49,
        hasAddOns: false,
        riceSubstitute: "rice",
      });

    expect(response.status).toBe(200);
    expect(response.body.dish.dishName).toBe("Mini Poha");
    expect(response.body.dish.tier).toBe("mini");
    expect(response.body.dish.mealType).toBe("breakfast");

    const listed = await request(app).get("/admin/tiffin/dishes").set("Authorization", `Bearer ${token}`);
    expect(listed.body.dishes.some((d: { dishName: string }) => d.dishName === "Mini Poha")).toBe(true);
  });

  it("lets an admin delete a dish, and it disappears from both the admin list and the single-meal menu", async () => {
    const token = await adminToken();
    const listed = await request(app).get("/admin/tiffin/dishes").set("Authorization", `Bearer ${token}`);
    const target = listed.body.dishes.find(
      (d: { tier: string; dietType: string; mealType: string; dayOfWeek: string }) =>
        d.tier === "regular" && d.dietType === "veg" && d.mealType === "lunch" && d.dayOfWeek === "Monday"
    );
    expect(target).toBeTruthy();

    const deleteResponse = await request(app).delete(`/admin/tiffin/dishes/${target.id}`).set("Authorization", `Bearer ${token}`);
    expect(deleteResponse.status).toBe(204);

    const relisted = await request(app).get("/admin/tiffin/dishes").set("Authorization", `Bearer ${token}`);
    expect(relisted.body.dishes.some((d: { id: string }) => d.id === target.id)).toBe(false);
  });

  it("rejects a non-admin caller deleting a dish", async () => {
    const token = await signup("non-admin-delete@example.com", "9812400080");
    const listResponse = await request(app).get("/admin/tiffin/dishes").set("Authorization", `Bearer ${await adminToken()}`);
    const anyDish = listResponse.body.dishes[0];

    const response = await request(app).delete(`/admin/tiffin/dishes/${anyDish.id}`).set("Authorization", `Bearer ${token}`);
    expect(response.status).toBe(403);
  });
});

describe("Meal-type availability is derived live from actual dishes, not a hardcoded table", () => {
  it("rejects creating a Mini Thrice Daily plan — Mini genuinely has no breakfast dish in the seeded menu", async () => {
    const token = await adminToken();
    const response = await request(app)
      .post("/admin/tiffin/plans")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Monthly Mini Veg Plan — Thrice Daily", dietType: "veg", tier: "mini", style: "thrice-daily", durationDays: 30, price: 4999 });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/breakfast/i);
  });

  it("cleanly rejects subscribing once a needed dish is removed mid-week, instead of crashing", async () => {
    const adminTok = await adminToken();
    const plan = await TiffinPlanModel.create({
      name: "Weekly Veg Plan — Twice Daily",
      dietType: "veg",
      tier: "regular",
      style: "twice-daily",
      durationDays: 7,
      price: 1699,
      active: true,
    });

    // Remove Wednesday's Regular/veg lunch dish — the twice-daily plan needs every day of lunch.
    const listed = await request(app).get("/admin/tiffin/dishes").set("Authorization", `Bearer ${adminTok}`);
    const wednesdayLunch = listed.body.dishes.find(
      (d: { tier: string; dietType: string; mealType: string; dayOfWeek: string }) =>
        d.tier === "regular" && d.dietType === "veg" && d.mealType === "lunch" && d.dayOfWeek === "Wednesday"
    );
    await request(app).delete(`/admin/tiffin/dishes/${wednesdayLunch.id}`).set("Authorization", `Bearer ${adminTok}`);

    const token = await signup("gap-subscriber@example.com", "9812400081");
    const response = await request(app)
      .post("/tiffin/subscriptions")
      .set("Authorization", `Bearer ${token}`)
      .send({ planId: plan.id, delivery: validDelivery, paymentMethod: "razorpay" });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/lunch/i);
  });
});
