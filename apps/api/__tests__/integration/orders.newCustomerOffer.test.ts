import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { MenuItemModel } from "../../src/db/models/MenuItem.model.js";
import { clearTestDb, startTestDb, stopTestDb, testEnv } from "./testDb.js";

// Own file so it gets its own signup rate-limit budget — needs only 1 fresh signup (all three
// orders below are placed by the same customer, to prove the offer counts globally across their
// first two quick-delivery orders regardless of brand).
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

async function seedMenuItems() {
  await MenuItemModel.insertMany([
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
    {
      _id: "cold-brew",
      brandId: "tbc",
      signatureName: "Cold Brew",
      commonName: "Iced Cold Coffee",
      description: "A smooth iced cold coffee.",
      price: 150,
      category: "cold-coffee",
      image: "https://example.com/cold-brew.jpg",
      flavorBadges: [],
    },
    {
      _id: "mango-mojito",
      brandId: "alchemy-tails",
      signatureName: "Mango Mojito",
      commonName: "Mango Mint Mocktail",
      description: "A refreshing mango mint mocktail.",
      price: 300,
      category: "signature-shakes",
      image: "https://example.com/mango-mojito.jpg",
      flavorBadges: [],
    },
  ]);
}

const validDelivery = {
  fullName: "Test Customer",
  phone: "9999999999",
  address: "123 Test St",
  city: "Patna",
  pincode: "800001",
};

async function signup(): Promise<string> {
  const response = await request(app)
    .post("/auth/signup")
    .send({ fullName: "New Customer", email: "new-customer-offer@example.com", phone: "9812400060", password: "password123" });
  return response.body.token;
}

describe("POST /orders — first/second-order new-customer offer", () => {
  it("order #1 (TBC) gets Buy 1 Get 1 Free, order #2 (Alchemy Tails) gets 50% off, order #3 (TBC) is back to normal pricing — the counter is global across brands", async () => {
    await seedMenuItems();
    const token = await signup();

    // Order #1 — two TBC items (220 + 150). Without the offer this would only get the 10%
    // quantity-tier discount (37); the new-customer offer instead gives the cheaper 150 unit free.
    const first = await request(app)
      .post("/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({
        items: [
          { lineId: "l1", menuItemId: "choco-crush", quantity: 1, customization: { sugarLevel: "regular", iceLevel: "regular", addOnIds: [] } },
          { lineId: "l2", menuItemId: "cold-brew", quantity: 1, customization: { sugarLevel: "regular", iceLevel: "regular", addOnIds: [] } },
        ],
        brandId: "tbc",
        delivery: validDelivery,
        deliveryFor: "self",
        paymentMethod: "cod",
      });
    expect(first.status).toBe(201);
    expect(first.body.order.totals.discountReason).toBe("first-order-bogo");
    expect(first.body.order.totals.discountAmount).toBe(150);

    // Order #2 — a DIFFERENT brand (Alchemy Tails). Still counts as this customer's 2nd
    // quick-delivery order overall, so it gets 50% off despite never having ordered from this
    // brand before — no cross-brand BOGO, no per-brand reset, just a flat 50% off this order.
    const second = await request(app)
      .post("/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({
        items: [
          { lineId: "l1", menuItemId: "mango-mojito", quantity: 1, customization: { sugarLevel: "regular", iceLevel: "regular", addOnIds: [] } },
        ],
        brandId: "alchemy-tails",
        delivery: validDelivery,
        deliveryFor: "self",
        paymentMethod: "cod",
      });
    expect(second.status).toBe(201);
    expect(second.body.order.totals.discountReason).toBe("second-order-half-off");
    expect(second.body.order.totals.discountAmount).toBe(150); // 50% of 300

    // Order #3 — back to ordinary quantity-tier pricing; the offer was one-time only.
    const third = await request(app)
      .post("/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({
        items: [
          { lineId: "l1", menuItemId: "choco-crush", quantity: 1, customization: { sugarLevel: "regular", iceLevel: "regular", addOnIds: [] } },
          { lineId: "l2", menuItemId: "cold-brew", quantity: 1, customization: { sugarLevel: "regular", iceLevel: "regular", addOnIds: [] } },
        ],
        brandId: "tbc",
        delivery: validDelivery,
        deliveryFor: "self",
        paymentMethod: "cod",
      });
    expect(third.status).toBe(201);
    expect(third.body.order.totals.discountReason).toBe("quantity-tier");
  });

  it("a guest (no account) never gets the offer, even on their first order", async () => {
    await seedMenuItems();

    const response = await request(app)
      .post("/orders")
      .send({
        items: [
          { lineId: "l1", menuItemId: "choco-crush", quantity: 1, customization: { sugarLevel: "regular", iceLevel: "regular", addOnIds: [] } },
          { lineId: "l2", menuItemId: "cold-brew", quantity: 1, customization: { sugarLevel: "regular", iceLevel: "regular", addOnIds: [] } },
        ],
        brandId: "tbc",
        delivery: validDelivery,
        deliveryFor: "self",
        paymentMethod: "cod",
      });

    expect(response.status).toBe(201);
    expect(response.body.order.totals.discountReason).toBe("quantity-tier");
  });
});
