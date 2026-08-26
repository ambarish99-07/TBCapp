/** Thrown for any coupon code that's well-formed but not applicable (not found, expired,
 * inactive, wrong brand, or the cart doesn't meet minOrderAmount). Caught in
 * coupons.controller.ts and returned as 400. */
export class CouponValidationError extends Error {}
