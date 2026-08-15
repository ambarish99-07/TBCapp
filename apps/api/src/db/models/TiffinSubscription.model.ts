import { Schema, model, type InferSchemaType } from "mongoose";

const DeliveryDetailsSchema = new Schema(
  {
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String, required: true },
    houseNumber: { type: String },
    area: { type: String },
    landmark: { type: String },
    city: { type: String, required: true },
    pincode: { type: String, required: true },
    mapsLink: { type: String },
    specialInstructions: { type: String },
    distanceFromShopKm: { type: Number, min: 0 },
  },
  { _id: false }
);

const PaymentInfoSchema = new Schema(
  {
    method: { type: String, enum: ["cod", "razorpay"], required: true },
    status: { type: String, enum: ["pending", "paid", "failed", "refunded"], required: true, default: "pending" },
    razorpayOrderId: { type: String },
    razorpayPaymentId: { type: String },
    refundAmount: { type: Number, min: 0 },
  },
  { _id: false }
);

/** A customer's paid-upfront tiffin plan subscription — entirely separate from `Order`, never
 * mixed into TBC/TAT order history. `TiffinScheduledMeal` docs (one per day) are generated
 * eagerly, all at once, at subscribe time (see tiffinSchedule.ts) — there's no scheduler
 * process to generate them day-by-day later. */
const TiffinSubscriptionSchema = new Schema(
  {
    subscriptionNumber: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    planId: { type: Schema.Types.ObjectId, ref: "TiffinPlan", required: true },
    // Snapshotted at subscribe time — a later plan-name/price edit shouldn't retroactively
    // rewrite what a past subscriber actually signed up for and paid.
    planName: { type: String, required: true },
    dietType: { type: String, enum: ["veg", "non-veg"], required: true },
    style: { type: String, enum: ["single", "twice-daily", "thrice-daily"], required: true },
    // What was actually subscribed — one element for "single", all three for "thrice-daily".
    mealTypes: { type: [String], enum: ["breakfast", "lunch", "dinner"], required: true },
    status: { type: String, enum: ["active", "paused", "completed", "cancelled"], required: true, default: "active" },
    // Snapshotted at subscribe time — used to tell a weekly plan (never cancellable) from a
    // monthly one, independent of any later pause-driven extension to endDate.
    durationDays: { type: Number, required: true },
    // ISO calendar dates (yyyy-mm-dd), not timestamps.
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    pausedFrom: { type: String },
    pausedUntil: { type: String },
    cancelledAt: { type: Date },
    delivery: { type: DeliveryDetailsSchema, required: true },
    price: { type: Number, required: true, min: 0 },
    payment: { type: PaymentInfoSchema, required: true },
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

TiffinSubscriptionSchema.index({ userId: 1, createdAt: -1 });

export type TiffinSubscriptionDocument = InferSchemaType<typeof TiffinSubscriptionSchema>;
export const TiffinSubscriptionModel = model("TiffinSubscription", TiffinSubscriptionSchema);
