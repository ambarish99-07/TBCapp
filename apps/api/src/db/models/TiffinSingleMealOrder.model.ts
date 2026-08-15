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

/** A one-off tiffin purchase — no subscription lifecycle (no pause/resume/skip), delivered once
 * the next day, entirely separate from `TiffinSubscription`. */
const TiffinSingleMealOrderSchema = new Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    tier: { type: String, enum: ["regular", "mini", "premium"], required: true },
    mealType: { type: String, enum: ["breakfast", "lunch", "dinner"], required: true },
    dietType: { type: String, enum: ["veg", "non-veg"], required: true },
    carbChoice: { type: String, enum: ["rice", "roti"] },
    // ISO calendar date (yyyy-mm-dd), not a timestamp.
    date: { type: String, required: true },
    // Snapshotted at order time — a later menu/price edit shouldn't retroactively rewrite what was ordered.
    dishName: { type: String, required: true },
    status: { type: String, enum: ["placed", "preparing", "out-for-delivery", "delivered", "cancelled"], required: true, default: "placed" },
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

TiffinSingleMealOrderSchema.index({ userId: 1, createdAt: -1 });

export type TiffinSingleMealOrderDocument = InferSchemaType<typeof TiffinSingleMealOrderSchema>;
export const TiffinSingleMealOrderModel = model("TiffinSingleMealOrder", TiffinSingleMealOrderSchema);
