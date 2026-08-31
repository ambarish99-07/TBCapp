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

async function signup(fullName: string, email: string, phone: string): Promise<string> {
  const response = await request(app).post("/auth/signup").send({ fullName, email, phone, password: "password123" });
  return response.body.token;
}

/** A minimal already-priced cart line, the shape /coupons/validate now takes instead of a bare
 * subtotal number — some coupon mechanics (e.g. "bogo") need each unit's own price. */
function pricingLine(unitPrice: number, quantity = 1, isCombo = false) {
  return { unitPrice, addOnPrices: [], quantity, isCombo };
}

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

    const response = await request(app)
      .post("/coupons/validate")
      .send({ code: "welcome50", brandId: "tbc", lines: [pricingLine(400)] });

    expect(response.status).toBe(200);
    // 50% of 400 = 200, capped at 100
    expect(response.body.discountAmount).toBe(100);
    expect(response.body.code).toBe("WELCOME50");
  });

  it("returns the flat discount when it's below the subtotal", async () => {
    await CouponModel.create({ code: "FLAT50", type: "flat", value: 50, minOrderAmount: 200, isActive: true });

    const response = await request(app)
      .post("/coupons/validate")
      .send({ code: "FLAT50", brandId: "tbc", lines: [pricingLine(300)] });

    expect(response.status).toBe(200);
    expect(response.body.discountAmount).toBe(50);
  });

  it("rejects an unknown code", async () => {
    const response = await request(app)
      .post("/coupons/validate")
      .send({ code: "NOPE", brandId: "tbc", lines: [pricingLine(300)] });
    expect(response.status).toBe(400);
  });

  it("rejects when the cart is below minOrderAmount", async () => {
    await CouponModel.create({ code: "FLAT50", type: "flat", value: 50, minOrderAmount: 200, isActive: true });

    const response = await request(app)
      .post("/coupons/validate")
      .send({ code: "FLAT50", brandId: "tbc", lines: [pricingLine(100)] });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain("more");
  });

  it("rejects a coupon scoped to a different brand", async () => {
    await CouponModel.create({ code: "TBCONLY", type: "flat", value: 20, minOrderAmount: 0, brandId: "tbc", isActive: true });

    const response = await request(app)
      .post("/coupons/validate")
      .send({ code: "TBCONLY", brandId: "alchemy-tails", lines: [pricingLine(300)] });

    expect(response.status).toBe(400);
  });

  it("rejects an inactive coupon", async () => {
    await CouponModel.create({ code: "OLDCODE", type: "flat", value: 20, minOrderAmount: 0, isActive: false });

    const response = await request(app)
      .post("/coupons/validate")
      .send({ code: "OLDCODE", brandId: "tbc", lines: [pricingLine(300)] });

    expect(response.status).toBe(400);
  });

  it("rejects a oncePerCustomer coupon for a guest — there's no account to key the one-time use on", async () => {
    await CouponModel.create({ code: "WELCOME50", type: "percent", value: 50, minOrderAmount: 0, isActive: true, oncePerCustomer: true });

    const response = await request(app)
      .post("/coupons/validate")
      .send({ code: "WELCOME50", brandId: "tbc", lines: [pricingLine(300)] });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/log in/i);
  });

  it("allows a logged-in customer to validate a oncePerCustomer coupon they haven't used yet", async () => {
    await CouponModel.create({ code: "WELCOME50", type: "percent", value: 50, minOrderAmount: 0, maxDiscountAmount: 100, isActive: true, oncePerCustomer: true });
    const token = await signup("New Customer", "newcustomer@example.com", "9812399999");

    const response = await request(app)
      .post("/coupons/validate")
      .set("Authorization", `Bearer ${token}`)
      .send({ code: "WELCOME50", brandId: "tbc", lines: [pricingLine(400)] });

    expect(response.status).toBe(200);
    expect(response.body.discountAmount).toBe(100);
  });

  it("rejects re-use of a oncePerCustomer coupon once it's already been redeemed by this account", async () => {
    await CouponModel.create({
      code: "WELCOME50",
      type: "percent",
      value: 50,
      minOrderAmount: 0,
      isActive: true,
      oncePerCustomer: true,
      usedByUserIds: ["already-used-user-id"],
    });
    const token = await signup("Repeat Customer", "repeat@example.com", "9812388888");
    // Force this account's own id into usedByUserIds via a second write, since signup doesn't
    // hand back the raw user id directly — fetch it via /auth/me instead.
    const me = await request(app).get("/auth/me").set("Authorization", `Bearer ${token}`);
    await CouponModel.updateOne({ code: "WELCOME50" }, { $addToSet: { usedByUserIds: me.body.user.id } });

    const response = await request(app)
      .post("/coupons/validate")
      .set("Authorization", `Bearer ${token}`)
      .send({ code: "WELCOME50", brandId: "tbc", lines: [pricingLine(400)] });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/already used/i);
  });
});

