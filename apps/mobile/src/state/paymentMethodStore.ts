import * as SecureStore from "expo-secure-store";
import { create } from "zustand";
import { PAYMENT_OPTION_GROUPS, type PaymentOption } from "../constants/paymentOptions";

const PAYMENT_METHOD_KEY = "tbc_payment_method_id";

function findOption(id: string): PaymentOption | null {
  for (const group of PAYMENT_OPTION_GROUPS) {
    const found = group.options.find((option) => option.id === id);
    if (found) return found;
  }
  return null;
}

interface PaymentMethodState {
  selected: PaymentOption | null;
  hydrate: () => Promise<void>;
  select: (option: PaymentOption) => Promise<void>;
}

/**
 * Persisted like the saved address (SecureStore, same pattern as themeStore) — once a
 * customer picks a payment method, it stays selected for every future order until they
 * explicitly change it, rather than resetting after each checkout or app restart.
 */
export const usePaymentMethodStore = create<PaymentMethodState>((set) => ({
  selected: null,

  hydrate: async () => {
    const savedId = await SecureStore.getItemAsync(PAYMENT_METHOD_KEY);
    set({ selected: savedId ? findOption(savedId) : null });
  },

  select: async (option) => {
    // Update in-memory state first so the Cart screen reflects the choice immediately —
    // the SecureStore write persists it in the background rather than blocking the UI.
    set({ selected: option });
    await SecureStore.setItemAsync(PAYMENT_METHOD_KEY, option.id);
  },
}));
