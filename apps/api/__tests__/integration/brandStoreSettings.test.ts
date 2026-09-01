import jwt from "jsonwebtoken";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { MenuItemModel } from "../../src/db/models/MenuItem.model.js";
import { UserModel } from "../../src/db/models/User.model.js";
import { addIsoDays, todayIsoInIst } from "../../src/utils/istDate.js";
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
  const admin = await UserModel.create({ fullName: "Admin", email: "admin-brandstore@test.com", passwordHash: "unused", role: "admin" });
  return jwt.sign({ userId: String(admin._id), role: "admin" }, env.JWT_SECRET, { expiresIn: "1h" });
}

async function seedMenuItem(brandId: string) {
  return MenuItemModel.create({
    _id: `${brandId}-item`,
    brandId,
    signatureName: "Test Item",
    commonName: "Test Item",
    description: "desc",
    price: 199,
    category: "signature-shakes",
    image: "https://example.com/a.jpg",
    flavorBadges: [],
  });
}

const validDelivery = { fullName: "Test Customer", phone: "9999999999", address: "123 Test St", city: "Patna", pincode: "800001" };

function orderPayload(brandId: string, itemId: string) {
  return {
    items: [{ lineId: "l1", menuItemId: itemId, quantity: 1, customization: { sugarLevel: "regular", iceLevel: "regular", addOnIds: [] } }],
    brandId,
    delivery: validDelivery,
    deliveryFor: "self",
    paymentMethod: "cod",
  };
}

describe("GET /brands/:brandId/status — defaults and isolation between brands", () => {
  it("defaults to open, 12:00-24:00 IST, closedByLickyeat false", async () => {
    const response = await request(app).get("/brands/tbc/status");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      brandId: "tbc",
      isOpen: true,
      closedByLickyeat: false,
      settings: { manuallyOpen: true, enforceServiceHours: true, openHour: 12, closeHour: 24 },
      upcomingClosures: [],
    });
  });

  it("closing one brand doesn't affect another", async () => {
    const token = await adminToken();
    await request(app).put("/admin/brands/tbc/store-settings").set("Authorization", `Bearer ${token}`).send({ manuallyOpen: false });

    const tbc = await request(app).get("/brands/tbc/status");
    expect(tbc.body.isOpen).toBe(false);
    expect(tbc.body.reason).toBe("manually-closed");
    expect(tbc.body.closedByLickyeat).toBe(false);

    const alchemyTails = await request(app).get("/brands/alchemy-tails/status");
    expect(alchemyTails.body.isOpen).toBe(true);
  });
});

describe("PUT/POST /admin/brands/:brandId/store-settings and store-closures", () => {
  it("rejects a non-admin caller for both endpoints", async () => {
    const settingsResponse = await request(app).put("/admin/brands/tbc/store-settings").send({ manuallyOpen: false });
    expect(settingsResponse.status).toBe(401);
    const closureResponse = await request(app).post("/admin/brands/tbc/store-closures").send({ startDate: "2026-09-05", endDate: "2026-09-06" });
    expect(closureResponse.status).toBe(401);
  });

  it("a brand's own planned closure blocks just that brand, with the exact dates and reason", async () => {
    await seedMenuItem("tbc");
    await seedMenuItem("alchemy-tails");
    const token = await adminToken();
    const today = todayIsoInIst();
    const declare = await request(app)
      .post("/admin/brands/tbc/store-closures")
      .set("Authorization", `Bearer ${token}`)
      .send({ startDate: today, endDate: addIsoDays(today, 1), reason: "Equipment repair" });

    expect(declare.status).toBe(201);
    expect(declare.body.status.isOpen).toBe(false);
    expect(declare.body.status.closedByLickyeat).toBe(false);

    const tbcOrder = await request(app).post("/orders").send(orderPayload("tbc", "tbc-item"));
    expect(tbcOrder.status).toBe(400);
    expect(tbcOrder.body.error).toMatch(/equipment repair/i);

    const alchemyOrder = await request(app).post("/orders").send(orderPayload("alchemy-tails", "alchemy-tails-item"));
    expect(alchemyOrder.status).toBe(201);
  });

  it("the Lickyeat-wide switch overrides every brand, and reports closedByLickyeat true", async () => {
    await seedMenuItem("tbc");
    const token = await adminToken();
    await request(app).put("/admin/store-settings").set("Authorization", `Bearer ${token}`).send({ manuallyOpen: false });

    const status = await request(app).get("/brands/tbc/status");
    expect(status.body.isOpen).toBe(false);
    expect(status.body.reason).toBe("manually-closed");
    expect(status.body.closedByLickyeat).toBe(true);

    const order = await request(app).post("/orders").send(orderPayload("tbc", "tbc-item"));
    expect(order.status).toBe(400);
  });

  it("a brand's own manual switch back on doesn't help if the Lickyeat-wide switch is still off", async () => {
    const token = await adminToken();
    await request(app).put("/admin/store-settings").set("Authorization", `Bearer ${token}`).send({ manuallyOpen: false });
    await request(app).put("/admin/brands/tbc/store-settings").set("Authorization", `Bearer ${token}`).send({ manuallyOpen: true });

    const status = await request(app).get("/brands/tbc/status");
    expect(status.body.isOpen).toBe(false);
    expect(status.body.closedByLickyeat).toBe(true);
  });

  it("a brand new to the system (never configured) still gets working defaults", async () => {
    const response = await request(app).get("/brands/the-biryani-lane/status");
    expect(response.status).toBe(200);
    expect(response.body.isOpen).toBe(true);
    expect(response.body.settings).toEqual({ manuallyOpen: true, enforceServiceHours: true, openHour: 12, closeHour: 24 });
  });

  it("lists a brand's own closures, scoped away from another brand's", async () => {
    const token = await adminToken();
    await request(app)
      .post("/admin/brands/tbc/store-closures")
      .set("Authorization", `Bearer ${token}`)
      .send({ startDate: "2026-12-25", endDate: "2026-12-26" });
    await request(app)
      .post("/admin/brands/alchemy-tails/store-closures")
      .set("Authorization", `Bearer ${token}`)
      .send({ startDate: "2026-11-01", endDate: "2026-11-02" });

    const tbcClosures = await request(app).get("/admin/brands/tbc/store-closures").set("Authorization", `Bearer ${token}`);
    expect(tbcClosures.body.closures).toHaveLength(1);
    expect(tbcClosures.body.closures[0].startDate).toBe("2026-12-25");
  });
});
