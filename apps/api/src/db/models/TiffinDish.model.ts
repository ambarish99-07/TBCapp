import { Schema, model, type InferSchemaType } from "mongoose";

/** One admin-editable slot in GG Tiffin's single-meal weekly rotation — see the shared
 * `TiffinDish` type for the full picture. Replaces the old hardcoded weekly-menu tables. */
const TiffinDishSchema = new Schema(
  {
    tier: { type: String, enum: ["regular", "mini", "premium"], required: true },
    dietType: { type: String, enum: ["veg", "non-veg"], required: true },
    mealType: { type: String, enum: ["breakfast", "lunch", "dinner"], required: true },
    dayOfWeek: {
      type: String,
      enum: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
      required: true,
    },
    dishName: { type: String, required: true },
    image: { type: String },
    hasAddOns: { type: Boolean, required: true, default: true },
    riceSubstitute: { type: String, enum: ["rice", "pulao"], required: true, default: "rice" },
    extraAddOnName: { type: String },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        ret.id = String(ret._id);
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

TiffinDishSchema.index({ tier: 1, dietType: 1, mealType: 1, dayOfWeek: 1 }, { unique: true });

export type TiffinDishDocument = InferSchemaType<typeof TiffinDishSchema>;
export const TiffinDishModel = model("TiffinDish", TiffinDishSchema);
