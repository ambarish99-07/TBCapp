import type { BrandStoreStatus } from "@tbc/shared-types";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "./client";

const POLL_INTERVAL_MS = 30000;

async function fetchBrandStoreStatus(brandId: string): Promise<BrandStoreStatus> {
  const { data } = await apiClient.get<BrandStoreStatus>(`/brands/${brandId}/status`);
  return data;
}

/**
 * Whether ordering is open right now for one specific catalog brand — powers the Home screen's
 * closed banner (for whichever brand is currently selected) and the Cart screen's checkout guard
 * (for the cart's own brand). Already factors in the Lickyeat-wide switch (an absolute override)
 * as well as this brand's own switch/hours/planned closures — a single call covers both levels.
 * Polled (not just fetched once) so a customer already on the app sees it change live if an admin
 * flips a switch or a scheduled window opens/closes while they're browsing. No auth needed — same
 * public endpoint either way. Doesn't cover GG Tiffin, which has its own separate ordering
 * cutoffs — pass `undefined` (disabling the query) whenever brandId is "gg-tiffin" or unknown.
 */
export function useStoreStatus(brandId: string | undefined) {
  return useQuery({
    queryKey: ["brand-store-status", brandId],
    queryFn: () => fetchBrandStoreStatus(brandId!),
    enabled: !!brandId,
    refetchInterval: POLL_INTERVAL_MS,
  });
}
