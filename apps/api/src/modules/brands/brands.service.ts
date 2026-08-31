import { BrandModel } from "../../db/models/Brand.model.js";

export function listLiveBrands() {
  return BrandModel.find({ status: "live" }).lean();
}

/** A brand the admin has created but hasn't opened for ordering yet — shown on the mobile Home
 * screen as a "Coming Soon" teaser (logo + tagline, non-clickable), separate from the live-brand
 * carousel/menu everywhere else. */
export function listComingSoonBrands() {
  return BrandModel.find({ status: "coming-soon" }).lean();
}
