import { Schema, model, type InferSchemaType } from "mongoose";

/** Admin-managed price per (tier, mealType) combo for the single-meal purchase — never
 * hardcoded in application code, same convention as `TiffinPlan.price`. Not every combo needs
 * a row (e.g. Mini has no breakfast row, so it's simply not offered). */
const TiffinMealPriceSchema = new Schema(
  {
    tier: { type: String, enum: ["regular", "mini", "premium"], required: true },
    mealType: { type: String, enum: ["breakfast", "lunch", "dinner"], required: true },
    price: { type: Number, required: true, min: 0 },
    active: { type: Boolean, required: true, default: true },
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

TiffinMealPriceSchema.index({ tier: 1, mealType: 1 }, { unique: true });

export type TiffinMealPriceDocument = InferSchemaType<typeof TiffinMealPriceSchema>;
export const TiffinMealPriceModel = model("TiffinMealPrice", TiffinMealPriceSchema);
