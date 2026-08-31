import jwt from "jsonwebtoken";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { MenuItemModel } from "../../src/db/models/MenuItem.model.js";
import { OrderModel } from "../../src/db/models/Order.model.js";
import { UserModel } from "../../src/db/models/User.model.js";
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
  const admin = await UserModel.create({ fullName: "Admin", email: "admin@test.com", passwordHash: "unused", role: "admin" });
  return jwt.sign({ userId: String(admin._id), role: "admin" }, env.JWT_SECRET, { expiresIn: "1h" });
}

let orderCounter = 0;
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
    totals: { subtotal: 200, discountAmount: 0, discountReason: "none", rewardAmount: 0, rewardReason: "none", deliveryFee: 39, tax: 10, total: 249 },
    payment: { method: "cod", status: "pending" },
    ...overrides,
  };
}

describe("GET /admin/customers", () => {
  it("is not accessible to a non-admin", async () => {
    const customer = await UserModel.create({ fullName: "Customer", passwordHash: "x", role: "customer" });
    const token = jwt.sign({ userId: String(customer._id), role: "customer" }, env.JWT_SECRET, { expiresIn: "1h" });
    const response = await request(app).get("/admin/customers").query({ q: "Priya" }).set("Authorization", `Bearer ${token}`);
    expect(response.status).toBe(403);
  });

  it("finds a customer by partial name, phone, or email, but never an admin", async () => {
    const seeded = await UserModel.create({ fullName: "Priya Sharma", phone: "9812345678", email: "priya@example.com", passwordHash: "x", role: "customer" });
    await UserModel.create({ fullName: "Rahul Verma", phone: "9898765432", passwordHash: "x", role: "customer" });
    await UserModel.create({ fullName: "Priya Admin", email: "priya-admin@test.com", passwordHash: "x", role: "admin" });

    const token = await adminToken();
    const authHeader = `Bearer ${token}`;

    const byName = await request(app).get("/admin/customers").query({ q: "priya" }).set("Authorization", authHeader);
    expect(byName.status).toBe(200);
    expect(byName.body.customers).toHaveLength(1);
    expect(byName.body.customers[0].fullName).toBe("Priya Sharma");
    // Regression guard: a search result with no usable `id` navigates the admin panel to
    // `/customers/undefined`, which then 400s trying to cast "undefined" to an ObjectId — this
    // silently happened for months because every other test here fetches a profile by an id
    // taken directly from `UserModel.create()`, never from a search result's own response body.
    expect(byName.body.customers[0].id).toBe(String(seeded._id));
    expect(byName.body.customers[0]._id).toBeUndefined();

    const byPhone = await request(app).get("/admin/customers").query({ q: "981234" }).set("Authorization", authHeader);
    expect(byPhone.body.customers).toHaveLength(1);

    // No `q` at all browses every customer instead of returning nothing — an admin looking for
    // someone to recommend to shouldn't need to already know who they're searching for.
    const all = await request(app).get("/admin/customers").set("Authorization", authHeader);
    expect(all.body.customers).toHaveLength(2);
    expect(all.body.customers.map((c: { fullName: string }) => c.fullName)).toEqual(["Priya Sharma", "Rahul Verma"]);
    expect(all.body.total).toBe(2);
  });

  it("paginates the full customer list", async () => {
    for (let i = 0; i < 3; i += 1) {
      await UserModel.create({ fullName: `Customer ${i}`, phone: `98000000${i}${i}`, passwordHash: "x", role: "customer" });
    }
    const token = await adminToken();
    const authHeader = `Bearer ${token}`;

    const page1 = await request(app).get("/admin/customers").query({ page: 1, pageSize: 2 }).set("Authorization", authHeader);
    expect(page1.body.total).toBe(3);
    expect(page1.body.customers).toHaveLength(2);

    const page2 = await request(app).get("/admin/customers").query({ page: 2, pageSize: 2 }).set("Authorization", authHeader);
    expect(page2.body.customers.length).toBeGreaterThan(0);
    const allIds = new Set([...page1.body.customers, ...page2.body.customers].map((c: { id: string }) => c.id));
    expect(allIds.size).toBe(3); // no overlap, nothing lost across the page boundary
  });

  it("a search result's own id can be used to fetch that customer's profile (the real admin-panel click-through path)", async () => {
    await UserModel.create({ fullName: "Asd", phone: "8678575785", passwordHash: "x", role: "customer" });
    const token = await adminToken();
    const authHeader = `Bearer ${token}`;

    const search = await request(app).get("/admin/customers").query({ q: "Asd" }).set("Authorization", authHeader);
    const foundId = search.body.customers[0].id;
    expect(foundId).toBeTruthy();

    const profile = await request(app).get(`/admin/customers/${foundId}`).set("Authorization", authHeader);
    expect(profile.status).toBe(200);
    expect(profile.body.customer.fullName).toBe("Asd");
  });
});

