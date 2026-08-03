import { describe, expect, it } from "vitest";
import { computePricing } from "../src/computePricing.js";
import type { PricingInput } from "../src/types.js";

describe("computePricing", () => {
  it("guest order: only the website discount applies, delivery fee charged below threshold", () => {
    const input: PricingInput = {
      lines: [{ unitPrice: 300, addOnPrices: [30], quantity: 1, isCombo: false }],
      isLoggedIn: false,
      tier: null,
      punchCard: { ordersSinceReward: 0 },
    };
    const result = computePricing(input);

    expect(result.subtotal).toBe(330);
    expect(result.punchCardDiscount).toBe(0); // guests never get this
    expect(result.websiteDiscountAmount).toBe(33);
    expect(result.loyaltyDiscountAmount).toBe(0); // null tier
    expect(result.bestPercentDiscount).toBe(33);
    expect(result.deliveryFee).toBe(39);
    expect(result.tax).toBe(15); // round(297 * 0.05)
    expect(result.total).toBe(351);
  });

  it("returning tier beats the flat website discount and unlocks free delivery at >= 499", () => {
    const input: PricingInput = {
      lines: [{ unitPrice: 250, addOnPrices: [], quantity: 2, isCombo: false }],
      isLoggedIn: true,
      tier: "returning",
      punchCard: { ordersSinceReward: 2 },
    };
    const result = computePricing(input);

    expect(result.subtotal).toBe(500);
    expect(result.websiteDiscountAmount).toBe(50);
    expect(result.loyaltyDiscountAmount).toBe(75);
    expect(result.bestPercentDiscount).toBe(75); // loyalty wins, NOT both stacked
    expect(result.deliveryFee).toBe(0);
    expect(result.tax).toBe(21); // round(425 * 0.05)
    expect(result.total).toBe(446);
  });

  it("gold tier's percent discount and the punch-card discount stack additively", () => {
    const input: PricingInput = {
      lines: [
        { unitPrice: 200, addOnPrices: [], quantity: 1, isCombo: false },
        { unitPrice: 150, addOnPrices: [], quantity: 1, isCombo: false },
      ],
      isLoggedIn: true,
      tier: "gold",
      punchCard: { ordersSinceReward: 5 },
    };
    const result = computePricing(input);

    expect(result.subtotal).toBe(350);
    expect(result.loyaltyDiscountAmount).toBe(70);
    expect(result.websiteDiscountAmount).toBe(35);
    expect(result.bestPercentDiscount).toBe(70);
    expect(result.punchCardDiscount).toBe(75); // stacks on top of bestPercentDiscount
    expect(result.deliveryFee).toBe(39);
    expect(result.tax).toBe(10); // round(205 * 0.05)
    expect(result.total).toBe(254);
  });

  it("free-delivery threshold boundary: exactly 499 is free, 498 is not", () => {
    const at499 = computePricing({
      lines: [{ unitPrice: 499, addOnPrices: [], quantity: 1, isCombo: false }],
      isLoggedIn: false,
      tier: null,
      punchCard: { ordersSinceReward: 0 },
    });
    const at498 = computePricing({
      lines: [{ unitPrice: 498, addOnPrices: [], quantity: 1, isCombo: false }],
      isLoggedIn: false,
      tier: null,
      punchCard: { ordersSinceReward: 0 },
    });

    expect(at499.deliveryFee).toBe(0);
    expect(at498.deliveryFee).toBe(39);
  });

  it("bestPercentDiscount is always max(website, loyalty), never their sum", () => {
    const result = computePricing({
      lines: [{ unitPrice: 1000, addOnPrices: [], quantity: 1, isCombo: false }],
      isLoggedIn: true,
      tier: "gold",
      punchCard: { ordersSinceReward: 0 },
    });

    expect(result.bestPercentDiscount).toBe(Math.max(result.websiteDiscountAmount, result.loyaltyDiscountAmount));
    expect(result.bestPercentDiscount).not.toBe(result.websiteDiscountAmount + result.loyaltyDiscountAmount);
  });

  it("combo lines are priced flat and excluded from the punch-card's cheapest-line search", () => {
    const result = computePricing({
      lines: [
        { unitPrice: 379, addOnPrices: [], quantity: 1, isCombo: true },
        { unitPrice: 220, addOnPrices: [], quantity: 1, isCombo: false },
      ],
      isLoggedIn: true,
      tier: "first-order",
      punchCard: { ordersSinceReward: 5 },
    });

    expect(result.punchCardDiscount).toBe(110); // round(0.5 * 220), combo line ignored
  });
});
