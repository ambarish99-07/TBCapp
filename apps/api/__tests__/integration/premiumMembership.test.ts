import { PREMIUM_MEMBERSHIP_DURATION_DAYS } from "@tbc/shared-types";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { MenuItemModel } from "../../src/db/models/MenuItem.model.js";
import { UserModel } from "../../src/db/models/User.model.js";
import { clearTestDb, startTestDb, stopTestDb, testEnv } from "./testDb.js";

// Own file so it gets its own signup rate-limit budget — needs 5 fresh signups.
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

async function signup(email: string, phone: string): Promise<string> {
  const response = await request(app)
    .post("/auth/signup")
    .send({ fullName: "Membership Tester", email, phone, password: "password123" });
  return response.body.token;
}

function todayPlusDays(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

describe("Premium Membership purchase", () => {
  it("rejects Cash on Delivery — a membership can only ever be paid online", async () => {
    const token = await signup("member-cod@example.com", "9812400060");

    const response = await request(app).post("/premium-membership/purchase").set("Authorization", `Bearer ${token}`).send({ paymentMethod: "cod" });

    expect(response.status).toBe(400);
  });

  it("allows Razorpay but doesn't activate until verified, and extends from the current expiry once already active", async () => {
    const token = await signup("member-razorpay@example.com", "9812400061");
    const me = await request(app).get("/auth/me").set("Authorization", `Bearer ${token}`);

    const first = await request(app)
      .post("/premium-membership/purchase")
      .set("Authorization", `Bearer ${token}`)
      .send({ paymentMethod: "razorpay" });

    expect(first.status).toBe(201);
    expect(first.body.purchase.orderNumber).toMatch(/^PM-/);
    expect(first.body.purchase.payment.status).toBe("pending");
    expect(first.body.user.premiumMembershipExpiresAt).toBeUndefined();

    const status = await request(app).get("/premium-membership/status").set("Authorization", `Bearer ${token}`);
    expect(status.body.active).toBe(false);

    // Simulates an already-active membership — the real path there is a verified Razorpay
    // payment, which can't be produced in a test without live keys.
    await UserModel.findByIdAndUpdate(me.body.user.id, { premiumMembershipExpiresAt: new Date(`${todayPlusDays(30)}T00:00:00Z`) });

    const second = await request(app)
      .post("/premium-membership/purchase")
      .set("Authorization", `Bearer ${token}`)
      .send({ paymentMethod: "razorpay" });

    expect(second.status).toBe(201);
    // The new pending purchase's expiry is extended from the still-active current one (today+30),
    // not reset to today+PREMIUM_MEMBERSHIP_DURATION_DAYS.
    expect(second.body.purchase.expiresAt).toBe(todayPlusDays(30 + PREMIUM_MEMBERSHIP_DURATION_DAYS));
  });

  it("rejects creating a Razorpay order for a purchase the caller doesn't own", async () => {
    const ownerToken = await signup("owner@example.com", "9812400062");
    const otherToken = await signup("other@example.com", "9812400063");

    const purchase = await request(app)
      .post("/premium-membership/purchase")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ paymentMethod: "razorpay" });

    const response = await request(app)
      .post(`/premium-membership/purchases/${purchase.body.purchase.id}/razorpay-order`)
      .set("Authorization", `Bearer ${otherToken}`);

    expect(response.status).toBe(400);
  });

  it("requires authentication for both purchasing and checking status", async () => {
    const purchaseResponse = await request(app).post("/premium-membership/purchase").send({ paymentMethod: "razorpay" });
    expect(purchaseResponse.status).toBe(401);

    const statusResponse = await request(app).get("/premium-membership/status");
    expect(statusResponse.status).toBe(401);
  });
});

describe("Premium Membership waives the delivery fee on real orders", () => {
  it("a logged-in order gets free delivery once the account has an active membership, regardless of distance or subtotal", async () => {
    await MenuItemModel.create({
      _id: "choco-crush",
      brandId: "tbc",
      signatureName: "Choco Crush",
      commonName: "Rich Chocolate Shake",
      description: "A rich, indulgent chocolate shake.",
      price: 100,
      category: "signature-shakes",
      image: "https://example.com/choco-crush.jpg",
      flavorBadges: ["Chocolate Lover"],
    });
    const token = await signup("free-delivery@example.com", "9812400064");
    const me = await request(app).get("/auth/me").set("Authorization", `Bearer ${token}`);
    // Simulates an already-active membership — the real path there is a verified Razorpay
    // payment, which can't be produced in a test without live keys.
    await UserModel.findByIdAndUpdate(me.body.user.id, { premiumMembershipExpiresAt: new Date(`${todayPlusDays(30)}T00:00:00Z`) });

    const orderResponse = await request(app)
      .post("/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({
        items: [
          {
            lineId: "l1",
            menuItemId: "choco-crush",
            quantity: 1,
            customization: { sugarLevel: "regular", iceLevel: "regular", addOnIds: [] },
          },
        ],
        brandId: "tbc",
        delivery: {
          fullName: "Test Customer",
          phone: "9999999999",
          address: "123 Test St",
          city: "Patna",
          pincode: "800001",
          distanceFromShopKm: 11,
        },
        deliveryFor: "self",
        paymentMethod: "cod",
      });

    expect(orderResponse.status).toBe(201);
    // 100 subtotal (well below the 499 free-delivery threshold), 11km (outside the loyalty
    // premium radius) — delivery is only free here because of the purchased membership.
    expect(orderResponse.body.order.totals.subtotal).toBe(100);
    expect(orderResponse.body.order.totals.deliveryFee).toBe(0);
  });
});
