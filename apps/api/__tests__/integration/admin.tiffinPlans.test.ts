import jwt from "jsonwebtoken";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { UserModel } from "../../src/db/models/User.model.js";
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

async function adminToken(): Promise<string> {
  const admin = await UserModel.create({ fullName: "Admin", email: "admin@test.com", passwordHash: "unused", role: "admin" });
  return jwt.sign({ userId: String(admin._id), role: "admin" }, env.JWT_SECRET, { expiresIn: "1h" });
}

const weeklyPlan = { name: "Weekly Veg Plan", dietType: "veg", style: "single", durationDays: 7, price: 899 };
const monthlyPlan = { name: "Monthly Veg Plan", dietType: "veg", style: "single", durationDays: 30, price: 3499 };

describe("Admin tiffin plan discounts (monthly-only)", () => {
  it("rejects a non-admin caller", async () => {
    const customer = await UserModel.create({ fullName: "Customer", passwordHash: "x", role: "customer" });
    const token = jwt.sign({ userId: String(customer._id), role: "customer" }, env.JWT_SECRET, { expiresIn: "1h" });
    const response = await request(app).post("/admin/tiffin/plans").set("Authorization", `Bearer ${token}`).send(monthlyPlan);
    expect(response.status).toBe(403);
  });

  it("creates a weekly plan with no discount fine, and lets it be edited (price) without ever touching salePercent", async () => {
    const token = await adminToken();
    const authHeader = `Bearer ${token}`;
    const created = await request(app).post("/admin/tiffin/plans").set("Authorization", authHeader).send(weeklyPlan);
    expect(created.status).toBe(201);
    expect(created.body.plan.salePercent).toBeUndefined();
  });

  it("rejects creating a weekly (non-monthly) plan with a discount", async () => {
    const token = await adminToken();
    const response = await request(app)
      .post("/admin/tiffin/plans")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...weeklyPlan, salePercent: 20 });
    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/monthly/i);
  });

  it("allows creating a monthly plan with a discount", async () => {
    const token = await adminToken();
    const response = await request(app)
      .post("/admin/tiffin/plans")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...monthlyPlan, salePercent: 20 });
    expect(response.status).toBe(201);
    expect(response.body.plan.salePercent).toBe(20);
  });

  it("rejects setting a discount on an already-created weekly plan via update", async () => {
    const token = await adminToken();
    const authHeader = `Bearer ${token}`;
    const created = await request(app).post("/admin/tiffin/plans").set("Authorization", authHeader).send(weeklyPlan);

    const response = await request(app)
      .put(`/admin/tiffin/plans/${created.body.plan.id}`)
      .set("Authorization", authHeader)
      .send({ salePercent: 15 });
    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/monthly/i);
  });

  it("allows setting, changing, and clearing a discount on an already-created monthly plan via update", async () => {
    const token = await adminToken();
    const authHeader = `Bearer ${token}`;
    const created = await request(app).post("/admin/tiffin/plans").set("Authorization", authHeader).send(monthlyPlan);
    const id = created.body.plan.id;

    const withDiscount = await request(app).put(`/admin/tiffin/plans/${id}`).set("Authorization", authHeader).send({ salePercent: 25 });
    expect(withDiscount.status).toBe(200);
    expect(withDiscount.body.plan.salePercent).toBe(25);

    const changed = await request(app).put(`/admin/tiffin/plans/${id}`).set("Authorization", authHeader).send({ salePercent: 40 });
    expect(changed.status).toBe(200);
    expect(changed.body.plan.salePercent).toBe(40);

    // Explicit null clears it back to "no discount" — omitting the field (as a real client's
    // JSON.stringify would for `undefined`) must NOT clear it.
    const untouched = await request(app).put(`/admin/tiffin/plans/${id}`).set("Authorization", authHeader).send({ price: 3499 });
    expect(untouched.body.plan.salePercent).toBe(40);

    const cleared = await request(app).put(`/admin/tiffin/plans/${id}`).set("Authorization", authHeader).send({ salePercent: null });
    expect(cleared.status).toBe(200);
    expect(cleared.body.plan.salePercent).toBeUndefined();
  });
});
