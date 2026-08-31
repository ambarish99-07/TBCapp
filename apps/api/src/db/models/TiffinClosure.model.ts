import { Schema, model, type InferSchemaType } from "mongoose";

/** An admin-declared "GG Tiffin closed" window — see the shared `TiffinClosure` type for the full
 * semantics. Each declaration is processed once, immediately, at creation time; the record itself
 * then just persists so ongoing single-meal ordering keeps skipping those dates for as long as
 * they're still in the future. */
const TiffinClosureSchema = new Schema(
  {
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    reason: { type: String, maxlength: 300 },
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

TiffinClosureSchema.index({ startDate: 1, endDate: 1 });

export type TiffinClosureDocument = InferSchemaType<typeof TiffinClosureSchema>;
export const TiffinClosureModel = model("TiffinClosure", TiffinClosureSchema);
