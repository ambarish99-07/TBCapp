import { cartSubtotal, computeCouponDiscount, round, type CartLineInput } from "@tbc/pricing";
import type { Coupon, CreateCouponRequest, UpdateCouponRequest } from "@tbc/shared-types";
import { CouponModel } from "../../db/models/Coupon.model.js";
import { CouponValidationError } from "./coupons.errors.js";

/** Powers the Cart screen's "Apply Coupon" browse page — every currently-usable coupon for this
 * brand, so a customer can see what's on offer before typing (or revealing) a code. Expired ones
 * are excluded outright rather than shown greyed out, since there's nothing actionable about them.
 * `userId` (when logged in) additionally drops any oncePerCustomer coupon this account has already
 * redeemed — a welcome offer they've used has nothing left to show them. */
export async function listActiveCoupons(brandId: string, userId?: string | null): Promise<Coupon[]> {
  const coupons = await CouponModel.find({
    isActive: true,
    $or: [{ brandId: { $exists: false } }, { brandId }],
    $and: [{ $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: new Date() } }] }],
  }).sort({ createdAt: -1 });
  return coupons
    .filter((coupon) => !(coupon.oncePerCustomer && userId && coupon.usedByUserIds.includes(userId)))
    .map((coupon) => coupon.toJSON() as unknown as Coupon);
}

/**
 * Re-run at order-creation time too (never trust a client-sent discount amount) — same code path
 * as the cart's "Apply Coupon" call, just with the server's own freshly-resolved lines. Takes the
 * cart's actual pricing lines rather than a bare subtotal number — some coupon mechanics (e.g.
 * "bogo") need each unit's own price, not just the total, to work out the discount; see
 * @tbc/pricing's computeCouponDiscount for the actual math, kept in one place for every mechanic.
 * `userId` is required to apply a oncePerCustomer coupon at all — there's no way to enforce
 * "once" for a guest checkout with no account to key the redemption on.
 */
export async function resolveCoupon(
  code: string,
  brandId: string,
  lines: CartLineInput[],
  userId?: string | null
): Promise<{ code: string; discountAmount: number }> {
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
  if (coupon.oncePerCustomer) {
    if (!userId) {
      throw new CouponValidationError("Log in to use this welcome offer");
    }
    if (coupon.usedByUserIds.includes(userId)) {
      throw new CouponValidationError("You've already used this welcome offer — it's good for one order only");
    }
  }

  const subtotal = cartSubtotal(lines);
  if (subtotal < coupon.minOrderAmount) {
    throw new CouponValidationError(`Add ₹${round(coupon.minOrderAmount - subtotal)} more to use this coupon`);
  }
  const eligibleUnitCount = lines.filter((line) => !line.isCombo).reduce((sum, line) => sum + line.quantity, 0);
  if (coupon.type === "bogo" && eligibleUnitCount < 2) {
    throw new CouponValidationError("Add one more eligible item to use this Buy One Get One Free offer");
  }

  const discountAmount = computeCouponDiscount(lines, subtotal, {
    type: coupon.type as "percent" | "flat" | "bogo",
    value: coupon.value,
    maxDiscountAmount: coupon.maxDiscountAmount ?? undefined,
  });

  return { code: coupon.code, discountAmount };
}

/**
 * Marks a oncePerCustomer coupon as spent by this account — called only once an order is
 * GENUINELY confirmed (COD: immediately at creation; Razorpay: only after signature
 * verification), mirroring exactly when advanceLoyaltyOrderCount fires. The `oncePerCustomer:
 * true` filter makes this a safe no-op for every ordinary multi-use coupon, so callers can fire
 * it unconditionally whenever an order carried a coupon code, without checking the flag first.
 */
export async function markCouponUsed(code: string, userId: string): Promise<void> {
  await CouponModel.updateOne(
    { code: code.trim().toUpperCase(), oncePerCustomer: true },
    { $addToSet: { usedByUserIds: userId } }
  );
}

// --- Admin ---

export async function listAllCoupons() {
  return CouponModel.find().sort({ createdAt: -1 });
}

export async function createCoupon(data: CreateCouponRequest) {
  if (data.brandId === "gg-tiffin") {
    throw new CouponValidationError("Coupons aren't available for GG Tiffin — see Festival Specials instead");
  }
  const code = data.code.trim().toUpperCase();
  const existing = await CouponModel.findOne({ code });
  if (existing) {
    throw new CouponValidationError(`A coupon with code "${code}" already exists`);
  }
  return CouponModel.create({ ...data, code });
}

export async function updateCoupon(id: string, data: UpdateCouponRequest) {
  if (data.brandId === "gg-tiffin") {
    throw new CouponValidationError("Coupons aren't available for GG Tiffin — see Festival Specials instead");
  }
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
