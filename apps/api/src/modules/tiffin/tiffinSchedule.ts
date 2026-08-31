import type { DayOfWeek, TiffinDietType, TiffinMealType } from "@tbc/shared-types";
import { TiffinDishModel } from "../../db/models/TiffinDish.model.js";
import { TiffinFestivalSpecialModel } from "../../db/models/TiffinFestivalSpecial.model.js";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export interface ScheduledMealDraft {
  date: string;
  mealType: TiffinMealType;
  dishName: string;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Keyed by `${dietType}|${dayOfWeek-or-isoDate}|${mealType}` — subscriptions are always Regular
 * tier, so this only ever needs that one tier's rows. Regular weekly rows key off a day name
 * ("Monday"); active festival-special rows (also Regular-tier only) are layered in keyed off
 * their exact ISO date instead — same "two key shapes, one map, no collisions" trick
 * singleMealMenu.ts#SingleMealDishLookup uses, so `computeMealsForRange` picks up a festival
 * dish automatically for any meal it generates on that date, no separate lookup needed.
 */
export type RegularDishLookup = Map<string, string>;

export async function buildRegularDishLookup(): Promise<RegularDishLookup> {
  const [dishes, specials] = await Promise.all([
    TiffinDishModel.find({ tier: "regular" }).select("dietType dayOfWeek mealType dishName").lean(),
    TiffinFestivalSpecialModel.find({ tier: "regular", active: true }).select("dietType date mealType dishName").lean(),
  ]);
  const lookup: RegularDishLookup = new Map(dishes.map((d) => [`${d.dietType}|${d.dayOfWeek}|${d.mealType}`, d.dishName]));
  for (const special of specials) {
    lookup.set(`${special.dietType}|${special.date}|${special.mealType}`, special.dishName);
  }
  return lookup;
}

/**
 * What GG Tiffin serves on a given day/meal, per the real curated Regular Tiffin menu
 * (subscriptions are always Regular tier). Matches singleMealMenu.ts#resolveDishSlot's
 * Regular-tier behavior exactly, since both now read from the same `TiffinDish` collection — a
 * subscription and a one-off single-meal order for the same day/diet/meal never disagree.
 */
export function dishForDay(lookup: RegularDishLookup, dietType: TiffinDietType, dayName: string, mealType: TiffinMealType): string {
  const dish = lookup.get(`${dietType}|${dayName}|${mealType}`);
  if (!dish) throw new Error(`No Regular-tier dish configured for ${dietType}/${dayName}/${mealType}`);
  return dish;
}

/**
 * Generates every scheduled meal for `durationDays` calendar days starting from `startDate`
 * (inclusive) — one row per (day, mealType) pair, each with its own dish (a "twice-daily" or
 * "thrice-daily" plan's meals genuinely differ by mealType now, matching the real menu). Called
 * once, eagerly, at subscribe time (and again when extending a subscription after a pause) —
 * there's no scheduler process to generate these day-by-day, so the full set has to exist up front.
 * Checks the exact date for a festival special before falling back to the regular day-of-week
 * dish — but only for meals generated from here on: a subscriber whose schedule was already
 * generated before a special was added won't see it retroactively (there's no re-generation pass
 * over already-created ScheduledMeal rows), same limitation as any other menu edit landing after
 * a subscription's schedule was baked in.
 */
export function computeMealsForRange(
  lookup: RegularDishLookup,
  dietType: TiffinDietType,
  mealTypes: TiffinMealType[],
  startDate: Date,
  durationDays: number
): ScheduledMealDraft[] {
  const meals: ScheduledMealDraft[] = [];
  for (let i = 0; i < durationDays; i++) {
    const date = new Date(startDate);
    date.setUTCDate(date.getUTCDate() + i);
    const isoDate = toIsoDate(date);
    const dayName = DAY_NAMES[date.getUTCDay()] as DayOfWeek;
    for (const mealType of mealTypes) {
      const dishName = lookup.get(`${dietType}|${isoDate}|${mealType}`) ?? dishForDay(lookup, dietType, dayName, mealType);
      meals.push({ date: isoDate, mealType, dishName });
    }
  }
  return meals;
}
