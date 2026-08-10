import { BrandModel } from "../../db/models/Brand.model.js";

export function listLiveBrands() {
  return BrandModel.find({ status: "live" }).lean();
}
