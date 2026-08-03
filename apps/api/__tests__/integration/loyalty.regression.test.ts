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

const validDelivery = {
  fullName: "Loyal Customer",
  phone: "9999999999",
  address: "123 Test St",
  city: "Patna",
  pincode: "800001",
};

async function placeCodOrder(token: string) {
  return request(app)
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
      delivery: validDelivery,
      paymentMethod: "cod",
    });
}

/**
 * Regression test for a real bug found in the original build: registered-user
 * loyalty/punch-card counters were never wired up to advance at all. This test
 * places several orders as one logged-in user and asserts both the loyalty tier
 * (via completedOrderCount) and the punch-card counter visibly move, including
 * the punch-card discount actually firing on the 6th order and resetting after.
 */
describe("loyalty tier + punch-card counters advance across a logged-in user's orders", () => {
  it("increments completedOrderCount and ordersSinceReward per COD order, firing + resetting the punch card at order 6", async () => {
    await MenuItemModel.create({
      _id: "choco-crush",
      signatureName: "Choco Crush",
      commonName: "Rich Chocolate Shake",
      description: "A rich, indulgent chocolate shake.",
      price: 220,
      category: "signature-shakes",
      image: "https://example.com/choco-crush.jpg",
      flavorBadges: ["Chocolate Lover"],
    });

    const signupResponse = await request(app).post("/auth/signup").send({
      email: "loyal@example.com",
      password: "password123",
      fullName: "Loyal Customer",
      phone: "9999999999",
    });
    expect(signupResponse.status).toBe(201);
    const token: string = signupResponse.body.token;

    // Orders 1-5: no punch-card discount yet, counters climb by 1 each time.
    for (let i = 1; i <= 5; i++) {
      const orderResponse = await placeCodOrder(token);
      expect(orderResponse.status).toBe(201);
      expect(orderResponse.body.order.totals.punchCardDiscount).toBe(0);

      const me = await request(app).get("/auth/me").set("Authorization", `Bearer ${token}`);
      expect(me.body.user.loyalty.completedOrderCount).toBe(i);
      expect(me.body.user.punchCard.ordersSinceReward).toBe(i);
    }

    // Order 6: ordersSinceReward is now 5 -> punch-card discount fires, and
    // completedOrderCount=5 already qualified the user for the "gold" tier.
    const sixthOrder = await placeCodOrder(token);
    expect(sixthOrder.status).toBe(201);
    expect(sixthOrder.body.order.totals.punchCardDiscount).toBeGreaterThan(0);
    expect(sixthOrder.body.order.loyaltyTierAtOrder).toBe("gold");

    const meAfterSixth = await request(app).get("/auth/me").set("Authorization", `Bearer ${token}`);
    expect(meAfterSixth.body.user.loyalty.completedOrderCount).toBe(6);
    // The reward just fired, so the punch-card cycle resets to 0 rather than climbing to 6.
    expect(meAfterSixth.body.user.punchCard.ordersSinceReward).toBe(0);
  });
});
