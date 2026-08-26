import type { Coupon, ValidateCouponRequest, ValidateCouponResponse } from "@tbc/shared-types";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { apiClient } from "./client";

/** Every currently-usable coupon for this brand — powers the Cart screen's "Apply Coupon" browse
 * page. Disabled with no brandId rather than erroring, since a brand isn't always resolved yet
 * (e.g. an empty cart). */
export function useActiveCoupons(brandId: string | undefined) {
  return useQuery({
    queryKey: ["active-coupons", brandId],
    queryFn: async () => {
      const { data } = await apiClient.get<{ coupons: Coupon[] }>("/coupons/active", { params: { brandId } });
      return data.coupons;
    },
    enabled: !!brandId,
  });
}

/** Thrown with the server's own message ("Add ₹50 more to use this coupon", "This coupon has
 * expired", etc.) — the generic axios error message ("Request failed with status code 400")
 * would otherwise be the only thing surfaced to the customer. */
export async function validateCouponRequest(payload: ValidateCouponRequest): Promise<ValidateCouponResponse> {
  try {
    const { data } = await apiClient.post<ValidateCouponResponse>("/coupons/validate", payload);
    return data;
  } catch (err) {
    if (axios.isAxiosError(err) && typeof err.response?.data?.error === "string") {
      throw new Error(err.response.data.error);
    }
    throw err;
  }
}
