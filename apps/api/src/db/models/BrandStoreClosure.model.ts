import { Schema, model, type InferSchemaType } from "mongoose";

/** Same shape as StoreClosure (the Lickyeat-wide planned-closure system), just scoped to one
 * brand via `brandId` — see the shared `BrandStoreClosure` type for the full semantics. */
const BrandStoreClosureSchema = new Schema(
  {
    brandId: { type: String, required: true },
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

BrandStoreClosureSchema.index({ brandId: 1, startDate: 1, endDate: 1 });

export type BrandStoreClosureDocument = InferSchemaType<typeof BrandStoreClosureSchema>;
export const BrandStoreClosureModel = model("BrandStoreClosure", BrandStoreClosureSchema);
