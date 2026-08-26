import { create } from "zustand";

interface SelectedAddress {
  label: string;
  city: string;
  /** Full street line (house number/area/address), for display under the label — e.g. the Cart
   * header's "Home" + full address beneath it. Optional since MenuScreen's own address bar has
   * always only shown `label · city`, before this existed. */
  line?: string;
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
