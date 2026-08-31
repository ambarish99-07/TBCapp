import { Schema, model, type InferSchemaType } from "mongoose";

/**
 * A one-off override for a single calendar date — see @tbc/shared-types' TiffinFestivalSpecial
 * for the full picture. Resolved with priority over the regular `TiffinDish` weekly rotation for
 * that exact date only (singleMealMenu.ts#resolveDishSlot checks this table first), so a slot
 * with no matching row here just falls back to its normal day-of-week dish, unchanged.
 */
const TiffinFestivalSpecialSchema = new Schema(
  {
    // ISO calendar date (yyyy-mm-dd), not a timestamp — same convention as TiffinScheduledMeal/date.
    date: { type: String, required: true },
    label: { type: String, required: true },
    tier: { type: String, enum: ["regular", "mini", "premium"], required: true },
    dietType: { type: String, enum: ["veg", "non-veg"], required: true },
    mealType: { type: String, enum: ["breakfast", "lunch", "dinner"], required: true },
    dishName: { type: String, required: true },
    image: { type: String },
    hasAddOns: { type: Boolean, required: true, default: true },
    riceSubstitute: { type: String, enum: ["rice", "pulao"], required: true, default: "rice" },
    extraAddOnName: { type: String },
    active: { type: Boolean, required: true, default: true },
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

// One special per (date, tier, dietType, mealType) slot — matches the same upsert-on-compound-key
// pattern TiffinDish uses for its own (tier, dietType, mealType, dayOfWeek) slots.
TiffinFestivalSpecialSchema.index({ date: 1, tier: 1, dietType: 1, mealType: 1 }, { unique: true });

export type TiffinFestivalSpecialDocument = InferSchemaType<typeof TiffinFestivalSpecialSchema>;
export const TiffinFestivalSpecialModel = model("TiffinFestivalSpecial", TiffinFestivalSpecialSchema);
