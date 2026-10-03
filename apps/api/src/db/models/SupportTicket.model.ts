import { Schema, model, type InferSchemaType } from "mongoose";

/** A help request raised from the app's support assistant — see @tbc/shared-types' support.ts. */
const SupportTicketSchema = new Schema(
  {
    ticketNumber: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    // Snapshotted at creation — the admin inbox needs who to call back without a join.
    customerName: { type: String, required: true },
    customerPhone: { type: String },
    orderId: { type: Schema.Types.ObjectId, ref: "Order" },
    orderNumber: { type: String },
    topic: {
      type: String,
      enum: ["payment-not-confirmed", "missing-item", "wrong-item", "spilled-or-damaged", "quality-issue", "late-delivery", "other"],
      required: true,
    },
    message: { type: String, required: true, maxlength: 1000 },
    photoUrl: { type: String },
    status: { type: String, enum: ["open", "in-progress", "resolved"], required: true, default: "open" },
    adminReply: { type: String, maxlength: 1000 },
    repliedAt: { type: Date },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        ret.id = String(ret._id);
        ret.userId = String(ret.userId);
        if (ret.orderId) ret.orderId = String(ret.orderId);
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

SupportTicketSchema.index({ status: 1, createdAt: -1 });
SupportTicketSchema.index({ userId: 1, createdAt: -1 });

export type SupportTicketDocument = InferSchemaType<typeof SupportTicketSchema>;
export const SupportTicketModel = model("SupportTicket", SupportTicketSchema);
