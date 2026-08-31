import type { TiffinClosure } from "@tbc/shared-types";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "./client";

const POLL_INTERVAL_MS = 60000;

async function fetchUpcomingClosures(): Promise<TiffinClosure[]> {
  const { data } = await apiClient.get<{ closures: TiffinClosure[] }>("/tiffin/closures/upcoming");
  return data.closures;
}

/** Any admin-declared GG Tiffin emergency closure that's still upcoming or ongoing — powers the
 * closed banner on GG Tiffin's own screens. Entirely separate from useStoreStatus (the TBC/TAT
 * switch); GG Tiffin never reads that one, and vice versa. */
export function useUpcomingTiffinClosures() {
  return useQuery({
    queryKey: ["tiffin-closures-upcoming"],
    queryFn: fetchUpcomingClosures,
    refetchInterval: POLL_INTERVAL_MS,
  });
}
