import {
  TIFFIN_NONVEG_CURRY_DAYS,
  TIFFIN_NONVEG_SUNDAY_DISH,
  TIFFIN_WEEKLY_VEG_ROTATION,
  type SundayVegChoice,
  type TiffinDietType,
  type TiffinMealType,
} from "@tbc/shared-types";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export interface ScheduledMealDraft {
  date: string;
  mealType: TiffinMealType;
  dishName: string;
}

const SUNDAY_VEG_DISH_NAME: Record<SundayVegChoice, string> = {
  paneer: "Paneer Sabzi (Sunday Special)",
  chole: "Chole (Sunday Special)",
};

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * What GG Tiffin serves on a given day of the week, per the fixed weekly rotation. The only
 * customer choice anywhere in this schedule is a veg plan's Sunday paneer/chole pick — every
 * other day is determined purely by diet type + day name:
 * - Veg: Mon-Sat follow `TIFFIN_WEEKLY_VEG_ROTATION`; Sunday is the customer's paneer/chole choice.
 * - Non-veg: Mon/Wed/Fri get a meat curry (`TIFFIN_NONVEG_CURRY_DAYS`); Tue/Thu/Sat fall back to
 *   that day's veg sabzi (same as the veg plan); Sunday is always Mutton, no choice.
 */
export function dishForDay(dietType: TiffinDietType, dayName: string, sundayVegChoice?: SundayVegChoice): string {
  if (dayName === "Sunday") {
    return dietType === "non-veg" ? TIFFIN_NONVEG_SUNDAY_DISH : SUNDAY_VEG_DISH_NAME[sundayVegChoice ?? "paneer"];
  }
  if (dietType === "non-veg" && TIFFIN_NONVEG_CURRY_DAYS[dayName]) {
    return TIFFIN_NONVEG_CURRY_DAYS[dayName];
  }
  return TIFFIN_WEEKLY_VEG_ROTATION[dayName];
}

/**
 * Generates every scheduled meal for `durationDays` calendar days starting from `startDate`
 * (inclusive) — one row per (day, mealType) pair, so a "twice-daily" plan's two `mealTypes`
 * (`["lunch", "dinner"]`) produce two rows per day sharing that day's dish, while a "single"
 * plan's one-element array produces one. Called once, eagerly, at subscribe time (and again
 * when extending a subscription after a pause) — there's no scheduler process to generate
 * these day-by-day, so the full set has to exist up front.
 */
export function computeMealsForRange(
  dietType: TiffinDietType,
  mealTypes: TiffinMealType[],
  startDate: Date,
  durationDays: number,
  sundayVegChoice?: SundayVegChoice
): ScheduledMealDraft[] {
  const meals: ScheduledMealDraft[] = [];
  for (let i = 0; i < durationDays; i++) {
    const date = new Date(startDate);
    date.setUTCDate(date.getUTCDate() + i);
    const dayName = DAY_NAMES[date.getUTCDay()];
    const dishName = dishForDay(dietType, dayName, sundayVegChoice);
    for (const mealType of mealTypes) {
      meals.push({ date: toIsoDate(date), mealType, dishName });
    }
  }
  return meals;
}
