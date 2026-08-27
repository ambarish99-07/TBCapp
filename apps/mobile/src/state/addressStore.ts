import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

const ADDRESS_STORAGE_KEY = "tbc_selected_address";

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
  isHydrated: boolean;
  hydrate: () => Promise<void>;
  setSelectedAddress: (address: SelectedAddress | null) => void;
}

/**
 * Display convenience for the Menu header's "Delivering to" bar and the Cart header's address
 * button — persisted (same AsyncStorage pattern as cartStore.lines) so whichever address was
 * last picked keeps showing on return visits instead of resetting to blank every app restart.
 * The customer's actual delivery address for an order still ultimately lives on the account
 * itself (User.address/city/pincode, via PATCH /auth/me) — CartAddressButton keeps that in sync
 * whenever a selection here changes, so this and the account never drift apart.
 */
export const useAddressStore = create<AddressState>((set) => ({
  selectedAddress: null,
  isHydrated: false,

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(ADDRESS_STORAGE_KEY);
      if (raw) set({ selectedAddress: JSON.parse(raw) as SelectedAddress });
    } catch {
      // Corrupt/unreadable storage — start with no selection rather than crashing.
    } finally {
      set({ isHydrated: true });
    }
  },

  setSelectedAddress: (address) => set({ selectedAddress: address }),
}));

useAddressStore.subscribe((state, prevState) => {
  if (!state.isHydrated || state.selectedAddress === prevState.selectedAddress) return;
  AsyncStorage.setItem(ADDRESS_STORAGE_KEY, JSON.stringify(state.selectedAddress)).catch(() => {});
});
