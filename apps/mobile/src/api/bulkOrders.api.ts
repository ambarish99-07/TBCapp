import type { BulkOrderInquiry, CreateBulkOrderInquiryRequest } from "@tbc/shared-types";
import { apiClient } from "./client";
import { useBrandStore } from "../state/brandStore";

export async function submitBulkOrderInquiry(
  payload: Omit<CreateBulkOrderInquiryRequest, "brandId">
): Promise<BulkOrderInquiry> {
  const brandId = useBrandStore.getState().selectedBrandId;
  const { data } = await apiClient.post<{ inquiry: BulkOrderInquiry }>("/bulk-order-inquiries", { ...payload, brandId });
  return data.inquiry;
}
