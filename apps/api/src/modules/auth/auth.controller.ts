import { SignupRequestSchema, LoginRequestSchema, type User } from "@tbc/shared-types";
import type { RequestHandler } from "express";
import { UserModel } from "../../db/models/User.model.js";
import type { Env } from "../../config/env.js";
import { hashPassword, verifyPassword, verifyAgainstDummyHash } from "./auth.service.js";
import { signAccessToken } from "./jwt.js";

function toPublicUser(doc: {
  _id: unknown;
  email: string;
  fullName: string;
  phone: string;
  role: "customer" | "admin";
  loyalty: { completedOrderCount: number; isPremiumMemberOverride: boolean };
}): User {
  return {
    id: String(doc._id),
    email: doc.email,
    fullName: doc.fullName,
    phone: doc.phone,
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

    const { email, password, fullName, phone } = parsed.data;

    try {
      const passwordHash = await hashPassword(password);
      const user = await UserModel.create({ email, passwordHash, fullName, phone });
      const token = signAccessToken({ userId: String(user._id), role: user.role as "customer" | "admin" }, env.JWT_SECRET, env.JWT_EXPIRES_IN);
      res.status(201).json({ token, user: toPublicUser(user) });
    } catch (err: unknown) {
      // Unique index on email is the real guard against a race between two
      // concurrent signups — this duplicate-key error is the expected outcome
      // of that race losing, not a bug.
      if (typeof err === "object" && err !== null && "code" in err && (err as { code?: number }).code === 11000) {
        res.status(409).json({ error: "An account with this email already exists" });
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

    const { email, password } = parsed.data;
    const user = await UserModel.findOne({ email: email.toLowerCase() });

    if (!user) {
      await verifyAgainstDummyHash(password);
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

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
