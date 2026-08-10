import { create } from "zustand";

interface SelectedAddress {
  label: string;
  city: string;
}

interface AddressState {
  selectedAddress: SelectedAddress | null;
  setSelectedAddress: (address: SelectedAddress) => void;
}

/**
 * Purely a display convenience for the Menu header's "Delivering to" bar — the customer's
 * actual delivery address for an order is still entered/confirmed at Checkout, which this
 * does not prefill. Session-only, same as brandStore/cartStore.
 */
export const useAddressStore = create<AddressState>((set) => ({
  selectedAddress: null,
  setSelectedAddress: (address) => set({ selectedAddress: address }),
}));
