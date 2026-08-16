import jwt from "jsonwebtoken";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { MenuItemModel } from "../../src/db/models/MenuItem.model.js";
import { OrderModel } from "../../src/db/models/Order.model.js";
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

// Upsert — some tests create more than one order (and therefore call this more than once)
// within the same `it` block, where afterEach's clearTestDb hasn't run yet.
async function seedMenuItem() {
  return MenuItemModel.findOneAndUpdate(
    { _id: "choco-crush" },
    {
      _id: "choco-crush",
      brandId: "tbc",
      signatureName: "Choco Crush",
      commonName: "Rich Chocolate Shake",
      description: "A rich, indulgent chocolate shake.",
      price: 220,
      category: "signature-shakes",
      image: "https://example.com/choco-crush.jpg",
      flavorBadges: ["Chocolate Lover"],
    },
    { upsert: true, new: true }
  );
}

const validDelivery = {
  fullName: "Test Customer",
  phone: "9999999999",
  address: "123 Test St",
  city: "Patna",
  pincode: "800001",
};

async function adminToken(): Promise<string> {
  const admin = await UserModel.create({ fullName: "Admin", email: "admin@test.com", passwordHash: "unused", phone: "9888888888", role: "admin" });
  return jwt.sign({ userId: String(admin._id), role: "admin" }, env.JWT_SECRET, { expiresIn: "1h" });
}

/** Creates a guest order via the real endpoint (so totals/pricing are real), then — since going
 * through actual Razorpay verification isn't practical in a test — directly flips the persisted
 * payment status and/or order status to simulate "already paid" / "already at status X", the same
 * direct-model-manipulation approach used for premium membership and tiffin cancellation tests. */
async function createOrder(overrides: { paymentStatus?: "pending" | "paid"; status?: string } = {}) {
  await seedMenuItem();
  const response = await request(app)
    .post("/orders")
    .send({
      items: [
        {
          lineId: "l1",
          menuItemId: "choco-crush",
          quantity: 1,
          customization: { sugarLevel: "regular", iceLevel: "regular", addOnIds: [] },
        },
      ],
      brandId: "tbc",
      delivery: validDelivery,
      deliveryFor: "self",
      paymentMethod: "razorpay",
    });
  const order = response.body.order as { accessToken: string; totals: { total: number } };

  const set: Record<string, unknown> = {};
  if (overrides.paymentStatus) set["payment.status"] = overrides.paymentStatus;
  if (overrides.status) set.status = overrides.status;
  if (Object.keys(set).length > 0) {
    await OrderModel.updateOne({ accessToken: order.accessToken }, { $set: set });
  }
  return order;
}

describe("POST /orders/guest/:accessToken/cancel", () => {
  it("gives a full refund when cancelled while still 'received', for an order already paid", async () => {
    const order = await createOrder({ paymentStatus: "paid" });

    const response = await request(app).post(`/orders/guest/${order.accessToken}/cancel`).send({});

    expect(response.status).toBe(200);
    expect(response.body.order.status).toBe("cancelled");
    expect(response.body.order.payment.status).toBe("refunded");
    expect(response.body.order.payment.refundAmount).toBe(order.totals.total);
  });

  it("gives a 50% refund when cancelled while 'preparing' or 'out-for-delivery'", async () => {
    const preparing = await createOrder({ paymentStatus: "paid", status: "preparing" });
    const preparingResponse = await request(app).post(`/orders/guest/${preparing.accessToken}/cancel`).send({});
    expect(preparingResponse.status).toBe(200);
    expect(preparingResponse.body.order.payment.refundAmount).toBe(Math.round(preparing.totals.total * 0.5));

    const dispatched = await createOrder({ paymentStatus: "paid", status: "out-for-delivery" });
    const dispatchedResponse = await request(app).post(`/orders/guest/${dispatched.accessToken}/cancel`).send({});
    expect(dispatchedResponse.status).toBe(200);
    expect(dispatchedResponse.body.order.payment.refundAmount).toBe(Math.round(dispatched.totals.total * 0.5));
  });

  it("gives a 30% refund when cancelled after delivery, and stores the reason", async () => {
    const order = await createOrder({ paymentStatus: "paid", status: "delivered" });

    const response = await request(app)
      .post(`/orders/guest/${order.accessToken}/cancel`)
      .send({ reason: "The order spilled in transit" });

    expect(response.status).toBe(200);
    expect(response.body.order.payment.refundAmount).toBe(Math.round(order.totals.total * 0.3));
    expect(response.body.order.cancellationReason).toBe("The order spilled in transit");
  });

  it("gives no refund for a COD order (nothing was charged upfront), even cancelled immediately", async () => {
    const order = await createOrder();

    const response = await request(app).post(`/orders/guest/${order.accessToken}/cancel`).send({});

    expect(response.status).toBe(200);
    expect(response.body.order.status).toBe("cancelled");
    expect(response.body.order.payment.status).toBe("pending");
    expect(response.body.order.payment.refundAmount).toBeUndefined();
  });

  it("rejects cancelling an order a second time", async () => {
    const order = await createOrder({ paymentStatus: "paid" });
    const first = await request(app).post(`/orders/guest/${order.accessToken}/cancel`).send({});
    expect(first.status).toBe(200);

    const second = await request(app).post(`/orders/guest/${order.accessToken}/cancel`).send({});
    expect(second.status).toBe(400);
  });

  it("rejects an unknown access token", async () => {
    const response = await request(app).post("/orders/guest/not-a-real-token/cancel").send({});
    expect(response.status).toBe(400);
  });
});

describe("PATCH /admin/orders/:id/status — delivery partner assignment", () => {
  it("assigns a delivery partner once the order moves to out-for-delivery, and records the status change in history", async () => {
    const token = await adminToken();
    const order = await createOrder();
    const orderDoc = await OrderModel.findOne({ accessToken: order.accessToken });

    const response = await request(app)
      .patch(`/admin/orders/${orderDoc!.id}/status`)
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
    const order = await createOrder();
    const orderDoc = await OrderModel.findOne({ accessToken: order.accessToken });

    const response = await request(app)
      .patch(`/admin/orders/${orderDoc!.id}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "preparing" });

    expect(response.status).toBe(200);
    expect(response.body.order.deliveryPartner).toBeUndefined();
  });
});
