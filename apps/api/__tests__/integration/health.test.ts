import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { startTestDb, stopTestDb, testEnv } from "./testDb.js";

const env = testEnv();
const app = createApp(env);

beforeAll(async () => {
  await startTestDb();
});

afterAll(async () => {
  await stopTestDb();
});

// A hosting platform's own health check should reflect real DB connectivity, not just
// "the Express process is up" — see app.ts's GET /health.
describe("GET /health", () => {
  it("reports ok and connected once the DB connection is established", async () => {
    const response = await request(app).get("/health");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true, db: "connected" });
  });
});
