import { Schema, model, type InferSchemaType } from "mongoose";

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

/** A ₹39/30-day Premium Membership purchase — no delivery lifecycle (nothing is delivered),
 * just a payment record backing `User.premiumMembershipExpiresAt`. */
const PremiumMembershipPurchaseSchema = new Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    price: { type: Number, required: true, min: 0 },
    // ISO calendar dates (yyyy-mm-dd), not timestamps.
    startDate: { type: String, required: true },
    expiresAt: { type: String, required: true },
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

PremiumMembershipPurchaseSchema.index({ userId: 1, createdAt: -1 });

export type PremiumMembershipPurchaseDocument = InferSchemaType<typeof PremiumMembershipPurchaseSchema>;
export const PremiumMembershipPurchaseModel = model("PremiumMembershipPurchase", PremiumMembershipPurchaseSchema);
