import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import jwt from "jsonwebtoken";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { OrderModel } from "../../src/db/models/Order.model.js";
import { UserModel } from "../../src/db/models/User.model.js";
import { clearTestDb, startTestDb, stopTestDb, testEnv } from "./testDb.js";

const env = testEnv();
const app = createApp(env);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploaded: string[] = [];

beforeAll(async () => {
  await startTestDb();
});

afterEach(async () => {
  await clearTestDb();
});

afterAll(async () => {
  await stopTestDb();
  for (const file of uploaded) fs.rmSync(file, { force: true });
});

async function userToken(email = "c@test.com", role: "customer" | "admin" = "customer") {
  const user = await UserModel.create({ fullName: role === "admin" ? "Admin" : "Riya", email, passwordHash: "unused", role, phone: `98${String(Math.random()).slice(2, 10)}` });
  return { id: String(user._id), auth: { Authorization: `Bearer ${jwt.sign({ userId: String(user._id), role }, env.JWT_SECRET, { expiresIn: "1h" })}` } };
}

async function orderFor(userId: string) {
  return OrderModel.create({
    accessToken: `tok-${userId}`,
    orderNumber: "TBC-TEST-0001",
    brandId: "tbc",
    userId,
    items: [],
    delivery: { fullName: "Riya", phone: "9876543210", address: "x", city: "Patna", pincode: "800001" },
    totals: { subtotal: 100, discountAmount: 0, discountReason: "none", rewardAmount: 0, rewardReason: "none", deliveryFee: 0, tax: 0, total: 100 },
    payment: { method: "razorpay", status: "pending" },
  });
}

describe("help requests from the support assistant", () => {
  it("raises a request on the customer's own order, with a photo they uploaded", async () => {
    const { id, auth } = await userToken();
    const order = await orderFor(id);

    const photo = await request(app)
      .post("/support/photo")
      .set(auth)
      .attach("image", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), { filename: "spill.png", contentType: "image/png" });
    expect(photo.status).toBe(201);
    uploaded.push(path.join(__dirname, "../../public/support-images", path.basename(photo.body.url)));

    const res = await request(app)
      .post("/support/tickets")
      .set(auth)
      .send({ topic: "spilled-or-damaged", orderId: String(order._id), message: "The shake spilled in the bag", photoUrl: photo.body.url });

    expect(res.status).toBe(201);
    expect(res.body.ticket.ticketNumber).toMatch(/^HLP-/);
    expect(res.body.ticket.orderNumber).toBe("TBC-TEST-0001");
    expect(res.body.ticket.customerPhone).toMatch(/^98\d{8}$/);

    const mine = await request(app).get("/support/tickets/mine").set(auth);
    expect(mine.body.tickets).toHaveLength(1);
  });

  it("refuses someone else's order, an outside photo URL, and requests without login", async () => {
    const owner = await userToken("owner@test.com");
    const order = await orderFor(owner.id);
    const other = await userToken("other@test.com");

    const notMine = await request(app).post("/support/tickets").set(other.auth).send({ topic: "missing-item", orderId: String(order._id), message: "Where is my fries" });
    expect(notMine.status).toBe(400);

    const badPhoto = await request(app)
      .post("/support/tickets")
      .set(owner.auth)
      .send({ topic: "other", message: "hello there", photoUrl: "https://evil.example.com/x.png" });
    expect(badPhoto.status).toBe(400);

    const anon = await request(app).post("/support/tickets").send({ topic: "other", message: "hello there" });
    expect(anon.status).toBe(401);
  });

  it("caps requests per account per day", async () => {
    const { auth } = await userToken();
    for (let i = 0; i < 10; i++) {
      expect((await request(app).post("/support/tickets").set(auth).send({ topic: "other", message: `question ${i}` })).status).toBe(201);
    }
    expect((await request(app).post("/support/tickets").set(auth).send({ topic: "other", message: "one more" })).status).toBe(400);
  });

  it("lets an admin reply, which the customer then sees, and marks it in progress", async () => {
    const customer = await userToken();
    const created = await request(app).post("/support/tickets").set(customer.auth).send({ topic: "payment-not-confirmed", message: "Paid ₹300 but no order" });
    const admin = await userToken("admin@test.com", "admin");

    const list = await request(app).get("/admin/support-tickets?status=open").set(admin.auth);
    expect(list.body.tickets).toHaveLength(1);

    const reply = await request(app)
      .patch(`/admin/support-tickets/${created.body.ticket.id}`)
      .set(admin.auth)
      .send({ adminReply: "We found it — refund started." });
    expect(reply.body.ticket.status).toBe("in-progress");

    const mine = await request(app).get("/support/tickets/mine").set(customer.auth);
    expect(mine.body.tickets[0].adminReply).toBe("We found it — refund started.");

    const forbidden = await request(app).get("/admin/support-tickets").set(customer.auth);
    expect(forbidden.status).toBe(403);
  });
});
