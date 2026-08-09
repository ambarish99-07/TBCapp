import { Schema, model, type InferSchemaType } from "mongoose";

/**
 * One pending OTP per phone number — upserted on every /auth/otp/request so a
 * resend simply replaces the previous code/expiry/attempts. Deleted once
 * consumed by a successful verify. This is what makes "expired OTP" and "too
 * many attempts" actually testable even though the SMS side is mocked (see
 * MOCK_OTP_CODE in auth.controller.ts) — the code itself is fixed, but expiry
 * and attempt-limiting are real.
 */
const OtpCodeSchema = new Schema({
  phone: { type: String, required: true, unique: true },
  code: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  attempts: { type: Number, required: true, default: 0 },
});

export type OtpCodeDocument = InferSchemaType<typeof OtpCodeSchema>;
export const OtpCodeModel = model("OtpCode", OtpCodeSchema);
