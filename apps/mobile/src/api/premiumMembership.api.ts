import type { PaymentMethod, PremiumMembershipPurchase, PremiumMembershipStatus, User } from "@tbc/shared-types";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "./client";

export function usePremiumMembershipStatus(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ["premium-membership-status"],
    queryFn: async () => {
      const { data } = await apiClient.get<PremiumMembershipStatus>("/premium-membership/status");
      return data;
    },
    enabled: options.enabled ?? true,
  });
}

export async function purchasePremiumMembershipRequest(paymentMethod: PaymentMethod): Promise<{ purchase: PremiumMembershipPurchase; user: User }> {
  const { data } = await apiClient.post<{ purchase: PremiumMembershipPurchase; user: User }>("/premium-membership/purchase", { paymentMethod });
  return data;
}

interface CreateMembershipRazorpayOrderResponse {
  razorpayOrderId: string;
  amount: number;
  currency: string;
  keyId?: string;
}

export async function createMembershipRazorpayOrderRequest(purchaseId: string): Promise<CreateMembershipRazorpayOrderResponse> {
  const { data } = await apiClient.post<CreateMembershipRazorpayOrderResponse>(`/premium-membership/purchases/${purchaseId}/razorpay-order`);
  return data;
}

export async function verifyMembershipRazorpayPaymentRequest(
  purchaseId: string,
  params: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }
): Promise<{ purchase: PremiumMembershipPurchase; user: User }> {
  const { data } = await apiClient.post<{ purchase: PremiumMembershipPurchase; user: User }>(
    `/premium-membership/purchases/${purchaseId}/razorpay-verify`,
    params
  );
  return data;
}
