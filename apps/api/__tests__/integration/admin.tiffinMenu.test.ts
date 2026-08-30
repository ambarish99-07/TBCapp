import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import jwt from "jsonwebtoken";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { UserModel } from "../../src/db/models/User.model.js";
import { clearTestDb, seedTiffinMenu, startTestDb, stopTestDb, testEnv } from "./testDb.js";

const env = testEnv();
const app = createApp(env);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadedFiles: string[] = [];

beforeAll(async () => {
  await startTestDb();
});

afterEach(async () => {
  await clearTestDb();
});

afterAll(async () => {
  await stopTestDb();
  for (const file of uploadedFiles) fs.rmSync(file, { force: true });
});

async function adminToken(): Promise<string> {
  const admin = await UserModel.create({ fullName: "Admin", email: "admin@test.com", passwordHash: "unused", role: "admin" });
  return jwt.sign({ userId: String(admin._id), role: "admin" }, env.JWT_SECRET, { expiresIn: "1h" });
}

describe("GET /admin/tiffin/dishes and PUT /admin/tiffin/dishes", () => {
  it("lists the seeded weekly rotation and lets an admin change a specific slot's dish", async () => {
    await seedTiffinMenu();
    const token = await adminToken();
    const authHeader = `Bearer ${token}`;

    const list = await request(app).get("/admin/tiffin/dishes").set("Authorization", authHeader);
    expect(list.status).toBe(200);
    expect(list.body.dishes).toHaveLength(112);

    const mondayLunchVeg = list.body.dishes.find(
      (d: { tier: string; dietType: string; mealType: string; dayOfWeek: string }) =>
        d.tier === "regular" && d.dietType === "veg" && d.mealType === "lunch" && d.dayOfWeek === "Monday"
    );
    expect(mondayLunchVeg.dishName).toBe("Aloo Matar");

    const updated = await request(app)
      .put("/admin/tiffin/dishes")
      .set("Authorization", authHeader)
      .send({ ...mondayLunchVeg, dishName: "Chana Masala", id: undefined });
    expect(updated.status).toBe(200);
    expect(updated.body.dish.dishName).toBe("Chana Masala");

    // The customer-facing weekly menu reflects the same change immediately — same collection.
    const publicMenu = await request(app).get("/tiffin/weekly-menu");
    const changed = publicMenu.body.dishes.find((d: { id: string }) => d.id === mondayLunchVeg.id);
    expect(changed.dishName).toBe("Chana Masala");
  });

  it("is not accessible to a non-admin", async () => {
    const customer = await UserModel.create({ fullName: "Customer", passwordHash: "x", role: "customer" });
    const token = jwt.sign({ userId: String(customer._id), role: "customer" }, env.JWT_SECRET, { expiresIn: "1h" });
    const response = await request(app).get("/admin/tiffin/dishes").set("Authorization", `Bearer ${token}`);
    expect(response.status).toBe(403);
  });
});

describe("GET /admin/tiffin/add-on-prices and PUT /admin/tiffin/add-on-prices", () => {
  it("lists seeded add-on prices and lets an admin change one", async () => {
    await seedTiffinMenu();
    const token = await adminToken();
    const authHeader = `Bearer ${token}`;

    const list = await request(app).get("/admin/tiffin/add-on-prices").set("Authorization", authHeader);
    expect(list.status).toBe(200);
    expect(list.body.addOnPrices).toHaveLength(10);
    const rice = list.body.addOnPrices.find((p: { name: string }) => p.name === "Rice");
    expect(rice.price).toBe(20);

    const updated = await request(app).put("/admin/tiffin/add-on-prices").set("Authorization", authHeader).send({ name: "Rice", price: 25 });
    expect(updated.status).toBe(200);
    expect(updated.body.addOnPrice.price).toBe(25);
  });
});

describe("POST /admin/tiffin/dishes/upload-image", () => {
  it("saves the file to public/tiffin-images and returns its URL", async () => {
    const token = await adminToken();
    const tinyPng = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64"
    );

    const response = await request(app)
      .post("/admin/tiffin/dishes/upload-image")
      .set("Authorization", `Bearer ${token}`)
      .attach("image", tinyPng, { filename: "photo.png", contentType: "image/png" });

    expect(response.status).toBe(201);
    expect(response.body.url).toMatch(/\/tiffin-images\/[a-f0-9-]+\.png$/);

    const savedPath = path.join(__dirname, "../../public/tiffin-images", path.basename(response.body.url));
    uploadedFiles.push(savedPath);
    expect(fs.existsSync(savedPath)).toBe(true);
  });
});
