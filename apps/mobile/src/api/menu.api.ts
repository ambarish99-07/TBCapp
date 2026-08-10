import type { Combo, MenuItem } from "@tbc/shared-types";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "./client";
import { useBrandStore } from "../state/brandStore";

export function useMenuItems() {
  const brandId = useBrandStore((state) => state.selectedBrandId);
  return useQuery({
    // brandId in the key so switching brands can never serve a stale, wrong-brand cache.
    queryKey: ["menu-items", brandId],
    queryFn: async () => {
      const { data } = await apiClient.get<{ items: MenuItem[] }>("/menu");
      return data.items;
    },
    enabled: !!brandId,
  });
}

export function useCombos() {
  const brandId = useBrandStore((state) => state.selectedBrandId);
  return useQuery({
    queryKey: ["combos", brandId],
    queryFn: async () => {
      const { data } = await apiClient.get<{ combos: Combo[] }>("/menu/combos");
      return data.combos;
    },
    enabled: !!brandId,
  });
}
