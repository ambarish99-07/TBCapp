import { describe, expect, it } from "vitest";
import { loyaltyPercent, resolveTier } from "../src/loyalty.js";

describe("resolveTier", () => {
  it("0 completed orders -> first-order", () => {
    expect(resolveTier(0, false)).toBe("first-order");
  });

  it("1-4 completed orders -> returning", () => {
    expect(resolveTier(1, false)).toBe("returning");
    expect(resolveTier(4, false)).toBe("returning");
  });

  it("5+ completed orders -> gold", () => {
    expect(resolveTier(5, false)).toBe("gold");
    expect(resolveTier(12, false)).toBe("gold");
  });

  it("isGoldMember overrides order count", () => {
    expect(resolveTier(1, true)).toBe("gold");
    expect(resolveTier(0, true)).toBe("gold");
  });
});

describe("loyaltyPercent", () => {
  it("returns 0 for null tier (guests)", () => {
    expect(loyaltyPercent(null)).toBe(0);
  });

  it("first-order -> 10%, returning -> 15%, gold -> 20%", () => {
    expect(loyaltyPercent("first-order")).toBe(0.1);
    expect(loyaltyPercent("returning")).toBe(0.15);
    expect(loyaltyPercent("gold")).toBe(0.2);
  });
});
