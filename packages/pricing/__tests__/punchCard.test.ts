import { describe, expect, it } from "vitest";
import { computePunchCardDiscount } from "../src/punchCard.js";
import type { CartLineInput } from "../src/types.js";

const line = (overrides: Partial<CartLineInput> = {}): CartLineInput => ({
  unitPrice: 200,
  addOnPrices: [],
  quantity: 1,
  isCombo: false,
  ...overrides,
});

describe("computePunchCardDiscount", () => {
  it("guests never get the punch-card discount, even with a qualifying counter", () => {
    const discount = computePunchCardDiscount([line()], false, { ordersSinceReward: 5 });
    expect(discount).toBe(0);
  });

  it("logged-in but below threshold gets nothing", () => {
    const discount = computePunchCardDiscount([line()], true, { ordersSinceReward: 4 });
    expect(discount).toBe(0);
  });

  it("logged-in at threshold gets 50% off one unit of the cheapest non-combo line", () => {
    const discount = computePunchCardDiscount(
      [line({ unitPrice: 300 }), line({ unitPrice: 150 })],
      true,
      { ordersSinceReward: 5 }
    );
    expect(discount).toBe(75); // round(0.5 * 150)
  });

  it("applies to one unit only, not scaled by quantity", () => {
    const discount = computePunchCardDiscount(
      [line({ unitPrice: 150, quantity: 4 })],
      true,
      { ordersSinceReward: 5 }
    );
    expect(discount).toBe(75);
  });

  it("ignores combo lines when picking the cheapest line", () => {
    const discount = computePunchCardDiscount(
      [line({ unitPrice: 50, isCombo: true }), line({ unitPrice: 200, isCombo: false })],
      true,
      { ordersSinceReward: 5 }
    );
    expect(discount).toBe(100); // round(0.5 * 200), the ₹50 combo line is ineligible
  });

  it("returns 0 if the cart has only combo lines", () => {
    const discount = computePunchCardDiscount(
      [line({ unitPrice: 379, isCombo: true })],
      true,
      { ordersSinceReward: 5 }
    );
    expect(discount).toBe(0);
  });

  it("fires again beyond the first cycle (e.g. ordersSinceReward=11 before a 12th-order reset)", () => {
    const discount = computePunchCardDiscount([line({ unitPrice: 100 })], true, {
      ordersSinceReward: 11,
    });
    expect(discount).toBe(50);
  });
});
