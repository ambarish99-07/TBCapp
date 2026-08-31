import jwt from "jsonwebtoken";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { MenuItemModel } from "../../src/db/models/MenuItem.model.js";
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

async function seedMenuItem() {
  return MenuItemModel.create({
    _id: "choco-crush",
    brandId: "tbc",
    signatureName: "Choco Crush",
    commonName: "Rich Chocolate Shake",
    description: "A rich, indulgent chocolate shake.",
    price: 220,
    category: "signature-shakes",
    image: "https://example.com/choco-crush.jpg",
    flavorBadges: ["Chocolate Lover"],
  });
}

const validDelivery = {
  fullName: "Test Customer",
  phone: "9999999999",
  address: "123 Test St",
  city: "Patna",
  pincode: "800001",
};

function orderPayload() {
  return {
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
    paymentMethod: "cod",
  };
}

describe("GET /store/status", () => {
  it("defaults to open, 12:00-24:00 IST, with both switches on", async () => {
    const response = await request(app).get("/store/status");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      isOpen: true,
      settings: { manuallyOpen: true, enforceServiceHours: true, openHour: 12, closeHour: 24 },
    });
  });

  it("needs no auth", async () => {
    const response = await request(app).get("/store/status");
    expect(response.status).not.toBe(401);
  });
});

describe("GET/PUT /admin/store-settings", () => {
  it("rejects a non-admin caller", async () => {
    const response = await request(app).get("/admin/store-settings");
    expect(response.status).toBe(401);
  });

  it("the manual switch closes the store regardless of the service-hours window", async () => {
    const token = await adminToken();
    const put = await request(app)
      .put("/admin/store-settings")
      .set("Authorization", `Bearer ${token}`)
      .send({ manuallyOpen: false });

    expect(put.status).toBe(200);
    expect(put.body).toEqual({
      isOpen: false,
      reason: "manually-closed",
      settings: { manuallyOpen: false, enforceServiceHours: true, openHour: 12, closeHour: 24 },
    });

    const publicStatus = await request(app).get("/store/status");
    expect(publicStatus.body.isOpen).toBe(false);
    expect(publicStatus.body.reason).toBe("manually-closed");
  });

  it("a window that excludes the current hour closes the store with reason outside-hours", async () => {
    const token = await adminToken();
    // A one-hour window almost certainly not the current hour, chosen relative to "now" so this
    // test can't ever coincidentally pass because it happened to run during 2-3am IST.
    const now = new Date();
    const excludedHour = (now.getUTCHours() + 12) % 24;
    const put = await request(app)
      .put("/admin/store-settings")
      .set("Authorization", `Bearer ${token}`)
      .send({ openHour: excludedHour, closeHour: (excludedHour + 1) % 24 || 24 });

    expect(put.status).toBe(200);
    expect(put.body.isOpen).toBe(false);
    expect(put.body.reason).toBe("outside-hours");
  });

  it("turning enforceServiceHours off makes the store open around the clock (manual switch still on)", async () => {
    const token = await adminToken();
    await request(app)
      .put("/admin/store-settings")
      .set("Authorization", `Bearer ${token}`)
      .send({ openHour: 2, closeHour: 3 }); // a window almost certainly excluding "now"

    const disabled = await request(app)
      .put("/admin/store-settings")
      .set("Authorization", `Bearer ${token}`)
      .send({ enforceServiceHours: false });

    expect(disabled.body.isOpen).toBe(true);
  });

  it("rejects an identical open and close hour", async () => {
    const token = await adminToken();
    const response = await request(app)
      .put("/admin/store-settings")
      .set("Authorization", `Bearer ${token}`)
      .send({ openHour: 5, closeHour: 5 });
    expect(response.status).toBe(400);
  });
});

describe("POST /orders — blocked while the store is closed", () => {
  it("rejects a catalog order while manually closed, with a customer-facing message", async () => {
    await seedMenuItem();
    const token = await adminToken();
    await request(app).put("/admin/store-settings").set("Authorization", `Bearer ${token}`).send({ manuallyOpen: false });

    const response = await request(app).post("/orders").send(orderPayload());
    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/not accepting orders/i);
  });

  it("rejects a catalog order outside the scheduled hours, naming the open/close time", async () => {
    await seedMenuItem();
    const token = await adminToken();
    const now = new Date();
    const excludedHour = (now.getUTCHours() + 12) % 24;
    await request(app)
      .put("/admin/store-settings")
      .set("Authorization", `Bearer ${token}`)
      .send({ openHour: excludedHour, closeHour: (excludedHour + 1) % 24 || 24 });

    const response = await request(app).post("/orders").send(orderPayload());
    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/we're closed right now/i);
  });

  it("allows a catalog order once reopened", async () => {
    await seedMenuItem();
    const token = await adminToken();
    await request(app).put("/admin/store-settings").set("Authorization", `Bearer ${token}`).send({ manuallyOpen: false });
    await request(app).put("/admin/store-settings").set("Authorization", `Bearer ${token}`).send({ manuallyOpen: true });

    const response = await request(app).post("/orders").send(orderPayload());
    expect(response.status).toBe(201);
  });
});
