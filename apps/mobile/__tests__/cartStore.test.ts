import { computePricing } from "@tbc/pricing";
import { beforeEach, describe, expect, it } from "vitest";
import { useCartStore, type CartLine } from "../src/state/cartStore";

function makeLine(overrides: Partial<CartLine> = {}): CartLine {
  return {
    lineId: "l1",
    menuItemId: "choco-crush",
    signatureName: "Choco Crush",
    commonName: "Rich Chocolate Shake",
    image: "https://example.com/img.jpg",
    unitPrice: 220,
    originalUnitPrice: 220,
    addOnPrices: [30],
    quantity: 1,
    sugarLevel: "regular",
    iceLevel: "regular",
    addOnIds: ["whipped-cream"],
    isCombo: false,
    category: "signature-shakes",
    ...overrides,
  };
}

describe("cartStore.computeTotals — no drift from @tbc/pricing", () => {
  beforeEach(() => {
    useCartStore.setState({ lines: [] });
  });

  it("produces exactly the same result as calling computePricing directly with equivalent input", () => {
    useCartStore.getState().addLine(makeLine());
    useCartStore
      .getState()
      .addLine(makeLine({ lineId: "l2", unitPrice: 150, originalUnitPrice: 150, addOnPrices: [], quantity: 2, category: "cold-coffee" }));

    const auth = { isLoggedIn: true, loyalty: { completedOrderCount: 1, isPremiumMemberOverride: false } };
    const storeResult = useCartStore.getState().computeTotals(auth);

    const directResult = computePricing({
      lines: [
        { unitPrice: 220, addOnPrices: [30], quantity: 1, isCombo: false, category: "signature-shakes" },
        { unitPrice: 150, addOnPrices: [], quantity: 2, isCombo: false, category: "cold-coffee" },
      ],
      isLoggedIn: true,
      loyalty: { completedOrderCount: 1, isPremiumMemberOverride: false },
    });

    expect(storeResult).toEqual(directResult);
  });

  it("reflects quantity changes immediately in the live preview total", () => {
    useCartStore.getState().addLine(makeLine({ addOnPrices: [] }));
    const auth = { isLoggedIn: false, loyalty: { completedOrderCount: 0, isPremiumMemberOverride: false } };
    const before = useCartStore.getState().computeTotals(auth);

    useCartStore.getState().setQuantity("l1", 3);
    const after = useCartStore.getState().computeTotals(auth);

    expect(after.subtotal).toBe(before.subtotal * 3);
  });
});
