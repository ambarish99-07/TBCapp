import { describe, expect, it } from "vitest";
import { computeComboPrice } from "../src/comboPricing.js";

describe("computeComboPrice", () => {
  it("prices a two-shake combo at 15% off the sum of the constituent base prices", () => {
    expect(computeComboPrice([220, 240])).toBe(391); // round(460 * 0.85) = round(391)
  });

  it("rounds to the nearest rupee", () => {
    expect(computeComboPrice([200, 210])).toBe(349); // round(410 * 0.85) = round(348.5) = 349
  });

  it("recomputes live from whatever base prices it's given — no stored/stale price", () => {
    const before = computeComboPrice([220, 240]);
    const afterPriceChange = computeComboPrice([250, 240]); // one item's price went up
    expect(afterPriceChange).not.toBe(before);
    expect(afterPriceChange).toBe(417); // round(490 * 0.85) = round(416.5) = 417
  });

  it("uses the combo's own discountPercent instead of the 15% default when given one", () => {
    expect(computeComboPrice([220, 240], 20)).toBe(368); // round(460 * 0.80) = 368
    expect(computeComboPrice([220, 240], 50)).toBe(230); // round(460 * 0.50) = 230
  });
});