describe("GET /admin/customers/:id and GET /admin/orders?userId=", () => {
  it("returns a customer's profile and scopes the order list to just their orders", async () => {
    const customer = await UserModel.create({ fullName: "Priya Sharma", phone: "9812345678", passwordHash: "x", role: "customer" });
    const otherCustomer = await UserModel.create({ fullName: "Rahul Verma", phone: "9898765432", passwordHash: "x", role: "customer" });
    await OrderModel.create(orderFixture({ userId: customer._id }));
    await OrderModel.create(orderFixture({ userId: customer._id }));
    await OrderModel.create(orderFixture({ userId: otherCustomer._id }));

    const token = await adminToken();
    const authHeader = `Bearer ${token}`;

    const profile = await request(app).get(`/admin/customers/${customer._id}`).set("Authorization", authHeader);
    expect(profile.status).toBe(200);
    expect(profile.body.customer.fullName).toBe("Priya Sharma");
    expect(profile.body.customer.id).toBe(String(customer._id));

    const orders = await request(app).get("/admin/orders").query({ userId: String(customer._id) }).set("Authorization", authHeader);
    expect(orders.status).toBe(200);
    expect(orders.body.orders).toHaveLength(2);
  });
});

describe("GET /admin/customers/:id/suggested-items", () => {
  it("rejects a non-admin caller", async () => {
    const customer = await UserModel.create({ fullName: "Customer", passwordHash: "x", role: "customer" });
    const token = jwt.sign({ userId: String(customer._id), role: "customer" }, env.JWT_SECRET, { expiresIn: "1h" });
    const response = await request(app).get(`/admin/customers/${customer._id}/suggested-items`).set("Authorization", `Bearer ${token}`);
    expect(response.status).toBe(403);
  });

  it("404s for a customer that doesn't exist", async () => {
    const token = await adminToken();
    const response = await request(app)
      .get("/admin/customers/6a0000000000000000000000/suggested-items")
      .set("Authorization", `Bearer ${token}`);
    expect(response.status).toBe(404);
  });

  it("suggests an item paired with what the customer has ordered, across every one of their orders", async () => {
    await MenuItemModel.create([
      {
        _id: "choco-crush",
        brandId: "tbc",
        signatureName: "Choco Crush",
        commonName: "Rich Chocolate Shake",
        description: "desc",
        price: 200,
        category: "signature-shakes",
        image: "https://example.com/a.jpg",
        flavorBadges: [],
        pairsWith: ["mango-tango"],
      },
      {
        _id: "mango-tango",
        brandId: "tbc",
        signatureName: "Mango Tango",
        commonName: "Mango Shake",
        description: "desc",
        price: 220,
        category: "signature-shakes",
        image: "https://example.com/b.jpg",
        flavorBadges: [],
      },
    ]);
    const customer = await UserModel.create({ fullName: "Priya Sharma", phone: "9812345678", passwordHash: "x", role: "customer" });
    await OrderModel.create(orderFixture({ userId: customer._id }));

    const token = await adminToken();
    const response = await request(app).get(`/admin/customers/${customer._id}/suggested-items`).set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.itemNames).toEqual(["Mango Tango"]);
  });

  it("returns no suggestions for a customer with no order history and nothing popular to fall back on", async () => {
    const customer = await UserModel.create({ fullName: "Fresh Customer", passwordHash: "x", role: "customer" });
    const token = await adminToken();
    const response = await request(app).get(`/admin/customers/${customer._id}/suggested-items`).set("Authorization", `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.itemNames).toEqual([]);
  });
});

describe("POST /admin/customers/:id/recommend", () => {
  it("rejects an empty item list and a customer with no phone on file", async () => {
    const token = await adminToken();
    const authHeader = `Bearer ${token}`;
    const noPhoneCustomer = await UserModel.create({ fullName: "No Phone", email: "nophone@test.com", passwordHash: "x", role: "customer" });

    const emptyList = await request(app)
      .post(`/admin/customers/${noPhoneCustomer._id}/recommend`)
      .set("Authorization", authHeader)
      .send({ itemNames: [] });
    expect(emptyList.status).toBe(400);

    const noPhone = await request(app)
      .post(`/admin/customers/${noPhoneCustomer._id}/recommend`)
      .set("Authorization", authHeader)
      .send({ itemNames: ["Choco Crush"] });
    expect(noPhone.status).toBe(400);
  });

  it("sends the admin-picked item names as-is for a customer with a phone on file", async () => {
    const token = await adminToken();
    const customer = await UserModel.create({ fullName: "Priya Sharma", phone: "9812345678", passwordHash: "x", role: "customer" });

    const response = await request(app)
      .post(`/admin/customers/${customer._id}/recommend`)
      .set("Authorization", `Bearer ${token}`)
      .send({ itemNames: ["Choco Crush", "Blue Lagoon"] });

    expect(response.status).toBe(200);
    expect(response.body.recommendedItemNames).toEqual(["Choco Crush", "Blue Lagoon"]);
  });
});

async function seedMenuItem(id: string, brandId: string) {
  return MenuItemModel.create({
    _id: id,
    brandId,
    signatureName: id,
    commonName: id,
    description: "desc",
    price: 200,
    category: "signature-shakes",
    image: "https://example.com/a.jpg",
    flavorBadges: [],
  });
}

async function signup(email: string, phone: string): Promise<string> {
  const response = await request(app).post("/auth/signup").send({ fullName: "Rec Tester", email, phone, password: "password123" });
  return response.body.token;
}

describe("Admin-curated in-app 'Recommended For You' picks", () => {
  it("rejects a non-admin caller and a payload with more than 2 items", async () => {
    const customer = await UserModel.create({ fullName: "Customer", passwordHash: "x", role: "customer" });
    const customerToken = jwt.sign({ userId: String(customer._id), role: "customer" }, env.JWT_SECRET, { expiresIn: "1h" });
    const notAdmin = await request(app)
      .put(`/admin/customers/${customer._id}/recommendations`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ brandId: "tbc", itemIds: ["choco-crush"] });
    expect(notAdmin.status).toBe(403);

    const token = await adminToken();
    const tooMany = await request(app)
      .put(`/admin/customers/${customer._id}/recommendations`)
      .set("Authorization", `Bearer ${token}`)
      .send({ brandId: "tbc", itemIds: ["a", "b", "c"] });
    expect(tooMany.status).toBe(400);
  });

  it("sets, lists, and clears a customer's per-brand recommendation, and the customer sees it live via /menu/my-recommendations", async () => {
    await seedMenuItem("choco-crush", "tbc");
    await seedMenuItem("mango-tango", "tbc");
    const token = await adminToken();
    const authHeader = `Bearer ${token}`;
    const customerToken = await signup("rec-customer@example.com", "9812355501");
    const me = await request(app).get("/auth/me").set("Authorization", `Bearer ${customerToken}`);
    const customerId = me.body.user.id;

    const set = await request(app)
      .put(`/admin/customers/${customerId}/recommendations`)
      .set("Authorization", authHeader)
      .send({ brandId: "tbc", itemIds: ["choco-crush", "mango-tango"] });
    expect(set.status).toBe(200);

    const list = await request(app).get(`/admin/customers/${customerId}/recommendations`).set("Authorization", authHeader);
    expect(list.status).toBe(200);
    expect(list.body.recommendations).toEqual([{ brandId: "tbc", itemIds: ["choco-crush", "mango-tango"] }]);

    // The customer's own Home screen reads this back live — never trust a client-computed row.
    const mine = await request(app)
      .get("/menu/my-recommendations")
      .query({ brandId: "tbc" })
      .set("Authorization", `Bearer ${customerToken}`);
    expect(mine.status).toBe(200);
    expect(mine.body.itemIds).toEqual(["choco-crush", "mango-tango"]);

    // A different brand (or an un-set one) has nothing.
    const otherBrand = await request(app)
      .get("/menu/my-recommendations")
      .query({ brandId: "alchemy-tails" })
      .set("Authorization", `Bearer ${customerToken}`);
    expect(otherBrand.body.itemIds).toEqual([]);

    // Clearing with an empty itemIds removes the row entirely rather than leaving an empty one.
    const cleared = await request(app)
      .put(`/admin/customers/${customerId}/recommendations`)
      .set("Authorization", authHeader)
      .send({ brandId: "tbc", itemIds: [] });
    expect(cleared.status).toBe(200);

    const listAfterClear = await request(app).get(`/admin/customers/${customerId}/recommendations`).set("Authorization", authHeader);
    expect(listAfterClear.body.recommendations).toEqual([]);

    const mineAfterClear = await request(app)
      .get("/menu/my-recommendations")
      .query({ brandId: "tbc" })
      .set("Authorization", `Bearer ${customerToken}`);
    expect(mineAfterClear.body.itemIds).toEqual([]);
  });

  it("rejects /menu/my-recommendations for an unauthenticated caller", async () => {
    const response = await request(app).get("/menu/my-recommendations").query({ brandId: "tbc" });
    expect(response.status).toBe(401);
  });
});
