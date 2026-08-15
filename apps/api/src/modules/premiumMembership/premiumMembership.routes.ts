import { Router } from "express";
import type { Env } from "../../config/env.js";
import { requireAuth } from "../auth/auth.middleware.js";
import {
  getMembershipStatus,
  postMembershipRazorpayOrder,
  postMembershipRazorpayVerify,
  postPurchase,
} from "./premiumMembership.controller.js";

/** ₹39/30-day free-delivery membership — its own module, entirely separate from tiffin and
 * orders. Every route requires an account, same as the rest of ordering. */
export function createPremiumMembershipRouter(env: Env): Router {
  const router = Router();

  router.post("/purchase", requireAuth(env.JWT_SECRET), postPurchase(env));
  router.post("/purchases/:id/razorpay-order", requireAuth(env.JWT_SECRET), postMembershipRazorpayOrder(env));
  router.post("/purchases/:id/razorpay-verify", requireAuth(env.JWT_SECRET), postMembershipRazorpayVerify(env));
  router.get("/status", requireAuth(env.JWT_SECRET), getMembershipStatus);

  return router;
}
