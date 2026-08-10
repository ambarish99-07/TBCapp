import { Schema, model, type InferSchemaType } from "mongoose";

/** A storefront under the Devour umbrella — human-readable slug used directly as _id, same pattern as MenuItem/Combo. */
const BrandSchema = new Schema(
  {
    _id: { type: String },
    name: { type: String, required: true },
    tagline: { type: String },
    logoUrl: { type: String },
    primaryColor: { type: String },
    accentColor: { type: String },
    status: { type: String, enum: ["live", "coming-soon"], required: true, default: "live" },
  },
  { timestamps: true, _id: false }
);

BrandSchema.index({ status: 1 });

export type BrandDocument = InferSchemaType<typeof BrandSchema>;
export const BrandModel = model("Brand", BrandSchema);
