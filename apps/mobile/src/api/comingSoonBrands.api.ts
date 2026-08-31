import type { Brand } from "@tbc/shared-types";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "./client";

/** Every brand the admin has created but not opened for ordering yet — powers Home's "Coming
 * Soon" teaser card. Separate from useBrands() (which only ever returns "live" brands, feeding
 * the interactive carousel/menu everywhere else), so a coming-soon brand never accidentally
 * becomes orderable just by showing up in the wrong list. */
export function useComingSoonBrands() {
  return useQuery({
    queryKey: ["brands-coming-soon"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ brands: Brand[] }>("/brands/coming-soon");
      return data.brands;
    },
  });
}
