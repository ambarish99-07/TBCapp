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

function tokenFor(userId: string, role: "customer" | "admin" = "customer"): string {
  return jwt.sign({ userId, role }, env.JWT_SECRET, { expiresIn: "1h" });
}

let orderCounter = 0;
async function createOrder(overrides: Record<string, unknown>) {
  orderCounter += 1;
  return OrderModel.create({
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
    totals: {
      subtotal: 200,
      discountAmount: 0,
      discountReason: "none",
      rewardAmount: 0,
      rewardReason: "none",
      deliveryFee: 39,
      tax: 10,
      total: 249,
    },
    payment: { method: "cod", status: "pending" },
    ...overrides,
  });
}

describe("Customer feedback submission", () => {
  it("rejects feedback on an order that hasn't been delivered yet", async () => {
    const customer = await UserModel.create({ fullName: "Customer", passwordHash: "x", role: "customer" });
    const order = await createOrder({ userId: customer._id, status: "preparing" });

    const response = await request(app)
      .post(`/orders/${order._id}/feedback`)
      .set("Authorization", `Bearer ${tokenFor(String(customer._id))}`)
      .send({ isComplaint: false, rating: 5 });

    expect(response.status).toBe(400);
  });

  it("rejects feedback from someone other than the order's owner", async () => {
    const owner = await UserModel.create({ fullName: "Owner", passwordHash: "x", role: "customer" });
    const stranger = await UserModel.create({ fullName: "Stranger", passwordHash: "x", role: "customer" });
    const order = await createOrder({ userId: owner._id, status: "delivered" });

    const response = await request(app)
      .post(`/orders/${order._id}/feedback`)
      .set("Authorization", `Bearer ${tokenFor(String(stranger._id))}`)
      .send({ isComplaint: false, rating: 5 });

    expect(response.status).toBe(400);
  });

  it("rejects a review with no rating and a complaint with no category", async () => {
    const customer = await UserModel.create({ fullName: "Customer", passwordHash: "x", role: "customer" });
    const order = await createOrder({ userId: customer._id, status: "delivered" });
    const token = tokenFor(String(customer._id));

    const missingRating = await request(app).post(`/orders/${order._id}/feedback`).set("Authorization", `Bearer ${token}`).send({ isComplaint: false });
    expect(missingRating.status).toBe(400);

    const missingCategory = await request(app)
      .post(`/orders/${order._id}/feedback`)
      .set("Authorization", `Bearer ${token}`)
      .send({ isComplaint: true });
    expect(missingCategory.status).toBe(400);
  });

  it("accepts a review, then returns it from the order's own feedback lookup, and rejects a second submission", async () => {
    const customer = await UserModel.create({ fullName: "Customer", passwordHash: "x", role: "customer" });
    const order = await createOrder({ userId: customer._id, status: "delivered" });
    const token = tokenFor(String(customer._id));

    const submit = await request(app)
      .post(`/orders/${order._id}/feedback`)
      .set("Authorization", `Bearer ${token}`)
      .send({ isComplaint: false, rating: 4, message: "Great shake!" });
    expect(submit.status).toBe(201);
    expect(submit.body.feedback.type).toBe("review");
    expect(submit.body.feedback.status).toBe("open");

    const lookup = await request(app).get(`/orders/${order._id}/feedback`).set("Authorization", `Bearer ${token}`);
    expect(lookup.status).toBe(200);
    expect(lookup.body.feedback.rating).toBe(4);

    const secondSubmit = await request(app)
      .post(`/orders/${order._id}/feedback`)
      .set("Authorization", `Bearer ${token}`)
      .send({ isComplaint: false, rating: 5 });
    expect(secondSubmit.status).toBe(400);
  });

  it("accepts a complaint with a category", async () => {
    const customer = await UserModel.create({ fullName: "Customer", passwordHash: "x", role: "customer" });
    const order = await createOrder({ userId: customer._id, status: "delivered" });

    const response = await request(app)
      .post(`/orders/${order._id}/feedback`)
      .set("Authorization", `Bearer ${tokenFor(String(customer._id))}`)
      .send({ isComplaint: true, category: "late-delivery", message: "Took two hours" });

    expect(response.status).toBe(201);
    expect(response.body.feedback.type).toBe("complaint");
    expect(response.body.feedback.category).toBe("late-delivery");
  });
});

describe("Admin feedback management", () => {
  async function adminToken(): Promise<string> {
    const admin = await UserModel.create({ fullName: "Admin", email: "admin@test.com", passwordHash: "x", role: "admin" });
    return tokenFor(String(admin._id), "admin");
  }

  it("is not accessible to a non-admin", async () => {
    const customer = await UserModel.create({ fullName: "Customer", passwordHash: "x", role: "customer" });
    const response = await request(app).get("/admin/feedback").set("Authorization", `Bearer ${tokenFor(String(customer._id))}`);
    expect(response.status).toBe(403);
  });

  it("lists feedback, filterable by type and status, and lets an admin update status and respond", async () => {
    const customer = await UserModel.create({ fullName: "Customer", passwordHash: "x", role: "customer" });
    const complaintOrder = await createOrder({ userId: customer._id, status: "delivered" });
    const reviewOrder = await createOrder({ userId: customer._id, status: "delivered" });
    const customerTokenHeader = `Bearer ${tokenFor(String(customer._id))}`;

    await request(app)
      .post(`/orders/${complaintOrder._id}/feedback`)
      .set("Authorization", customerTokenHeader)
      .send({ isComplaint: true, category: "wrong-item" });
    await request(app).post(`/orders/${reviewOrder._id}/feedback`).set("Authorization", customerTokenHeader).send({ isComplaint: false, rating: 5 });

    const token = await adminToken();
    const authHeader = `Bearer ${token}`;

    const all = await request(app).get("/admin/feedback").set("Authorization", authHeader);
    expect(all.status).toBe(200);
    expect(all.body.feedback).toHaveLength(2);

    const complaintsOnly = await request(app).get("/admin/feedback").query({ type: "complaint" }).set("Authorization", authHeader);
    expect(complaintsOnly.body.feedback).toHaveLength(1);
    expect(complaintsOnly.body.feedback[0].category).toBe("wrong-item");

    const complaintId = complaintsOnly.body.feedback[0].id;

    const statusUpdate = await request(app)
      .patch(`/admin/feedback/${complaintId}/status`)
      .set("Authorization", authHeader)
      .send({ status: "in-progress" });
    expect(statusUpdate.status).toBe(200);
    expect(statusUpdate.body.feedback.status).toBe("in-progress");

    const respond = await request(app)
      .patch(`/admin/feedback/${complaintId}/respond`)
      .set("Authorization", authHeader)
      .send({ adminResponse: "We're sorry — a replacement is on its way." });
    expect(respond.status).toBe(200);
    expect(respond.body.feedback.adminResponse).toBe("We're sorry — a replacement is on its way.");
    expect(respond.body.feedback.respondedAt).toBeTruthy();

    const openOnly = await request(app).get("/admin/feedback").query({ status: "open" }).set("Authorization", authHeader);
    expect(openOnly.body.feedback).toHaveLength(1);
    expect(openOnly.body.feedback[0].type).toBe("review");
  });
});
