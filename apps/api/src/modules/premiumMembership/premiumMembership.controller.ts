import { PurchasePremiumMembershipRequestSchema } from "@tbc/shared-types";
import type { Request, RequestHandler, Response } from "express";
import type { Env } from "../../config/env.js";
import * as premiumMembershipService from "./premiumMembership.service.js";
import { PremiumMembershipValidationError } from "./premiumMembership.errors.js";

function handlePremiumMembershipError(err: unknown, res: Response): boolean {
  if (err instanceof PremiumMembershipValidationError) {
    res.status(400).json({ error: err.message });
    return true;
  }
  return false;
}

/** Every route here is mounted behind requireAuth — this only guards TypeScript's optional `req.user`. */
function requireUserId(req: Request, res: Response): string | null {
  if (!req.user) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }
  return req.user.userId;
}

export function postPurchase(env: Env): RequestHandler {
  return async (req, res) => {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const parsed = PurchasePremiumMembershipRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid purchase payload", details: parsed.error.flatten() });
      return;
    }

    try {
      const { purchase, user } = await premiumMembershipService.purchaseMembership(env, userId, parsed.data.paymentMethod);
      res.status(201).json({ purchase, user });
    } catch (err) {
      if (handlePremiumMembershipError(err, res)) return;
      throw err;
    }
  };
}

export function postMembershipRazorpayOrder(env: Env): RequestHandler {
  return async (req, res) => {
    const userId = requireUserId(req, res);
    if (!userId) return;
    try {
      const razorpayOrder = await premiumMembershipService.createMembershipRazorpayOrder(env, userId, req.params.id);
      res.json(razorpayOrder);
    } catch (err) {
      if (handlePremiumMembershipError(err, res)) return;
      throw err;
    }
  };
}

export function postMembershipRazorpayVerify(env: Env): RequestHandler {
  return async (req, res) => {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body as {
      razorpay_order_id?: string;
      razorpay_payment_id?: string;
      razorpay_signature?: string;
    };
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      res.status(400).json({ error: "Missing required verification fields" });
      return;
    }

    try {
      const { purchase, user } = await premiumMembershipService.verifyMembershipRazorpayPayment(env, userId, req.params.id, {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
      });
      res.json({ purchase, user });
    } catch (err) {
      if (handlePremiumMembershipError(err, res)) return;
      throw err;
    }
  };
}

export const getMembershipStatus: RequestHandler = async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  try {
    const status = await premiumMembershipService.getMembershipStatus(userId);
    res.json(status);
  } catch (err) {
    if (handlePremiumMembershipError(err, res)) return;
    throw err;
  }
};
