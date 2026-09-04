import { BrandModel } from "../../db/models/Brand.model.js";

// createdAt as the tiebreaker/fallback keeps ordering stable for any brand created before
// displayOrder existed, or in the unexpected case one is ever left unset.
const DISPLAY_ORDER_SORT = { displayOrder: 1, createdAt: 1 } as const;

export function listLiveBrands() {
  return BrandModel.find({ status: "live" }).sort(DISPLAY_ORDER_SORT).lean();
}

/** A brand the admin has created but hasn't opened for ordering yet — shown on the mobile Home
 * screen as a "Coming Soon" teaser (logo + tagline, non-clickable), separate from the live-brand
 * carousel/menu everywhere else. */
export function listComingSoonBrands() {
  return BrandModel.find({ status: "coming-soon" }).sort(DISPLAY_ORDER_SORT).lean();
}

/** One past the highest displayOrder currently in use (0 if no brand has one yet) — so a newly
 * created brand always appends to the end of every list instead of landing wherever MongoDB's
 * "missing field sorts first" rule would put it. */
export async function nextDisplayOrder(): Promise<number> {
  const highest = await BrandModel.find({ displayOrder: { $ne: null } })
    .sort({ displayOrder: -1 })
    .limit(1)
    .select("displayOrder")
    .lean();
  return (highest[0]?.displayOrder ?? -1) + 1;
}
