import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
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

describe("email uniqueness is enforced at the DB level, not just app-level pre-insert checks", () => {
  it("has a real unique index on email in MongoDB (not just a Mongoose schema annotation)", async () => {
    // Model.init() resolves once Mongoose has finished building indexes — without
    // it, a fresh collection with zero documents may not exist yet to list indexes on.
    await UserModel.init();
    const indexes = await UserModel.collection.indexes();
    const emailIndex = indexes.find((index) => index.key && "email" in index.key);
    expect(emailIndex).toBeDefined();
    expect(emailIndex?.unique).toBe(true);
  });

  it("lets exactly one of two concurrent signups with the same email succeed", async () => {
    const payload = {
      email: "race@example.com",
      password: "password123",
      fullName: "Race Condition",
      phone: "9999999999",
    };

    // Two requests fired concurrently to actually exercise the race, rather than
    // relying on a check-then-insert app-level guard that a race could slip past.
    const [first, second] = await Promise.all([
      request(app).post("/auth/signup").send(payload),
      request(app).post("/auth/signup").send(payload),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([201, 409]);

    const count = await UserModel.countDocuments({ email: payload.email });
    expect(count).toBe(1);
  });
});

describe("signup accepts email or phone as the account identifier", () => {
  it("has a real unique index on phone in MongoDB too", async () => {
    await UserModel.init();
    const indexes = await UserModel.collection.indexes();
    const phoneIndex = indexes.find((index) => index.key && "phone" in index.key);
    expect(phoneIndex).toBeDefined();
    expect(phoneIndex?.unique).toBe(true);
  });

  it("signs up and logs in with phone only (no email)", async () => {
    const signupResponse = await request(app)
      .post("/auth/signup")
      .send({ fullName: "Phone Only", phone: "9111111111", password: "password123" });
    expect(signupResponse.status).toBe(201);
    expect(signupResponse.body.user.phone).toBe("9111111111");
    expect(signupResponse.body.user.email).toBeUndefined();

    const loginResponse = await request(app).post("/auth/login").send({ identifier: "9111111111", password: "password123" });
    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.user.phone).toBe("9111111111");
  });

  it("signs up and logs in with email only (no phone)", async () => {
    const signupResponse = await request(app)
      .post("/auth/signup")
      .send({ fullName: "Email Only", email: "emailonly@example.com", password: "password123" });
    expect(signupResponse.status).toBe(201);
    expect(signupResponse.body.user.email).toBe("emailonly@example.com");
    expect(signupResponse.body.user.phone).toBeUndefined();

    const loginResponse = await request(app)
      .post("/auth/login")
      .send({ identifier: "emailonly@example.com", password: "password123" });
    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.user.email).toBe("emailonly@example.com");
  });

  it("rejects signup with neither email nor phone", async () => {
    const response = await request(app).post("/auth/signup").send({ fullName: "Nobody", password: "password123" });
    expect(response.status).toBe(400);
  });
});

describe("login/signup rate limiting", () => {
  it("rejects login attempts beyond the configured window limit", async () => {
    const attempts = await Promise.all(
      Array.from({ length: 11 }, () =>
        request(app).post("/auth/login").send({ identifier: "nobody@example.com", password: "wrong" })
      )
    );

    const statusCodes = attempts.map((res) => res.status);
    expect(statusCodes.filter((code) => code === 429).length).toBeGreaterThan(0);
  });
});
