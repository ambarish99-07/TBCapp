import { Schema, model, type InferSchemaType } from "mongoose";

/** One customer submission per order (enforced via the unique index below) — a combined review
 * (rating) or complaint (category), never both forms for the same order. See feedback.service.ts
 * for the eligibility rules (must be the order's own registered customer, order must be delivered). */
const FeedbackSchema = new Schema(
  {
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true, unique: true },
    // Denormalized off the order at submission time — lets the admin list/filter without a join.
    orderNumber: { type: String, required: true },
    brandId: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    customerName: { type: String, required: true },
    type: { type: String, enum: ["review", "complaint"], required: true },
    rating: { type: Number, min: 1, max: 5 },
    category: { type: String, enum: ["wrong-item", "missing-item", "late-delivery", "quality-issue", "other"] },
    message: { type: String, maxlength: 1000 },
    status: { type: String, enum: ["open", "in-progress", "resolved"], required: true, default: "open" },
    adminResponse: { type: String, maxlength: 1000 },
    respondedAt: { type: Date },
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

FeedbackSchema.index({ status: 1, createdAt: -1 });
FeedbackSchema.index({ type: 1, createdAt: -1 });
FeedbackSchema.index({ brandId: 1 });

export type FeedbackDocument = InferSchemaType<typeof FeedbackSchema>;
export const FeedbackModel = model("Feedback", FeedbackSchema);
