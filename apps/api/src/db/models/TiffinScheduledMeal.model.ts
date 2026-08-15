import { Schema, model, type InferSchemaType } from "mongoose";

/** One row per day of a subscription's active duration — the unit both the customer's
 * "upcoming meals" view and the admin's daily-operations view are built from. */
const TiffinScheduledMealSchema = new Schema(
  {
    subscriptionId: { type: Schema.Types.ObjectId, ref: "TiffinSubscription", required: true },
    // ISO calendar date (yyyy-mm-dd) — a specific day's meal, not a timestamp.
    date: { type: String, required: true },
    mealType: { type: String, enum: ["breakfast", "lunch", "dinner"], required: true },
    dishName: { type: String, required: true },
    status: {
      type: String,
      enum: ["scheduled", "skipped", "preparing", "out-for-delivery", "delivered", "cancelled"],
      required: true,
      default: "scheduled",
    },
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

TiffinScheduledMealSchema.index({ subscriptionId: 1, date: 1 });
TiffinScheduledMealSchema.index({ date: 1, status: 1 });

export type TiffinScheduledMealDocument = InferSchemaType<typeof TiffinScheduledMealSchema>;
export const TiffinScheduledMealModel = model("TiffinScheduledMeal", TiffinScheduledMealSchema);
