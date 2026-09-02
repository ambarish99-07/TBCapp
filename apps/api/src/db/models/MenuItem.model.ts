import { Schema, model, type InferSchemaType } from "mongoose";

const MenuItemSizeVariantSchema = new Schema(
  {
    label: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    // Out-of-stock toggle for just this one size — see @tbc/shared-types' doc-comment.
    isAvailable: { type: Boolean, required: true, default: true },
  },
  { _id: false }
);

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
    // Free text, not a fixed enum — see @tbc/shared-types' MenuCategorySchema doc-comment for why.
    category: { type: String, required: true },
    image: { type: String, required: true },
    flavorBadges: { type: [String], default: [] },
    isPopular: { type: Boolean, default: false },
    isNew: { type: Boolean, default: false },
    isStaffPick: { type: Boolean, default: false },
    // Out-of-stock toggle for the whole item — see @tbc/shared-types' MenuItemSchema doc-comment.
    isAvailable: { type: Boolean, required: true, default: true },
    pairsWith: { type: [String], default: [] },
    /** When set, the charged price is price * (1 - salePercent/100); `price` stays the shown strikethrough value. Only a few items should carry this. */
    salePercent: { type: Number, min: 1, max: 99 },
    // Display label for `price`'s own portion (e.g. "300 ml", "500 gm") — see
    // @tbc/shared-types' MenuItemSchema doc-comment. Purely informational.
    portionSize: { type: String },
    // Extra sizes beyond the default, each priced directly by the admin — see
    // @tbc/shared-types' MenuItemSizeVariantSchema doc-comment.
    sizeVariants: { type: [MenuItemSizeVariantSchema], default: [] },
    // False for an item with no sugar/ice concept at all (a biryani, a momo plate, ...) — see
    // @tbc/shared-types' MenuItemSchema doc-comment.
    hasSugarIceCustomization: { type: Boolean, required: true, default: true },
    // Which named add-ons (from MenuAddOnPriceModel) this item offers — resolved into `addOns`
    // (name + current price) at read time, never stored pre-priced.
    addOnNames: { type: [String], default: [] },
  },
  // `isNew` is a name Mongoose documents also use internally (tracks whether a
  // doc has been saved yet) — harmless to shadow here since we only ever read it
  // via .lean(), but suppress the warning rather than deviate from the spec's field name.
  { timestamps: true, _id: false, suppressReservedKeysWarning: true }
);

MenuItemSchema.index({ brandId: 1 });

export type MenuItemDocument = InferSchemaType<typeof MenuItemSchema>;
export const MenuItemModel = model("MenuItem", MenuItemSchema);
