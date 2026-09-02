import { Schema, model, type InferSchemaType } from "mongoose";

/** A named menu add-on's shared flat price (Whipped Cream, Extra Choc Syrup, Extra Raita,
 * Papad, ...) — the same named add-on costs the same wherever any brand's item offers it. See
 * the shared `MenuAddOnPrice` type. Deliberately its own collection, separate from GG Tiffin's
 * TiffinAddOnPrice — the two menus have entirely independent lifecycles and vocabularies. */
const MenuAddOnPriceSchema = new Schema(
  {
    name: { type: String, required: true, unique: true },
    price: { type: Number, required: true, min: 0 },
    // Out-of-stock toggle, shared across every brand/item that offers this add-on — see
    // @tbc/shared-types' MenuAddOnPriceSchema doc-comment.
    isAvailable: { type: Boolean, required: true, default: true },
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

export type MenuAddOnPriceDocument = InferSchemaType<typeof MenuAddOnPriceSchema>;
export const MenuAddOnPriceModel = model("MenuAddOnPrice", MenuAddOnPriceSchema);
