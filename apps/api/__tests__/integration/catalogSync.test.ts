import jwt from "jsonwebtoken";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.js";
import { BrandStoreSettingsModel } from "../../src/db/models/BrandStoreSettings.model.js";
import { ComboModel } from "../../src/db/models/Combo.model.js";
import { MenuItemModel } from "../../src/db/models/MenuItem.model.js";
import { UserModel } from "../../src/db/models/User.model.js";
import {
  SYNC_SIGNATURE_HEADER,
  SYNC_TIMESTAMP_HEADER,
  signSyncBody,
  verifySyncSignature,
} from "../../src/modules/catalogSync/catalogSync.types.js";
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

function signed(body: unknown, secret = SECRET, timestamp = String(Date.now())) {
  const raw = JSON.stringify(body);
  return { raw, headers: { "Content-Type": "application/json", [SYNC_TIMESTAMP_HEADER]: timestamp, [SYNC_SIGNATURE_HEADER]: signSyncBody(secret, timestamp, raw) } };
}

async function adminToken(): Promise<string> {
  const admin = await UserModel.create({ fullName: "Admin", email: "admin@test.com", passwordHash: "unused", role: "admin" });
  return jwt.sign({ userId: String(admin._id), role: "admin" }, env.JWT_SECRET, { expiresIn: "1h" });
}

const websiteItem = {
  id: "chicken-biryani",
  brandId: "the-biryani-lane",
  signatureName: "Chicken Biryani",
  commonName: "Chicken Dum Biryani",
  description: "desc",
  price: 199,
  category: "Biryani",
  imageUrl: "/static/menu-images/chicken-biryani.jpg",
  dietType: "non-veg",
  flavorBadges: [],
  isPopular: false,
  isNew: false,
  isStaffPick: false,
  isAvailable: false,
  pairsWith: [],
  salePercent: null,
  portionSize: "500 g box",
  sizeVariants: [{ label: "1 kg box", price: 319, isAvailable: true }],
  hasSugarIceCustomization: false,
  addOnNames: ["Extra Raita"],
};

describe("signature check", () => {
  it("accepts the right secret and rejects a wrong secret, a tampered body, or a stale timestamp", () => {
    const ts = String(Date.now());
    const sig = signSyncBody(SECRET, ts, "{}");
    expect(verifySyncSignature(SECRET, ts, sig, "{}")).toBe(true);
    expect(verifySyncSignature("another-secret-another-secret-123", ts, sig, "{}")).toBe(false);
    expect(verifySyncSignature(SECRET, ts, sig, '{"x":1}')).toBe(false);
    const old = String(Date.now() - 10 * 60 * 1000);
    expect(verifySyncSignature(SECRET, old, signSyncBody(SECRET, old, "{}"), "{}")).toBe(false);
  });
});

describe("POST /internal/catalog-sync — changes made on the website", () => {
  it("applies a signed menu item, translating the brand id and resolving a relative photo path", async () => {
    const { raw, headers } = signed({ events: [{ kind: "menuItem.upsert", data: websiteItem }] });
    const res = await request(app).post("/internal/catalog-sync").set(headers).send(raw);

    expect(res.status).toBe(200);
    const item = await MenuItemModel.findById("chicken-biryani").lean();
    expect(item?.brandId).toBe("TBL");
    expect(item?.image).toBe(`${PEER}/static/menu-images/chicken-biryani.jpg`);
    expect(item?.isAvailable).toBe(false);
    expect(item?.sizeVariants).toHaveLength(1);
  });

  it("refuses an unsigned or wrongly signed request and changes nothing", async () => {
    const unsigned = await request(app).post("/internal/catalog-sync").send({ events: [{ kind: "menuItem.delete", id: "x" }] });
    expect(unsigned.status).toBe(401);

    const { raw, headers } = signed({ events: [{ kind: "menuItem.upsert", data: websiteItem }] }, "wrong-secret-wrong-secret-wrong-secret");
    const forged = await request(app).post("/internal/catalog-sync").set(headers).send(raw);
    expect(forged.status).toBe(401);
    expect(await MenuItemModel.findById("chicken-biryani")).toBeNull();
  });

  it("applies a kitchen's open/closed switch and a combo deletion", async () => {
    await ComboModel.create({ _id: "feast-solo", brandId: "feast", type: "curated", name: "Solo", description: "d", itemIds: ["a", "b"] });
    const { raw, headers } = signed({
      events: [
        { kind: "storeSwitch.upsert", data: { scope: "the-biryani-lane", open: false } },
        { kind: "combo.delete", id: "feast-solo" },
      ],
    });
    const res = await request(app).post("/internal/catalog-sync").set(headers).send(raw);

    expect(res.status).toBe(200);
    expect((await BrandStoreSettingsModel.findById("TBL").lean())?.manuallyOpen).toBe(false);
    expect(await ComboModel.findById("feast-solo")).toBeNull();
  });
});

