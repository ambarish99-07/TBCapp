import jwt from "jsonwebtoken";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { TiffinMealPriceModel } from "../../src/db/models/TiffinMealPrice.model.js";
import { TiffinPlanModel } from "../../src/db/models/TiffinPlan.model.js";
import { TiffinSingleMealOrderModel } from "../../src/db/models/TiffinSingleMealOrder.model.js";
import { UserModel } from "../../src/db/models/User.model.js";
import { clearTestDb, seedTiffinMenu, startTestDb, stopTestDb, testEnv } from "./testDb.js";

const env = testEnv();
const app = createApp(env);

beforeAll(async () => {
  await startTestDb();
});

beforeEach(async () => {
  await seedTiffinMenu();
});

afterEach(async () => {
  await clearTestDb();
});

afterAll(async () => {
  await stopTestDb();
});

let phoneCounter = 0;
async function signup(email: string): Promise<string> {
  phoneCounter += 1;
  const phone = `98${String(phoneCounter).padStart(8, "0")}`;
  const response = await request(app).post("/auth/signup").send({ fullName: "Closure Tester", email, phone, password: "password123" });
  return response.body.token;
}

async function adminToken(): Promise<string> {
  const admin = await UserModel.create({ fullName: "Admin", email: "admin-closure@test.com", passwordHash: "unused", phone: "9888888899", role: "admin" });
  return jwt.sign({ userId: String(admin._id), role: "admin" }, env.JWT_SECRET, { expiresIn: "1h" });
}

const validDelivery = {
  fullName: "Test Customer",
  phone: "9999999999",
  address: "123 Test St",
  city: "Patna",
  pincode: "800001",
};

async function subscribeToWeeklyVeg(token: string) {
  const plan = await TiffinPlanModel.create({ name: "Weekly Veg Plan", dietType: "veg", style: "single", durationDays: 7, price: 899, active: true });
  const response = await request(app)
    .post("/tiffin/subscriptions")
    .set("Authorization", `Bearer ${token}`)
    .send({ planId: plan.id, mealType: "lunch", delivery: validDelivery, paymentMethod: "cod" });
  const meals = await request(app)
    .get(`/tiffin/subscriptions/${response.body.subscription.id}/meals`)
    .set("Authorization", `Bearer ${token}`);
  return { subscription: response.body.subscription, meals: meals.body.meals as { id: string; date: string; status: string }[] };
}

