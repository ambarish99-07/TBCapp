import { Schema, model, type InferSchemaType } from "mongoose";

/** Admin-managed promo codes — see @tbc/shared-types CouponSchema for the shape this maps to.
 * `code` is stored uppercase so lookups are case-insensitive without a collation. */
const CouponSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    // "bogo" (Buy One Get One Free) has no admin-set value of its own — its discount is derived
    // entirely from the cart's own item prices, see @tbc/pricing's computeCouponDiscount.
    type: { type: String, enum: ["percent", "flat", "bogo"], required: true },
    value: { type: Number, required: true, min: 0 },
    minOrderAmount: { type: Number, required: true, min: 0, default: 0 },
    maxDiscountAmount: { type: Number, min: 0 },
    brandId: { type: String },
    expiresAt: { type: Date },
    isActive: { type: Boolean, required: true, default: true },
    // Welcome-offer-style coupons: usable once per customer account, not just once overall.
    // usedByUserIds tracks who has already redeemed it (populated at genuine order-confirmation
    // time — COD immediately, Razorpay only after payment verification — never at checkout time).
    oncePerCustomer: { type: Boolean, default: false },
    usedByUserIds: { type: [String], default: [] },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        ret.id = String(ret._id);
        delete ret._id;
        delete ret.__v;
        delete ret.updatedAt;
        // Collapse to a count everywhere (admin's usage column included) — the raw list of
        // other customers' user ids has no legitimate use on the wire and shouldn't leak to
        // whichever customer happens to be browsing this same coupon on the Cart screen.
        ret.usedCount = Array.isArray(ret.usedByUserIds) ? ret.usedByUserIds.length : 0;
        delete ret.usedByUserIds;
        return ret;
      },
    },
  }
);

export type CouponDocument = InferSchemaType<typeof CouponSchema>;
export const CouponModel = model("Coupon", CouponSchema);
