import jwt from "jsonwebtoken";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { BrandModel } from "../../src/db/models/Brand.model.js";
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
  const admin = await UserModel.create({ fullName: "Admin", email: "admin-brands@test.com", passwordHash: "unused", phone: "9888888877", role: "admin" });
  return jwt.sign({ userId: String(admin._id), role: "admin" }, env.JWT_SECRET, { expiresIn: "1h" });
}

describe("GET /brands and GET /brands/coming-soon", () => {
  it("splits live and coming-soon brands into their own endpoints", async () => {
    await BrandModel.create({ _id: "tbc", name: "The Blenders Club", status: "live" });
    await BrandModel.create({ _id: "the-biryani-lane", name: "The Biryani Lane", status: "coming-soon" });

    const live = await request(app).get("/brands");
    expect(live.body.brands.map((b: { id: string }) => b.id)).toEqual(["tbc"]);

    const comingSoon = await request(app).get("/brands/coming-soon");
    expect(comingSoon.body.brands.map((b: { id: string }) => b.id)).toEqual(["the-biryani-lane"]);
  });

  it("a coming-soon brand doesn't leak into the admin list's non-coming-soon assumptions either way — both statuses show up there", async () => {
    await BrandModel.create({ _id: "the-biryani-lane", name: "The Biryani Lane", status: "coming-soon" });
    const token = await adminToken();

    const response = await request(app).get("/admin/brands").set("Authorization", `Bearer ${token}`);
    expect(response.body.brands).toHaveLength(1);
    expect(response.body.brands[0].status).toBe("coming-soon");
  });
});

describe("POST /admin/brands/upload-image", () => {
  it("rejects a non-admin caller", async () => {
    const response = await request(app).post("/admin/brands/upload-image");
    expect(response.status).toBe(401);
  });
});
