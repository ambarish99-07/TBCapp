import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { MenuItemModel } from "../../src/db/models/MenuItem.model.js";
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

async function seedMenuItem(overrides: Partial<{ _id: string; price: number }> = {}) {
  return MenuItemModel.create({
    _id: "choco-crush",
    signatureName: "Choco Crush",
    commonName: "Rich Chocolate Shake",
    description: "A rich, indulgent chocolate shake.",
    price: 220,
    category: "signature-shakes",
    image: "https://example.com/choco-crush.jpg",
    flavorBadges: ["Chocolate Lover"],
    ...overrides,
  });
}

const validDelivery = {
  fullName: "Test Customer",
  phone: "9999999999",
  address: "123 Test St",
  city: "Patna",
  pincode: "800001",
};

describe("POST /orders — never trusts a client-submitted price", () => {
  it("ignores a tampered client-submitted price and charges the server's real menu price", async () => {
    await seedMenuItem({ price: 220 });

    const response = await request(app)
      .post("/orders")
      .send({
        items: [
          {
            lineId: "l1",
            menuItemId: "choco-crush",
            unitPrice: 1, // tampered — CreateOrderRequestSchema has no such field, so this is silently stripped
            quantity: 1,
            customization: { sugarLevel: "regular", iceLevel: "regular", addOnIds: [] },
          },
        ],
        delivery: validDelivery,
        paymentMethod: "cod",
      });

    expect(response.status).toBe(201);
    // 220 subtotal, single item -> 0% quantity-tier discount, deliveryFee 39 (below 499),
    // taxableAmount 220, tax round(220*0.05)=11, total = 220+11+39 = 270.
    expect(response.body.order.totals.subtotal).toBe(220);
    expect(response.body.order.totals.total).toBe(270);
    expect(response.body.order.items[0].unitPrice).toBe(220);
  });

  it("rejects an order line referencing an unknown menu item id", async () => {
    const response = await request(app)
      .post("/orders")
      .send({
        items: [
          {
            lineId: "l1",
            menuItemId: "does-not-exist",
            quantity: 1,
            customization: { sugarLevel: "regular", iceLevel: "regular", addOnIds: [] },
          },
        ],
        delivery: validDelivery,
        paymentMethod: "cod",
      });

    expect(response.status).toBe(400);
  });

  it("rejects an unknown add-on id", async () => {
    await seedMenuItem();

    const response = await request(app)
      .post("/orders")
      .send({
        items: [
          {
            lineId: "l1",
            menuItemId: "choco-crush",
            quantity: 1,
            customization: { sugarLevel: "regular", iceLevel: "regular", addOnIds: ["not-a-real-addon"] },
          },
        ],
        delivery: validDelivery,
        paymentMethod: "cod",
      });

    expect(response.status).toBe(400);
  });
});

describe("POST /orders — payload caps", () => {
  it("rejects more than 50 line items", async () => {
    await seedMenuItem();
    const line = {
      menuItemId: "choco-crush",
      quantity: 1,
      customization: { sugarLevel: "regular", iceLevel: "regular", addOnIds: [] },
    };

    const response = await request(app)
      .post("/orders")
      .send({
        items: Array.from({ length: 51 }, (_, i) => ({ ...line, lineId: `l${i}` })),
        delivery: validDelivery,
        paymentMethod: "cod",
      });

    expect(response.status).toBe(400);
  });

  it("rejects a quantity above 20 on a single line", async () => {
    await seedMenuItem();

    const response = await request(app)
      .post("/orders")
      .send({
        items: [
          {
            lineId: "l1",
            menuItemId: "choco-crush",
            quantity: 21,
            customization: { sugarLevel: "regular", iceLevel: "regular", addOnIds: [] },
          },
        ],
        delivery: validDelivery,
        paymentMethod: "cod",
      });

    expect(response.status).toBe(400);
  });
});
