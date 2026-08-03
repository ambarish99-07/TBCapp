import { describe, expect, it } from "vitest";
import { computePricing } from "../src/computePricing.js";

/**
 * This package has no database access and cannot detect a tampered price on its
 * own — it faithfully prices whatever `unitPrice` it's given. That is by design:
 * resolving a menu-item/add-on id to its real, current price is I/O and belongs
 * to apps/api's priceResolver, which must call this function with server-looked-up
 * prices only and never with a client-submitted value. This test documents that
 * contract; the actual tamper-rejection test (submit a fake low price over HTTP,
 * assert the server ignores it) lives in apps/api's order-creation integration tests.
 */
describe("computePricing price-input contract", () => {
  it("prices exactly the unitPrice it's given, with no independent verification", () => {
    const genuineResult = computePricing({
      lines: [{ unitPrice: 300, addOnPrices: [], quantity: 1, isCombo: false }],
      isLoggedIn: false,
      tier: null,
      punchCard: { ordersSinceReward: 0 },
    });

    const tamperedResult = computePricing({
      lines: [{ unitPrice: 1, addOnPrices: [], quantity: 1, isCombo: false }],
      isLoggedIn: false,
      tier: null,
      punchCard: { ordersSinceReward: 0 },
    });

    expect(genuineResult.total).not.toBe(tamperedResult.total);
    // The onus is entirely on the caller to supply a server-resolved unitPrice —
    // this package provides no tamper protection of its own.
  });
});
