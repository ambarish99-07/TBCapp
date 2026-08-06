import { computePricing, type DrinkCategory, type LoyaltyState, type PricingResult } from "@tbc/pricing";
import type { AddOnId, IceLevel, SugarLevel } from "@tbc/shared-types";
import { create } from "zustand";

export interface CartLine {
  lineId: string;
  menuItemId: string;
  signatureName: string;
  commonName: string;
  image: string;
  /** The price shown here is for live preview only — the server re-derives it independently at order time. */
  unitPrice: number;
  /** Pre-sale-discount price, for strikethrough display — equals unitPrice when the item wasn't on sale. */
  originalUnitPrice: number;
  addOnPrices: number[];
  quantity: number;
  sugarLevel: SugarLevel;
  iceLevel: IceLevel;
  addOnIds: AddOnId[];
  isCombo: boolean;
  /** Absent for combo lines — drives the 6th/10th-order milestone rewards. */
  category?: DrinkCategory;
}

interface AuthContext {
  isLoggedIn: boolean;
  loyalty: LoyaltyState;
  distanceFromShopKm?: number | null;
}

interface CartState {
  lines: CartLine[];
  addLine: (line: CartLine) => void;
  removeLine: (lineId: string) => void;
  setQuantity: (lineId: string, quantity: number) => void;
  clear: () => void;
  /**
   * Computes the exact same PricingResult shape the server will compute at order
   * time, using @tbc/pricing directly — this is what makes the live cart-preview
   * total structurally unable to drift from what the server actually charges.
   */
  computeTotals: (auth: AuthContext) => PricingResult;
}

export const useCartStore = create<CartState>((set, get) => ({
  lines: [],

  addLine: (line) => set((state) => ({ lines: [...state.lines, line] })),

  removeLine: (lineId) => set((state) => ({ lines: state.lines.filter((l) => l.lineId !== lineId) })),

  setQuantity: (lineId, quantity) =>
    set((state) => ({
      lines: state.lines.map((l) => (l.lineId === lineId ? { ...l, quantity: Math.max(1, Math.min(20, quantity)) } : l)),
    })),

  clear: () => set({ lines: [] }),

  computeTotals: (auth) => {
    const lines = get().lines;
    return computePricing({
      lines: lines.map((line) => ({
        unitPrice: line.unitPrice,
        addOnPrices: line.addOnPrices,
        quantity: line.quantity,
        isCombo: line.isCombo,
        category: line.category,
      })),
      isLoggedIn: auth.isLoggedIn,
      loyalty: auth.loyalty,
      distanceFromShopKm: auth.distanceFromShopKm,
    });
  },
}));
