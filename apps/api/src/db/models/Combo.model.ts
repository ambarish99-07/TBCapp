import { Schema, model, type InferSchemaType } from "mongoose";

/**
 * Curated combos (e.g. "Chocolate Duo") are for menu-display/grouping only — the
 * order flow never references them directly, since ordering a curated combo just
 * means adding each constituent item individually at full price (per spec).
 *
 * "Choose N" combos (e.g. "pick any 2 for ₹379") DO participate directly in the
 * order flow via a synthetic `combo:<comboId>:<discriminator>` line id — see
 * apps/api/src/modules/pricing/priceResolver.ts.
 */
const ComboSchema = new Schema(
  {
    _id: { type: String },
    type: { type: String, enum: ["curated", "choose-n"], required: true },
    name: { type: String, required: true },
    description: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    image: { type: String },
    // curated only
    itemIds: { type: [String], default: undefined },
    // choose-n only
    chooseCount: { type: Number },
    eligibleItemIds: { type: [String], default: undefined },
  },
  { timestamps: true, _id: false }
);

export type ComboDocument = InferSchemaType<typeof ComboSchema>;
export const ComboModel = model("Combo", ComboSchema);
