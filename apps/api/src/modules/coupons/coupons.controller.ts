import { ValidateCouponRequestSchema } from "@tbc/shared-types";
import type { RequestHandler, Response } from "express";
import * as couponsService from "./coupons.service.js";
import { CouponValidationError } from "./coupons.errors.js";

function handleCouponError(err: unknown, res: Response): boolean {
  if (err instanceof CouponValidationError) {
    res.status(400).json({ error: err.message });
    return true;
  }
  return false;
}

export const getActiveCoupons: RequestHandler = async (req, res) => {
  const brandId = typeof req.query.brandId === "string" ? req.query.brandId : undefined;
  if (!brandId) {
    res.status(400).json({ error: "brandId query param is required" });
    return;
  }
  const coupons = await couponsService.listActiveCoupons(brandId);
  res.json({ coupons });
};

export const postValidateCoupon: RequestHandler = async (req, res) => {
  const parsed = ValidateCouponRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid coupon validation payload", details: parsed.error.flatten() });
    return;
  }

  try {
    const result = await couponsService.resolveCoupon(parsed.data.code, parsed.data.brandId, parsed.data.subtotal);
    res.json(result);
  } catch (err) {
    if (handleCouponError(err, res)) return;
    throw err;
  }
};
