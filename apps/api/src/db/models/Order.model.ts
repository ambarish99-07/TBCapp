import { Schema, model, type InferSchemaType } from "mongoose";

const CustomizationSchema = new Schema(
  {
    sugarLevel: { type: String, enum: ["less", "regular", "extra"], required: true },
    iceLevel: { type: String, enum: ["less", "regular", "extra"], required: true },
    addOnIds: { type: [String], default: [] },
  },
  { _id: false }
);

const OrderLineSchema = new Schema(
  {
    lineId: { type: String, required: true },
    menuItemId: { type: String, required: true },
    signatureName: { type: String, required: true },
    commonName: { type: String, required: true },
    image: { type: String, required: true },
    unitPrice: { type: Number, required: true, min: 0 },
    addOnPrices: { type: [Number], default: [] },
    quantity: { type: Number, required: true, min: 1, max: 20 },
    customization: { type: CustomizationSchema, required: true },
  },
  { _id: false }
);

const DeliveryDetailsSchema = new Schema(
  {
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String, required: true },
    city: { type: String, required: true },
    pincode: { type: String, required: true },
    mapsLink: { type: String },
    specialInstructions: { type: String },
  },
  { _id: false }
);

const OrderTotalsSchema = new Schema(
  {
    subtotal: { type: Number, required: true },
    punchCardDiscount: { type: Number, required: true },
    websiteDiscount: { type: Number, required: true },
    loyaltyDiscount: { type: Number, required: true },
    deliveryFee: { type: Number, required: true },
    tax: { type: Number, required: true },
    total: { type: Number, required: true },
  },
  { _id: false }
);

const StatusHistoryEntrySchema = new Schema(
  {
    status: {
      type: String,
      enum: ["received", "preparing", "out-for-delivery", "delivered", "cancelled"],
      required: true,
    },
    at: { type: Date, required: true, default: Date.now },
    note: { type: String },
  },
  { _id: false }
);

const PaymentInfoSchema = new Schema(
  {
    method: { type: String, enum: ["cod", "razorpay"], required: true },
    status: { type: String, enum: ["pending", "paid", "failed", "refunded"], required: true, default: "pending" },
    razorpayOrderId: { type: String },
    razorpayPaymentId: { type: String },
  },
  { _id: false }
);

const OrderSchema = new Schema(
  {
    // Separate, cryptographically random public identifier for guest order lookup —
    // deliberately NOT the Mongo _id, which is sequential/guessable enough to enumerate.
    accessToken: { type: String, required: true, unique: true },
    orderNumber: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    items: { type: [OrderLineSchema], required: true },
    delivery: { type: DeliveryDetailsSchema, required: true },
    totals: { type: OrderTotalsSchema, required: true },
    loyaltyTierAtOrder: { type: String, enum: ["first-order", "returning", "gold", null], default: null },
    estimatedMinutes: { type: Number, required: true, default: 35 },
    status: {
      type: String,
      enum: ["received", "preparing", "out-for-delivery", "delivered", "cancelled"],
      default: "received",
    },
    statusHistory: { type: [StatusHistoryEntrySchema], default: [] },
    payment: { type: PaymentInfoSchema, required: true },
  },
  { timestamps: true }
);

// accessToken and orderNumber already get unique indexes from `unique: true` above.
OrderSchema.index({ userId: 1, createdAt: -1 });

export type OrderDocument = InferSchemaType<typeof OrderSchema>;
export const OrderModel = model("Order", OrderSchema);
