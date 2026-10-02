import { CreateCouponRequestSchema, UpdateCouponRequestSchema, ValidateCouponRequestSchema } from "@tbc/shared-types";
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

// brandIds (comma-separated — every kitchen in the cart) is optional here on purpose — omitted
// entirely, it returns every brand's active coupons at once, for the Account screen's
// brand-agnostic browse page. A single legacy `brandId` is still accepted.
export const getActiveCoupons: RequestHandler = async (req, res) => {
  const raw =
    typeof req.query.brandIds === "string" ? req.query.brandIds : typeof req.query.brandId === "string" ? req.query.brandId : "";
  const brandIds = raw.split(",").map((id) => id.trim()).filter(Boolean);
  const coupons = await couponsService.listActiveCoupons(brandIds.length ? brandIds : undefined, req.user?.userId ?? null);
  res.json({ coupons });
};

export const postValidateCoupon: RequestHandler = async (req, res) => {
  const parsed = ValidateCouponRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid coupon validation payload", details: parsed.error.flatten() });
    return;
  }

  try {
    const result = await couponsService.resolveCoupon(parsed.data.code, parsed.data.brandIds, parsed.data.lines, req.user?.userId ?? null);
    res.json(result);
  } catch (err) {
    if (handleCouponError(err, res)) return;
    throw err;
  }
};

// --- Admin ---

export const listCouponsAdmin: RequestHandler = async (_req, res) => {
  const coupons = await couponsService.listAllCoupons();
  res.json({ coupons });
};

export const createCouponAdmin: RequestHandler = async (req, res) => {
  const parsed = CreateCouponRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid coupon payload", details: parsed.error.flatten() });
    return;
  }
  try {
    const coupon = await couponsService.createCoupon(parsed.data);
    res.status(201).json({ coupon });
  } catch (err) {
    if (handleCouponError(err, res)) return;
    throw err;
  }
};

export const updateCouponAdmin: RequestHandler = async (req, res) => {
  const parsed = UpdateCouponRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid coupon payload", details: parsed.error.flatten() });
    return;
  }
  try {
    const coupon = await couponsService.updateCoupon(req.params.id, parsed.data);
    res.json({ coupon });
  } catch (err) {
    if (handleCouponError(err, res)) return;
    throw err;
  }
};

export const deleteCouponAdmin: RequestHandler = async (req, res) => {
  await couponsService.deleteCoupon(req.params.id);
  res.status(204).send();
};
