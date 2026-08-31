import { z } from "zod";

/**
 * Every coupon "mechanic" the admin can create from the panel — adding a new kind of offer (e.g.
 * "cheapest of 3 free", a category-specific flat discount) means adding one option here, one
 * branch to @tbc/pricing's computeCouponDiscount, and one bit of admin-form UI; nothing else in
 * the order/cart-preview flow needs to change, since both already just call resolveCoupon.
 * "percent"/"flat" are plain discounts off the subtotal; "bogo" (Buy One Get One Free) makes the
 * cheapest eligible unit in the cart free — see computeCouponDiscount for the exact math.
 */
export const CouponTypeSchema = z.enum(["percent", "flat", "bogo"]);
export type CouponType = z.infer<typeof CouponTypeSchema>;

/** Admin-managed promo code — validated server-side at both "Apply Coupon" time (cart preview)
 * and again at order creation (never trust the discount amount a client sends back). */
export const CouponSchema = z.object({
  id: z.string(),
  code: z.string(),
  type: CouponTypeSchema,
  /** Percent (0-100) for `type: "percent"`, a flat rupee amount for `type: "flat"`. Unused
   * (always 0) for `type: "bogo"` — that mechanic's discount comes from the cart's own prices. */
  value: z.number().nonnegative(),
  /** Cart must reach at least this non-combo subtotal for the coupon to apply. */
  minOrderAmount: z.number().nonnegative(),
  /** Caps the discount for a `percent` coupon — ignored for `flat` and `bogo`. */
  maxDiscountAmount: z.number().positive().optional(),
  /** Restricts the coupon to one brand — absent means it's valid across every brand. */
  brandId: z.string().optional(),
  expiresAt: z.string().optional(),
  isActive: z.boolean(),
  /** Welcome-offer-style coupon — each customer account can redeem it once, ever, not just once
   * overall. Enforced server-side (coupons.service.ts); this flag is informational for the UI. */
  oncePerCustomer: z.boolean().optional(),
  /** How many accounts have already redeemed it — a count, never the raw list of who. */
  usedCount: z.number().nonnegative().optional(),
});
export type Coupon = z.infer<typeof CouponSchema>;

/** Admin create/update payload. `expiresAt`, when set, is an ISO date string ("YYYY-MM-DD" or a
 * full timestamp) — parsed to a real expiry moment server-side. Defined as a plain shape first
 * (not the refined schema below) so `.partial()` stays available for the update variant. */
const couponFieldsShape = z.object({
  code: z.string().min(1),
  type: CouponTypeSchema,
  value: z.number().nonnegative(),
  minOrderAmount: z.number().nonnegative().default(0),
  maxDiscountAmount: z.number().positive().optional(),
  brandId: z.string().optional(),
  expiresAt: z.string().optional(),
  isActive: z.boolean().default(true),
  oncePerCustomer: z.boolean().default(false),
});

export const CreateCouponRequestSchema = couponFieldsShape.refine((data) => data.type === "bogo" || data.value > 0, {
  message: "Value must be greater than 0 for a percent or flat coupon",
  path: ["value"],
});
export type CreateCouponRequest = z.infer<typeof CreateCouponRequestSchema>;

export const UpdateCouponRequestSchema = couponFieldsShape.partial();
export type UpdateCouponRequest = z.infer<typeof UpdateCouponRequestSchema>;

/** A cart line, priced exactly the way @tbc/pricing's CartLineInput is — just enough for
 * computeCouponDiscount to work out a "bogo" discount (needs each unit's own price, not just a
 * total), while percent/flat coupons only ever look at the subtotal these sum to. The Cart
 * screen's "Apply Coupon" preview sends its own already-priced lines; order creation instead
 * passes the server's own freshly-resolved lines directly, never this wire shape. */
export const CouponPricingLineSchema = z.object({
  unitPrice: z.number().nonnegative(),
  addOnPrices: z.array(z.number().nonnegative()).default([]),
  quantity: z.number().int().positive(),
  isCombo: z.boolean(),
});
export type CouponPricingLine = z.infer<typeof CouponPricingLineSchema>;

export const ValidateCouponRequestSchema = z.object({
  code: z.string().min(1),
  brandId: z.string().min(1),
  /** The cart's current lines — drives `minOrderAmount`/the subtotal-based discount types, and
   * (for a "bogo" coupon) which unit is the free one. */
  lines: z.array(CouponPricingLineSchema).min(1),
});
export type ValidateCouponRequest = z.infer<typeof ValidateCouponRequestSchema>;

export const ValidateCouponResponseSchema = z.object({
  code: z.string(),
  discountAmount: z.number().nonnegative(),
});
export type ValidateCouponResponse = z.infer<typeof ValidateCouponResponseSchema>;
