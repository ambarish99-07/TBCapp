import { SignupRequestSchema, LoginRequestSchema, RequestOtpSchema, UpdateProfileRequestSchema, VerifyOtpSchema, type User } from "@tbc/shared-types";
import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";
import { OtpCodeModel } from "../../db/models/OtpCode.model.js";
import { UserModel } from "../../db/models/User.model.js";
import type { Env } from "../../config/env.js";
import { hashPassword, verifyPassword, verifyAgainstDummyHash } from "./auth.service.js";
import { signAccessToken } from "./jwt.js";
import { sendOtpSms, smsConfigured, toIndianMobile } from "../../integrations/sms/msg91.js";

/**
 * Dev-only stand-in for a real SMS provider (Meta/MSG91/Twilio etc.) — no such
 * account is configured yet, same situation as WhatsApp/Razorpay elsewhere in
 * this codebase. Every OTP request "succeeds" with this fixed code instead of
 * actually sending an SMS; swap in a real provider call in requestOtp once one
 * is configured, and this constant goes away. Expiry and attempt-limiting
 * (OtpCode model) are real, even though the code itself is fixed.
 */
const MOCK_OTP_CODE = "123456";

/** Codes are stored only as a keyed hash — a database leak never exposes a usable OTP. */
function hashOtp(env: Env, phone: string, code: string): string {
  return createHmac("sha256", env.JWT_SECRET).update(`otp:${phone}:${code}`).digest("hex");
}
const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

export function toPublicUser(doc: {
  _id: unknown;
  email?: string | null;
  fullName: string;
  phone?: string | null;
  role: "customer" | "admin";
  loyalty: { completedOrderCount: number; isPremiumMemberOverride: boolean };
  premiumMembershipExpiresAt?: Date | null;
  houseNumber?: string | null;
  area?: string | null;
  address?: string | null;
  landmark?: string | null;
  city?: string | null;
  pincode?: string | null;
}): User {
  return {
    id: String(doc._id),
    email: doc.email ?? undefined,
    fullName: doc.fullName,
    phone: doc.phone ?? undefined,
    role: doc.role,
    loyalty: doc.loyalty,
    premiumMembershipExpiresAt: doc.premiumMembershipExpiresAt?.toISOString(),
    houseNumber: doc.houseNumber ?? undefined,
    area: doc.area ?? undefined,
    address: doc.address ?? undefined,
    landmark: doc.landmark ?? undefined,
    city: doc.city ?? undefined,
    pincode: doc.pincode ?? undefined,
  };
}

export function signup(env: Env): RequestHandler {
  return async (req, res) => {
    const parsed = SignupRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid signup payload", details: parsed.error.flatten() });
      return;
    }

    const { email, phone, password, fullName } = parsed.data;

    try {
      const passwordHash = await hashPassword(password);
      const user = await UserModel.create({ email, phone, passwordHash, fullName });
      const token = signAccessToken({ userId: String(user._id), role: user.role as "customer" | "admin" }, env.JWT_SECRET, env.JWT_EXPIRES_IN);
      res.status(201).json({ token, user: toPublicUser(user) });
    } catch (err: unknown) {
      // Unique indexes on email/phone are the real guard against a race between
      // two concurrent signups — this duplicate-key error is the expected
      // outcome of that race losing, not a bug.
      if (typeof err === "object" && err !== null && "code" in err && (err as { code?: number }).code === 11000) {
        const keyPattern = (err as { keyPattern?: Record<string, unknown> }).keyPattern ?? {};
        const field = "email" in keyPattern ? "email" : "phone" in keyPattern ? "phone number" : "email or phone number";
        res.status(409).json({ error: `An account with this ${field} already exists` });
        return;
      }
      throw err;
    }
  };
}

export function login(env: Env): RequestHandler {
  return async (req, res) => {
    const parsed = LoginRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid login payload" });
      return;
    }

    const { identifier, password } = parsed.data;
    const normalized = identifier.trim();
    const user = await UserModel.findOne({
      $or: [{ email: normalized.toLowerCase() }, { phone: normalized }],
    });

    if (!user) {
      await verifyAgainstDummyHash(password);
      res.status(401).json({ error: "Invalid email/phone or password" });
      return;
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      res.status(401).json({ error: "Invalid email/phone or password" });
      return;
    }

    const token = signAccessToken({ userId: String(user._id), role: user.role as "customer" | "admin" }, env.JWT_SECRET, env.JWT_EXPIRES_IN);
    res.json({ token, user: toPublicUser(user) });
  };
}

