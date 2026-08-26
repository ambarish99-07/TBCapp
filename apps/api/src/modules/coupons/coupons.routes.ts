import { Router } from "express";
import type { Env } from "../../config/env.js";
import { optionalAuth } from "../auth/auth.middleware.js";
import { getActiveCoupons, postValidateCoupon } from "./coupons.controller.js";

/** Coupon validation is available to guests and logged-in customers alike — same trust model as
 * order creation (optionalAuth), since applying a coupon needs no account identity, only a valid
 * code, the right brand, and a cart that meets its minimum. */
export function createCouponsRouter(env: Env): Router {
  const router = Router();

  router.get("/active", optionalAuth(env.JWT_SECRET), getActiveCoupons);
  router.post("/validate", optionalAuth(env.JWT_SECRET), postValidateCoupon);

  return router;
}
