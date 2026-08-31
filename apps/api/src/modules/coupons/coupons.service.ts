import { round } from "@tbc/pricing";
import type { Coupon, CreateCouponRequest, UpdateCouponRequest } from "@tbc/shared-types";
import { CouponModel } from "../../db/models/Coupon.model.js";
import { CouponValidationError } from "./coupons.errors.js";

/** Powers the Cart screen's "Apply Coupon" browse page — every currently-usable coupon for this
 * brand, so a customer can see what's on offer before typing (or revealing) a code. Expired ones
 * are excluded outright rather than shown greyed out, since there's nothing actionable about them. */
export async function listActiveCoupons(brandId: string): Promise<Coupon[]> {
  const coupons = await CouponModel.find({
    isActive: true,
    $or: [{ brandId: { $exists: false } }, { brandId }],
    $and: [{ $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: new Date() } }] }],
  }).sort({ createdAt: -1 });
  return coupons.map((coupon) => coupon.toJSON() as unknown as Coupon);
}

/** Re-run at order-creation time too (never trust a client-sent discount amount) — same code
 * path as the cart's "Apply Coupon" call, just with the server's own freshly-resolved subtotal. */
export async function resolveCoupon(code: string, brandId: string, subtotal: number): Promise<{ code: string; discountAmount: number }> {
  const coupon = await CouponModel.findOne({ code: code.trim().toUpperCase() });
  if (!coupon || !coupon.isActive) {
    throw new CouponValidationError("Invalid coupon code");
  }
  if (coupon.expiresAt && coupon.expiresAt < new Date()) {
    throw new CouponValidationError("This coupon has expired");
  }
  if (coupon.brandId && coupon.brandId !== brandId) {
    throw new CouponValidationError("This coupon isn't valid for this brand");
  }
  if (subtotal < coupon.minOrderAmount) {
    throw new CouponValidationError(`Add ₹${round(coupon.minOrderAmount - subtotal)} more to use this coupon`);
  }

  const rawDiscount = coupon.type === "percent" ? subtotal * (coupon.value / 100) : coupon.value;
  const cappedDiscount =
    coupon.type === "percent" && coupon.maxDiscountAmount != null ? Math.min(rawDiscount, coupon.maxDiscountAmount) : rawDiscount;
  const discountAmount = Math.min(round(cappedDiscount), subtotal);

  return { code: coupon.code, discountAmount };
}

// --- Admin ---

export async function listAllCoupons() {
  return CouponModel.find().sort({ createdAt: -1 });
}

export async function createCoupon(data: CreateCouponRequest) {
  const code = data.code.trim().toUpperCase();
  const existing = await CouponModel.findOne({ code });
  if (existing) {
    throw new CouponValidationError(`A coupon with code "${code}" already exists`);
  }
  return CouponModel.create({ ...data, code });
}

export async function updateCoupon(id: string, data: UpdateCouponRequest) {
  const update = { ...data, ...(data.code ? { code: data.code.trim().toUpperCase() } : {}) };
  const coupon = await CouponModel.findByIdAndUpdate(id, update, { new: true, runValidators: true });
  if (!coupon) {
    throw new CouponValidationError("Coupon not found");
  }
  return coupon;
}

export async function deleteCoupon(id: string) {
  await CouponModel.findByIdAndDelete(id);
}
