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

async function seedMenuItem() {
  return MenuItemModel.create({
    _id: "choco-crush",
    signatureName: "Choco Crush",
    commonName: "Rich Chocolate Shake",
    description: "A rich, indulgent chocolate shake.",
    price: 220,
    category: "signature-shakes",
    image: "https://example.com/choco-crush.jpg",
    flavorBadges: ["Chocolate Lover"],
  });
}

async function signup(fullName: string, email: string, phone: string): Promise<string> {
  const response = await request(app).post("/auth/signup").send({ fullName, email, phone, password: "password123" });
  return response.body.token;
}

const items = [
  {
    lineId: "l1",
    menuItemId: "choco-crush",
    quantity: 1,
    customization: { sugarLevel: "regular", iceLevel: "regular", addOnIds: [] },
  },
];

describe("Order for someone else", () => {
  it("keeps the order tied to the account while delivery goes to a different person", async () => {
    await seedMenuItem();
    const token = await signup("Rahul Kumar", "rahul@example.com", "9812300001");

    const response = await request(app)
      .post("/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({
        items,
        delivery: {
          fullName: "Priya Kumar",
          phone: "9712300002",
          address: "Boring Road",
          houseNumber: "12B",
          area: "Boring Road",
          landmark: "Near XYZ",
          city: "Patna",
          pincode: "800001",
          specialInstructions: "Call before delivery",
        },
        deliveryFor: "recipient",
        paymentMethod: "cod",
      });

    expect(response.status).toBe(201);
    const order = response.body.order;
    // Order stays owned by the account that placed it...
    expect(order.customer.name).toBe("Rahul Kumar");
    expect(order.customer.phone).toBe("9812300001");
    expect(order.deliveryFor).toBe("recipient");
    // ...while delivery info is entirely the recipient's, independent of the account.
    expect(order.delivery.fullName).toBe("Priya Kumar");
    expect(order.delivery.phone).toBe("9712300002");
    expect(order.delivery.houseNumber).toBe("12B");
    expect(order.delivery.landmark).toBe("Near XYZ");

    const mine = await request(app).get("/orders/mine").set("Authorization", `Bearer ${token}`);
    expect(mine.body.orders).toHaveLength(1);
    expect(mine.body.orders[0].id).toBe(order.id);
  });

  it("defaults to deliveryFor self when ordering for yourself, snapshotting the same identity twice", async () => {
    await seedMenuItem();
    const token = await signup("Solo Customer", "solo@example.com", "9812300003");

    const response = await request(app)
      .post("/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({
        items,
        delivery: { fullName: "Solo Customer", phone: "9812300003", address: "1 Own St", city: "Patna", pincode: "800001" },
        deliveryFor: "self",
        paymentMethod: "cod",
      });

    expect(response.status).toBe(201);
    expect(response.body.order.deliveryFor).toBe("self");
    expect(response.body.order.customer.name).toBe(response.body.order.delivery.fullName);
  });
});

describe("Delivery zone validation", () => {
  it("rejects an order to a city outside the supported delivery area", async () => {
    await seedMenuItem();

    const response = await request(app)
      .post("/orders")
      .send({
        items,
        delivery: { fullName: "Out Of Zone", phone: "9999999999", address: "1 Elsewhere Rd", city: "Mumbai", pincode: "400001" },
        deliveryFor: "self",
        paymentMethod: "cod",
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/don't deliver/i);
  });

  it("rejects an order whose self-reported distance exceeds the delivery radius", async () => {
    await seedMenuItem();

    const response = await request(app)
      .post("/orders")
      .send({
        items,
        delivery: {
          fullName: "Too Far",
          phone: "9999999999",
          address: "1 Far Rd",
          city: "Patna",
          pincode: "800001",
          distanceFromShopKm: 50,
        },
        deliveryFor: "self",
        paymentMethod: "cod",
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/delivery radius/i);
  });
});

describe("Saved recipients", () => {
  it("supports create, list, update, and delete, scoped to the owning account", async () => {
    const tokenA = await signup("Account A", "a@example.com", "9812300010");
    const tokenB = await signup("Account B", "b@example.com", "9812300011");

    const created = await request(app)
      .post("/me/recipients")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({
        label: "Mom",
        fullName: "Mom Kumar",
        phone: "9712300012",
        address: "Boring Road",
        city: "Patna",
        pincode: "800001",
      });
    expect(created.status).toBe(201);
    const recipientId = created.body.recipient.id;

    const listedByA = await request(app).get("/me/recipients").set("Authorization", `Bearer ${tokenA}`);
    expect(listedByA.body.recipients).toHaveLength(1);
    expect(listedByA.body.recipients[0].label).toBe("Mom");

    const listedByB = await request(app).get("/me/recipients").set("Authorization", `Bearer ${tokenB}`);
    expect(listedByB.body.recipients).toHaveLength(0);

    const updated = await request(app)
      .patch(`/me/recipients/${recipientId}`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({
        label: "Mom (new number)",
        fullName: "Mom Kumar",
        phone: "9712399999",
        address: "Boring Road",
        city: "Patna",
        pincode: "800001",
      });
    expect(updated.status).toBe(200);
    expect(updated.body.recipient.phone).toBe("9712399999");

    // Account B can't touch account A's saved recipient.
    const crossAccountDelete = await request(app).delete(`/me/recipients/${recipientId}`).set("Authorization", `Bearer ${tokenB}`);
    expect(crossAccountDelete.status).toBe(404);

    const deleted = await request(app).delete(`/me/recipients/${recipientId}`).set("Authorization", `Bearer ${tokenA}`);
    expect(deleted.status).toBe(204);
  });

  it("requires authentication", async () => {
    const response = await request(app).get("/me/recipients");
    expect(response.status).toBe(401);
  });
});
