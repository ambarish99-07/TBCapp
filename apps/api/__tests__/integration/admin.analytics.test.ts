import jwt from "jsonwebtoken";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { BrandModel } from "../../src/db/models/Brand.model.js";
import { OrderModel } from "../../src/db/models/Order.model.js";
import { UserModel } from "../../src/db/models/User.model.js";
import { addIsoDays, istMidnightUtc, todayIsoInIst } from "../../src/utils/istDate.js";
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

async function adminToken(): Promise<string> {
  const admin = await UserModel.create({
    fullName: "Admin",
    email: "admin@test.com",
    passwordHash: "unused",
    phone: "9999999999",
    role: "admin",
  });
  return jwt.sign({ userId: String(admin._id), role: "admin" }, env.JWT_SECRET, { expiresIn: "1h" });
}

let orderCounter = 0;
/** A minimal, valid Order — every field the schema requires filled in with fixed placeholders,
 * so each test only has to spell out what it's actually varying (brandId/userId/status/createdAt). */
function orderFixture(overrides: Record<string, unknown>) {
  orderCounter += 1;
  return {
    accessToken: `test-access-token-${orderCounter}`,
    orderNumber: `TBC-TEST-${orderCounter}`,
    brandId: "tbc",
    status: "received",
    items: [
      {
        lineId: "l1",
        menuItemId: "choco-crush",
        signatureName: "Choco Crush",
        commonName: "Rich Chocolate Shake",
        unitPrice: 200,
        originalUnitPrice: 200,
        quantity: 1,
        customization: { sugarLevel: "regular", iceLevel: "regular", addOnIds: [] },
      },
    ],
    delivery: { fullName: "Test", phone: "9999999999", address: "Addr", city: "Patna", pincode: "800001" },
    totals: {
      subtotal: 200,
      discountAmount: 0,
      discountReason: "none",
      rewardAmount: 0,
      rewardReason: "none",
      deliveryFee: 39,
      tax: 10,
      total: 249,
    },
    payment: { method: "cod", status: "pending" },
    ...overrides,
  };
}

describe("GET /admin/analytics", () => {
  it("computes today/yesterday/week/month buckets, per-brand stats, and repeat/new customer stats", async () => {
    // All boundaries derived from the same IST helpers the service itself uses, rather than
    // wall-clock offsets — keeps the test correct no matter what time of day it actually runs.
    const todayIso = todayIsoInIst();
    const todayStart = istMidnightUtc(todayIso);
    const yesterdayStart = istMidnightUtc(addIsoDays(todayIso, -1));
    const eightDaysAgoStart = istMidnightUtc(addIsoDays(todayIso, -8));
    const anHour = 60 * 60 * 1000;

    await BrandModel.create({ _id: "tbc", name: "The Blenders Club", status: "live" });
    await BrandModel.create({ _id: "alchemy", name: "The Alchemy Tails", status: "live" });

    const returningUser = await UserModel.create({ fullName: "Returning Customer", passwordHash: "x", role: "customer" });
    const newUser = await UserModel.create({ fullName: "New Customer", passwordHash: "x", role: "customer" });

    // Returning customer: first order 8 days ago (outside the 7-day "new customer" window),
    // second order today — this is the one repeat order in the fixture.
    await OrderModel.create({
      ...orderFixture({ userId: returningUser._id, brandId: "tbc" }),
      createdAt: new Date(eightDaysAgoStart.getTime() + anHour),
    });
    await OrderModel.create({
      ...orderFixture({ userId: returningUser._id, brandId: "tbc" }),
      createdAt: new Date(todayStart.getTime() + anHour),
    });

    // New customer: a single order yesterday, inside both the 7- and 30-day new-customer windows.
    await OrderModel.create({
      ...orderFixture({ userId: newUser._id, brandId: "alchemy" }),
      createdAt: new Date(yesterdayStart.getTime() + anHour),
    });

    // Guest (no account) order, today, cancelled — counts toward today's order count but not
    // its revenue, and toward guestOrders rather than any customer's repeat/new status.
    await OrderModel.create({
      ...orderFixture({ brandId: "tbc", status: "cancelled" }),
      createdAt: new Date(todayStart.getTime() + 2 * anHour),
    });

    const token = await adminToken();
    const response = await request(app).get("/admin/analytics").set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    const summary = response.body;

    expect(summary.ordersToday.orders).toBe(2); // returning customer's 2nd order + the guest order
    expect(summary.ordersToday.revenue).toBe(249); // the cancelled guest order is excluded
    expect(summary.ordersYesterday.orders).toBe(1);
    expect(summary.ordersLast7Days.orders).toBe(3); // excludes the 8-days-ago order
    expect(summary.ordersLast30Days.orders).toBe(4);
    expect(summary.allTime.orders).toBe(4);
    expect(summary.totalOrders).toBe(4);
    expect(summary.guestOrders).toBe(1);

    expect(summary.repeatOrders).toBe(1);
    expect(summary.firstTimeOrders).toBe(2); // one per registered customer

    expect(summary.customers.totalRegisteredCustomers).toBe(2);
    expect(summary.customers.repeatCustomers).toBe(1);
    expect(summary.customers.oneTimeCustomers).toBe(1);
    expect(summary.customers.newCustomersToday).toBe(0); // neither customer's first order was today
    expect(summary.customers.newCustomersLast7Days).toBe(1);
    expect(summary.customers.newCustomersLast30Days).toBe(2);

    const tbcStats = summary.byBrand.find((b: { brandId: string }) => b.brandId === "tbc");
    expect(tbcStats.orders).toBe(3);
    expect(tbcStats.revenue).toBe(498); // the 8-days-ago and today orders; the cancelled one excluded

    const alchemyStats = summary.byBrand.find((b: { brandId: string }) => b.brandId === "alchemy");
    expect(alchemyStats.orders).toBe(1);
    expect(alchemyStats.revenue).toBe(249);

    expect(summary.monthlyRevenue).toHaveLength(12);
    expect(summary.weeklyRevenue).toHaveLength(12);
    expect(summary.weeklyRevenue[11].orders).toBe(3); // the most recent trailing-7-day window matches ordersLast7Days
    expect(summary.todayHourlyRevenue).toHaveLength(24);
    const hourlyOrderTotal = summary.todayHourlyRevenue.reduce((sum: number, h: { orders: number }) => sum + h.orders, 0);
    expect(hourlyOrderTotal).toBe(summary.ordersToday.orders);

    expect(summary.catalog.totalBrands).toBe(2);
    expect(summary.catalog.totalMenuItems).toBe(0);
    expect(summary.catalog.totalCombos).toBe(0);
  });
});
