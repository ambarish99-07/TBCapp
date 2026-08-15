import {
  TIFFIN_NONVEG_BREAKFAST_OVERRIDES,
  TIFFIN_REGULAR_NONVEG_DINNER_OVERRIDES,
  TIFFIN_REGULAR_VEG_MENU,
  type TiffinDietType,
  type TiffinMealType,
} from "@tbc/shared-types";

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
 * What GG Tiffin serves on a given day/meal, per the real curated Regular Tiffin menu
 * (subscriptions are always Regular tier — see `TIFFIN_REGULAR_VEG_MENU`). Matches
 * singleMealMenu.ts#getSingleMealDish's Regular-tier behavior exactly, so a subscription and a
 * one-off single-meal order for the same day/diet/meal never disagree:
 * - Breakfast is shared between diets except Wednesday, where non-veg keeps the old Bread
 *   Omelette instead of veg's Upma (`TIFFIN_NONVEG_BREAKFAST_OVERRIDES`).
 * - Veg lunch/dinner follows the curated menu directly, every day including Sunday (fixed, no
 *   customer choice).
 * - Non-veg swaps in a meat curry at DINNER only, on Mon/Wed/Fri
 *   (`TIFFIN_REGULAR_NONVEG_DINNER_OVERRIDES` — the same table singleMealMenu.ts uses for
 *   Regular's dinner, so the two never drift apart) — the real menu only ever has one non-veg
 *   item a day, never both lunch and dinner. Regular tier has no special Sunday non-veg dish
 *   (Mutton is a Premium-only, single-meal-only upgrade) — every other day/meal falls back to the
 *   same curated veg dish.
 */
export function dishForDay(dietType: TiffinDietType, dayName: string, mealType: TiffinMealType): string {
  if (mealType === "breakfast") {
    if (dietType === "non-veg" && TIFFIN_NONVEG_BREAKFAST_OVERRIDES[dayName]) {
      return TIFFIN_NONVEG_BREAKFAST_OVERRIDES[dayName];
    }
    return TIFFIN_REGULAR_VEG_MENU[dayName].breakfast;
  }
  if (dietType === "non-veg" && mealType === "dinner" && TIFFIN_REGULAR_NONVEG_DINNER_OVERRIDES[dayName]) {
    return TIFFIN_REGULAR_NONVEG_DINNER_OVERRIDES[dayName];
  }
  return TIFFIN_REGULAR_VEG_MENU[dayName][mealType];
}

/**
 * Generates every scheduled meal for `durationDays` calendar days starting from `startDate`
 * (inclusive) — one row per (day, mealType) pair, each with its own dish (a "twice-daily" or
 * "thrice-daily" plan's meals genuinely differ by mealType now, matching the real menu). Called
 * once, eagerly, at subscribe time (and again when extending a subscription after a pause) —
 * there's no scheduler process to generate these day-by-day, so the full set has to exist up front.
 */
export function computeMealsForRange(
  dietType: TiffinDietType,
  mealTypes: TiffinMealType[],
  startDate: Date,
  durationDays: number
): ScheduledMealDraft[] {
  const meals: ScheduledMealDraft[] = [];
  for (let i = 0; i < durationDays; i++) {
    const date = new Date(startDate);
    date.setUTCDate(date.getUTCDate() + i);
    const dayName = DAY_NAMES[date.getUTCDay()];
    for (const mealType of mealTypes) {
      meals.push({ date: toIsoDate(date), mealType, dishName: dishForDay(dietType, dayName, mealType) });
    }
  }
  return meals;
}
