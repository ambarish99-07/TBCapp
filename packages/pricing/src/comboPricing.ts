import { COMBO_DISCOUNT_PCT } from "./constants.js";
import { round } from "./rounding.js";

/**
 * Every combo — curated (fixed two shakes) or choose-your-own — is priced as a
 * percentage off the sum of its constituent items' base prices: that combo's own
 * admin-set `discountPercent` (e.g. 20 for 20% off) if it has one, else the flat
 * 15% default (`COMBO_DISCOUNT_PCT`). Pure/no I/O: callers (API priceResolver, mobile
 * Combos/ChooseCombo screens) look up the real current base prices themselves and pass
 * them in here, so the bundle price can never drift out of sync with the individual
 * item prices it's derived from — same principle as computePricing.
 */
export function computeComboPrice(constituentBasePrices: number[], discountPercent?: number): number {
  const sum = constituentBasePrices.reduce((total, price) => total + price, 0);
  const discountFraction = discountPercent != null ? discountPercent / 100 : COMBO_DISCOUNT_PCT;
  return round(sum * (1 - discountFraction));
}
