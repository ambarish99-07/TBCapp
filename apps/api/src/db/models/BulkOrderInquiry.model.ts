import { Schema, model, type InferSchemaType } from "mongoose";

/** A customer's request to be contacted about a large/event order — public submissions, admin-managed follow-up. */
const BulkOrderInquirySchema = new Schema(
  {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String },
    occasion: { type: String },
    estimatedQuantity: { type: String },
    preferredDate: { type: String },
    message: { type: String },
    status: { type: String, enum: ["new", "contacted", "closed"], required: true, default: "new" },
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

BulkOrderInquirySchema.index({ createdAt: -1 });

export type BulkOrderInquiryDocument = InferSchemaType<typeof BulkOrderInquirySchema>;
export const BulkOrderInquiryModel = model("BulkOrderInquiry", BulkOrderInquirySchema);
