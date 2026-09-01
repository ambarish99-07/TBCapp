import { Schema, model, type InferSchemaType } from "mongoose";

/** An admin-declared "catalog brands closed on these dates" window — see the shared
 * `StoreClosure` type for the full semantics. Entirely separate from TiffinClosure (GG Tiffin's
 * own emergency-closure system), since the two ordering models and their side effects differ. */
const StoreClosureSchema = new Schema(
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

StoreClosureSchema.index({ startDate: 1, endDate: 1 });

export type StoreClosureDocument = InferSchemaType<typeof StoreClosureSchema>;
export const StoreClosureModel = model("StoreClosure", StoreClosureSchema);
