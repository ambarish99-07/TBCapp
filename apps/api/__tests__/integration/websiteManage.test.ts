import jwt from "jsonwebtoken";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.js";
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

/** Stands in for the website: records each signed call and answers with `reply(path, body)`. */
function website(reply: (path: string, body: Record<string, unknown>) => { status?: number; body: unknown }) {
  const calls: { path: string; body: Record<string, unknown>; signed: boolean }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(async (url: string, init: RequestInit) => {
      const headers = init.headers as Record<string, string>;
      const raw = init.body as string;
      const path = url.replace(`${PEER}/internal/admin-peer`, "");
      const body = JSON.parse(raw) as Record<string, unknown>;
      calls.push({ path, body, signed: verifySyncSignature(SECRET, headers[SYNC_TIMESTAMP_HEADER], headers[SYNC_SIGNATURE_HEADER], raw) });
      const r = reply(path, body);
      return new Response(JSON.stringify(r.body), { status: r.status ?? 200 });
    })
  );
  return calls;
}

describe("the website's orders, blog, leads and GG Tiffin in the Lickyeat Admin", () => {
  it("lists website orders with the app's brand ids, filtering by the website's", async () => {
    const calls = website(() => ({
      body: { orders: [{ id: "o1", brandId: "the-biryani-lane", brandIds: ["the-biryani-lane", "tbc"], lines: [{ brandId: "the-biryani-lane" }] }] },
    }));
    const res = await request(app).get("/admin/website/orders").query({ brandId: "TBL" }).set(await adminAuth());
    expect(res.status).toBe(200);
    expect(calls[0]).toMatchObject({ path: "/orders", body: { brandId: "the-biryani-lane" }, signed: true });
    expect(res.body.orders[0]).toMatchObject({ brandId: "TBL", brandIds: ["TBL", "tbc"], lines: [{ brandId: "TBL" }] });
  });

  it("passes the website's refusal on as-is, so the admin sees why", async () => {
    website(() => ({ status: 400, body: { error: { message: "Cannot move from received to delivered." } } }));
    const res = await request(app).post("/admin/website/orders/o1/status").set(await adminAuth()).send({ status: "delivered" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Cannot move from received to delivered.");
  });

  it("forwards blog edits and lead notes (signed by the Lickyeat Admin)", async () => {
    const calls = website((path) => ({ body: path.startsWith("/blog") ? { post: { id: "monsoon" } } : { lead: { id: "L1" } } }));
    const auth = await adminAuth();
    await request(app).patch("/admin/website/blog/monsoon").set(auth).send({ excerpt: "Cold" });
    await request(app).patch("/admin/website/leads/L1").set(auth).send({ status: "contacted", note: "Called" });
    expect(calls[0]).toMatchObject({ path: "/blog/update", body: { slug: "monsoon", patch: { excerpt: "Cold" } } });
    expect(calls[1]).toMatchObject({ path: "/leads/update", body: { id: "L1", status: "contacted", note: "Called", by: "Lickyeat Admin" } });
  });

  it("only lets a GG Tiffin single-meal order move forward to a real status", async () => {
    website(() => ({ body: { order: {} } }));
    const res = await request(app).post("/admin/website/tiffin/single-meal/x/status").set(await adminAuth()).send({ status: "teleported" });
    expect(res.status).toBe(400);
  });

  it("is for admins only", async () => {
    const res = await request(app).get("/admin/website/orders");
    expect(res.status).toBe(401);
  });
});
