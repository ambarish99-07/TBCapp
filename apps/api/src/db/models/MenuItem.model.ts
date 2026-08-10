import { Schema, model, type InferSchemaType } from "mongoose";

const MenuItemSchema = new Schema(
  {
    // Human-readable slug ids (e.g. "choco-crush") are used directly as _id so
    // menuItemId references elsewhere in the app don't need a lookup indirection.
    _id: { type: String },
    brandId: { type: String, required: true },
    signatureName: { type: String, required: true },
    commonName: { type: String, required: true },
    description: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    category: { type: String, enum: ["signature-shakes", "cold-coffee"], required: true },
    image: { type: String, required: true },
    flavorBadges: { type: [String], default: [] },
    isPopular: { type: Boolean, default: false },
    isNew: { type: Boolean, default: false },
    isStaffPick: { type: Boolean, default: false },
    pairsWith: { type: [String], default: [] },
    /** When set, the charged price is price * (1 - salePercent/100); `price` stays the shown strikethrough value. Only a few items should carry this. */
    salePercent: { type: Number, min: 1, max: 99 },
  },
  // `isNew` is a name Mongoose documents also use internally (tracks whether a
  // doc has been saved yet) — harmless to shadow here since we only ever read it
  // via .lean(), but suppress the warning rather than deviate from the spec's field name.
  { timestamps: true, _id: false, suppressReservedKeysWarning: true }
);

MenuItemSchema.index({ brandId: 1 });

export type MenuItemDocument = InferSchemaType<typeof MenuItemSchema>;
export const MenuItemModel = model("MenuItem", MenuItemSchema);
