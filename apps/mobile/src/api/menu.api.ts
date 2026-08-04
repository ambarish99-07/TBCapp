import type { CuratedCombo, ChooseNCombo, MenuItem } from "@tbc/shared-types";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "./client";

export function useMenuItems() {
  return useQuery({
    queryKey: ["menu-items"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ items: MenuItem[] }>("/menu");
      return data.items;
    },
  });
}

export function useCombos() {
  return useQuery({
    queryKey: ["combos"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ combos: (CuratedCombo | ChooseNCombo)[] }>("/menu/combos");
      return data.combos;
    },
  });
}
