import { Schema, model, type InferSchemaType } from "mongoose";

/**
 * A customer's saved delivery contact (e.g. "Home", "Mom") — reused at
 * checkout instead of retyping the same recipient's details every time.
 * Purely a convenience list; deleting or editing one never touches past
 * orders, since each order snapshots its own `delivery` details at creation.
 */
const SavedRecipientSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    label: { type: String, required: true },
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
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        ret.id = String(ret._id);
        delete ret._id;
        delete ret.__v;
        delete ret.userId;
        return ret;
      },
    },
  }
);

SavedRecipientSchema.index({ userId: 1, createdAt: -1 });

export type SavedRecipientDocument = InferSchemaType<typeof SavedRecipientSchema>;
export const SavedRecipientModel = model("SavedRecipient", SavedRecipientSchema);
