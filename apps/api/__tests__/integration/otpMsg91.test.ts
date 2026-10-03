import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.js";
import { OtpCodeModel } from "../../src/db/models/OtpCode.model.js";
import { toIndianMobile } from "../../src/integrations/sms/msg91.js";
import { clearTestDb, startTestDb, stopTestDb, testEnv } from "./testDb.js";

const env = testEnv({
  MSG91_AUTH_KEY: "test-auth-key-123456",
  MSG91_OTP_TEMPLATE_ID: "tmpl-abc-123",
  OTP_REVIEW_PHONE: "9000000001",
  OTP_REVIEW_CODE: "246810",
});
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

function msg91Ok() {
  return vi.fn().mockResolvedValue(new Response(JSON.stringify({ type: "success", message: "3a6f" }), { status: 200 }));
}

describe("real OTP SMS via MSG91", () => {
  it("sends a random 6-digit code to +91 with the template, stores only a hash, and only that code verifies", async () => {
    const fetchMock = msg91Ok();
    vi.stubGlobal("fetch", fetchMock);

    const res = await request(app).post("/auth/otp/request").send({ phone: "98765 43210" });
    expect(res.status).toBe(200);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
    expect(url).toBe("https://control.msg91.com/api/v5/flow");
    expect(init.headers.authkey).toBe("test-auth-key-123456");
    const body = JSON.parse(init.body as string);
    expect(body.template_id).toBe("tmpl-abc-123");
    expect(body.recipients[0].mobiles).toBe("919876543210");
    const code: string = body.recipients[0].number;
    expect(code).toMatch(/^\d{6}$/);

    const stored = await OtpCodeModel.findOne({ phone: "98765 43210" }).lean();
    expect(stored?.code).not.toBe(code);
    expect(stored?.code).toMatch(/^[0-9a-f]{64}$/);

    const wrong = await request(app).post("/auth/otp/verify").send({ phone: "98765 43210", otp: code === "123456" ? "654321" : "123456", fullName: "Riya" });
    expect(wrong.status).toBe(401);
    const right = await request(app).post("/auth/otp/verify").send({ phone: "98765 43210", otp: code, fullName: "Riya" });
    expect(right.status).toBe(200);
    expect(right.body.token).toBeTruthy();
  });

  it("tells the customer when MSG91 refuses (even with HTTP 200) and leaves no pending code behind", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ type: "error", message: "Invalid template" }), { status: 200 })));
    const res = await request(app).post("/auth/otp/request").send({ phone: "9876543210" });
    expect(res.status).toBe(502);
    expect(await OtpCodeModel.findOne({ phone: "9876543210" })).toBeNull();
  });

  it("rejects a number that isn't an Indian mobile before sending anything", async () => {
    const fetchMock = msg91Ok();
    vi.stubGlobal("fetch", fetchMock);
    const res = await request(app).post("/auth/otp/request").send({ phone: "12345678" });
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("lets the app-store review number log in with its fixed code, without sending an SMS", async () => {
    const fetchMock = msg91Ok();
    vi.stubGlobal("fetch", fetchMock);
    await request(app).post("/auth/otp/request").send({ phone: "9000000001" });
    expect(fetchMock).not.toHaveBeenCalled();
    const res = await request(app).post("/auth/otp/verify").send({ phone: "9000000001", otp: "246810", fullName: "Reviewer" });
    expect(res.status).toBe(200);
  });

  it("normalises Indian mobile formats", () => {
    expect(toIndianMobile("+91 98765-43210")).toBe("9876543210");
    expect(toIndianMobile("098765 43210")).toBe("9876543210");
    expect(toIndianMobile("5876543210")).toBeNull();
    expect(toIndianMobile("98765")).toBeNull();
  });
});
