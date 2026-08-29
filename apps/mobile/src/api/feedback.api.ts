import type { Feedback, SubmitFeedbackRequest } from "@tbc/shared-types";
import { apiClient } from "./client";

export async function fetchFeedbackForOrder(orderId: string): Promise<Feedback | null> {
  const { data } = await apiClient.get<{ feedback: Feedback | null }>(`/orders/${orderId}/feedback`);
  return data.feedback;
}

export async function submitFeedbackRequest(orderId: string, payload: SubmitFeedbackRequest): Promise<Feedback> {
  const { data } = await apiClient.post<{ feedback: Feedback }>(`/orders/${orderId}/feedback`, payload);
  return data.feedback;
}
