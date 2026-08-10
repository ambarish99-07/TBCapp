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
    // Not required — combos without a single representative photo (e.g. "choose your own") may omit it.
    image: { type: String },
    unitPrice: { type: Number, required: true, min: 0 },
    originalUnitPrice: { type: Number, required: true, min: 0 },
    addOnPrices: { type: [Number], default: [] },
    quantity: { type: Number, required: true, min: 1, max: 20 },
    customization: { type: CustomizationSchema, required: true },
    category: { type: String, enum: ["signature-shakes", "cold-coffee"] },
  },
  { _id: false }
);

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

// Snapshot of the account that placed the order — kept separate from
// `delivery`, which is always who receives it (self or someone else).
const OrderCustomerSchema = new Schema(
  {
    name: { type: String, required: true },
    phone: { type: String },
  },
  { _id: false }
);

const OrderTotalsSchema = new Schema(
  {
    subtotal: { type: Number, required: true },
    discountAmount: { type: Number, required: true },
    discountReason: { type: String, enum: ["none", "quantity-tier", "premium"], required: true },
    rewardAmount: { type: Number, required: true },
    rewardReason: {
      type: String,
      enum: ["none", "sixth-order-cold-coffee", "tenth-order-free-drink"],
      required: true,
    },
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
    brandId: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    customer: { type: OrderCustomerSchema },
    deliveryFor: { type: String, enum: ["self", "recipient"], required: true, default: "self" },
    items: { type: [OrderLineSchema], required: true },
    delivery: { type: DeliveryDetailsSchema, required: true },
    totals: { type: OrderTotalsSchema, required: true },
    // Snapshot at order time — a later premium-status change must never retroactively alter a past order's charge.
    isPremiumMemberAtOrder: { type: Boolean, required: true, default: false },
    estimatedMinutes: { type: Number, required: true, default: 35 },
    status: {
      type: String,
      enum: ["received", "preparing", "out-for-delivery", "delivered", "cancelled"],
      default: "received",
    },
    statusHistory: { type: [StatusHistoryEntrySchema], default: [] },
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

// accessToken and orderNumber already get unique indexes from `unique: true` above.
OrderSchema.index({ userId: 1, createdAt: -1 });
OrderSchema.index({ brandId: 1, createdAt: -1 });

export type OrderDocument = InferSchemaType<typeof OrderSchema>;
export const OrderModel = model("Order", OrderSchema);
