import { Schema, model, type InferSchemaType } from "mongoose";

/** A named single-meal add-on's shared flat price (Rice, Roti, Daal, Paratha, Pulao, a protein's
 * "extra piece", or the generic "Extra Portion" veg top-up) — see the shared `TiffinAddOnPrice`
 * type. The same named add-on costs the same wherever a dish offers it. */
const TiffinAddOnPriceSchema = new Schema(
  {
    name: { type: String, required: true, unique: true },
    price: { type: Number, required: true, min: 0 },
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

export type TiffinAddOnPriceDocument = InferSchemaType<typeof TiffinAddOnPriceSchema>;
export const TiffinAddOnPriceModel = model("TiffinAddOnPrice", TiffinAddOnPriceSchema);
