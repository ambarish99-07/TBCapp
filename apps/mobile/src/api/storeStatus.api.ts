import type { StoreStatus } from "@tbc/shared-types";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "./client";

const POLL_INTERVAL_MS = 30000;

async function fetchStoreStatus(): Promise<StoreStatus> {
  const { data } = await apiClient.get<StoreStatus>("/store/status");
  return data;
}

/**
 * Whether catalog-brand ordering (TBC, TAT, any future brand) is open right now — powers the Home
 * screen's closed banner and the Cart screen's checkout guard. Polled (not just fetched once) so
 * a customer already on the app sees it change live if an admin flips the switch or a scheduled
 * window opens/closes while they're browsing. No auth needed — same public endpoint either way.
 * Doesn't cover GG Tiffin, which has its own separate ordering cutoffs.
 */
export function useStoreStatus() {
  return useQuery({
    queryKey: ["store-status"],
    queryFn: fetchStoreStatus,
    refetchInterval: POLL_INTERVAL_MS,
  });
}
