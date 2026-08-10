import jwt from "jsonwebtoken";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
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

async function adminToken(): Promise<string> {
  const admin = await UserModel.create({
    fullName: "Admin",
    email: "admin@test.com",
    passwordHash: "unused",
    phone: "9999999999",
    role: "admin",
  });
  return jwt.sign({ userId: String(admin._id), role: "admin" }, env.JWT_SECRET, { expiresIn: "1h" });
}

/**
 * Regression test: GET /admin/orders must return an `id` field matching the
 * Mongo `_id`, not `_id` itself. Without this, every order's `id` is
 * `undefined`, which silently breaks anything keying off it — e.g. the admin
 * dashboard's new-order alert polling, which diffs known order ids against
 * the latest poll: with every `id` collapsing to the same `undefined`, the
 * diff never sees a "new" order and the alert never fires.
 */
describe("GET /admin/orders — response shape", () => {
  it("returns each order's real id as `id`, not `_id`", async () => {
    const token = await adminToken();
    await OrderModel.create({
      accessToken: "test-access-token-1234567890",
      orderNumber: "TBC-TEST0000-0000",
      brandId: "tbc",
      items: [
        {
          lineId: "l1",
          menuItemId: "choco-crush",
          signatureName: "Choco Crush",
          commonName: "Rich Chocolate Shake",
          unitPrice: 220,
          originalUnitPrice: 220,
          quantity: 1,
          customization: { sugarLevel: "regular", iceLevel: "regular", addOnIds: [] },
        },
      ],
      delivery: { fullName: "Test", phone: "9999999999", address: "Addr", city: "Patna", pincode: "800001" },
      totals: {
        subtotal: 220,
        discountAmount: 0,
        discountReason: "none",
        rewardAmount: 0,
        rewardReason: "none",
        deliveryFee: 39,
        tax: 11,
        total: 270,
      },
      status: "received",
      payment: { method: "cod", status: "pending" },
    });

    const response = await request(app).get("/admin/orders").query({ status: "received" }).set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(typeof response.body.orders[0].id).toBe("string");
    expect(response.body.orders[0].id).toHaveLength(24);
    expect(response.body.orders[0]._id).toBeUndefined();

    const distinctIds = new Set(response.body.orders.map((order: { id: string }) => order.id));
    expect(distinctIds.size).toBe(response.body.orders.length);
  });
});
