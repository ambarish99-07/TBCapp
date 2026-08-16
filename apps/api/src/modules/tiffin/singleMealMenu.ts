import {
  TIFFIN_MINI_NONVEG_DINNER_OVERRIDES,
  TIFFIN_NONVEG_BREAKFAST_OVERRIDES,
  TIFFIN_PREMIUM_NONVEG_LUNCH_OVERRIDES,
  TIFFIN_PREMIUM_VEG_MENU,
  TIFFIN_REGULAR_NONVEG_DINNER_OVERRIDES,
  TIFFIN_REGULAR_VEG_MENU,
  type SingleMealAddOn,
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

/** Dishes with no separate staple components to offer as add-ons — Premium's Sunday dinner
 * ("Puri with Chole") is already a complete two-part dish, and breakfast items are single-serve
 * as-is. */
const NO_ADDONS_DISHES = new Set(["Puri with Chole"]);

/** Dishes that pair with Pulao instead of plain Rice as their rice-based add-on — Mutton Curry
 * (Premium's one Sunday non-veg upgrade) and Paneer Butter Masala (its one Sunday veg upgrade). */
const PULAO_STAPLE_DISHES = new Set(["Mutton Curry", "Paneer Butter Masala"]);

/** Meat/egg curries offer "{Protein} piece" as their extra-portion add-on instead of "Extra
 * {dish}" — every other (veg) dish offers an extra helping of the sabzi itself. */
const PROTEIN_PIECE_NAMES: Record<string, string> = {
  "Fish Curry": "Fish piece",
  "Egg Curry": "Egg piece",
  "Chicken Curry": "Chicken piece",
  "Mutton Curry": "Mutton piece",
};

/** Flat prices for the staple add-ons, shared across every dish that offers them. */
const STAPLE_ADDON_PRICES: Record<string, number> = {
  Rice: 20,
  Roti: 10,
  Daal: 20,
  Paratha: 15,
  Pulao: 25,
};

/** Extra-piece prices for meat/egg curries — varies by protein, unlike the flat staple prices. */
const PROTEIN_PIECE_PRICES: Record<string, number> = {
  "Fish piece": 45,
  "Egg piece": 15,
  "Chicken piece": 40,
  "Mutton piece": 60,
};

/** Flat price for an extra helping of the day's veg sabzi itself. */
const EXTRA_VEG_PORTION_PRICE = 30;

/**
 * The real, individually-priced extras a customer can choose to add to this meal in the
 * customize pop-up — never included automatically. Regular offers rice/roti/daal plus an extra
 * portion of the day's dish; Premium swaps roti for paratha (and rice for pulao on its two Sunday
 * upgrades, Mutton Curry and Paneer Butter Masala); Mini, the single-carb tier, only offers roti
 * plus the extra-portion add-on. Breakfast and Premium's already-complete Sunday dinner have
 * nothing to add, so they return no add-ons at all.
 */
export function resolveAddOns(tier: TiffinMealTier, mealType: SingleMealType, dishName: string): SingleMealAddOn[] {
  if (mealType === "breakfast" || NO_ADDONS_DISHES.has(dishName)) return [];

  const proteinPiece = PROTEIN_PIECE_NAMES[dishName];
  const lastAddOn: SingleMealAddOn = proteinPiece
    ? { name: proteinPiece, price: PROTEIN_PIECE_PRICES[proteinPiece] }
    : { name: `Extra ${dishName}`, price: EXTRA_VEG_PORTION_PRICE };

  const stapleNames =
    tier === "mini"
      ? ["Roti"]
      : tier === "premium"
        ? [PULAO_STAPLE_DISHES.has(dishName) ? "Pulao" : "Rice", "Paratha", "Daal"]
        : ["Rice", "Roti", "Daal"];

  return [...stapleNames.map((name) => ({ name, price: STAPLE_ADDON_PRICES[name] })), lastAddOn];
}
