import { COMBO_DISCOUNT_PCT } from "./constants.js";
import { round } from "./rounding.js";

/**
 * Every combo — curated (fixed two shakes) or choose-your-own — is priced as a
 * flat 15% off the sum of its constituent items' base prices. Pure/no I/O:
 * callers (API priceResolver, mobile Combos/ChooseCombo screens) look up the
 * real current base prices themselves and pass them in here, so the bundle
 * price can never drift out of sync with the individual item prices it's
 * derived from — same principle as computePricing.
 */
export function computeComboPrice(constituentBasePrices: number[]): number {
  const sum = constituentBasePrices.reduce((total, price) => total + price, 0);
  return round(sum * (1 - COMBO_DISCOUNT_PCT));
}
