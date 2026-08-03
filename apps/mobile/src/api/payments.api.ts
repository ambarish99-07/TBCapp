import { apiClient } from "./client.js";

interface CreateRazorpayOrderResponse {
  razorpayOrderId: string;
  amount: number;
  currency: string;
  keyId?: string;
}

export async function createRazorpayOrderRequest(orderId: string, accessToken: string): Promise<CreateRazorpayOrderResponse> {
  const { data } = await apiClient.post<CreateRazorpayOrderResponse>("/payments/razorpay/order", {
    orderId,
    accessToken,
  });
  return data;
}

export async function verifyRazorpayPaymentRequest(params: {
  orderId: string;
  accessToken: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}): Promise<void> {
  await apiClient.post("/payments/razorpay/verify", params);
}
