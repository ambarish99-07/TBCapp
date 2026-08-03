import { DELIVERY_FEE, FREE_DELIVERY_THRESHOLD, TAX_PCT, WEBSITE_DISCOUNT_PCT } from "./constants.js";
import { loyaltyPercent } from "./loyalty.js";
import { computePunchCardDiscount } from "./punchCard.js";
import { round } from "./rounding.js";
import type { PricingInput, PricingResult } from "./types.js";

function lineTotal(line: PricingInput["lines"][number]): number {
  const addOnsTotal = line.addOnPrices.reduce((sum, price) => sum + price, 0);
  return (line.unitPrice + addOnsTotal) * line.quantity;
}

/**
 * Pure pricing engine — no I/O, no DB lookups. Callers (API order-creation and the
 * mobile cart-preview) must resolve real unitPrice/addOnPrices themselves before
 * calling this, so both sides share identical math and can never drift apart.
 */
export function computePricing(input: PricingInput): PricingResult {
  const subtotal = input.lines.reduce((sum, line) => sum + lineTotal(line), 0);

  const punchCardDiscount = computePunchCardDiscount(input.lines, input.isLoggedIn, input.punchCard);

  const websiteDiscountAmount = round(subtotal * WEBSITE_DISCOUNT_PCT);
  const loyaltyDiscountAmount = round(subtotal * loyaltyPercent(input.tier));

  // Website discount and loyalty discount are mutually exclusive — customer gets
  // whichever is larger, never both stacked. Punch-card discount stacks on top of
  // this (different layer: single item vs. whole subtotal) — intentional.
  const bestPercentDiscount = Math.max(websiteDiscountAmount, loyaltyDiscountAmount);

  const deliveryFee = subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE;

  const taxableAmount = subtotal - bestPercentDiscount - punchCardDiscount;
  const tax = round(taxableAmount * TAX_PCT);

  const total = taxableAmount + tax + deliveryFee;

  return {
    subtotal,
    punchCardDiscount,
    websiteDiscountAmount,
    loyaltyDiscountAmount,
    bestPercentDiscount,
    deliveryFee,
    tax,
    total,
  };
}
