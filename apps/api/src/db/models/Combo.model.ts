import { Schema, model, type InferSchemaType } from "mongoose";

/**
 * Both combo types are ordered the same way — via a synthetic
 * `combo:<comboId>:<payload>` line id (see priceResolver.ts). Curated combos
 * (e.g. "Chocolate Duo") have fixed constituent items (`itemIds`, always
 * exactly two shakes); "choose N" combos (e.g. "pick any 2 shakes") let the
 * customer pick which items from `eligibleItemIds` fill the `chooseCount`
 * slots — encoded in the line id's payload as `itemId1+itemId2`.
 *
 * No stored price on either type — every combo is priced live as 15% off the
 * sum of its constituent items' current base prices (@tbc/pricing's
 * computeComboPrice), so it can never drift out of sync with menu prices.
 */
const ComboSchema = new Schema(
  {
    _id: { type: String },
    type: { type: String, enum: ["curated", "choose-n"], required: true },
    name: { type: String, required: true },
    description: { type: String, required: true },
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
