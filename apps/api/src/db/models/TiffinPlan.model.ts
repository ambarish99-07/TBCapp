import { Schema, model, type InferSchemaType } from "mongoose";

/** Admin-managed catalog of GG Tiffin subscription plans — price/duration/active are never
 * hardcoded in application code, only here. */
const TiffinPlanSchema = new Schema(
  {
    name: { type: String, required: true },
    dietType: { type: String, enum: ["veg", "non-veg"], required: true },
    style: { type: String, enum: ["single", "twice-daily", "thrice-daily"], required: true },
    durationDays: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 },
    active: { type: Boolean, required: true, default: true },
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

export type TiffinPlanDocument = InferSchemaType<typeof TiffinPlanSchema>;
export const TiffinPlanModel = model("TiffinPlan", TiffinPlanSchema);
