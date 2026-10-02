import { FEAST_COMBO_BRAND_ID, makeComboLineId } from "@tbc/shared-types";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { BrandModel } from "../../src/db/models/Brand.model.js";
import { BrandStoreSettingsModel } from "../../src/db/models/BrandStoreSettings.model.js";
import { ComboModel } from "../../src/db/models/Combo.model.js";
import { CouponModel } from "../../src/db/models/Coupon.model.js";
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

function item(_id: string, brandId: string, price: number, category: string) {
  return {
    _id,
    brandId,
    signatureName: _id,
    commonName: _id,
    description: "desc",
    price,
    category,
    image: "https://example.com/x.jpg",
    flavorBadges: [],
  };
}

function line(menuItemId: string, quantity = 1) {
  return { lineId: `l-${menuItemId}`, menuItemId, quantity, customization: { addOnIds: [] } };
}

beforeEach(async () => {
  await BrandModel.create([
    { _id: "tbc", name: "The Blenders Club", status: "live" },
    { _id: "TBL", name: "The Biryani Lane", status: "live" },
    { _id: "alchemy-tails", name: "Alchemy Tails", status: "live" },
    { _id: "soon", name: "Coming Soon Kitchen", status: "coming-soon" },
  ]);
  // Hours off so the suite doesn't depend on the wall clock — only the manual switch matters here.
  await BrandStoreSettingsModel.create(
    ["tbc", "TBL", "alchemy-tails", "soon"].map((_id) => ({ _id, enforceServiceHours: false }))
  );
  await MenuItemModel.create([
    item("choco-crush", "tbc", 200, "signature-shakes"),
    item("chicken-biryani", "TBL", 250, "Biryani"),
    item("virgin-mojito", "alchemy-tails", 150, "mocktails"),
    item("future-dish", "soon", 100, "Momos"),
  ]);
});

describe("POST /orders — one order across several kitchens", () => {
  it("accepts items from different kitchens in one order, tagging each line with its kitchen", async () => {
    const response = await request(app)
      .post("/orders")
      .send({
        items: [line("chicken-biryani"), line("choco-crush"), line("virgin-mojito")],
        delivery: validDelivery,
        deliveryFor: "self",
        paymentMethod: "cod",
      });

    expect(response.status).toBe(201);
    expect(response.body.order.brandIds).toEqual(["TBL", "tbc", "alchemy-tails"]);
    expect(response.body.order.brandId).toBe("TBL");
    expect(response.body.order.items.map((l: { brandId: string }) => l.brandId)).toEqual(["TBL", "tbc", "alchemy-tails"]);
    expect(response.body.order.totals.subtotal).toBe(600);
  });

  it("names the closed kitchen when one kitchen in a mixed order is closed", async () => {
    await BrandStoreSettingsModel.updateOne({ _id: "TBL" }, { manuallyOpen: false });

    const response = await request(app)
      .post("/orders")
      .send({ items: [line("chicken-biryani"), line("choco-crush")], delivery: validDelivery, deliveryFor: "self", paymentMethod: "cod" });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain("The Biryani Lane is closed");
  });

  it("still lets the open kitchens' items be ordered without the closed one's", async () => {
    await BrandStoreSettingsModel.updateOne({ _id: "TBL" }, { manuallyOpen: false });

    const response = await request(app)
      .post("/orders")
      .send({ items: [line("choco-crush"), line("virgin-mojito")], delivery: validDelivery, deliveryFor: "self", paymentMethod: "cod" });

    expect(response.status).toBe(201);
  });

  it("refuses an item from a kitchen that isn't live yet", async () => {
    const response = await request(app)
      .post("/orders")
      .send({ items: [line("future-dish")], delivery: validDelivery, deliveryFor: "self", paymentMethod: "cod" });

    expect(response.status).toBe(400);
  });

  it("applies a kitchen-specific coupon when that kitchen is part of a mixed cart", async () => {
    await CouponModel.create({ code: "TBCONLY", type: "flat", value: 20, minOrderAmount: 0, brandId: "tbc", isActive: true });

    const response = await request(app)
      .post("/orders")
      .send({
        items: [line("chicken-biryani"), line("choco-crush")],
        delivery: validDelivery,
        deliveryFor: "self",
        paymentMethod: "cod",
        couponCode: "TBCONLY",
      });

    expect(response.status).toBe(201);
    expect(response.body.order.totals.couponDiscountAmount).toBe(20);
  });
});

