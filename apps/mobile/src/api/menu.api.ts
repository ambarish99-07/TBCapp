import type { BrowseCategorySummary, Combo, MenuItem } from "@tbc/shared-types";
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

/** The fixed circular-tile taxonomy for the "search all brands" page — one row per category, real photo included. */
export function useBrowseCategories() {
  return useQuery({
    queryKey: ["browse-categories"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ categories: BrowseCategorySummary[] }>("/menu/browse-categories");
      return data.categories;
    },
  });
}

/** Cross-brand item search — unlike useMenuItems, NOT scoped to the currently selected brand. */
export function useMenuSearch(params: { q?: string; category?: string }) {
  const q = params.q?.trim() ?? "";
  const category = params.category ?? "";
  return useQuery({
    queryKey: ["menu-search", q, category],
    queryFn: async () => {
      const { data } = await apiClient.get<{ items: MenuItem[] }>("/menu/search", {
        params: { q: q || undefined, category: category || undefined },
      });
      return data.items;
    },
    enabled: q.length > 0 || category.length > 0,
  });
}
