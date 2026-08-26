import { DELIVERY_FEE, FREE_DELIVERY_RADIUS_KM, FREE_DELIVERY_THRESHOLD, PREMIUM_DISCOUNT_PCT, TAX_PCT } from "./constants.js";
import { computeMilestoneReward } from "./milestoneReward.js";
import { computeNewCustomerOfferDiscount } from "./newCustomerOffer.js";
import { resolveIsPremiumMember } from "./premium.js";
import { quantityDiscountPercent } from "./quantityDiscount.js";
import { round } from "./rounding.js";
import type { DiscountReason, PricingInput, PricingResult } from "./types.js";

function lineTotal(line: PricingInput["lines"][number]): number {
  const addOnsTotal = line.addOnPrices.reduce((sum, price) => sum + price, 0);
  return (line.unitPrice + addOnsTotal) * line.quantity;
}

/** The same subtotal math `computePricing` uses internally, exposed standalone for callers that
 * need it before they have the rest of a `PricingInput` ready — e.g. resolving a coupon's
 * `minOrderAmount` against the cart, which has to happen before the coupon's own discount amount
 * can be fed back in as `couponDiscountAmount`. */
export function cartSubtotal(lines: PricingInput["lines"]): number {
  return lines.reduce((sum, line) => sum + lineTotal(line), 0);
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
  const newCustomerOffer = isPremiumMember
    ? null
    : computeNewCustomerOfferDiscount(
        input.lines,
        nonComboSubtotal,
        input.isLoggedIn,
        input.isQuickDeliveryBrand ?? false,
        input.loyalty.completedOrderCount
      );

  // Precedence: premium (25%, requires 15+ prior orders) > the one-time new-customer offer (orders
  // #1/#2 only) > the ordinary quantity tier > nothing. Premium and the new-customer offer can
  // never actually collide in practice (15+ vs. 0/1 prior orders), but the order still matters for
  // clarity about which one wins if that ever changed.
  let discountReason: DiscountReason;
  let discountAmount: number;
  if (isPremiumMember) {
    discountReason = "premium";
    discountAmount = round(nonComboSubtotal * PREMIUM_DISCOUNT_PCT);
  } else if (newCustomerOffer) {
    discountReason = newCustomerOffer.reason;
    discountAmount = newCustomerOffer.amount;
  } else if (quantityDiscountPercent(nonComboQuantity) > 0) {
    discountReason = "quantity-tier";
    discountAmount = round(nonComboSubtotal * quantityDiscountPercent(nonComboQuantity));
  } else {
    discountReason = "none";
    discountAmount = 0;
  }

  const milestoneReward = computeMilestoneReward(input.lines, input.isLoggedIn, input.loyalty.completedOrderCount);

  const isWithinFreeDeliveryRadius =
    isPremiumMember && input.distanceFromShopKm != null && input.distanceFromShopKm <= FREE_DELIVERY_RADIUS_KM;
  const hasFreeDeliveryMembership = input.hasFreeDeliveryMembership ?? false;
  const deliveryFee = isWithinFreeDeliveryRadius || hasFreeDeliveryMembership || subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE;

  // Applied after the discount/reward above rather than stacked independently — clamped so a
  // coupon can never push the taxable amount below zero.
  const remainingAfterDiscountAndReward = Math.max(0, subtotal - discountAmount - milestoneReward.amount);
  const couponDiscount = Math.min(input.couponDiscountAmount ?? 0, remainingAfterDiscountAndReward);

  const taxableAmount = remainingAfterDiscountAndReward - couponDiscount;
  const tax = round(taxableAmount * TAX_PCT);

  const total = taxableAmount + tax + deliveryFee;

  return {
    subtotal,
    isPremiumMember,
    discountAmount,
    discountReason,
    rewardAmount: milestoneReward.amount,
    rewardReason: milestoneReward.reason,
    couponDiscount,
    hasFreeDeliveryMembership,
    deliveryFee,
    tax,
    total,
  };
}