describe("POST /coupons/validate — bogo", () => {
  it("makes the cheapest eligible unit free when there are at least 2 eligible units", async () => {
    await CouponModel.create({ code: "BOGO", type: "bogo", value: 0, minOrderAmount: 0, isActive: true });

    const response = await request(app)
      .post("/coupons/validate")
      .send({ code: "BOGO", brandId: "tbc", lines: [pricingLine(220), pricingLine(180)] });

    expect(response.status).toBe(200);
    expect(response.body.discountAmount).toBe(180);
  });

  it("counts each unit of a multi-quantity line separately", async () => {
    await CouponModel.create({ code: "BOGO", type: "bogo", value: 0, minOrderAmount: 0, isActive: true });

    const response = await request(app)
      .post("/coupons/validate")
      .send({ code: "BOGO", brandId: "tbc", lines: [pricingLine(220, 2)] });

    expect(response.status).toBe(200);
    expect(response.body.discountAmount).toBe(220);
  });

  it("rejects with a clear message when the cart has fewer than 2 eligible units", async () => {
    await CouponModel.create({ code: "BOGO", type: "bogo", value: 0, minOrderAmount: 0, isActive: true });

    const response = await request(app)
      .post("/coupons/validate")
      .send({ code: "BOGO", brandId: "tbc", lines: [pricingLine(220)] });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/one more/i);
  });

  it("never counts combo lines toward eligibility", async () => {
    await CouponModel.create({ code: "BOGO", type: "bogo", value: 0, minOrderAmount: 0, isActive: true });

    const response = await request(app)
      .post("/coupons/validate")
      .send({ code: "BOGO", brandId: "tbc", lines: [pricingLine(391, 1, true), pricingLine(350, 1, true)] });

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

  it("retires a oncePerCustomer coupon for this account the moment a COD order using it is placed", async () => {
    await seedMenuItem({ price: 220 });
    await CouponModel.create({ code: "WELCOME50", type: "percent", value: 50, minOrderAmount: 0, maxDiscountAmount: 100, isActive: true, oncePerCustomer: true });
    const token = await signup("Welcome Customer", "welcome@example.com", "9812377777");
    const authHeader = `Bearer ${token}`;

    const firstOrder = await request(app)
      .post("/orders")
      .set("Authorization", authHeader)
      .send({
        items: [
          { lineId: "l1", menuItemId: "choco-crush", quantity: 1, customization: { sugarLevel: "regular", iceLevel: "regular", addOnIds: [] } },
        ],
        brandId: "tbc",
        delivery: validDelivery,
        deliveryFor: "self",
        paymentMethod: "cod",
        couponCode: "WELCOME50",
      });
    expect(firstOrder.status).toBe(201);
    expect(firstOrder.body.order.totals.couponCode).toBe("WELCOME50");

    // Still shows up for a guest/other customer, but no longer usable by this same account.
    const activeForThisCustomer = await request(app).get("/coupons/active").query({ brandId: "tbc" }).set("Authorization", authHeader);
    expect(activeForThisCustomer.body.coupons.map((c: { code: string }) => c.code)).not.toContain("WELCOME50");

    const secondOrder = await request(app)
      .post("/orders")
      .set("Authorization", authHeader)
      .send({
        items: [
          { lineId: "l1", menuItemId: "choco-crush", quantity: 1, customization: { sugarLevel: "regular", iceLevel: "regular", addOnIds: [] } },
        ],
        brandId: "tbc",
        delivery: validDelivery,
        deliveryFor: "self",
        paymentMethod: "cod",
        couponCode: "WELCOME50",
      });
    expect(secondOrder.status).toBe(400);
    expect(secondOrder.body.error).toMatch(/already used/i);
  });

  it("applies a bogo coupon at checkout, making the cheaper of two items free", async () => {
    await seedMenuItem({ _id: "choco-crush", price: 220 });
    await seedMenuItem({ _id: "mango-tango", price: 180 });
    await CouponModel.create({ code: "BOGO", type: "bogo", value: 0, minOrderAmount: 0, isActive: true });

    const response = await request(app)
      .post("/orders")
      .send({
        items: [
          { lineId: "l1", menuItemId: "choco-crush", quantity: 1, customization: { sugarLevel: "regular", iceLevel: "regular", addOnIds: [] } },
          { lineId: "l2", menuItemId: "mango-tango", quantity: 1, customization: { sugarLevel: "regular", iceLevel: "regular", addOnIds: [] } },
        ],
        brandId: "tbc",
        delivery: validDelivery,
        deliveryFor: "self",
        paymentMethod: "cod",
        couponCode: "BOGO",
      });

    expect(response.status).toBe(201);
    expect(response.body.order.totals.couponCode).toBe("BOGO");
    // Cheaper of the two (180) is free.
    expect(response.body.order.totals.couponDiscountAmount).toBe(180);
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
