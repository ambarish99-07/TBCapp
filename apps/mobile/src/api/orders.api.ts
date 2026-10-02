import type { CreateOrderRequest, Order } from "@tbc/shared-types";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "./client";

/** One order can mix kitchens — no brandId is sent; the server derives every line's kitchen. */
export async function createOrderRequest(payload: Omit<CreateOrderRequest, "brandId">): Promise<Order> {
  const { data } = await apiClient.post<{ order: Order }>("/orders", payload);
  return data.order;
}

export async function fetchOrderByAccessToken(accessToken: string): Promise<Order> {
  const { data } = await apiClient.get<{ order: Order }>(`/orders/guest/${accessToken}`);
  return data.order;
}

export async function fetchOrderById(id: string): Promise<Order> {
  const { data } = await apiClient.get<{ order: Order }>(`/orders/${id}`);
  return data.order;
}

export async function fetchMyOrders(): Promise<Order[]> {
  const { data } = await apiClient.get<{ orders: Order[] }>("/orders/mine");
  return data.orders;
}

/** Same queryKey OrderHistoryScreen already uses, so both share one cache entry — this hook just
 * adds polling, for the app-wide "View Order Status" pill to stay reasonably fresh. */
export function useMyOrders() {
  return useQuery({ queryKey: ["my-orders"], queryFn: fetchMyOrders, refetchInterval: 15000 });
}

export async function cancelOrderRequest(accessToken: string, reason?: string): Promise<Order> {
  const { data } = await apiClient.post<{ order: Order }>(`/orders/guest/${accessToken}/cancel`, { reason });
  return data.order;
}
