import { DELIVERY_FEE, FREE_DELIVERY_RADIUS_KM, FREE_DELIVERY_THRESHOLD, PREMIUM_DISCOUNT_PCT, TAX_PCT } from "./constants.js";
import { computeMilestoneReward } from "./milestoneReward.js";
import { resolveIsPremiumMember } from "./premium.js";
import { quantityDiscountPercent } from "./quantityDiscount.js";
import { round } from "./rounding.js";
import type { PricingInput, PricingResult } from "./types.js";

function lineTotal(line: PricingInput["lines"][number]): number {
  const addOnsTotal = line.addOnPrices.reduce((sum, price) => sum + price, 0);
  return (line.unitPrice + addOnsTotal) * line.quantity;
}

/**
 * Pure pricing engine — no I/O, no DB lookups. Callers (API order-creation and
 * the mobile cart-preview) must resolve real unitPrice/addOnPrices/category
 * themselves before calling this, so both sides share identical math and can
 * never drift apart.
 */
export function computePricing(input: PricingInput): PricingResult {
  const comboLines = input.lines.filter((line) => line.isCombo);
  const nonComboLines = input.lines.filter((line) => !line.isCombo);

  const comboSubtotal = comboLines.reduce((sum, line) => sum + lineTotal(line), 0);
  const nonComboSubtotal = nonComboLines.reduce((sum, line) => sum + lineTotal(line), 0);
  const subtotal = comboSubtotal + nonComboSubtotal;

  const nonComboQuantity = nonComboLines.reduce((sum, line) => sum + line.quantity, 0);

  // Combo lines already carry their own bundled price and are deliberately
  // excluded from this discount — applying it on top would double-discount
  // an already-discounted bundle.
  const isPremiumMember = input.isLoggedIn && resolveIsPremiumMember(input.loyalty);
  const discountReason = isPremiumMember ? "premium" : quantityDiscountPercent(nonComboQuantity) > 0 ? "quantity-tier" : "none";
  const discountPercent = isPremiumMember ? PREMIUM_DISCOUNT_PCT : quantityDiscountPercent(nonComboQuantity);
  const discountAmount = round(nonComboSubtotal * discountPercent);

  const milestoneReward = computeMilestoneReward(input.lines, input.isLoggedIn, input.loyalty.completedOrderCount);

  const isWithinFreeDeliveryRadius =
    isPremiumMember && input.distanceFromShopKm != null && input.distanceFromShopKm <= FREE_DELIVERY_RADIUS_KM;
  const deliveryFee = isWithinFreeDeliveryRadius || subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE;

  const taxableAmount = subtotal - discountAmount - milestoneReward.amount;
  const tax = round(taxableAmount * TAX_PCT);

  const total = taxableAmount + tax + deliveryFee;

  return {
    subtotal,
    isPremiumMember,
    discountAmount,
    discountReason,
    rewardAmount: milestoneReward.amount,
    rewardReason: milestoneReward.reason,
    deliveryFee,
    tax,
    total,
  };
}