describe("outbound — an admin change in the app is sent to the website", () => {
  it("sends a saved menu item, signed, with the website's brand id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ applied: 1 }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const token = await adminToken();

    const res = await request(app)
      .put("/menu")
      .set("Authorization", `Bearer ${token}`)
      .send({
        id: "egg-biryani",
        brandId: "TBL",
        signatureName: "Egg Biryani",
        commonName: "Egg Biryani",
        description: "desc",
        price: 179,
        category: "Biryani",
        image: "https://storage.googleapis.com/bucket/menu-images/egg.jpg",
        flavorBadges: [],
      });
    expect(res.status).toBe(200);

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
    expect(url).toBe(`${PEER}/internal/catalog-sync`);
    const body = JSON.parse(init.body as string);
    expect(body.events[0].kind).toBe("menuItem.upsert");
    expect(body.events[0].data.brandId).toBe("the-biryani-lane");
    expect(body.events[0].data.imageUrl).toBe("https://storage.googleapis.com/bucket/menu-images/egg.jpg");
    expect(verifySyncSignature(SECRET, init.headers[SYNC_TIMESTAMP_HEADER], init.headers[SYNC_SIGNATURE_HEADER], init.body as string)).toBe(true);
  });

  it("sends a delete when an item is removed, and never fails the admin's save if the website is down", async () => {
    await MenuItemModel.create({ _id: "old", brandId: "tbc", signatureName: "Old", commonName: "Old", description: "d", price: 1, category: "x", image: "i" });
    const fetchMock = vi.fn().mockRejectedValue(new Error("website down"));
    vi.stubGlobal("fetch", fetchMock);
    const token = await adminToken();

    const res = await request(app).delete("/menu/old").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(204);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).events[0]).toEqual({ kind: "menuItem.delete", id: "old" });
  });

  it("refuses a new brand id that isn't a lowercase slug, so ids always match the website", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 200 })));
    const token = await adminToken();
    const bad = await request(app).post("/admin/brands").set("Authorization", `Bearer ${token}`).send({ id: "Momo House", name: "Momo House", status: "live" });
    expect(bad.status).toBe(400);
    const good = await request(app).post("/admin/brands").set("Authorization", `Bearer ${token}`).send({ id: "momo-house", name: "Momo House", status: "live" });
    expect(good.status).toBe(201);
  });
});

describe("GET /admin/catalog-sync — what differs between app and website", () => {
  it("lists items that exist only on one side", async () => {
    await MenuItemModel.create({ _id: "app-only", brandId: "tbc", signatureName: "A", commonName: "A", description: "d", price: 1, category: "x", image: "i" });
    await MenuItemModel.create({ _id: "both", brandId: "tbc", signatureName: "B", commonName: "B", description: "d", price: 1, category: "x", image: "i" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ brandIds: [], menuItemIds: ["both", "site-only"], comboIds: [], addOnNames: [] }), { status: 200 })
      )
    );
    const token = await adminToken();

    const res = await request(app).get("/admin/catalog-sync").set("Authorization", `Bearer ${token}`);
    expect(res.body.reachable).toBe(true);
    expect(res.body.diff.websiteOnly.menuItemIds).toEqual(["site-only"]);
    expect(res.body.diff.appOnly.menuItemIds).toEqual(["app-only"]);
  });
});
