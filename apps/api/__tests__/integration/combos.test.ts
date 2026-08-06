import { makeComboLineId } from "@tbc/shared-types";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { ComboModel } from "../../src/db/models/Combo.model.js";
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

const validDelivery = {
  fullName: "Test Customer",
  phone: "9999999999",
  address: "123 Test St",
  city: "Patna",
  pincode: "800001",
};

async function seedShakes() {
  await MenuItemModel.create([
    {
      _id: "choco-crush",
      signatureName: "Choco Crush",
      commonName: "Rich Chocolate Shake",
      description: "desc",
      price: 220,
      category: "signature-shakes",
      image: "https://example.com/a.jpg",
      flavorBadges: [],
    },
    {
      _id: "oreo-blast",
      signatureName: "Oreo Blast",
      commonName: "Cookies & Cream Shake",
      description: "desc",
      price: 240,
      category: "signature-shakes",
      image: "https://example.com/b.jpg",
      flavorBadges: [],
    },
    {
      _id: "mango-tango",
      signatureName: "Mango Tango",
      commonName: "Mango Shake",
      description: "desc",
      price: 200,
      category: "signature-shakes",
      image: "https://example.com/c.jpg",
      flavorBadges: [],
    },
  ]);
}

describe("curated combo pricing", () => {
  it("charges 15% off the sum of the two constituent shakes' base prices", async () => {
    await seedShakes();
    await ComboModel.create({
      _id: "chocolate-duo",
      type: "curated",
      name: "Chocolate Duo",
      description: "desc",
      itemIds: ["choco-crush", "oreo-blast"],
    });

    const lineId = makeComboLineId("chocolate-duo", "fixed");
    const response = await request(app)
      .post("/orders")
      .send({
        items: [
          {
            lineId,
            menuItemId: lineId,
            quantity: 1,
            customization: { sugarLevel: "regular", iceLevel: "regular", addOnIds: [] },
          },
        ],
        delivery: validDelivery,
        paymentMethod: "cod",
      });

    expect(response.status).toBe(201);
    // (220 + 240) * 0.85 = 391
    expect(response.body.order.items[0].unitPrice).toBe(391);
    expect(response.body.order.items[0].originalUnitPrice).toBe(460);
  });
});

describe("choose-your-own combo pricing", () => {
  it("charges 15% off the sum of whichever two eligible items the customer picked", async () => {
    await seedShakes();
    await ComboModel.create({
      _id: "choose-your-own-2",
      type: "choose-n",
      name: "Choose Your Own Duo",
      description: "desc",
      chooseCount: 2,
      eligibleItemIds: ["choco-crush", "oreo-blast", "mango-tango"],
    });

    const lineId = makeComboLineId("choose-your-own-2", "mango-tango+oreo-blast");
    const response = await request(app)
      .post("/orders")
      .send({
        items: [
          {
            lineId,
            menuItemId: lineId,
            quantity: 1,
            customization: { sugarLevel: "regular", iceLevel: "regular", addOnIds: [] },
          },
        ],
        delivery: validDelivery,
        paymentMethod: "cod",
      });

    expect(response.status).toBe(201);
    // (200 + 240) * 0.85 = 374
    expect(response.body.order.items[0].unitPrice).toBe(374);
  });

  it("rejects a selection that doesn't match chooseCount", async () => {
    await seedShakes();
    await ComboModel.create({
      _id: "choose-your-own-2",
      type: "choose-n",
      name: "Choose Your Own Duo",
      description: "desc",
      chooseCount: 2,
      eligibleItemIds: ["choco-crush", "oreo-blast", "mango-tango"],
    });

    const lineId = makeComboLineId("choose-your-own-2", "mango-tango");
    const response = await request(app)
      .post("/orders")
      .send({
        items: [
          {
            lineId,
            menuItemId: lineId,
            quantity: 1,
            customization: { sugarLevel: "regular", iceLevel: "regular", addOnIds: [] },
          },
        ],
        delivery: validDelivery,
        paymentMethod: "cod",
      });

    expect(response.status).toBe(400);
  });

  it("rejects an ineligible item and a duplicated item", async () => {
    await seedShakes();
    await MenuItemModel.create({
      _id: "cold-brew-classic",
      signatureName: "Cold Brew Classic",
      commonName: "Classic Cold Coffee",
      description: "desc",
      price: 180,
      category: "cold-coffee",
      image: "https://example.com/d.jpg",
      flavorBadges: [],
    });
    await ComboModel.create({
      _id: "choose-your-own-2",
      type: "choose-n",
      name: "Choose Your Own Duo",
      description: "desc",
      chooseCount: 2,
      eligibleItemIds: ["choco-crush", "oreo-blast", "mango-tango"],
    });

    const ineligibleLineId = makeComboLineId("choose-your-own-2", "cold-brew-classic+mango-tango");
    const ineligibleResponse = await request(app)
      .post("/orders")
      .send({
        items: [
          {
            lineId: ineligibleLineId,
            menuItemId: ineligibleLineId,
            quantity: 1,
            customization: { sugarLevel: "regular", iceLevel: "regular", addOnIds: [] },
          },
        ],
        delivery: validDelivery,
        paymentMethod: "cod",
      });
    expect(ineligibleResponse.status).toBe(400);

    const duplicateLineId = makeComboLineId("choose-your-own-2", "mango-tango+mango-tango");
    const duplicateResponse = await request(app)
      .post("/orders")
      .send({
        items: [
          {
            lineId: duplicateLineId,
            menuItemId: duplicateLineId,
            quantity: 1,
            customization: { sugarLevel: "regular", iceLevel: "regular", addOnIds: [] },
          },
        ],
        delivery: validDelivery,
        paymentMethod: "cod",
      });
    expect(duplicateResponse.status).toBe(400);
  });
});
