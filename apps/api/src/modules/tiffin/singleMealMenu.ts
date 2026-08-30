import type { DayOfWeek, SingleMealAddOn, SingleMealType, TiffinDietType, TiffinMealTier } from "@tbc/shared-types";
import { TiffinAddOnPriceModel } from "../../db/models/TiffinAddOnPrice.model.js";
import { TiffinDishModel } from "../../db/models/TiffinDish.model.js";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function dayNameForDate(date: string): DayOfWeek {
  return DAY_NAMES[new Date(`${date}T00:00:00Z`).getUTCDay()] as DayOfWeek;
}

/** Everything `resolveAddOns` needs about one resolved dish, straight off its `TiffinDish` row —
 * see that schema for what each field means. */
export interface DishSlot {
  dishName: string;
  image?: string;
  hasAddOns: boolean;
  riceSubstitute: "rice" | "pulao";
  extraAddOnName?: string;
}

/** Keyed by `${tier}|${dietType}|${mealType}|${dayOfWeek}` — one lookup covers every combination
 * the single-meal menu needs, fetched once per request rather than once per (tier, mealType, diet)
 * triple. */
export type SingleMealDishLookup = Map<string, DishSlot>;

function dishSlotKey(tier: TiffinMealTier, dietType: TiffinDietType, mealType: SingleMealType, dayOfWeek: DayOfWeek): string {
  return `${tier}|${dietType}|${mealType}|${dayOfWeek}`;
}

export async function buildSingleMealDishLookup(): Promise<SingleMealDishLookup> {
  const dishes = await TiffinDishModel.find().lean();
  const lookup: SingleMealDishLookup = new Map();
  for (const dish of dishes) {
    lookup.set(dishSlotKey(dish.tier as TiffinMealTier, dish.dietType as TiffinDietType, dish.mealType as SingleMealType, dish.dayOfWeek as DayOfWeek), {
      dishName: dish.dishName,
      image: dish.image ?? undefined,
      hasAddOns: dish.hasAddOns,
      riceSubstitute: dish.riceSubstitute as "rice" | "pulao",
      extraAddOnName: dish.extraAddOnName ?? undefined,
    });
  }
  return lookup;
}

/** Pure lookup against an already-fetched map — `null` only for Mini + breakfast, which Mini
 * doesn't offer at all (no row exists for that combination). */
export function resolveDishSlot(
  lookup: SingleMealDishLookup,
  tier: TiffinMealTier,
  dietType: TiffinDietType,
  mealType: SingleMealType,
  date: string
): DishSlot | null {
  return lookup.get(dishSlotKey(tier, dietType, mealType, dayNameForDate(date))) ?? null;
}

/** Keyed by add-on name (e.g. "Rice", "Chicken piece", "Extra Portion") — fetched once per
 * request, same pattern as the dish lookup above. */
export type AddOnPriceLookup = Map<string, number>;

export async function buildAddOnPriceLookup(): Promise<AddOnPriceLookup> {
  const prices = await TiffinAddOnPriceModel.find().lean();
  return new Map(prices.map((p) => [p.name, p.price]));
}

/**
 * The real, individually-priced extras a customer can choose to add to this meal in the
 * customize pop-up — never included automatically. Regular and Mini both offer rice/roti/daal
 * plus an extra portion of the day's dish — Mini's base meal is just roti + sabzi, but the
 * customer can still choose to add rice and/or daal on top for extra cost; Premium swaps roti
 * for paratha (and rice for pulao on dishes flagged `riceSubstitute: "pulao"`). Breakfast and any
 * dish flagged `hasAddOns: false` (e.g. Premium's already-complete Sunday dinner) return no
 * add-ons at all.
 */
export function resolveAddOns(addOnPrices: AddOnPriceLookup, tier: TiffinMealTier, mealType: SingleMealType, dish: DishSlot): SingleMealAddOn[] {
  if (mealType === "breakfast" || !dish.hasAddOns) return [];

  const priceOf = (name: string) => addOnPrices.get(name) ?? 0;
  const lastAddOn: SingleMealAddOn = dish.extraAddOnName
    ? { name: dish.extraAddOnName, price: priceOf(dish.extraAddOnName) }
    : { name: `Extra ${dish.dishName}`, price: priceOf("Extra Portion") };

  const stapleNames =
    tier === "mini"
      ? ["Rice", "Roti", "Daal"]
      : tier === "premium"
        ? [dish.riceSubstitute === "pulao" ? "Pulao" : "Rice", "Paratha", "Daal"]
        : ["Rice", "Roti", "Daal"];

  return [...stapleNames.map((name) => ({ name, price: priceOf(name) })), lastAddOn];
}
