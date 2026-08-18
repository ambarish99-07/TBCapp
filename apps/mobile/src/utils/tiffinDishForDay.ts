import {
  TIFFIN_MINI_NONVEG_DINNER_OVERRIDES,
  TIFFIN_NONVEG_BREAKFAST_OVERRIDES,
  TIFFIN_PREMIUM_NONVEG_LUNCH_OVERRIDES,
  TIFFIN_PREMIUM_VEG_MENU,
  TIFFIN_REGULAR_NONVEG_DINNER_OVERRIDES,
  TIFFIN_REGULAR_VEG_MENU,
  type TiffinDietType,
  type TiffinMealTier,
  type TiffinMealType,
} from "@tbc/shared-types";

export const WEEK_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** Mirrors the backend's singleMealMenu.ts#getSingleMealDish exactly, but keyed by day name
 * instead of a calendar date — this is a menu reference/browser, not an order, so there's no
 * ordering-cutoff date resolution involved, just "what does tier X serve on day Y." Returns null
 * only for Mini + breakfast, which Mini doesn't offer at all. */
export function singleMealDishForDay(tier: TiffinMealTier, dietType: TiffinDietType, day: string, mealType: TiffinMealType): string | null {
  if (mealType === "breakfast") {
    if (tier === "mini") return null;
    if (dietType === "non-veg" && TIFFIN_NONVEG_BREAKFAST_OVERRIDES[day]) return TIFFIN_NONVEG_BREAKFAST_OVERRIDES[day];
    const menu = tier === "premium" ? TIFFIN_PREMIUM_VEG_MENU : TIFFIN_REGULAR_VEG_MENU;
    return menu[day].breakfast;
  }

  if (tier === "mini") {
    if (dietType === "non-veg" && mealType === "dinner" && TIFFIN_MINI_NONVEG_DINNER_OVERRIDES[day]) {
      return TIFFIN_MINI_NONVEG_DINNER_OVERRIDES[day];
    }
    return TIFFIN_REGULAR_VEG_MENU[day][mealType];
  }

  if (dietType === "non-veg") {
    if (tier === "premium" && mealType === "lunch" && TIFFIN_PREMIUM_NONVEG_LUNCH_OVERRIDES[day]) {
      return TIFFIN_PREMIUM_NONVEG_LUNCH_OVERRIDES[day];
    }
    if (mealType === "dinner" && TIFFIN_REGULAR_NONVEG_DINNER_OVERRIDES[day]) {
      return TIFFIN_REGULAR_NONVEG_DINNER_OVERRIDES[day];
    }
  }

  const menu = tier === "premium" ? TIFFIN_PREMIUM_VEG_MENU : TIFFIN_REGULAR_VEG_MENU;
  return menu[day][mealType];
}

/** Subscriptions are always Regular tier — a thin wrapper so the plan preview schedule doesn't
 * need to know tiers exist. Regular always resolves to a real dish (only Mini can be null, and
 * only for breakfast), so this is safe to type as non-nullable. */
export function dishForDay(dietType: TiffinDietType, day: string, mealType: TiffinMealType): string {
  const dish = singleMealDishForDay("regular", dietType, day, mealType);
  if (dish === null) throw new Error("unreachable: Regular tier always has a dish for every meal type");
  return dish;
}

/** Premium's Sunday dinner ("Puri with Chole") is already a complete two-part dish name, so it's
 * left unchanged rather than getting a staple prefix. */
const ALREADY_COMPOSED_DISPLAY_DISHES = new Set(["Puri with Chole"]);
/** Premium's two Sunday upgrades (Mutton Curry, Paneer Butter Masala) pair with Pulao instead of
 * plain Rice. */
const PULAO_STAPLE_DISPLAY_DISHES = new Set(["Mutton Curry", "Paneer Butter Masala"]);

/**
 * Spells out the tier's real staple components ahead of the bare sabzi/curry name, for display on
 * the menu-browsing screens (subscription plan preview, Weekly Menu, Order a Single Meal) —
 * "Rice Roti Daal Aloo Gobhi", "Rice Paratha Daal Mushroom Masala", "Pulao Paratha Daal Mutton
 * Curry" on Premium's Sunday upgrades. Purely a display transform: the order/checkout/tracking
 * flow keeps using the bare dish name plus its own real, individually-priced add-ons — this
 * doesn't touch either.
 */
export function composeFullDishName(tier: TiffinMealTier, mealType: TiffinMealType, dishName: string): string {
  if (mealType === "breakfast" || ALREADY_COMPOSED_DISPLAY_DISHES.has(dishName)) return dishName;
  if (tier === "mini") return `Roti ${dishName}`;
  if (tier === "premium") {
    const staple = PULAO_STAPLE_DISPLAY_DISHES.has(dishName) ? "Pulao" : "Rice";
    return `${staple} Paratha Daal ${dishName}`;
  }
  return `Rice Roti Daal ${dishName}`;
}
