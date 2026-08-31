import { round } from "./rounding.js";
import type { CartLineInput } from "./types.js";

/**
 * Every coupon "mechanic" the admin can create lives here as one more case — adding a new kind
 * of offer (e.g. "cheapest of 3 free", "flat off a specific category") means adding one branch
 * to `computeCouponDiscount` and one option to `CouponTypeSchema`/the admin form, not touching
 * order creation, the cart preview, or anything else that calls resolveCoupon.
 */
export type CouponType = "percent" | "flat" | "bogo";

export interface CouponConfig {
  type: CouponType;
  /** Percent (0-100) for "percent", a flat rupee amount for "flat". Ignored for "bogo" — that
   * mechanic's discount is derived entirely from the cart's own prices, never an admin-set number. */
  value: number;
  /** Caps the discount for a "percent" coupon — ignored for "flat" and "bogo". */
  maxDiscountAmount?: number;
}

/** Buy-one-get-one-free's "free one" — the cheapest single *unit* across every non-combo line,
 * counting each unit of a multi-quantity line separately (2x the same ₹220 shake still only
 * needs one of those two units to be the free one). Combo lines never qualify — they already
 * carry their own bundle discount, same reasoning milestoneReward's rewards use. Needs at least
 * 2 eligible units in the cart, or there's nothing to "get free" against. */
function cheapestEligibleUnitPrice(lines: CartLineInput[]): number | null {
  const eligibleUnits: number[] = [];
  for (const line of lines) {
    if (line.isCombo) continue;
    for (let i = 0; i < line.quantity; i++) eligibleUnits.push(line.unitPrice);
  }
  if (eligibleUnits.length < 2) return null;
  return Math.min(...eligibleUnits);
}

/**
 * Pure — given a coupon's config and the cart's own pricing lines/subtotal, returns the rupee
 * discount it's worth. Never touches minOrderAmount/expiry/oncePerCustomer/brand checks or the
 * DB lookup itself — those stay in coupons.service.ts, which owns the round-trip; this is just
 * the arithmetic, kept alongside computePricing/computeComboPrice/computeMilestoneReward so
 * every discount mechanic in the app is computed in exactly one place.
 */
export function computeCouponDiscount(lines: CartLineInput[], subtotal: number, coupon: CouponConfig): number {
  if (coupon.type === "bogo") {
    const freeUnitPrice = cheapestEligibleUnitPrice(lines);
    return freeUnitPrice != null ? Math.min(round(freeUnitPrice), subtotal) : 0;
  }

  const rawDiscount = coupon.type === "percent" ? subtotal * (coupon.value / 100) : coupon.value;
  const cappedDiscount =
    coupon.type === "percent" && coupon.maxDiscountAmount != null ? Math.min(rawDiscount, coupon.maxDiscountAmount) : rawDiscount;
  return Math.min(round(cappedDiscount), subtotal);
}
