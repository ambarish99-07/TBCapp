import { QUANTITY_DISCOUNT_TIERS } from "./constants.js";

/** 1 item -> 0%, 2 -> 10%, 3 -> 15%, 4+ -> 20%, based on total non-combo drink quantity. */
export function quantityDiscountPercent(nonComboQuantity: number): number {
  const tier = QUANTITY_DISCOUNT_TIERS.find((t) => nonComboQuantity >= t.minQuantity);
  return tier?.percent ?? 0;
}
