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
  const admin = await UserModel.create({
    fullName: "Admin",
    email: "admin@test.com",
    passwordHash: "unused",
    phone: "9999999999",
    role: "admin",
  });
  return jwt.sign({ userId: String(admin._id), role: "admin" }, env.JWT_SECRET, { expiresIn: "1h" });
}

async function customerToken(): Promise<string> {
  const customer = await UserModel.create({
    fullName: "Customer",
    email: "customer@test.com",
    passwordHash: "unused",
    phone: "9888888888",
    role: "customer",
  });
  return jwt.sign({ userId: String(customer._id), role: "customer" }, env.JWT_SECRET, { expiresIn: "1h" });
}

describe("Bulk order inquiries", () => {
  it("accepts a public submission with just a name and phone", async () => {
    const response = await request(app).post("/bulk-order-inquiries").send({ name: "Priya Kumar", phone: "9712300002" });

    expect(response.status).toBe(201);
    expect(response.body.inquiry.status).toBe("new");
    expect(response.body.inquiry.name).toBe("Priya Kumar");
    expect(response.body.inquiry.id).toBeDefined();
  });

  it("rejects a submission missing a phone number", async () => {
    const response = await request(app).post("/bulk-order-inquiries").send({ name: "No Phone" });
    expect(response.status).toBe(400);
  });

  it("is visible to admins with the full form, but not to regular customers", async () => {
    await request(app).post("/bulk-order-inquiries").send({
      name: "Office Party",
      phone: "9712399999",
      email: "office@example.com",
      occasion: "Office party",
      estimatedQuantity: "50 shakes",
      preferredDate: "Next Friday",
      message: "Need delivery by 3pm",
    });

    const admin = await adminToken();
    const listedByAdmin = await request(app).get("/admin/bulk-order-inquiries").set("Authorization", `Bearer ${admin}`);
    expect(listedByAdmin.status).toBe(200);
    expect(listedByAdmin.body.inquiries).toHaveLength(1);
    expect(listedByAdmin.body.inquiries[0].occasion).toBe("Office party");
    expect(listedByAdmin.body.inquiries[0].message).toBe("Need delivery by 3pm");

    const customer = await customerToken();
    const listedByCustomer = await request(app).get("/admin/bulk-order-inquiries").set("Authorization", `Bearer ${customer}`);
    expect(listedByCustomer.status).toBe(403);

    const listedAnonymously = await request(app).get("/admin/bulk-order-inquiries");
    expect(listedAnonymously.status).toBe(401);
  });

  it("lets an admin advance an inquiry's status", async () => {
    const created = await request(app).post("/bulk-order-inquiries").send({ name: "Status Test", phone: "9712311111" });
    const admin = await adminToken();

    const updated = await request(app)
      .patch(`/admin/bulk-order-inquiries/${created.body.inquiry.id}/status`)
      .set("Authorization", `Bearer ${admin}`)
      .send({ status: "contacted" });

    expect(updated.status).toBe(200);
    expect(updated.body.inquiry.status).toBe("contacted");
  });
});
