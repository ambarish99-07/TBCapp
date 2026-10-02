import type { Coupon, ValidateCouponRequest, ValidateCouponResponse } from "@tbc/shared-types";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "./client";

/** Every currently-usable coupon for these kitchens (a cart can mix kitchens) — powers the Cart
 * screen's "Apply Coupon" browse page. Disabled with no kitchens rather than erroring, since there
 * isn't always one resolved yet (e.g. an empty cart). */
export function useActiveCoupons(brandIds: string[]) {
  const key = brandIds.join(",");
  return useQuery({
    queryKey: ["active-coupons", key],
    queryFn: async () => {
      const { data } = await apiClient.get<{ coupons: Coupon[] }>("/coupons/active", { params: { brandIds: key } });
      return data.coupons;
    },
    enabled: brandIds.length > 0,
  });
}

/** Every currently-usable coupon across every brand at once, regardless of cart/order amount —
 * powers the Account screen's "Coupons" browse page, which has no single cart to scope to the
 * way the Cart screen's useActiveCoupons(brandIds) does. Same endpoint, just called with no
 * brandId param (the server returns everything instead of one brand's coupons — see
 * coupons.service.ts's listActiveCoupons). */
export function useAllActiveCoupons() {
  return useQuery({
    queryKey: ["active-coupons", "all"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ coupons: Coupon[] }>("/coupons/active");
      return data.coupons;
    },
  });
}

// The server's own message ("Add ₹50 more to use this coupon", "This coupon has expired", etc.)
// ends up as the thrown error's `.message` automatically — see apiClient's response interceptor.
export async function validateCouponRequest(payload: ValidateCouponRequest): Promise<ValidateCouponResponse> {
  const { data } = await apiClient.post<ValidateCouponResponse>("/coupons/validate", payload);
  return data;
}
