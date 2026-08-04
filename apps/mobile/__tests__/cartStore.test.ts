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
    addOnPrices: [30],
    quantity: 1,
    sugarLevel: "regular",
    iceLevel: "regular",
    addOnIds: ["whipped-cream"],
    isCombo: false,
    ...overrides,
  };
}

describe("cartStore.computeTotals — no drift from @tbc/pricing", () => {
  beforeEach(() => {
    useCartStore.setState({ lines: [] });
  });

  it("produces exactly the same result as calling computePricing directly with equivalent input", () => {
    useCartStore.getState().addLine(makeLine());
    useCartStore.getState().addLine(makeLine({ lineId: "l2", unitPrice: 150, addOnPrices: [], quantity: 2 }));

    const auth = { isLoggedIn: true, tier: "returning" as const, ordersSinceReward: 1 };
    const storeResult = useCartStore.getState().computeTotals(auth);

    const directResult = computePricing({
      lines: [
        { unitPrice: 220, addOnPrices: [30], quantity: 1, isCombo: false },
        { unitPrice: 150, addOnPrices: [], quantity: 2, isCombo: false },
      ],
      isLoggedIn: true,
      tier: "returning",
      punchCard: { ordersSinceReward: 1 },
    });

    expect(storeResult).toEqual(directResult);
  });

  it("reflects quantity changes immediately in the live preview total", () => {
    useCartStore.getState().addLine(makeLine({ addOnPrices: [] }));
    const before = useCartStore.getState().computeTotals({ isLoggedIn: false, tier: null, ordersSinceReward: 0 });

    useCartStore.getState().setQuantity("l1", 3);
    const after = useCartStore.getState().computeTotals({ isLoggedIn: false, tier: null, ordersSinceReward: 0 });

    expect(after.subtotal).toBe(before.subtotal * 3);
  });
});
