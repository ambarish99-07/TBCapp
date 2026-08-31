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
  const admin = await UserModel.create({ fullName: "Admin", email: "admin@test.com", passwordHash: "unused", role: "admin" });
  return jwt.sign({ userId: String(admin._id), role: "admin" }, env.JWT_SECRET, { expiresIn: "1h" });
}

let orderCounter = 0;
function orderFixture(overrides: Record<string, unknown>) {
  orderCounter += 1;
  return {
    accessToken: `test-access-token-${orderCounter}`,
    orderNumber: `TBC-TEST-${orderCounter}`,
    brandId: "tbc",
    status: "received",
    items: [
      {
        lineId: "l1",
        menuItemId: "choco-crush",
        signatureName: "Choco Crush",
        commonName: "Rich Chocolate Shake",
        unitPrice: 200,
        originalUnitPrice: 200,
        quantity: 1,
        customization: { sugarLevel: "regular", iceLevel: "regular", addOnIds: [] },
      },
    ],
    delivery: { fullName: "Test", phone: "9999999999", address: "Addr", city: "Patna", pincode: "800001" },
    totals: { subtotal: 200, discountAmount: 0, discountReason: "none", rewardAmount: 0, rewardReason: "none", deliveryFee: 39, tax: 10, total: 249 },
    payment: { method: "cod", status: "pending" },
    ...overrides,
  };
}

describe("GET /admin/customers", () => {
  it("is not accessible to a non-admin", async () => {
    const customer = await UserModel.create({ fullName: "Customer", passwordHash: "x", role: "customer" });
    const token = jwt.sign({ userId: String(customer._id), role: "customer" }, env.JWT_SECRET, { expiresIn: "1h" });
    const response = await request(app).get("/admin/customers").query({ q: "Priya" }).set("Authorization", `Bearer ${token}`);
    expect(response.status).toBe(403);
  });

  it("finds a customer by partial name, phone, or email, but never an admin", async () => {
    await UserModel.create({ fullName: "Priya Sharma", phone: "9812345678", email: "priya@example.com", passwordHash: "x", role: "customer" });
    await UserModel.create({ fullName: "Rahul Verma", phone: "9898765432", passwordHash: "x", role: "customer" });
    await UserModel.create({ fullName: "Priya Admin", email: "priya-admin@test.com", passwordHash: "x", role: "admin" });

    const token = await adminToken();
    const authHeader = `Bearer ${token}`;

    const byName = await request(app).get("/admin/customers").query({ q: "priya" }).set("Authorization", authHeader);
    expect(byName.status).toBe(200);
    expect(byName.body.customers).toHaveLength(1);
    expect(byName.body.customers[0].fullName).toBe("Priya Sharma");

    const byPhone = await request(app).get("/admin/customers").query({ q: "981234" }).set("Authorization", authHeader);
    expect(byPhone.body.customers).toHaveLength(1);

    const empty = await request(app).get("/admin/customers").set("Authorization", authHeader);
    expect(empty.body.customers).toHaveLength(0);
  });
});

describe("GET /admin/customers/:id and GET /admin/orders?userId=", () => {
  it("returns a customer's profile and scopes the order list to just their orders", async () => {
    const customer = await UserModel.create({ fullName: "Priya Sharma", phone: "9812345678", passwordHash: "x", role: "customer" });
    const otherCustomer = await UserModel.create({ fullName: "Rahul Verma", phone: "9898765432", passwordHash: "x", role: "customer" });
    await OrderModel.create(orderFixture({ userId: customer._id }));
    await OrderModel.create(orderFixture({ userId: customer._id }));
    await OrderModel.create(orderFixture({ userId: otherCustomer._id }));

    const token = await adminToken();
    const authHeader = `Bearer ${token}`;

    const profile = await request(app).get(`/admin/customers/${customer._id}`).set("Authorization", authHeader);
    expect(profile.status).toBe(200);
    expect(profile.body.customer.fullName).toBe("Priya Sharma");

    const orders = await request(app).get("/admin/orders").query({ userId: String(customer._id) }).set("Authorization", authHeader);
    expect(orders.status).toBe(200);
    expect(orders.body.orders).toHaveLength(2);
  });
});

describe("POST /admin/customers/:id/recommend", () => {
  it("rejects an empty item list and a customer with no phone on file", async () => {
    const token = await adminToken();
    const authHeader = `Bearer ${token}`;
    const noPhoneCustomer = await UserModel.create({ fullName: "No Phone", email: "nophone@test.com", passwordHash: "x", role: "customer" });

    const emptyList = await request(app)
      .post(`/admin/customers/${noPhoneCustomer._id}/recommend`)
      .set("Authorization", authHeader)
      .send({ itemNames: [] });
    expect(emptyList.status).toBe(400);

    const noPhone = await request(app)
      .post(`/admin/customers/${noPhoneCustomer._id}/recommend`)
      .set("Authorization", authHeader)
      .send({ itemNames: ["Choco Crush"] });
    expect(noPhone.status).toBe(400);
  });

  it("sends the admin-picked item names as-is for a customer with a phone on file", async () => {
    const token = await adminToken();
    const customer = await UserModel.create({ fullName: "Priya Sharma", phone: "9812345678", passwordHash: "x", role: "customer" });

    const response = await request(app)
      .post(`/admin/customers/${customer._id}/recommend`)
      .set("Authorization", `Bearer ${token}`)
      .send({ itemNames: ["Choco Crush", "Blue Lagoon"] });

    expect(response.status).toBe(200);
    expect(response.body.recommendedItemNames).toEqual(["Choco Crush", "Blue Lagoon"]);
  });
});
