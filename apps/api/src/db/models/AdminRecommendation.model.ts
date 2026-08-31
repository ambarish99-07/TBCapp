import { Schema, model, type InferSchemaType } from "mongoose";

/**
 * An admin-curated "Recommended For You" pick for one customer + brand — set from the Customer
 * Detail page after the admin reviews that customer's real order history (see
 * @tbc/shared-types' AdminRecommendationSchema). Surfaced ahead of the customer's own reorder
 * history and the brand's isPopular fill-ins on their Home screen. Capped at 2 items server-side
 * (see admin.controller.ts#upsertCustomerRecommendationAdmin) — this is a deliberate one-or-two
 * hand-picked nudge, not a general-purpose list. One row per (userId, brandId); clearing it back
 * to no picks deletes the row entirely rather than leaving an empty itemIds array around.
 */
const AdminRecommendationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    brandId: { type: String, required: true },
    itemIds: { type: [String], required: true, default: [] },
  },
  { timestamps: true }
);

AdminRecommendationSchema.index({ userId: 1, brandId: 1 }, { unique: true });

export type AdminRecommendationDocument = InferSchemaType<typeof AdminRecommendationSchema>;
export const AdminRecommendationModel = model("AdminRecommendation", AdminRecommendationSchema);
