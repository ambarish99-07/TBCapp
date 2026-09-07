import type { UpsertTiffinAddOnPriceRequest, UpsertTiffinDishRequest, UpsertTiffinFestivalSpecialRequest } from "@tbc/shared-types";
import { TiffinAddOnPriceModel } from "../../db/models/TiffinAddOnPrice.model.js";
import { TiffinDishModel } from "../../db/models/TiffinDish.model.js";
import { TiffinFestivalSpecialModel } from "../../db/models/TiffinFestivalSpecial.model.js";

/** The full weekly rotation — ~110 rows, small enough to hand the admin panel (and the mobile
 * app's menu-browsing screens) the whole thing at once rather than paginating or filtering
 * server-side. */
export function listTiffinDishes() {
  return TiffinDishModel.find().sort({ tier: 1, dietType: 1, mealType: 1, dayOfWeek: 1 });
}

/** Most (tier, dietType, mealType, dayOfWeek) slots already exist from seeding, so this is
 * usually an update keyed on the compound unique index — but `upsert: true` also lets the admin
 * panel genuinely create a brand-new slot (e.g. Mini's first-ever breakfast dish) directly from
 * the Menu page, not just fix a slot missing after a bad migration. */
export function upsertTiffinDish(data: UpsertTiffinDishRequest) {
  const { tier, dietType, mealType, dayOfWeek, ...update } = data;
  return TiffinDishModel.findOneAndUpdate({ tier, dietType, mealType, dayOfWeek }, { tier, dietType, mealType, dayOfWeek, ...update }, { new: true, upsert: true, runValidators: true });
}

/** Removing a slot's dish entirely (not just changing what it serves) — the same "just isn't on
 * the menu" state Mini's breakfast slots have always been in, now reachable for any tier/meal/day
 * from the Menu page instead of being fixed at seed time. Subscription/single-meal resolution
 * already handles an absent slot gracefully (see singleMealMenu.ts#resolveDishSlot,
 * tiffin.service.ts#getAvailableMealTypesForTierDiet) — no special-casing needed here. */
export function deleteTiffinDish(id: string) {
  return TiffinDishModel.findByIdAndDelete(id);
}

/** Every festival special, past and future — small table, admin panel gets it all at once, same
 * as the weekly rotation above. */
export function listFestivalSpecials() {
  return TiffinFestivalSpecialModel.find().sort({ date: 1, tier: 1, dietType: 1, mealType: 1 });
}

/** Unlike a `TiffinDish` slot (always one of ~110 fixed existing rows), a festival special for a
 * new date genuinely doesn't exist yet — this still upserts (keyed on the same compound unique
 * index the schema enforces) so editing an already-created special and creating a brand-new one
 * go through the exact same call, matching every other admin upsert in this codebase. */
export function upsertFestivalSpecial(data: UpsertTiffinFestivalSpecialRequest) {
  const { date, tier, dietType, mealType, ...update } = data;
  return TiffinFestivalSpecialModel.findOneAndUpdate(
    { date, tier, dietType, mealType },
    { date, tier, dietType, mealType, ...update },
    { new: true, upsert: true, runValidators: true }
  );
}

export function deleteFestivalSpecial(id: string) {
  return TiffinFestivalSpecialModel.findByIdAndDelete(id);
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
