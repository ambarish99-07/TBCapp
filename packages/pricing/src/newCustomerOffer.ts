import { NEW_CUSTOMER_BOGO_ORDER_NUMBER, NEW_CUSTOMER_HALF_OFF_ORDER_NUMBER, NEW_CUSTOMER_HALF_OFF_PCT } from "./constants.js";
import { round } from "./rounding.js";
import type { CartLineInput, DiscountReason } from "./types.js";

export interface NewCustomerOffer {
  amount: number;
  reason: Extract<DiscountReason, "first-order-bogo" | "second-order-half-off">;
}

/**
 * A logged-in customer's first-ever quick-delivery order (TBC/Alchemy Tails only — GG Tiffin
 * subscriptions and single-meal orders never reach this, see the `isQuickDeliveryBrand` gate)
 * gets the cheapest non-combo unit in the cart free, as long as there are at least two non-combo
 * units total (nothing to give away free on a single-unit order). Their second such order gets a
 * flat 50% off the non-combo subtotal instead — a plain percentage, not a per-unit freebie, since
 * "50% off the order" doesn't need a specific line to target. From the third order on, this
 * doesn't apply at all; ordinary quantity-tier/premium pricing and the repeating 6th/10th-order
 * milestone rewards take over exactly as before. Combo lines never participate, same as every
 * other percentage discount in this package — they already carry their own bundled price.
 */
export function computeNewCustomerOfferDiscount(
  lines: CartLineInput[],
  nonComboSubtotal: number,
  isLoggedIn: boolean,
  isQuickDeliveryBrand: boolean,
  completedOrderCount: number
): NewCustomerOffer | null {
  if (!isLoggedIn || !isQuickDeliveryBrand) return null;

  const thisOrderNumber = completedOrderCount + 1;
  const nonComboLines = lines.filter((line) => !line.isCombo);

  if (thisOrderNumber === NEW_CUSTOMER_BOGO_ORDER_NUMBER) {
    const totalUnits = nonComboLines.reduce((sum, line) => sum + line.quantity, 0);
    if (totalUnits < 2) return null;
    const cheapestUnitPrice = Math.min(...nonComboLines.map((line) => line.unitPrice));
    return { amount: round(cheapestUnitPrice), reason: "first-order-bogo" };
  }

  if (thisOrderNumber === NEW_CUSTOMER_HALF_OFF_ORDER_NUMBER) {
    if (nonComboLines.length === 0) return null;
    return { amount: round(nonComboSubtotal * NEW_CUSTOMER_HALF_OFF_PCT), reason: "second-order-half-off" };
  }

  return null;
}
