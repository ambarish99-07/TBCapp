import {
  TIFFIN_NONVEG_CURRY_DAYS,
  TIFFIN_NONVEG_SUNDAY_DISH,
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
 * (subscriptions are always Regular tier — see `TIFFIN_REGULAR_VEG_MENU`):
 * - Breakfast is the same dish regardless of diet type — no non-veg breakfast items exist.
 * - Veg lunch/dinner follows the curated menu directly, every day including Sunday (fixed, no
 *   customer choice).
 * - Non-veg Mon/Wed/Fri swap in a meat curry (`TIFFIN_NONVEG_CURRY_DAYS`) for the whole day,
 *   regardless of lunch or dinner; Sunday is always Mutton, also regardless of meal; every other
 *   day/meal falls back to the same curated veg dish.
 */
export function dishForDay(dietType: TiffinDietType, dayName: string, mealType: TiffinMealType): string {
  if (mealType === "breakfast") {
    return TIFFIN_REGULAR_VEG_MENU[dayName].breakfast;
  }
  if (dietType === "non-veg") {
    if (dayName === "Sunday") return TIFFIN_NONVEG_SUNDAY_DISH;
    if (TIFFIN_NONVEG_CURRY_DAYS[dayName]) return TIFFIN_NONVEG_CURRY_DAYS[dayName];
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
