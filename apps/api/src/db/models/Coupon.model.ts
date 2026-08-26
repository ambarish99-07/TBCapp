import { Schema, model, type InferSchemaType } from "mongoose";

/** Admin-managed promo codes — see @tbc/shared-types CouponSchema for the shape this maps to.
 * `code` is stored uppercase so lookups are case-insensitive without a collation. */
const CouponSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    type: { type: String, enum: ["percent", "flat"], required: true },
    value: { type: Number, required: true, min: 0 },
    minOrderAmount: { type: Number, required: true, min: 0, default: 0 },
    maxDiscountAmount: { type: Number, min: 0 },
    brandId: { type: String },
    expiresAt: { type: Date },
    isActive: { type: Boolean, required: true, default: true },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        ret.id = String(ret._id);
        delete ret._id;
        delete ret.__v;
        delete ret.updatedAt;
        return ret;
      },
    },
  }
);

export type CouponDocument = InferSchemaType<typeof CouponSchema>;
export const CouponModel = model("Coupon", CouponSchema);