describe("Feast combos", () => {
  it("prices a curated Feast combo spanning kitchens and records every kitchen on the order", async () => {
    await ComboModel.create({
      _id: "feast-solo",
      brandId: FEAST_COMBO_BRAND_ID,
      type: "curated",
      name: "Solo Feast",
      description: "desc",
      itemIds: ["chicken-biryani", "choco-crush", "virgin-mojito"],
    });

    const response = await request(app)
      .post("/orders")
      .send({ items: [line(makeComboLineId("feast-solo", "x"))], delivery: validDelivery, deliveryFor: "self", paymentMethod: "cod" });

    expect(response.status).toBe(201);
    // 15% default combo discount off 250 + 200 + 150.
    expect(response.body.order.items[0].unitPrice).toBe(510);
    expect(response.body.order.items[0].brandId).toBe(FEAST_COMBO_BRAND_ID);
    expect(response.body.order.brandIds).toEqual(["TBL", "tbc", "alchemy-tails"]);
  });

  it("lets a build-your-own Feast with an empty eligible list pick from any live kitchen", async () => {
    await ComboModel.create({
      _id: "feast-byo",
      brandId: FEAST_COMBO_BRAND_ID,
      type: "choose-n",
      name: "Build Your Own Feast",
      description: "desc",
      chooseCount: 2,
      eligibleItemIds: [],
    });

    const ok = await request(app)
      .post("/orders")
      .send({
        items: [line(makeComboLineId("feast-byo", "chicken-biryani+virgin-mojito"))],
        delivery: validDelivery,
        deliveryFor: "self",
        paymentMethod: "cod",
      });
    expect(ok.status).toBe(201);
    expect(ok.body.order.brandIds).toEqual(["TBL", "alchemy-tails"]);

    const notLive = await request(app)
      .post("/orders")
      .send({
        items: [line(makeComboLineId("feast-byo", "chicken-biryani+future-dish"))],
        delivery: validDelivery,
        deliveryFor: "self",
        paymentMethod: "cod",
      });
    expect(notLive.status).toBe(400);
  });

  it("lets a Feast build-your-own repeat an item, and summarizes repeats for the kitchen", async () => {
    await ComboModel.create({
      _id: "feast-byo-four",
      brandId: FEAST_COMBO_BRAND_ID,
      type: "choose-n",
      feastSize: "four",
      name: "Build Your Own — For Four",
      description: "desc",
      chooseCount: 4,
      eligibleItemIds: [],
    });

    const response = await request(app)
      .post("/orders")
      .send({
        items: [line(makeComboLineId("feast-byo-four", "chicken-biryani+chicken-biryani+chicken-biryani+choco-crush"))],
        delivery: validDelivery,
        deliveryFor: "self",
        paymentMethod: "cod",
      });

    expect(response.status).toBe(201);
    // 15% default off 3 × 250 + 200 = 950, rounded to whole rupees.
    expect(response.body.order.items[0].unitPrice).toBe(808);
    expect(response.body.order.items[0].commonName).toBe("3× chicken-biryani + choco-crush");
  });

  it("still refuses repeats in a kitchen's own pick-N combo", async () => {
    await MenuItemModel.create(item("cookie-crush", "tbc", 220, "signature-shakes"));
    await ComboModel.create({
      _id: "tbc-duo",
      brandId: "tbc",
      type: "choose-n",
      name: "Duo",
      description: "desc",
      chooseCount: 2,
      eligibleItemIds: ["choco-crush", "cookie-crush"],
    });

    const response = await request(app)
      .post("/orders")
      .send({ items: [line(makeComboLineId("tbc-duo", "choco-crush+choco-crush"))], delivery: validDelivery, deliveryFor: "self", paymentMethod: "cod" });

    expect(response.status).toBe(400);
  });

  it("blocks a Feast combo when one of its kitchens is closed", async () => {
    await ComboModel.create({
      _id: "feast-solo",
      brandId: FEAST_COMBO_BRAND_ID,
      type: "curated",
      name: "Solo Feast",
      description: "desc",
      itemIds: ["chicken-biryani", "choco-crush"],
    });
    await BrandStoreSettingsModel.updateOne({ _id: "tbc" }, { manuallyOpen: false });

    const response = await request(app)
      .post("/orders")
      .send({ items: [line(makeComboLineId("feast-solo", "x"))], delivery: validDelivery, deliveryFor: "self", paymentMethod: "cod" });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain("The Blenders Club is closed");
  });

  it("lists Feast combos alongside every live kitchen's own combos", async () => {
    await ComboModel.create([
      { _id: "feast-solo", brandId: FEAST_COMBO_BRAND_ID, type: "curated", name: "Solo Feast", description: "d", itemIds: ["chicken-biryani", "choco-crush"] },
      { _id: "tbc-duo", brandId: "tbc", type: "curated", name: "Duo", description: "d", itemIds: ["choco-crush", "choco-crush"] },
    ]);

    const response = await request(app).get("/menu/combos/all");

    expect(response.status).toBe(200);
    const ids = response.body.combos.map((c: { id: string }) => c.id).sort();
    expect(ids).toEqual(["feast-solo", "tbc-duo"]);
  });
});
