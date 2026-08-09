import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { OtpCodeModel } from "../../src/db/models/OtpCode.model.js";
import { UserModel } from "../../src/db/models/User.model.js";
import { clearTestDb, startTestDb, stopTestDb, testEnv } from "./testDb.js";

// Its own app instance (and so its own in-memory rate-limiter state) — kept
// separate from hardening.test.ts so the many /auth/otp/* calls here can't
// collide with that file's dedicated rate-limit-exhaustion test.
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

describe("phone + OTP login", () => {
  it("verifies without a name first, then only asks for one because the number is new", async () => {
    await request(app).post("/auth/otp/request").send({ phone: "9333333333" });

    const verifiedNoName = await request(app).post("/auth/otp/verify").send({ phone: "9333333333", otp: "123456" });
    expect(verifiedNoName.status).toBe(200);
    expect(verifiedNoName.body.requiresName).toBe(true);
    expect(verifiedNoName.body.token).toBeUndefined();

    // Same code, still valid — resubmitted with the name instead of re-verifying.
    const created = await request(app)
      .post("/auth/otp/verify")
      .send({ phone: "9333333333", otp: "123456", fullName: "Otp Person" });
    expect(created.status).toBe(200);
    expect(created.body.user.phone).toBe("9333333333");
    expect(created.body.token).toBeDefined();
  });

  it("logs an existing phone-registered user straight in, never asking for a name", async () => {
    await request(app).post("/auth/otp/request").send({ phone: "9444444444" });
    await request(app).post("/auth/otp/verify").send({ phone: "9444444444", otp: "123456", fullName: "Repeat Visitor" });

    await request(app).post("/auth/otp/request").send({ phone: "9444444444" });
    const second = await request(app).post("/auth/otp/verify").send({ phone: "9444444444", otp: "123456" });
    expect(second.status).toBe(200);
    expect(second.body.requiresName).toBeUndefined();
    expect(second.body.user.fullName).toBe("Repeat Visitor");

    const count = await UserModel.countDocuments({ phone: "9444444444" });
    expect(count).toBe(1);
  });

  it("rejects the wrong code without consuming an attempt beyond the limit", async () => {
    await request(app).post("/auth/otp/request").send({ phone: "9555555555" });

    const response = await request(app)
      .post("/auth/otp/verify")
      .send({ phone: "9555555555", otp: "000000", fullName: "Wrong Code" });
    expect(response.status).toBe(401);
    expect(response.body.error).toMatch(/incorrect/i);
  });

  it("locks out after too many incorrect attempts", async () => {
    await request(app).post("/auth/otp/request").send({ phone: "9666666666" });

    let lastResponse;
    for (let i = 0; i < 6; i++) {
      lastResponse = await request(app).post("/auth/otp/verify").send({ phone: "9666666666", otp: "000000" });
    }
    expect(lastResponse!.status).toBe(429);
  });

  it("rejects an expired code", async () => {
    await request(app).post("/auth/otp/request").send({ phone: "9777777777" });
    await OtpCodeModel.updateOne({ phone: "9777777777" }, { expiresAt: new Date(Date.now() - 1000) });

    const response = await request(app).post("/auth/otp/verify").send({ phone: "9777777777", otp: "123456" });
    expect(response.status).toBe(401);
    expect(response.body.error).toMatch(/expired/i);
  });

  it("rejects verification when no code was ever requested", async () => {
    const response = await request(app).post("/auth/otp/verify").send({ phone: "9888888888", otp: "123456" });
    expect(response.status).toBe(400);
  });

  it("a resend replaces the previous code and resets attempts", async () => {
    await request(app).post("/auth/otp/request").send({ phone: "9999911111" });
    await request(app).post("/auth/otp/verify").send({ phone: "9999911111", otp: "000000" }); // one wrong attempt

    await request(app).post("/auth/otp/request").send({ phone: "9999911111" }); // resend
    const record = await OtpCodeModel.findOne({ phone: "9999911111" });
    expect(record?.attempts).toBe(0);

    const response = await request(app).post("/auth/otp/verify").send({ phone: "9999911111", otp: "123456", fullName: "Resend Person" });
    expect(response.status).toBe(200);
  });
});
