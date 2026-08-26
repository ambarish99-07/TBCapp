import AsyncStorage from "@react-native-async-storage/async-storage";
import { ADD_ON_PRICES, computePricing, type DrinkCategory, type LoyaltyState, type PricingResult } from "@tbc/pricing";
import { CROSS_BRAND_ID, isQuickDeliveryBrandId, type AddOnId, type IceLevel, type SugarLevel } from "@tbc/shared-types";
import { create } from "zustand";

const CART_STORAGE_KEY = "tbc_cart_lines";

export interface CartLine {
  lineId: string;
  /** Which brand this item was added under — checkout sends this to the server, never whichever
   * brand happens to be ambiently "selected" at the moment of checkout (that can drift, e.g. the
   * Home carousel auto-rotating in the background, well after the item was actually added). */
  brandId: string;
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
  /** Free-text notes from the customer, sent through as-is to the kitchen. */
  comment?: string;
  isCombo: boolean;
  /** Absent for combo lines — drives the 6th/10th-order milestone rewards. */
  category?: DrinkCategory;
}

interface AuthContext {
  isLoggedIn: boolean;
  loyalty: LoyaltyState;
  distanceFromShopKm?: number | null;
  hasFreeDeliveryMembership?: boolean;
}

export interface AppliedCoupon {
  code: string;
  /** The discount amount the server returned at "Apply Coupon" time — re-validated (never
   * trusted) again at order creation, but used here for the live cart preview. */
  discountAmount: number;
}

interface CartState {
  lines: CartLine[];
  isHydrated: boolean;
  /** Not persisted across app restarts (unlike `lines`) — a coupon is cheap to re-apply and this
   * avoids checking out with a stale discount if the coupon expired or its rules changed since. */
  appliedCoupon: AppliedCoupon | null;
  setAppliedCoupon: (coupon: AppliedCoupon | null) => void;
  /** Loads whatever was left in the cart last time the app was open — the cart survives
   * a restart now, same as the saved address/payment method, and only empties when the
   * customer clears it themselves (the summary bar's ✕) or completes an order. */
  hydrate: () => Promise<void>;
  addLine: (line: CartLine) => void;
  removeLine: (lineId: string) => void;
  setQuantity: (lineId: string, quantity: number) => void;
  /** Not for combo lines — those have no sugar/ice/add-ons to edit. Re-derives addOnPrices from addOnIds. */
  updateLineCustomization: (
    lineId: string,
    updates: { sugarLevel: SugarLevel; iceLevel: IceLevel; addOnIds: AddOnId[]; comment: string }
  ) => void;
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
  isHydrated: false,
  appliedCoupon: null,
  setAppliedCoupon: (coupon) => set({ appliedCoupon: coupon }),

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(CART_STORAGE_KEY);
      if (raw) {
        const lines = JSON.parse(raw) as CartLine[];
        // Lines saved before `brandId` was added to CartLine can never check out correctly (the
        // order's brandId falls back to whatever's ambiently selected, which is the exact bug
        // this field exists to avoid) — drop them rather than leave a cart stuck failing checkout.
        set({ lines: lines.filter((line) => !!line.brandId) });
      }
    } catch {
      // Corrupt/unreadable storage — start with an empty cart rather than crashing.
    } finally {
      set({ isHydrated: true });
    }
  },

  addLine: (line) => set((state) => ({ lines: [...state.lines, line] })),

  removeLine: (lineId) => set((state) => ({ lines: state.lines.filter((l) => l.lineId !== lineId) })),

  setQuantity: (lineId, quantity) =>
    set((state) => ({
      lines: state.lines.map((l) => (l.lineId === lineId ? { ...l, quantity: Math.max(1, Math.min(20, quantity)) } : l)),
    })),

  updateLineCustomization: (lineId, updates) =>
    set((state) => ({
      lines: state.lines.map((l) =>
        l.lineId === lineId
          ? {
              ...l,
              sugarLevel: updates.sugarLevel,
              iceLevel: updates.iceLevel,
              addOnIds: updates.addOnIds,
              addOnPrices: updates.addOnIds.map((id) => ADD_ON_PRICES[id]),
              comment: updates.comment || undefined,
            }
          : l
      ),
    })),

  clear: () => set({ lines: [], appliedCoupon: null }),

  computeTotals: (auth) => {
    const lines = get().lines;
    // Same "which brand does this cart actually belong to" resolution createOrderRequest uses
    // (see orders.api.ts#resolveCartBrandId) — a cross-brand combo line has no brand of its own,
    // so it's skipped when picking the representative line.
    const ownedLine = lines.find((line) => line.brandId && line.brandId !== CROSS_BRAND_ID);
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
      hasFreeDeliveryMembership: auth.hasFreeDeliveryMembership,
      isQuickDeliveryBrand: ownedLine ? isQuickDeliveryBrandId(ownedLine.brandId) : false,
      couponDiscountAmount: get().appliedCoupon?.discountAmount,
    });
  },
}));

// Persists `lines` to AsyncStorage on every change, once hydration has finished — guarded
// so the empty initial state (before hydrate() loads anything) can never overwrite what's
// actually saved on disk.
useCartStore.subscribe((state, prevState) => {
  if (!state.isHydrated || state.lines === prevState.lines) return;
  AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(state.lines)).catch(() => {});
});
