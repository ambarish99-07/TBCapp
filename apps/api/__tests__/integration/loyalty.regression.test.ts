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
      brandId: "tbc",
      items: [
        {
          lineId: "l1",
          menuItemId: "choco-crush", // shake, ₹220
          quantity: 1,
          customization: { sugarLevel: "regular", iceLevel: "regular", addOnIds: [] },
        },
        {
          lineId: "l2",
          menuItemId: "cold-brew-classic", // cold coffee, ₹180
          quantity: 1,
          customization: { sugarLevel: "regular", iceLevel: "regular", addOnIds: [] },
        },
      ],
      delivery: validDelivery,
      deliveryFor: "self",
      paymentMethod: "cod",
    });
}

/**
 * Regression coverage for the milestone/premium reward system: places 16 orders
 * as one logged-in user and asserts completedOrderCount advances every time,
 * the 6th/16th-order cold-coffee reward and the 10th-order free-drink reward
 * both fire on schedule, and premium membership (with its flat 25% discount)
 * kicks in starting with the order placed after the 15th completes.
 */
describe("milestone rewards and premium membership advance across a logged-in user's orders", () => {
  it("fires the 6th-order reward, the 10th-order reward, and unlocks premium at order 16", async () => {
    await MenuItemModel.create([
      {
        _id: "choco-crush",
        brandId: "tbc",
        signatureName: "Choco Crush",
        commonName: "Rich Chocolate Shake",
        description: "A rich, indulgent chocolate shake.",
        price: 220,
        category: "signature-shakes",
        image: "https://example.com/choco-crush.jpg",
        flavorBadges: [],
      },
      {
        _id: "cold-brew-classic",
        brandId: "tbc",
        signatureName: "Cold Brew Classic",
        commonName: "Classic Cold Coffee",
        description: "A classic, smooth cold coffee.",
        price: 180,
        category: "cold-coffee",
        image: "https://example.com/cold-brew.jpg",
        flavorBadges: [],
      },
    ]);

    const signupResponse = await request(app).post("/auth/signup").send({
      email: "loyal@example.com",
      password: "password123",
      fullName: "Loyal Customer",
      phone: "9999999999",
    });
    expect(signupResponse.status).toBe(201);
    const token: string = signupResponse.body.token;

    // Order 1: the new-customer offer takes precedence over quantity-tier — Buy 1 Get 1 Free
    // gives away the cheaper 180 cold-coffee unit.
    const firstOrder = await placeCodOrder(token);
    expect(firstOrder.status).toBe(201);
    expect(firstOrder.body.order.totals.discountReason).toBe("first-order-bogo");
    expect(firstOrder.body.order.totals.discountAmount).toBe(180);
    expect(firstOrder.body.order.totals.rewardReason).toBe("none");
    const meAfterFirst = await request(app).get("/auth/me").set("Authorization", `Bearer ${token}`);
    expect(meAfterFirst.body.user.loyalty.completedOrderCount).toBe(1);

    // Order 2: still the new-customer offer, now the flat 50%-off — 50% of the 400 subtotal.
    const secondOrder = await placeCodOrder(token);
    expect(secondOrder.status).toBe(201);
    expect(secondOrder.body.order.totals.discountReason).toBe("second-order-half-off");
    expect(secondOrder.body.order.totals.discountAmount).toBe(200);
    expect(secondOrder.body.order.totals.rewardReason).toBe("none");
    const meAfterSecond = await request(app).get("/auth/me").set("Authorization", `Bearer ${token}`);
    expect(meAfterSecond.body.user.loyalty.completedOrderCount).toBe(2);

    // Orders 3-5: the one-time new-customer offer is spent — ordinary quantity-tier discount
    // only (2 items -> 10%), no milestone reward yet.
    for (let i = 3; i <= 5; i++) {
      const orderResponse = await placeCodOrder(token);
      expect(orderResponse.status).toBe(201);
      expect(orderResponse.body.order.totals.discountReason).toBe("quantity-tier");
      expect(orderResponse.body.order.totals.rewardReason).toBe("none");

      const me = await request(app).get("/auth/me").set("Authorization", `Bearer ${token}`);
      expect(me.body.user.loyalty.completedOrderCount).toBe(i);
    }

    // Order 6: 50% off the cheapest cold-coffee unit (₹180 -> ₹90 reward).
    const sixthOrder = await placeCodOrder(token);
    expect(sixthOrder.body.order.totals.rewardReason).toBe("sixth-order-cold-coffee");
    expect(sixthOrder.body.order.totals.rewardAmount).toBe(90);

    // Orders 7-9: back to no reward.
    for (let i = 7; i <= 9; i++) {
      const orderResponse = await placeCodOrder(token);
      expect(orderResponse.body.order.totals.rewardReason).toBe("none");
    }

    // Order 10: the cheapest eligible drink (₹180 cold coffee) is entirely free.
    const tenthOrder = await placeCodOrder(token);
    expect(tenthOrder.body.order.totals.rewardReason).toBe("tenth-order-free-drink");
    expect(tenthOrder.body.order.totals.rewardAmount).toBe(180);
    expect(tenthOrder.body.order.isPremiumMemberAtOrder).toBe(false);

    // Orders 11-15: still not premium (completedOrderCount reaches 15 only after order 15 completes).
    for (let i = 11; i <= 15; i++) {
      const orderResponse = await placeCodOrder(token);
      expect(orderResponse.body.order.isPremiumMemberAtOrder).toBe(false);
    }

    const meBeforeSixteenth = await request(app).get("/auth/me").set("Authorization", `Bearer ${token}`);
    expect(meBeforeSixteenth.body.user.loyalty.completedOrderCount).toBe(15);

    // Order 16: premium is now active (flat 25%), AND this is also a 6th-cycle-position
    // order (16 mod 10 = 6), so the cold-coffee reward stacks on top of it.
    const sixteenthOrder = await placeCodOrder(token);
    expect(sixteenthOrder.body.order.isPremiumMemberAtOrder).toBe(true);
    expect(sixteenthOrder.body.order.totals.discountReason).toBe("premium");
    expect(sixteenthOrder.body.order.totals.discountAmount).toBe(100); // round(400 * 0.25)
    expect(sixteenthOrder.body.order.totals.rewardReason).toBe("sixth-order-cold-coffee");
    expect(sixteenthOrder.body.order.totals.rewardAmount).toBe(90);
  });
});
