import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
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

async function signup(fullName: string, email: string, phone: string): Promise<string> {
  const response = await request(app).post("/auth/signup").send({ fullName, email, phone, password: "password123" });
  return response.body.token;
}

describe("PATCH /auth/me", () => {
  it("updates the caller's own profile fields", async () => {
    const token = await signup("Old Name", "old@example.com", "9812300020");

    const response = await request(app)
      .patch("/auth/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ fullName: "New Name", email: "new@example.com", phone: "9812300021" });

    expect(response.status).toBe(200);
    expect(response.body.user.fullName).toBe("New Name");
    expect(response.body.user.email).toBe("new@example.com");
    expect(response.body.user.phone).toBe("9812300021");

    const me = await request(app).get("/auth/me").set("Authorization", `Bearer ${token}`);
    expect(me.body.user.fullName).toBe("New Name");
  });

  it("updates the caller's own address fields — e.g. after moving to a new locality", async () => {
    const token = await signup("Movers Person", "movers@example.com", "9812300025");

    const response = await request(app).patch("/auth/me").set("Authorization", `Bearer ${token}`).send({
      fullName: "Movers Person",
      houseNumber: "42B",
      area: "Boring Road",
      address: "42B Boring Road",
      landmark: "Near City Mall",
      city: "Patna",
      pincode: "800001",
    });

    expect(response.status).toBe(200);
    expect(response.body.user.houseNumber).toBe("42B");
    expect(response.body.user.city).toBe("Patna");
    expect(response.body.user.pincode).toBe("800001");
  });

  it("rejects an update to an email already used by another account", async () => {
    await signup("Account A", "taken@example.com", "9812300022");
    const tokenB = await signup("Account B", "b@example.com", "9812300023");

    const response = await request(app)
      .patch("/auth/me")
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ fullName: "Account B", email: "taken@example.com" });

    expect(response.status).toBe(409);
  });

  it("rejects an empty full name", async () => {
    const token = await signup("Account C", "c@example.com", "9812300024");

    const response = await request(app).patch("/auth/me").set("Authorization", `Bearer ${token}`).send({ fullName: "" });

    expect(response.status).toBe(400);
  });

  it("requires authentication", async () => {
    const response = await request(app).patch("/auth/me").send({ fullName: "Someone" });
    expect(response.status).toBe(401);
  });
});
