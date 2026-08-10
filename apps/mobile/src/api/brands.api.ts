import type { Brand } from "@tbc/shared-types";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "./client";

export function useBrands() {
  return useQuery({
    queryKey: ["brands"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ brands: Brand[] }>("/brands");
      return data.brands;
    },
  });
}
