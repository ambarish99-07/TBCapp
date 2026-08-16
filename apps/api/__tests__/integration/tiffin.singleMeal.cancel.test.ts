import jwt from "jsonwebtoken";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { TiffinSingleMealOrderModel } from "../../src/db/models/TiffinSingleMealOrder.model.js";
import { UserModel } from "../../src/db/models/User.model.js";
import { clearTestDb, startTestDb, stopTestDb, testEnv } from "./testDb.js";

// Orders and users are created directly against the models here (same pattern as
// admin.orders.test.ts's adminToken()) instead of going through /auth/signup — this needs
// precise control over payment.status and createdAt (to simulate "already paid" and "placed
// 20 minutes ago") that the real order-creation flow can't give us, and it sidesteps the
// signup rate limiter entirely since none of that is under test here.
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

let phoneCounter = 0;

async function userToken(email: string): Promise<{ userId: string; token: string }> {
  phoneCounter += 1;
  const phone = `98${String(phoneCounter).padStart(8, "0")}`;
  const user = await UserModel.create({ fullName: "Cancel Tester", email, passwordHash: "unused", phone });
  const userId = String(user._id);
  return { userId, token: jwt.sign({ userId }, env.JWT_SECRET, { expiresIn: "1h" }) };
}

async function adminToken(): Promise<string> {
  const admin = await UserModel.create({ fullName: "Admin", email: "admin@test.com", passwordHash: "unused", phone: "9888888888", role: "admin" });
  return jwt.sign({ userId: String(admin._id), role: "admin" }, env.JWT_SECRET, { expiresIn: "1h" });
}

const validDelivery = {
  fullName: "Test Customer",
  phone: "9999999999",
  address: "123 Test St",
  city: "Patna",
  pincode: "800001",
};

async function createOrder(userId: string, overrides: Record<string, unknown> = {}) {
  return TiffinSingleMealOrderModel.create({
    orderNumber: `GTM-TEST-${Math.random().toString(36).slice(2, 8)}`,
    userId,
    tier: "regular",
    mealType: "lunch",
    dietType: "veg",
    date: "2026-08-17",
    dishName: "Aloo Matar",
    addOns: [],
    status: "placed",
    statusHistory: [{ status: "placed", at: new Date().toISOString() }],
    delivery: validDelivery,
    price: 129,
    quantity: 1,
    payment: { method: "razorpay", status: "pending" },
    ...overrides,
  });
}

describe("POST /tiffin/single-meal/orders/:id/cancel", () => {
  it("refunds in full when cancelled within the window, for an order already paid via Razorpay", async () => {
    const { userId, token } = await userToken("cancel-instant@example.com");
    const order = await createOrder(userId, { payment: { method: "razorpay", status: "paid" } });

    const response = await request(app).post(`/tiffin/single-meal/orders/${order.id}/cancel`).set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.order.status).toBe("cancelled");
    expect(response.body.order.payment.status).toBe("refunded");
    expect(response.body.order.payment.refundAmount).toBe(129);
    expect(response.body.order.statusHistory.at(-1)).toMatchObject({ status: "cancelled" });
  });

  it("gives no refund once the cancellation window has passed, even if already paid", async () => {
    const { userId, token } = await userToken("cancel-late@example.com");
    const order = await createOrder(userId, { payment: { method: "razorpay", status: "paid" } });
    const backdated = new Date(Date.now() - 20 * 60 * 1000);
    await TiffinSingleMealOrderModel.collection.updateOne({ _id: order._id }, { $set: { createdAt: backdated } });

    const response = await request(app).post(`/tiffin/single-meal/orders/${order.id}/cancel`).set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.order.status).toBe("cancelled");
    expect(response.body.order.payment.status).toBe("paid");
    expect(response.body.order.payment.refundAmount).toBeUndefined();
  });

  it("gives no refund for a COD order (nothing was charged upfront), and rejects cancelling it a second time", async () => {
    const { userId, token } = await userToken("cancel-cod@example.com");
    const order = await createOrder(userId, { payment: { method: "cod", status: "pending" } });

    const first = await request(app).post(`/tiffin/single-meal/orders/${order.id}/cancel`).set("Authorization", `Bearer ${token}`);
    expect(first.status).toBe(200);
    expect(first.body.order.status).toBe("cancelled");
    expect(first.body.order.payment.status).toBe("pending");
    expect(first.body.order.payment.refundAmount).toBeUndefined();

    const second = await request(app).post(`/tiffin/single-meal/orders/${order.id}/cancel`).set("Authorization", `Bearer ${token}`);
    expect(second.status).toBe(400);
  });

  it("rejects cancelling an already-delivered order", async () => {
    const { userId, token } = await userToken("cancel-delivered@example.com");
    const order = await createOrder(userId, { status: "delivered" });

    const response = await request(app).post(`/tiffin/single-meal/orders/${order.id}/cancel`).set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(400);
  });

  it("rejects cancelling an order that belongs to someone else", async () => {
    const owner = await userToken("cancel-owner@example.com");
    const stranger = await userToken("cancel-stranger@example.com");
    const order = await createOrder(owner.userId);

    const response = await request(app).post(`/tiffin/single-meal/orders/${order.id}/cancel`).set("Authorization", `Bearer ${stranger.token}`);

    expect(response.status).toBe(400);
  });

  it("requires authentication", async () => {
    const { userId } = await userToken("cancel-noauth@example.com");
    const order = await createOrder(userId);

    const response = await request(app).post(`/tiffin/single-meal/orders/${order.id}/cancel`);

    expect(response.status).toBe(401);
  });
});

describe("PATCH /admin/tiffin/single-meal/orders/:id/status", () => {
  it("assigns a delivery partner once the order moves to out-for-delivery, and records the status change in history", async () => {
    const token = await adminToken();
    const { userId } = await userToken("status-customer@example.com");
    const order = await createOrder(userId);

    const response = await request(app)
      .patch(`/admin/tiffin/single-meal/orders/${order.id}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "out-for-delivery" });

    expect(response.status).toBe(200);
    expect(response.body.order.status).toBe("out-for-delivery");
    expect(response.body.order.deliveryPartner.name).toBeTruthy();
    expect(response.body.order.deliveryPartner.phone).toBeTruthy();
    expect(response.body.order.statusHistory.at(-1)).toMatchObject({ status: "out-for-delivery" });
  });

  it("does not assign a delivery partner for a status other than out-for-delivery", async () => {
    const token = await adminToken();
    const { userId } = await userToken("status-customer2@example.com");
    const order = await createOrder(userId);

    const response = await request(app)
      .patch(`/admin/tiffin/single-meal/orders/${order.id}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "preparing" });

    expect(response.status).toBe(200);
    expect(response.body.order.deliveryPartner).toBeUndefined();
  });
});
