import type { Brand } from "@tbc/shared-types";
import { create } from "zustand";
import { useCartStore } from "./cartStore";

interface BrandState {
  selectedBrandId: string | null;
  selectedBrand: Brand | null;
  /** Entering a brand always starts a fresh cart — a cart can only ever hold one brand's lines at a time. */
  selectBrand: (brand: Brand) => void;
  clearBrand: () => void;
}

export const useBrandStore = create<BrandState>((set) => ({
  selectedBrandId: null,
  selectedBrand: null,

  selectBrand: (brand) => {
    useCartStore.getState().clear();
    set({ selectedBrandId: brand.id, selectedBrand: brand });
  },

  clearBrand: () => set({ selectedBrandId: null, selectedBrand: null }),
}));
