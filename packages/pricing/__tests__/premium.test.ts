import { describe, expect, it } from "vitest";
import { resolveIsPremiumMember } from "../src/premium.js";

describe("resolveIsPremiumMember", () => {
  it("is false below the 15-order threshold with no override", () => {
    expect(resolveIsPremiumMember({ completedOrderCount: 14, isPremiumMemberOverride: false })).toBe(false);
  });

  it("unlocks at exactly 15 completed orders", () => {
    expect(resolveIsPremiumMember({ completedOrderCount: 15, isPremiumMemberOverride: false })).toBe(true);
    expect(resolveIsPremiumMember({ completedOrderCount: 20, isPremiumMemberOverride: false })).toBe(true);
  });

  it("an admin override grants premium regardless of order count", () => {
    expect(resolveIsPremiumMember({ completedOrderCount: 0, isPremiumMemberOverride: true })).toBe(true);
  });
});
