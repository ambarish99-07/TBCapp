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

const validCoupon = { code: "welcome50", type: "flat", value: 50, minOrderAmount: 200, isActive: true };

describe("Admin coupon management", () => {
  it("rejects a non-admin caller", async () => {
    const customer = await UserModel.create({ fullName: "Customer", passwordHash: "x", role: "customer" });
    const token = jwt.sign({ userId: String(customer._id), role: "customer" }, env.JWT_SECRET, { expiresIn: "1h" });
    const response = await request(app).get("/admin/coupons").set("Authorization", `Bearer ${token}`);
    expect(response.status).toBe(403);
  });

  it("creates a coupon, uppercasing the code, then lists it", async () => {
    const token = await adminToken();
    const authHeader = `Bearer ${token}`;

    const created = await request(app).post("/admin/coupons").set("Authorization", authHeader).send(validCoupon);
    expect(created.status).toBe(201);
    expect(created.body.coupon.code).toBe("WELCOME50");
    expect(created.body.coupon.isActive).toBe(true);

    const list = await request(app).get("/admin/coupons").set("Authorization", authHeader);
    expect(list.status).toBe(200);
    expect(list.body.coupons).toHaveLength(1);
  });

  it("rejects creating a second coupon with the same code (case-insensitively)", async () => {
    const token = await adminToken();
    const authHeader = `Bearer ${token}`;
    await request(app).post("/admin/coupons").set("Authorization", authHeader).send(validCoupon);

    const duplicate = await request(app)
      .post("/admin/coupons")
      .set("Authorization", authHeader)
      .send({ ...validCoupon, code: "Welcome50" });
    expect(duplicate.status).toBe(400);
  });

  it("updates a coupon (e.g. deactivating it) and deletes it", async () => {
    const token = await adminToken();
    const authHeader = `Bearer ${token}`;
    const created = await request(app).post("/admin/coupons").set("Authorization", authHeader).send(validCoupon);
    const id = created.body.coupon.id;

    const updated = await request(app).put(`/admin/coupons/${id}`).set("Authorization", authHeader).send({ isActive: false, value: 75 });
    expect(updated.status).toBe(200);
    expect(updated.body.coupon.isActive).toBe(false);
    expect(updated.body.coupon.value).toBe(75);

    const deleted = await request(app).delete(`/admin/coupons/${id}`).set("Authorization", authHeader);
    expect(deleted.status).toBe(204);

    const list = await request(app).get("/admin/coupons").set("Authorization", authHeader);
    expect(list.body.coupons).toHaveLength(0);
  });

  it("rejects an invalid payload", async () => {
    const token = await adminToken();
    const response = await request(app).post("/admin/coupons").set("Authorization", `Bearer ${token}`).send({ code: "X" });
    expect(response.status).toBe(400);
  });
});
