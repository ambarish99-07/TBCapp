import type { User } from "@tbc/shared-types";
import * as SecureStore from "expo-secure-store";
import { create } from "zustand";
import { fetchMe } from "../api/auth.api";

const TOKEN_KEY = "tbc_auth_token";

interface AuthState {
  token: string | null;
  user: User | null;
  /** True until the persisted token (if any) has been checked and the profile re-fetched. */
  isHydrating: boolean;
  hydrate: () => Promise<void>;
  setSession: (token: string, user: User) => Promise<void>;
  updateUser: (user: User) => void;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  isHydrating: true,

  hydrate: async () => {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    if (!token) {
      set({ isHydrating: false });
      return;
    }

    set({ token });
    try {
      const user = await fetchMe();
      set({ user, isHydrating: false });
    } catch {
      // Token is invalid/expired — fall back to the logged-out state rather
      // than leaving the app stuck believing it has a session with no user.
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      set({ token: null, user: null, isHydrating: false });
    }
  },

  setSession: async (token, user) => {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    set({ token, user, isHydrating: false });
  },

  updateUser: (user) => set({ user }),

  logout: async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    set({ token: null, user: null });
  },
}));
