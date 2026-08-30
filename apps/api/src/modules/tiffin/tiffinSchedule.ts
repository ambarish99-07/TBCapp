import type { DayOfWeek, TiffinDietType, TiffinMealType } from "@tbc/shared-types";
import { TiffinDishModel } from "../../db/models/TiffinDish.model.js";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export interface ScheduledMealDraft {
  date: string;
  mealType: TiffinMealType;
  dishName: string;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Keyed by `${dietType}|${dayOfWeek}|${mealType}` — subscriptions are always Regular tier, so
 * this only ever needs that one tier's rows out of the full `TiffinDish` collection. */
export type RegularDishLookup = Map<string, string>;

export async function buildRegularDishLookup(): Promise<RegularDishLookup> {
  const dishes = await TiffinDishModel.find({ tier: "regular" }).select("dietType dayOfWeek mealType dishName").lean();
  return new Map(dishes.map((d) => [`${d.dietType}|${d.dayOfWeek}|${d.mealType}`, d.dishName]));
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
    const dayName = DAY_NAMES[date.getUTCDay()] as DayOfWeek;
    for (const mealType of mealTypes) {
      meals.push({ date: toIsoDate(date), mealType, dishName: dishForDay(lookup, dietType, dayName, mealType) });
    }
  }
  return meals;
}
