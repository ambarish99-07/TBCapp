import type { UpsertTiffinAddOnPriceRequest, UpsertTiffinDishRequest } from "@tbc/shared-types";
import { TiffinAddOnPriceModel } from "../../db/models/TiffinAddOnPrice.model.js";
import { TiffinDishModel } from "../../db/models/TiffinDish.model.js";

/** The full weekly rotation — ~110 rows, small enough to hand the admin panel (and the mobile
 * app's menu-browsing screens) the whole thing at once rather than paginating or filtering
 * server-side. */
export function listTiffinDishes() {
  return TiffinDishModel.find().sort({ tier: 1, dietType: 1, mealType: 1, dayOfWeek: 1 });
}

/** Every valid (tier, dietType, mealType, dayOfWeek) slot already exists from seeding — there's
 * no "add a new slot" concept, only "change what's assigned to this slot" — so this is always an
 * update keyed on the compound unique index, never a true insert in practice. Still `upsert: true`
 * so a slot missing after a bad migration doesn't hard-fail instead of just being created. */
export function upsertTiffinDish(data: UpsertTiffinDishRequest) {
  const { tier, dietType, mealType, dayOfWeek, ...update } = data;
  return TiffinDishModel.findOneAndUpdate({ tier, dietType, mealType, dayOfWeek }, { tier, dietType, mealType, dayOfWeek, ...update }, { new: true, upsert: true, runValidators: true });
}

export function listAddOnPrices() {
  return TiffinAddOnPriceModel.find().sort({ name: 1 });
}

/** Keyed on name (unique) — same "there's a small fixed vocabulary, editing just changes an
 * existing row" shape as dishes above, but exposed as its own upsert since an admin might
 * legitimately want to introduce one more named add-on later. */
export function upsertAddOnPrice(data: UpsertTiffinAddOnPriceRequest) {
  return TiffinAddOnPriceModel.findOneAndUpdate({ name: data.name }, data, { new: true, upsert: true, runValidators: true });
}
