import { describe, expect, it } from "vitest";
import { computeCouponDiscount } from "../src/couponDiscount.js";
import type { CartLineInput } from "../src/types.js";

function line(overrides: Partial<CartLineInput> = {}): CartLineInput {
  return { unitPrice: 200, addOnPrices: [], quantity: 1, isCombo: false, ...overrides };
}

describe("computeCouponDiscount", () => {
  it("percent: takes the given percentage of the subtotal", () => {
    expect(computeCouponDiscount([line()], 400, { type: "percent", value: 50 })).toBe(200);
  });

  it("percent: caps at maxDiscountAmount when the raw discount exceeds it", () => {
    expect(computeCouponDiscount([line()], 400, { type: "percent", value: 50, maxDiscountAmount: 100 })).toBe(100);
  });

  it("flat: returns the flat rupee amount when it's below the subtotal", () => {
    expect(computeCouponDiscount([line()], 300, { type: "flat", value: 50 })).toBe(50);
  });

  it("flat: never exceeds the subtotal even if the coupon's value is larger", () => {
    expect(computeCouponDiscount([line()], 30, { type: "flat", value: 50 })).toBe(30);
  });

  it("bogo: the cheapest of two eligible units is free", () => {
    const lines = [line({ unitPrice: 220 }), line({ unitPrice: 180 })];
    expect(computeCouponDiscount(lines, 400, { type: "bogo", value: 0 })).toBe(180);
  });

  it("bogo: counts each unit of a multi-quantity line separately", () => {
    const lines = [line({ unitPrice: 220, quantity: 2 })];
    expect(computeCouponDiscount(lines, 440, { type: "bogo", value: 0 })).toBe(220);
  });

  it("bogo: no discount with fewer than 2 eligible units in the cart", () => {
    const lines = [line({ unitPrice: 220, quantity: 1 })];
    expect(computeCouponDiscount(lines, 220, { type: "bogo", value: 0 })).toBe(0);
  });

  it("bogo: combo lines never count toward eligibility, even with 2+ of them", () => {
    const lines = [line({ unitPrice: 391, isCombo: true }), line({ unitPrice: 350, isCombo: true })];
    expect(computeCouponDiscount(lines, 741, { type: "bogo", value: 0 })).toBe(0);
  });

  it("bogo: mixes combo and non-combo lines correctly, only the non-combo ones qualify", () => {
    const lines = [line({ unitPrice: 391, isCombo: true }), line({ unitPrice: 220 }), line({ unitPrice: 180 })];
    expect(computeCouponDiscount(lines, 791, { type: "bogo", value: 0 })).toBe(180);
  });
});
