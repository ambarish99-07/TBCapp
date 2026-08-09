import { SignupRequestSchema, LoginRequestSchema, RequestOtpSchema, VerifyOtpSchema, type User } from "@tbc/shared-types";
import { randomBytes } from "node:crypto";
import type { RequestHandler } from "express";
import { OtpCodeModel } from "../../db/models/OtpCode.model.js";
import { UserModel } from "../../db/models/User.model.js";
import type { Env } from "../../config/env.js";
import { hashPassword, verifyPassword, verifyAgainstDummyHash } from "./auth.service.js";
import { signAccessToken } from "./jwt.js";

/**
 * Dev-only stand-in for a real SMS provider (Meta/MSG91/Twilio etc.) — no such
 * account is configured yet, same situation as WhatsApp/Razorpay elsewhere in
 * this codebase. Every OTP request "succeeds" with this fixed code instead of
 * actually sending an SMS; swap in a real provider call in requestOtp once one
 * is configured, and this constant goes away. Expiry and attempt-limiting
 * (OtpCode model) are real, even though the code itself is fixed.
 */
const MOCK_OTP_CODE = "123456";
const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

function toPublicUser(doc: {
  _id: unknown;
  email?: string | null;
  fullName: string;
  phone?: string | null;
  role: "customer" | "admin";
  loyalty: { completedOrderCount: number; isPremiumMemberOverride: boolean };
}): User {
  return {
    id: String(doc._id),
    email: doc.email ?? undefined,
    fullName: doc.fullName,
    phone: doc.phone ?? undefined,
    role: doc.role,
    loyalty: doc.loyalty,
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

export function requestOtp(_env: Env): RequestHandler {
  return async (req, res) => {
    const parsed = RequestOtpSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Please enter a valid mobile number." });
      return;
    }

    // Upserting means a resend simply replaces the previous code/expiry/attempts.
    await OtpCodeModel.findOneAndUpdate(
      { phone: parsed.data.phone },
      { code: MOCK_OTP_CODE, expiresAt: new Date(Date.now() + OTP_TTL_MS), attempts: 0 },
      { upsert: true }
    );

    // Real send would go here. For now, log it the same way the WhatsApp
    // integration logs instead of sending when it isn't configured.
    console.log(`[otp] mock code for ${parsed.data.phone}: ${MOCK_OTP_CODE}`);
    res.json({ sent: true });
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
    if (otp !== pending.code) {
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
