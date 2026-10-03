import jwt from "jsonwebtoken";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.js";
import { OrderModel } from "../../src/db/models/Order.model.js";
import { UserModel } from "../../src/db/models/User.model.js";
import { SYNC_SIGNATURE_HEADER, SYNC_TIMESTAMP_HEADER, verifySyncSignature } from "../../src/modules/catalogSync/catalogSync.types.js";
import { clearTestDb, startTestDb, stopTestDb, testEnv } from "./testDb.js";

const SECRET = "test-sync-secret-that-is-at-least-32-chars";
const PEER = "https://site-api.example.com";
const env = testEnv({ CATALOG_SYNC_PEER_URL: PEER, CATALOG_SYNC_SECRET: SECRET });
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

async function appOrder(total: number) {
  return OrderModel.create({
    accessToken: `t-${total}-${Math.random()}`,
    orderNumber: `TBC-${total}-${Math.random()}`,
    brandId: "tbc",
    userId: null,
    items: [{ lineId: "l", menuItemId: "choco-crush", brandId: "tbc", signatureName: "Choco Crush", commonName: "x", unitPrice: total, originalUnitPrice: total, quantity: 1, customization: { addOnIds: [] } }],
    delivery: { fullName: "A", phone: "9", address: "x", area: "Kankarbagh", city: "Patna", pincode: "800020" },
    totals: { subtotal: total, discountAmount: 0, discountReason: "none", rewardAmount: 0, rewardReason: "none", deliveryFee: 0, tax: 0, total },
    payment: { method: "cod", status: "pending" },
  });
}

const websiteRow = {
  createdAt: new Date().toISOString(),
  status: "delivered",
  brandId: "the-biryani-lane",
  userId: "site:abc",
  total: 300,
  area: "Boring Road",
  items: [{ menuItemId: "chicken-biryani", signatureName: "Chicken Biryani", quantity: 1, brandId: "the-biryani-lane", lineTotal: 300 }],
};

function websiteReturns(body: unknown, status = 200) {
  const fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("GET /admin/analytics?source=", () => {
  it("adds the website's orders for 'both', mapping its kitchen ids to the app's", async () => {
    await appOrder(200);
    const fetchMock = websiteReturns({ orders: [websiteRow] });
    const auth = await adminAuth();

    const app_ = await request(app).get("/admin/analytics?source=app").set(auth);
    expect(app_.body.allTime).toEqual({ orders: 1, revenue: 200 });
    expect(fetchMock).not.toHaveBeenCalled();

    const site = await request(app).get("/admin/analytics?source=website").set(auth);
    expect(site.body.allTime).toEqual({ orders: 1, revenue: 300 });
    expect(site.body.byBrand[0].brandId).toBe("TBL");

    const both = await request(app).get("/admin/analytics?source=both").set(auth);
    expect(both.body.allTime).toEqual({ orders: 2, revenue: 500 });
    expect(both.body.byArea.map((a: { area: string }) => a.area).sort()).toEqual(["Boring Road", "Kankarbagh"]);
    expect(both.body.source).toBe("both");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
    expect(url).toBe(`${PEER}/internal/admin-peer/analytics-orders`);
    expect(verifySyncSignature(SECRET, init.headers[SYNC_TIMESTAMP_HEADER], init.headers[SYNC_SIGNATURE_HEADER], init.body as string)).toBe(true);
  });

  it("falls back to app-only with a warning when the website is down, instead of failing", async () => {
    await appOrder(200);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    const res = await request(app).get("/admin/analytics?source=both").set(await adminAuth());
    expect(res.status).toBe(200);
    expect(res.body.allTime.orders).toBe(1);
    expect(res.body.warning).toMatch(/app orders only/);
  });
});

describe("website customers / reviews / help requests through the app admin", () => {
  it("lists website feedback with app brand ids and forwards a reply", async () => {
    const fetchMock = websiteReturns({ feedback: [{ id: "f1", brandId: "the-biryani-lane", type: "complaint" }] });
    const auth = await adminAuth();
    const list = await request(app).get("/admin/website/feedback?type=complaint").set(auth);
    expect(list.body.feedback[0].brandId).toBe("TBL");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ type: "complaint" });

    websiteReturns({ feedback: { id: "f1", status: "in-progress" } });
    const reply = await request(app).patch("/admin/website/feedback/f1").set(auth).send({ adminResponse: "Sorry!" });
    expect(reply.body.feedback.status).toBe("in-progress");
  });

  it("is admin-only and reports a website outage clearly", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    const customer = await UserModel.create({ fullName: "C", email: "c@test.com", passwordHash: "x", role: "customer" });
    const notAdmin = await request(app)
      .get("/admin/website/customers")
      .set({ Authorization: `Bearer ${jwt.sign({ userId: String(customer._id), role: "customer" }, env.JWT_SECRET)}` });
    expect(notAdmin.status).toBe(403);

    const res = await request(app).get("/admin/website/customers").set(await adminAuth());
    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/Couldn't reach the website/);
  });
});
