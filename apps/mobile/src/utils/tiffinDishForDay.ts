import type { DayOfWeek, TiffinDietType, TiffinDish, TiffinMealTier, TiffinMealType } from "@tbc/shared-types";

export const WEEK_DAYS: DayOfWeek[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** Keyed by `${tier}|${dietType}|${mealType}|${dayOfWeek}` — build once from the fetched
 * `useTiffinWeeklyMenu()` list and reuse across lookups, same shape the backend uses internally. */
export type WeeklyMenuLookup = Map<string, TiffinDish>;

export function buildWeeklyMenuLookup(dishes: TiffinDish[]): WeeklyMenuLookup {
  return new Map(dishes.map((d) => [`${d.tier}|${d.dietType}|${d.mealType}|${d.dayOfWeek}`, d]));
}

/** Mirrors the backend's singleMealMenu.ts#resolveDishSlot — this is a menu reference/browser,
 * not an order, so there's no ordering-cutoff date resolution involved, just "what does tier X
 * serve on day Y." Returns null only for Mini + breakfast, which Mini doesn't offer at all. */
export function singleMealDishForDay(
  lookup: WeeklyMenuLookup,
  tier: TiffinMealTier,
  dietType: TiffinDietType,
  day: DayOfWeek,
  mealType: TiffinMealType
): TiffinDish | null {
  return lookup.get(`${tier}|${dietType}|${mealType}|${day}`) ?? null;
}

/** A subscription plan is pinned to one fixed tier (`TiffinPlan.tier`) — this is a thin wrapper
 * around `singleMealDishForDay` for the plan preview schedule. Only Mini + breakfast can be null,
 * and the plan-select screen already hides breakfast as a choice for Mini plans, so this is safe
 * to type as non-nullable for any tier/mealType combination a real plan can actually offer. */
export function dishForDay(lookup: WeeklyMenuLookup, tier: TiffinMealTier, dietType: TiffinDietType, day: DayOfWeek, mealType: TiffinMealType): TiffinDish {
  const dish = singleMealDishForDay(lookup, tier, dietType, day, mealType);
  if (dish === null) throw new Error(`unreachable: ${tier} tier has no dish configured for ${dietType}/${day}/${mealType}`);
  return dish;
}

/**
 * Spells out the tier's real staple components ahead of the bare sabzi/curry name, for display on
 * the menu-browsing screens (subscription plan preview, Weekly Menu, Order a Single Meal) —
 * "Rice Roti Daal Aloo Gobhi", "Rice Paratha Daal Mushroom Masala", "Pulao Paratha Daal Mutton
 * Curry" on Premium's Sunday upgrades. Purely a display transform: the order/checkout/tracking
 * flow keeps using the bare dish name plus its own real, individually-priced add-ons — this
 * doesn't touch either. `riceSubstitute`/`hasAddOns` come straight off the resolved dish now,
 * not a hardcoded dish-name lookup.
 */
export function composeFullDishName(tier: TiffinMealTier, mealType: TiffinMealType, dish: Pick<TiffinDish, "dishName" | "hasAddOns" | "riceSubstitute">): string {
  if (mealType === "breakfast" || !dish.hasAddOns) return dish.dishName;
  if (tier === "mini") return `Roti ${dish.dishName}`;
  if (tier === "premium") {
    const staple = dish.riceSubstitute === "pulao" ? "Pulao" : "Rice";
    return `${staple} Paratha Daal ${dish.dishName}`;
  }
  return `Rice Roti Daal ${dish.dishName}`;
}
