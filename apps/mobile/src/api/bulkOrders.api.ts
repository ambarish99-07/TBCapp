import type { BulkOrderInquiry, CreateBulkOrderInquiryRequest } from "@tbc/shared-types";
import { apiClient } from "./client";

export async function submitBulkOrderInquiry(payload: CreateBulkOrderInquiryRequest): Promise<BulkOrderInquiry> {
  const { data } = await apiClient.post<{ inquiry: BulkOrderInquiry }>("/bulk-order-inquiries", payload);
  return data.inquiry;
}
