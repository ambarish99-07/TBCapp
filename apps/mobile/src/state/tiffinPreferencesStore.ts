import * as SecureStore from "expo-secure-store";
import { create } from "zustand";

const VEG_ONLY_KEY = "tbc_tiffin_veg_only";

interface TiffinPreferencesState {
  vegOnly: boolean;
  hydrate: () => Promise<void>;
  setVegOnly: (vegOnly: boolean) => void;
}

/**
 * Shared across GG Tiffin's landing page, weekly menu browser, and single-meal ordering screen —
 * flipping the "Veg Only" switch on any one of them hides non-veg everywhere else in the flow
 * too, not just wherever it was toggled. Persisted like the saved payment method, so it survives
 * app restarts.
 */
export const useTiffinPreferencesStore = create<TiffinPreferencesState>((set) => ({
  vegOnly: false,

  hydrate: async () => {
    const saved = await SecureStore.getItemAsync(VEG_ONLY_KEY);
    if (saved !== null) set({ vegOnly: saved === "true" });
  },

  setVegOnly: (vegOnly) => {
    set({ vegOnly });
    SecureStore.setItemAsync(VEG_ONLY_KEY, String(vegOnly)).catch(() => {});
  },
}));
