import { z } from "zod";

export const CouponTypeSchema = z.enum(["percent", "flat"]);
export type CouponType = z.infer<typeof CouponTypeSchema>;

/** Admin-managed promo code — validated server-side at both "Apply Coupon" time (cart preview)
 * and again at order creation (never trust the discount amount a client sends back). */
export const CouponSchema = z.object({
  id: z.string(),
  code: z.string(),
  type: CouponTypeSchema,
  /** Percent (0-100) for `type: "percent"`, a flat rupee amount for `type: "flat"`. */
  value: z.number().positive(),
  /** Cart must reach at least this non-combo subtotal for the coupon to apply. */
  minOrderAmount: z.number().nonnegative(),
  /** Caps the discount for a `percent` coupon — ignored for `flat`. */
  maxDiscountAmount: z.number().positive().optional(),
  /** Restricts the coupon to one brand — absent means it's valid across every brand. */
  brandId: z.string().optional(),
  expiresAt: z.string().optional(),
  isActive: z.boolean(),
});
export type Coupon = z.infer<typeof CouponSchema>;

export const ValidateCouponRequestSchema = z.object({
  code: z.string().min(1),
  brandId: z.string().min(1),
  /** The cart's current non-combo subtotal — drives `minOrderAmount` and the discount math. */
  subtotal: z.number().nonnegative(),
});
export type ValidateCouponRequest = z.infer<typeof ValidateCouponRequestSchema>;

export const ValidateCouponResponseSchema = z.object({
  code: z.string(),
  discountAmount: z.number().nonnegative(),
});
export type ValidateCouponResponse = z.infer<typeof ValidateCouponResponseSchema>;
