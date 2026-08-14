import type { Brand } from "@tbc/shared-types";
import * as SecureStore from "expo-secure-store";
import { create } from "zustand";
import { useCartStore } from "./cartStore";

const BRAND_ID_KEY = "tbc_selected_brand_id";

interface BrandState {
  selectedBrandId: string | null;
  selectedBrand: Brand | null;
  /** Restores the id persisted from last session, if any — resolving it to the full Brand
   * object still needs `restoreBrand` once the brand list has loaded. */
  hydrate: () => Promise<void>;
  /** User explicitly switching brands — always starts a fresh cart, since a cart can only
   * ever hold one brand's lines at a time. */
  selectBrand: (brand: Brand) => void;
  /** Resolving the persisted brand id back to a full Brand object on app launch — NOT a
   * switch, so the cart (which survives restarts now) is left untouched. */
  restoreBrand: (brand: Brand) => void;
  clearBrand: () => void;
}

export const useBrandStore = create<BrandState>((set) => ({
  selectedBrandId: null,
  selectedBrand: null,

  hydrate: async () => {
    const savedId = await SecureStore.getItemAsync(BRAND_ID_KEY);
    if (savedId) set({ selectedBrandId: savedId });
  },

  selectBrand: (brand) => {
    useCartStore.getState().clear();
    set({ selectedBrandId: brand.id, selectedBrand: brand });
    SecureStore.setItemAsync(BRAND_ID_KEY, brand.id).catch(() => {});
  },

  restoreBrand: (brand) => set({ selectedBrandId: brand.id, selectedBrand: brand }),

  clearBrand: () => set({ selectedBrandId: null, selectedBrand: null }),
}));
