import jwt from "jsonwebtoken";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.js";
import { CouponModel } from "../../src/db/models/Coupon.model.js";
import { UserModel } from "../../src/db/models/User.model.js";
import { clearTestDb, startTestDb, stopTestDb, testEnv } from "./testDb.js";

const env = testEnv({ CATALOG_SYNC_PEER_URL: "https://site-api.example.com", CATALOG_SYNC_SECRET: "test-sync-secret-that-is-at-least-32-chars" });
const app = createApp(env);

beforeAll(async () => {
  await startTestDb();
});
afterEach(async () => {
  vi.unstubAllGlobals();
  await clearTestDb();
});
afterAll(async () => {
  await stopTestDb();
});

async function adminAuth() {
  const admin = await UserModel.create({ fullName: "Admin", email: "admin@test.com", passwordHash: "unused", role: "admin" });
  return { Authorization: `Bearer ${jwt.sign({ userId: String(admin._id), role: "admin" }, env.JWT_SECRET, { expiresIn: "1h" })}` };
}

function captureSync() {
  const events: { kind: string; [k: string]: unknown }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      events.push(...JSON.parse(init.body as string).events);
      return new Response(JSON.stringify({ applied: 1 }), { status: 200 });
    })
  );
  return events;
}

describe("shared settings are sent to the website when changed in the admin", () => {
  it("sends a new coupon with where it applies, and app-only coupons don't work on the website", async () => {
    const events = captureSync();
    const auth = await adminAuth();
    await request(app).post("/admin/coupons").set(auth).send({ code: "feast20", type: "percent", value: 20, minOrderAmount: 0 });
    await vi.waitFor(() => expect(events.find((e) => e.kind === "coupon.upsert")).toBeTruthy());
    expect((events.find((e) => e.kind === "coupon.upsert") as { data: { code: string; channels: string[] } }).data).toMatchObject({ code: "FEAST20", channels: ["app", "website"] });

    // A website-only code is refused in the app.
    await CouponModel.create({ code: "WEBONLY", type: "flat", value: 50, minOrderAmount: 0, channels: ["website"] });
    const res = await request(app)
      .post("/coupons/validate")
      .send({ code: "WEBONLY", brandIds: ["tbc"], lines: [{ unitPrice: 300, addOnPrices: [], quantity: 1, isCombo: false }] });
    expect(res.status).toBe(400);
  });

  it("sends GG Tiffin dish changes and opening hours", async () => {
    const events = captureSync();
    const auth = await adminAuth();
    await request(app)
      .put("/admin/tiffin/dishes")
      .set(auth)
      .send({ tier: "regular", dietType: "veg", mealType: "lunch", dayOfWeek: "Monday", dishName: "Paneer Bhurji", hasAddOns: true, riceSubstitute: "rice" });
    await request(app).put("/admin/store-settings").set(auth).send({ openHour: 11 });
    await vi.waitFor(() => {
      expect(events.find((e) => e.kind === "tiffinDish.upsert")).toBeTruthy();
      expect(events.find((e) => e.kind === "storeHours.upsert")).toBeTruthy();
    });
    expect((events.find((e) => e.kind === "storeHours.upsert") as { data: object }).data).toMatchObject({ scope: "lickyeat", openHour: 11 });
  });
});