describe("POST /admin/tiffin/closures", () => {
  it("rejects a non-admin caller", async () => {
    const response = await request(app).post("/admin/tiffin/closures").send({ startDate: "2026-09-01", endDate: "2026-09-02" });
    expect(response.status).toBe(401);
  });

  it("extends an active subscription's endDate by exactly the number of closed days it actually hit, marking those meals 'closed'", async () => {
    const token = await signup("closure-sub@example.com");
    const { subscription, meals } = await subscribeToWeeklyVeg(token);
    // Close 2 of this subscription's own scheduled days.
    const closedFrom = meals[2].date;
    const closedTo = meals[3].date;

    const admin = await adminToken();
    const declareResponse = await request(app)
      .post("/admin/tiffin/closures")
      .set("Authorization", `Bearer ${admin}`)
      .send({ startDate: closedFrom, endDate: closedTo, reason: "Kitchen flooding" });

    expect(declareResponse.status).toBe(201);
    expect(declareResponse.body.extendedSubscriptionCount).toBe(1);
    expect(declareResponse.body.closure.reason).toBe("Kitchen flooding");

    const afterMeals = await request(app)
      .get(`/tiffin/subscriptions/${subscription.id}/meals`)
      .set("Authorization", `Bearer ${token}`);
    // Original 7 + 2 make-up days for the 2 closed days = 9, none lost.
    expect(afterMeals.body.meals).toHaveLength(9);
    const closedRows = afterMeals.body.meals.filter((m: { date: string }) => m.date === closedFrom || m.date === closedTo);
    expect(closedRows.every((m: { status: string }) => m.status === "closed")).toBe(true);

    const subResponse = await request(app)
      .get(`/tiffin/subscriptions/mine`)
      .set("Authorization", `Bearer ${token}`);
    expect(subResponse.body.subscriptions[0].endDate > subscription.endDate).toBe(true);
  });

  it("auto-cancels an affected single-meal order with a full refund, regardless of the normal cancellation window", async () => {
    const token = await signup("closure-single@example.com");
    const signupResponse = await request(app).get("/auth/me").set("Authorization", `Bearer ${token}`);
    const userId = signupResponse.body.user.id;
    const order = await TiffinSingleMealOrderModel.create({
      orderNumber: "GTM-CLOSURE-TEST",
      userId,
      tier: "regular",
      mealType: "lunch",
      dietType: "veg",
      date: "2026-09-10",
      dishName: "Aloo Matar",
      addOns: [],
      status: "placed",
      statusHistory: [{ status: "placed", at: new Date().toISOString() }],
      delivery: validDelivery,
      price: 129,
      quantity: 1,
      // Paid, and long past any cancellation window — an emergency closure refunds in full anyway.
      payment: { method: "razorpay", status: "paid" },
    });
    await TiffinSingleMealOrderModel.collection.updateOne({ _id: order._id }, { $set: { createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000) } });

    const admin = await adminToken();
    const declareResponse = await request(app)
      .post("/admin/tiffin/closures")
      .set("Authorization", `Bearer ${admin}`)
      .send({ startDate: "2026-09-10", endDate: "2026-09-10" });

    expect(declareResponse.status).toBe(201);
    expect(declareResponse.body.cancelledSingleMealOrderCount).toBe(1);
    expect(declareResponse.body.refundedAmount).toBe(129);

    const orderResponse = await request(app).get("/tiffin/single-meal/orders/mine").set("Authorization", `Bearer ${token}`);
    expect(orderResponse.body.orders[0].status).toBe("cancelled");
    expect(orderResponse.body.orders[0].payment.refundAmount).toBe(129);
  });

  it("a new subscription started during an already-declared closure skips the closed dates from day one", async () => {
    const admin = await adminToken();
    // Close tomorrow through the day after — exactly where a new subscription would otherwise start.
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const dayAfter = new Date();
    dayAfter.setUTCDate(dayAfter.getUTCDate() + 2);
    const startDate = tomorrow.toISOString().slice(0, 10);
    const endDate = dayAfter.toISOString().slice(0, 10);
    await request(app).post("/admin/tiffin/closures").set("Authorization", `Bearer ${admin}`).send({ startDate, endDate });

    const token = await signup("closure-new-sub@example.com");
    const { meals } = await subscribeToWeeklyVeg(token);

    // No meal was ever scheduled on the closed dates in the first place.
    expect(meals.some((m) => m.date === startDate)).toBe(false);
    expect(meals.some((m) => m.date === endDate)).toBe(false);
    expect(meals).toHaveLength(7); // still 7 real delivery days, just stretched over more calendar days.
  });

  it("blocks new single-meal ordering for a closed date", async () => {
    const admin = await adminToken();
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const closedDate = tomorrow.toISOString().slice(0, 10);
    await request(app)
      .post("/admin/tiffin/closures")
      .set("Authorization", `Bearer ${admin}`)
      .send({ startDate: closedDate, endDate: closedDate });
    await TiffinMealPriceModel.create({ tier: "regular", mealType: "breakfast", price: 79, active: true });

    const menuResponse = await request(app).get("/tiffin/single-meal/menu");
    // Breakfast is always tomorrow (unlike lunch/dinner, which can resolve to "today" depending
    // on the time of day the test runs), so this is guaranteed to hit the closed date.
    expect(menuResponse.body.menu).toEqual([]);
  });
});