export function requestOtp(env: Env): RequestHandler {
  return async (req, res) => {
    const parsed = RequestOtpSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Please enter a valid mobile number." });
      return;
    }
    const { phone } = parsed.data;
    const isReviewLogin = !!env.OTP_REVIEW_PHONE && !!env.OTP_REVIEW_CODE && phone === env.OTP_REVIEW_PHONE;
    const realSms = smsConfigured(env) && !isReviewLogin;

    const mobile = toIndianMobile(phone);
    if (realSms && !mobile) {
      res.status(400).json({ error: "Please enter a valid 10-digit Indian mobile number." });
      return;
    }

    const code = isReviewLogin ? env.OTP_REVIEW_CODE! : realSms ? String(randomInt(0, 1_000_000)).padStart(6, "0") : MOCK_OTP_CODE;

    // Upserting means a resend simply replaces the previous code/expiry/attempts.
    await OtpCodeModel.findOneAndUpdate(
      { phone },
      { code: hashOtp(env, phone, code), expiresAt: new Date(Date.now() + OTP_TTL_MS), attempts: 0 },
      { upsert: true }
    );

    if (!realSms) {
      if (!isReviewLogin) console.log(`[otp] SMS not configured — test code for ${phone}: ${MOCK_OTP_CODE}`);
      res.json({ sent: true });
      return;
    }

    try {
      await sendOtpSms(env, mobile!, code);
      res.json({ sent: true });
    } catch (err) {
      // Don't leave the customer waiting for a code that was never sent.
      await OtpCodeModel.deleteOne({ phone });
      console.error("[otp] send failed:", err instanceof Error ? err.message : err);
      res.status(502).json({ error: "We couldn't send the OTP right now. Please try again in a minute." });
    }
  };
}

export function verifyOtp(env: Env): RequestHandler {
  return async (req, res) => {
    const parsed = VerifyOtpSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid verification payload" });
      return;
    }

    const { phone, otp, fullName } = parsed.data;
    const pending = await OtpCodeModel.findOne({ phone });
    if (!pending) {
      res.status(400).json({ error: "Please request a new code." });
      return;
    }
    if (pending.expiresAt.getTime() < Date.now()) {
      await OtpCodeModel.deleteOne({ phone });
      res.status(401).json({ error: "This OTP has expired. Please request a new one." });
      return;
    }
    if (pending.attempts >= MAX_OTP_ATTEMPTS) {
      await OtpCodeModel.deleteOne({ phone });
      res.status(429).json({ error: "Too many incorrect attempts. Please request a new code." });
      return;
    }
    const given = Buffer.from(hashOtp(env, phone, otp.trim()), "hex");
    const stored = Buffer.from(pending.code, "hex");
    if (given.length !== stored.length || !timingSafeEqual(given, stored)) {
      pending.attempts += 1;
      await pending.save();
      res.status(401).json({ error: "The OTP is incorrect. Please try again." });
      return;
    }

    let user = await UserModel.findOne({ phone });
    if (!user) {
      if (!fullName) {
        // Code is verified but there's no account yet — the client collects a
        // name and resubmits the same code, still within its expiry window,
        // rather than treating this as an error.
        res.json({ requiresName: true });
        return;
      }
      // OTP-verified accounts have no password of their own — a random,
      // never-shown hash keeps passwordHash populated without making one
      // guessable or usable for password-based login.
      const passwordHash = await hashPassword(randomBytes(32).toString("hex"));
      user = await UserModel.create({ phone, fullName, passwordHash });
    }

    await OtpCodeModel.deleteOne({ phone });
    const token = signAccessToken({ userId: String(user._id), role: user.role as "customer" | "admin" }, env.JWT_SECRET, env.JWT_EXPIRES_IN);
    res.json({ token, user: toPublicUser(user) });
  };
}

export const me: RequestHandler = async (req, res) => {
  if (!req.user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const user = await UserModel.findById(req.user.userId);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({ user: toPublicUser(user) });
};

export const updateProfile: RequestHandler = async (req, res) => {
  if (!req.user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const parsed = UpdateProfileRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid profile payload", details: parsed.error.flatten() });
    return;
  }

  try {
    const user = await UserModel.findByIdAndUpdate(req.user.userId, parsed.data, { new: true, runValidators: true });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json({ user: toPublicUser(user) });
  } catch (err: unknown) {
    // Same race-condition guard as signup — the unique index on email/phone is the real check.
    if (typeof err === "object" && err !== null && "code" in err && (err as { code?: number }).code === 11000) {
      const keyPattern = (err as { keyPattern?: Record<string, unknown> }).keyPattern ?? {};
      const field = "email" in keyPattern ? "email" : "phone" in keyPattern ? "phone number" : "email or phone number";
      res.status(409).json({ error: `An account with this ${field} already exists` });
      return;
    }
    throw err;
  }
};
