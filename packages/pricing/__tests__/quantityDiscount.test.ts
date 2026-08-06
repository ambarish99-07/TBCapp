import { describe, expect, it } from "vitest";
import { quantityDiscountPercent } from "../src/quantityDiscount.js";

describe("quantityDiscountPercent", () => {
  it("0 or 1 item -> no discount", () => {
    expect(quantityDiscountPercent(0)).toBe(0);
    expect(quantityDiscountPercent(1)).toBe(0);
  });

  it("2 items -> 10%", () => {
    expect(quantityDiscountPercent(2)).toBe(0.1);
  });

  it("3 items -> 15%", () => {
    expect(quantityDiscountPercent(3)).toBe(0.15);
  });

  it("4 or more items -> 20%", () => {
    expect(quantityDiscountPercent(4)).toBe(0.2);
    expect(quantityDiscountPercent(10)).toBe(0.2);
  });
});
