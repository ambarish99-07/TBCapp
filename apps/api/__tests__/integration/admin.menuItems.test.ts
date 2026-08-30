import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import jwt from "jsonwebtoken";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { MenuItemModel } from "../../src/db/models/MenuItem.model.js";
import { UserModel } from "../../src/db/models/User.model.js";
import { clearTestDb, startTestDb, stopTestDb, testEnv } from "./testDb.js";

const env = testEnv();
const app = createApp(env);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Uploads land in the real apps/api/public/menu-images (see modules/menu/upload.ts) — there's no
// isolated test directory for it, so every file this suite creates is tracked and deleted again.
const uploadedFiles: string[] = [];

beforeAll(async () => {
  await startTestDb();
});

afterEach(async () => {
  await clearTestDb();
});

afterAll(async () => {
  await stopTestDb();
  for (const file of uploadedFiles) {
    fs.rmSync(file, { force: true });
  }
});

async function adminToken(): Promise<string> {
  const admin = await UserModel.create({ fullName: "Admin", email: "admin@test.com", passwordHash: "unused", role: "admin" });
  return jwt.sign({ userId: String(admin._id), role: "admin" }, env.JWT_SECRET, { expiresIn: "1h" });
}

const validItem = {
  id: "choco-crush",
  brandId: "tbc",
  signatureName: "Choco Crush",
  commonName: "Rich Chocolate Shake",
  description: "desc",
  price: 220,
  category: "signature-shakes",
  image: "https://example.com/a.jpg",
  flavorBadges: [],
};

describe("PUT /menu (admin upsert)", () => {
  it("rejects a non-admin caller", async () => {
    const customer = await UserModel.create({ fullName: "Customer", passwordHash: "x", role: "customer" });
    const token = jwt.sign({ userId: String(customer._id), role: "customer" }, env.JWT_SECRET, { expiresIn: "1h" });

    const response = await request(app).put("/menu").set("Authorization", `Bearer ${token}`).send(validItem);
    expect(response.status).toBe(403);
  });

  it("rejects a payload missing required fields", async () => {
    const token = await adminToken();
    const response = await request(app)
      .put("/menu")
      .set("Authorization", `Bearer ${token}`)
      .send({ id: "choco-crush", brandId: "tbc" });
    expect(response.status).toBe(400);
  });

  it("creates a new item, then updates it, then deletes it", async () => {
    const token = await adminToken();
    const authHeader = `Bearer ${token}`;

    const created = await request(app).put("/menu").set("Authorization", authHeader).send(validItem);
    expect(created.status).toBe(200);
    expect(created.body.item.id).toBe("choco-crush");
    expect(created.body.item.price).toBe(220);

    const updated = await request(app)
      .put("/menu")
      .set("Authorization", authHeader)
      .send({ ...validItem, price: 250, isPopular: true });
    expect(updated.status).toBe(200);
    expect(updated.body.item.price).toBe(250);
    expect(updated.body.item.isPopular).toBe(true);

    const listBeforeDelete = await request(app).get("/menu").query({ brandId: "tbc" });
    expect(listBeforeDelete.body.items).toHaveLength(1);

    const deleted = await request(app).delete("/menu/choco-crush").set("Authorization", authHeader);
    expect(deleted.status).toBe(204);

    const listAfterDelete = await request(app).get("/menu").query({ brandId: "tbc" });
    expect(listAfterDelete.body.items).toHaveLength(0);
  });
});

describe("POST /menu/upload-image", () => {
  it("rejects a non-admin caller", async () => {
    const customer = await UserModel.create({ fullName: "Customer", passwordHash: "x", role: "customer" });
    const token = jwt.sign({ userId: String(customer._id), role: "customer" }, env.JWT_SECRET, { expiresIn: "1h" });

    const response = await request(app)
      .post("/menu/upload-image")
      .set("Authorization", `Bearer ${token}`)
      .attach("image", Buffer.from("not-a-real-png"), { filename: "a.png", contentType: "image/png" });
    expect(response.status).toBe(403);
  });

  it("saves the file and returns a URL an admin can set as an item's image", async () => {
    const token = await adminToken();
    // A tiny transparent PNG, not just arbitrary bytes — multer's fileFilter only checks the
    // declared content-type here, but a real file makes this test double as a smoke test for the
    // whole disk-write path.
    const pngPath = path.join(__dirname, "../fixtures/tiny.png");
    const tinyPng = fs.existsSync(pngPath)
      ? fs.readFileSync(pngPath)
      : Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
          "base64"
        );

    const response = await request(app)
      .post("/menu/upload-image")
      .set("Authorization", `Bearer ${token}`)
      .attach("image", tinyPng, { filename: "photo.png", contentType: "image/png" });

    expect(response.status).toBe(201);
    expect(response.body.url).toMatch(/\/menu-images\/[a-f0-9-]+\.png$/);

    const savedPath = path.join(__dirname, "../../public/menu-images", path.basename(response.body.url));
    uploadedFiles.push(savedPath);
    expect(fs.existsSync(savedPath)).toBe(true);
  });

  it("rejects a non-image file", async () => {
    const token = await adminToken();
    const response = await request(app)
      .post("/menu/upload-image")
      .set("Authorization", `Bearer ${token}`)
      .attach("image", Buffer.from("hello"), { filename: "a.txt", contentType: "text/plain" });
    // Rejected by multer's fileFilter, surfaced via the app's generic error handler.
    expect(response.status).toBe(500);
  });
});
