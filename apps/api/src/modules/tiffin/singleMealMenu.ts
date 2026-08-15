import {
  TIFFIN_MINI_NONVEG_DINNER_OVERRIDES,
  TIFFIN_NONVEG_BREAKFAST_OVERRIDES,
  TIFFIN_PREMIUM_NONVEG_LUNCH_OVERRIDES,
  TIFFIN_PREMIUM_VEG_MENU,
  TIFFIN_REGULAR_NONVEG_DINNER_OVERRIDES,
  TIFFIN_REGULAR_VEG_MENU,
  type SingleMealType,
  type TiffinDietType,
  type TiffinMealTier,
} from "@tbc/shared-types";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function dayNameForDate(date: string): string {
  return DAY_NAMES[new Date(`${date}T00:00:00Z`).getUTCDay()];
}

/**
 * Resolves the single-meal dish for a given tier/dietType/mealType/date.
 * - Breakfast is shared between diets except Wednesday, where non-veg keeps the old Bread
 *   Omelette instead of veg's Upma (`TIFFIN_NONVEG_BREAKFAST_OVERRIDES`) — and Mini doesn't offer
 *   breakfast at all.
 * - Veg: Regular and Premium each have their own curated weekly menu; Mini reuses Regular's
 *   lunch/dinner dish for that day (same sabzi, just one carb).
 * - Non-veg: each tier swaps in a meat curry on its own specific days (see the
 *   `TIFFIN_*_NONVEG_*_OVERRIDES` tables — Mini has fewer non-veg days than Regular/Premium, and
 *   Premium's only non-veg upgrade beyond Regular's is Sunday lunch); every other day/meal falls
 *   back to that tier's veg dish.
 */
export function getSingleMealDish(tier: TiffinMealTier, dietType: TiffinDietType, mealType: SingleMealType, date: string): string | null {
  const dayName = dayNameForDate(date);

  if (mealType === "breakfast") {
    if (tier === "mini") return null;
    if (dietType === "non-veg" && TIFFIN_NONVEG_BREAKFAST_OVERRIDES[dayName]) {
      return TIFFIN_NONVEG_BREAKFAST_OVERRIDES[dayName];
    }
    const menu = tier === "premium" ? TIFFIN_PREMIUM_VEG_MENU : TIFFIN_REGULAR_VEG_MENU;
    return menu[dayName].breakfast;
  }

  if (tier === "mini") {
    if (dietType === "non-veg" && mealType === "dinner" && TIFFIN_MINI_NONVEG_DINNER_OVERRIDES[dayName]) {
      return TIFFIN_MINI_NONVEG_DINNER_OVERRIDES[dayName];
    }
    return TIFFIN_REGULAR_VEG_MENU[dayName][mealType];
  }

  if (dietType === "non-veg") {
    if (tier === "premium" && mealType === "lunch" && TIFFIN_PREMIUM_NONVEG_LUNCH_OVERRIDES[dayName]) {
      return TIFFIN_PREMIUM_NONVEG_LUNCH_OVERRIDES[dayName];
    }
    if (mealType === "dinner" && TIFFIN_REGULAR_NONVEG_DINNER_OVERRIDES[dayName]) {
      return TIFFIN_REGULAR_NONVEG_DINNER_OVERRIDES[dayName];
    }
  }

  const menu = tier === "premium" ? TIFFIN_PREMIUM_VEG_MENU : TIFFIN_REGULAR_VEG_MENU;
  return menu[dayName][mealType];
}
