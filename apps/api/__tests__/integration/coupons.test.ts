import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
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

async function seedMenuItem(overrides: Partial<{ _id: string; price: number }> = {}) {
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

describe("GET /coupons/active", () => {
  it("lists active brand-wide and brand-specific coupons for the given brand, excluding other brands and inactive/expired ones", async () => {
    await CouponModel.create({ code: "WELCOME50", type: "percent", value: 50, minOrderAmount: 0, isActive: true });
    await CouponModel.create({ code: "TBCONLY", type: "flat", value: 20, minOrderAmount: 0, brandId: "tbc", isActive: true });
    await CouponModel.create({ code: "OTHERBRAND", type: "flat", value: 20, minOrderAmount: 0, brandId: "alchemy-tails", isActive: true });
    await CouponModel.create({ code: "INACTIVE", type: "flat", value: 20, minOrderAmount: 0, isActive: false });
    await CouponModel.create({ code: "EXPIRED", type: "flat", value: 20, minOrderAmount: 0, isActive: true, expiresAt: new Date("2020-01-01") });

    const response = await request(app).get("/coupons/active").query({ brandId: "tbc" });

    expect(response.status).toBe(200);
    const codes = response.body.coupons.map((c: { code: string }) => c.code).sort();
    expect(codes).toEqual(["TBCONLY", "WELCOME50"]);
  });

  it("requires a brandId query param", async () => {
    const response = await request(app).get("/coupons/active");
    expect(response.status).toBe(400);
  });
});

describe("POST /coupons/validate", () => {
  it("returns the discount for a valid percent coupon, capped at maxDiscountAmount", async () => {
    await CouponModel.create({ code: "WELCOME50", type: "percent", value: 50, minOrderAmount: 0, maxDiscountAmount: 100, isActive: true });

    const response = await request(app).post("/coupons/validate").send({ code: "welcome50", brandId: "tbc", subtotal: 400 });

    expect(response.status).toBe(200);
    // 50% of 400 = 200, capped at 100
    expect(response.body.discountAmount).toBe(100);
    expect(response.body.code).toBe("WELCOME50");
  });

  it("returns the flat discount when it's below the subtotal", async () => {
    await CouponModel.create({ code: "FLAT50", type: "flat", value: 50, minOrderAmount: 200, isActive: true });

    const response = await request(app).post("/coupons/validate").send({ code: "FLAT50", brandId: "tbc", subtotal: 300 });

    expect(response.status).toBe(200);
    expect(response.body.discountAmount).toBe(50);
  });

  it("rejects an unknown code", async () => {
    const response = await request(app).post("/coupons/validate").send({ code: "NOPE", brandId: "tbc", subtotal: 300 });
    expect(response.status).toBe(400);
  });

  it("rejects when the cart is below minOrderAmount", async () => {
    await CouponModel.create({ code: "FLAT50", type: "flat", value: 50, minOrderAmount: 200, isActive: true });

    const response = await request(app).post("/coupons/validate").send({ code: "FLAT50", brandId: "tbc", subtotal: 100 });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain("more");
  });

  it("rejects a coupon scoped to a different brand", async () => {
    await CouponModel.create({ code: "TBCONLY", type: "flat", value: 20, minOrderAmount: 0, brandId: "tbc", isActive: true });

    const response = await request(app).post("/coupons/validate").send({ code: "TBCONLY", brandId: "alchemy-tails", subtotal: 300 });

    expect(response.status).toBe(400);
  });

  it("rejects an inactive coupon", async () => {
    await CouponModel.create({ code: "OLDCODE", type: "flat", value: 20, minOrderAmount: 0, isActive: false });

    const response = await request(app).post("/coupons/validate").send({ code: "OLDCODE", brandId: "tbc", subtotal: 300 });

    expect(response.status).toBe(400);
  });
});

describe("POST /orders — coupon applied at checkout", () => {
  it("re-validates the coupon server-side and reflects the discount in the order's totals", async () => {
    await seedMenuItem({ price: 220 });
    await CouponModel.create({ code: "FLAT50", type: "flat", value: 50, minOrderAmount: 0, isActive: true });

    const response = await request(app)
      .post("/orders")
      .send({
        items: [
          { lineId: "l1", menuItemId: "choco-crush", quantity: 1, customization: { sugarLevel: "regular", iceLevel: "regular", addOnIds: [] } },
        ],
        brandId: "tbc",
        delivery: validDelivery,
        deliveryFor: "self",
        paymentMethod: "cod",
        couponCode: "flat50",
      });

    expect(response.status).toBe(201);
    // 220 subtotal - 50 coupon = 170 taxable, tax round(170*0.05)=9, total = 170+9+39 = 218.
    expect(response.body.order.totals.couponCode).toBe("FLAT50");
    expect(response.body.order.totals.couponDiscountAmount).toBe(50);
    expect(response.body.order.totals.total).toBe(218);
  });

  it("rejects order creation outright when the coupon code is invalid", async () => {
    await seedMenuItem({ price: 220 });

    const response = await request(app)
      .post("/orders")
      .send({
        items: [
          { lineId: "l1", menuItemId: "choco-crush", quantity: 1, customization: { sugarLevel: "regular", iceLevel: "regular", addOnIds: [] } },
        ],
        brandId: "tbc",
        delivery: validDelivery,
        deliveryFor: "self",
        paymentMethod: "cod",
        couponCode: "NOPE",
      });

    expect(response.status).toBe(400);
  });
});
