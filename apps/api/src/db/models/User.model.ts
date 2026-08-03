import { Schema, model, type InferSchemaType } from "mongoose";

const LoyaltyStateSchema = new Schema(
  {
    completedOrderCount: { type: Number, required: true, default: 0 },
    isGoldMember: { type: Boolean, required: true, default: false },
  },
  { _id: false }
);

const PunchCardStateSchema = new Schema(
  {
    ordersSinceReward: { type: Number, required: true, default: 0 },
  },
  { _id: false }
);

const UserSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    role: { type: String, enum: ["customer", "admin"], required: true, default: "customer" },
    loyalty: { type: LoyaltyStateSchema, required: true, default: () => ({}) },
    punchCard: { type: PunchCardStateSchema, required: true, default: () => ({}) },
  },
  { timestamps: true }
);

// `unique: true` on the email field above is a DB-level unique index — not just an
// app-level pre-insert check — so two concurrent signups with the same email can't
// both race past a check-then-insert.

export type UserDocument = InferSchemaType<typeof UserSchema>;
export const UserModel = model("User", UserSchema);
