import { Schema, model, type InferSchemaType } from "mongoose";

const LoyaltyStateSchema = new Schema(
  {
    // Drives quantity-tier/premium/milestone-reward logic in @tbc/pricing — see resolveIsPremiumMember.
    completedOrderCount: { type: Number, required: true, default: 0 },
    // Admin-settable override to manually grant premium regardless of completedOrderCount.
    isPremiumMemberOverride: { type: Boolean, required: true, default: false },
  },
  { _id: false }
);

const UserSchema = new Schema(
  {
    // Both optional — a customer can sign up with just one — but `sparse: true`
    // means the unique index only applies to documents where the field is
    // actually set, so any number of users can share "no email" or "no phone".
    email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    phone: { type: String, unique: true, sparse: true, trim: true },
    passwordHash: { type: String, required: true },
    fullName: { type: String, required: true },
    role: { type: String, enum: ["customer", "admin"], required: true, default: "customer" },
    loyalty: { type: LoyaltyStateSchema, required: true, default: () => ({}) },
    // The account's own address — separate from the multi-address "saved recipients" system
    // (SavedRecipient) used at checkout; this is the one place a customer's own locality lives.
    houseNumber: { type: String },
    area: { type: String },
    address: { type: String },
    landmark: { type: String },
    city: { type: String },
    pincode: { type: String },
  },
  { timestamps: true }
);

// `unique: true` on email/phone above are real DB-level unique indexes — not just
// app-level pre-insert checks — so two concurrent signups with the same email or
// phone can't both race past a check-then-insert.

export type UserDocument = InferSchemaType<typeof UserSchema>;
export const UserModel = model("User", UserSchema);
