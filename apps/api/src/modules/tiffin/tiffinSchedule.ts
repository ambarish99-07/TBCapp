import type { DayOfWeek, TiffinDietType, TiffinMealTier, TiffinMealType } from "@tbc/shared-types";
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
 * Keyed by `${dietType}|${dayOfWeek-or-isoDate}|${mealType}` — a subscription is always pinned to
 * one fixed tier for its whole lifetime (snapshotted from its plan at subscribe time), so this
 * only ever needs that one tier's rows at a time; build a fresh lookup per tier rather than one
 * shared map for all three. Regular weekly rows key off a day name ("Monday"); active
 * festival-special rows for the same tier are layered in keyed off their exact ISO date instead —
 * same "two key shapes, one map, no collisions" trick singleMealMenu.ts#SingleMealDishLookup uses,
 * so `computeMealsForRange` picks up a festival dish automatically for any meal it generates on
 * that date, no separate lookup needed.
 */
export type TierDishLookup = Map<string, string>;

export async function buildDishLookupForTier(tier: TiffinMealTier): Promise<TierDishLookup> {
  const [dishes, specials] = await Promise.all([
    TiffinDishModel.find({ tier }).select("dietType dayOfWeek mealType dishName").lean(),
    TiffinFestivalSpecialModel.find({ tier, active: true }).select("dietType date mealType dishName").lean(),
  ]);
  const lookup: TierDishLookup = new Map(dishes.map((d) => [`${d.dietType}|${d.dayOfWeek}|${d.mealType}`, d.dishName]));
  for (const special of specials) {
    lookup.set(`${special.dietType}|${special.date}|${special.mealType}`, special.dishName);
  }
  return lookup;
}

/**
 * Which meal types a (tier, dietType) can actually sustain a *recurring* subscription for —
 * derived live from the `TiffinDish` rows the admin's Menu page manages, not a hardcoded table.
 * A meal type only counts as available once all 7 days of the week have a dish configured for
 * it; a single missing day would otherwise leave a subscriber with nothing delivered that day.
 * This is what makes admin-side dish edits (adding a whole new meal type, or removing one down to
 * an incomplete week) automatically flow through to what plans/subscriptions can offer — no
 * separate tier/meal-type table to keep in sync by hand. Single-meal ordering has its own,
 * looser rule (singleMealMenu.ts#resolveDishSlot) since it only ever needs *one* specific date at
 * a time, not a full week up front.
 */
export async function getAvailableMealTypesForTierDiet(tier: TiffinMealTier, dietType: TiffinDietType): Promise<Set<TiffinMealType>> {
  const rows = await TiffinDishModel.find({ tier, dietType }).select("mealType dayOfWeek").lean();
  const daysByMealType = new Map<TiffinMealType, Set<string>>();
  for (const row of rows) {
    const mealType = row.mealType as TiffinMealType;
    const days = daysByMealType.get(mealType) ?? new Set<string>();
    days.add(row.dayOfWeek);
    daysByMealType.set(mealType, days);
  }
  const available = new Set<TiffinMealType>();
  for (const [mealType, days] of daysByMealType) {
    if (days.size === DAY_NAMES.length) available.add(mealType);
  }
  return available;
}

/**
 * What GG Tiffin serves on a given day/meal, per the real curated menu for whichever tier
 * `lookup` was built for. Matches singleMealMenu.ts#resolveDishSlot's behavior for that same tier
 * exactly, since both now read from the same `TiffinDish` collection — a subscription and a
 * one-off single-meal order for the same tier/day/diet/meal never disagree. Throws only for a
 * combination that structurally doesn't exist (e.g. Mini + breakfast) — callers that accept a
 * plan's tier from the catalog validate that up front (see tiffin.service.ts) so this should never
 * actually be reached with an invalid combination in practice.
 */
export function dishForDay(lookup: TierDishLookup, tier: TiffinMealTier, dietType: TiffinDietType, dayName: string, mealType: TiffinMealType): string {
  const dish = lookup.get(`${dietType}|${dayName}|${mealType}`);
  if (!dish) throw new Error(`No ${tier}-tier dish configured for ${dietType}/${dayName}/${mealType}`);
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
  lookup: TierDishLookup,
  tier: TiffinMealTier,
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
      const dishName = lookup.get(`${dietType}|${isoDate}|${mealType}`) ?? dishForDay(lookup, tier, dietType, dayName, mealType);
      meals.push({ date: isoDate, mealType, dishName });
    }
  }
  return meals;
}

/**
 * Same as `computeMealsForRange`, but any calendar date in `closedDates` (an admin-declared
 * emergency closure — see tiffinClosure.service.ts) is skipped entirely and pushed to the end,
 * so the subscriber still gets exactly `durationDays` worth of actual delivery days. Used only at
 * subscribe time, so a brand-new subscription that happens to start during (or run into) an
 * already-declared closure is correct from day one — it never needs the separate retroactive
 * skip-and-extend that declareClosure applies to subscriptions that existed before the closure.
 */
export function computeMealsForRangeSkippingClosedDates(
  lookup: TierDishLookup,
  tier: TiffinMealTier,
  dietType: TiffinDietType,
  mealTypes: TiffinMealType[],
  startDate: Date,
  durationDays: number,
  closedDates: ReadonlySet<string>
): ScheduledMealDraft[] {
  if (closedDates.size === 0) return computeMealsForRange(lookup, tier, dietType, mealTypes, startDate, durationDays);

  const meals: ScheduledMealDraft[] = [];
  let deliverableDaysGenerated = 0;
  let dayOffset = 0;
  // Bounded so a pathological (e.g. permanently open-ended) closure record can't spin forever —
  // real closures are a handful of days, so this ceiling is never remotely approached in practice.
  const MAX_DAY_OFFSET = 3650;
  while (deliverableDaysGenerated < durationDays && dayOffset < MAX_DAY_OFFSET) {
    const date = new Date(startDate);
    date.setUTCDate(date.getUTCDate() + dayOffset);
    dayOffset += 1;
    const isoDate = toIsoDate(date);
    if (closedDates.has(isoDate)) continue;

    const dayName = DAY_NAMES[date.getUTCDay()] as DayOfWeek;
    for (const mealType of mealTypes) {
      const dishName = lookup.get(`${dietType}|${isoDate}|${mealType}`) ?? dishForDay(lookup, tier, dietType, dayName, mealType);
      meals.push({ date: isoDate, mealType, dishName });
    }
    deliverableDaysGenerated += 1;
  }
  return meals;
}
