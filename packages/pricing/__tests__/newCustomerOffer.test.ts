import { describe, expect, it } from "vitest";
import { computeNewCustomerOfferDiscount } from "../src/newCustomerOffer.js";
import type { CartLineInput } from "../src/types.js";

const shakeLine = (unitPrice: number, quantity = 1): CartLineInput => ({
  unitPrice,
  addOnPrices: [],
  quantity,
  isCombo: false,
  category: "signature-shakes",
});

const comboLine = (unitPrice: number): CartLineInput => ({
  unitPrice,
  addOnPrices: [],
  quantity: 1,
  isCombo: true,
});

describe("computeNewCustomerOfferDiscount — order #1 (Buy 1 Get 1 Free)", () => {
  it("gives the cheapest unit free when there are at least two non-combo units", () => {
    const lines = [shakeLine(300), shakeLine(180)];
    const result = computeNewCustomerOfferDiscount(lines, 480, true, true, 0);
    expect(result).toEqual({ amount: 180, reason: "first-order-bogo" });
  });

  it("a single line with quantity 2 also counts as two units", () => {
    const lines = [shakeLine(220, 2)];
    const result = computeNewCustomerOfferDiscount(lines, 440, true, true, 0);
    expect(result).toEqual({ amount: 220, reason: "first-order-bogo" });
  });

  it("gives nothing when the order only has a single unit — there's no second item to give free", () => {
    const result = computeNewCustomerOfferDiscount([shakeLine(300)], 300, true, true, 0);
    expect(result).toBeNull();
  });

  it("combo lines don't count toward the unit total and are never the free item", () => {
    const lines = [comboLine(400), shakeLine(300)];
    const result = computeNewCustomerOfferDiscount(lines, 300, true, true, 0);
    // only 1 non-combo unit — no BOGO even though there's a combo line too
    expect(result).toBeNull();
  });
});

describe("computeNewCustomerOfferDiscount — order #2 (50% off)", () => {
  it("gives a flat 50% off the non-combo subtotal", () => {
    const lines = [shakeLine(300), shakeLine(200)];
    const result = computeNewCustomerOfferDiscount(lines, 500, true, true, 1);
    expect(result).toEqual({ amount: 250, reason: "second-order-half-off" });
  });

  it("applies even to a single-item order — no minimum-quantity requirement like order #1's BOGO", () => {
    const result = computeNewCustomerOfferDiscount([shakeLine(300)], 300, true, true, 1);
    expect(result).toEqual({ amount: 150, reason: "second-order-half-off" });
  });

  it("gives nothing when the cart is all combos", () => {
    const result = computeNewCustomerOfferDiscount([comboLine(400)], 0, true, true, 1);
    expect(result).toBeNull();
  });
});

describe("computeNewCustomerOfferDiscount — eligibility gates", () => {
  it("guests never get the offer, even on order #1/#2", () => {
    expect(computeNewCustomerOfferDiscount([shakeLine(300), shakeLine(200)], 500, false, true, 0)).toBeNull();
    expect(computeNewCustomerOfferDiscount([shakeLine(300)], 300, false, true, 1)).toBeNull();
  });

  it("never applies outside TBC/Alchemy Tails — isQuickDeliveryBrand: false excludes GG Tiffin", () => {
    expect(computeNewCustomerOfferDiscount([shakeLine(300), shakeLine(200)], 500, true, false, 0)).toBeNull();
    expect(computeNewCustomerOfferDiscount([shakeLine(300)], 300, true, false, 1)).toBeNull();
  });

  it("the 3rd order and beyond get nothing from this offer", () => {
    expect(computeNewCustomerOfferDiscount([shakeLine(300), shakeLine(200)], 500, true, true, 2)).toBeNull();
    expect(computeNewCustomerOfferDiscount([shakeLine(300), shakeLine(200)], 500, true, true, 10)).toBeNull();
  });
});
