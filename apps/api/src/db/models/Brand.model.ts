import { Schema, model, type InferSchemaType } from "mongoose";

/** A storefront under the Lickyeat umbrella — human-readable slug used directly as _id, same pattern as MenuItem/Combo. */
const BrandSchema = new Schema(
  {
    _id: { type: String },
    name: { type: String, required: true },
    tagline: { type: String },
    logoUrl: { type: String },
    heroImageUrl: { type: String },
    heroImageUrlDark: { type: String },
    primaryColor: { type: String },
    accentColor: { type: String },
    status: { type: String, enum: ["live", "coming-soon"], required: true, default: "live" },
    displayOrder: { type: Number },
  },
  { timestamps: true, _id: false }
);

BrandSchema.index({ status: 1 });
BrandSchema.index({ displayOrder: 1 });

export type BrandDocument = InferSchemaType<typeof BrandSchema>;
export const BrandModel = model("Brand", BrandSchema);
