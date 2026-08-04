import type { CreateOrderRequest, Order } from "@tbc/shared-types";
import { apiClient } from "./client";

export async function createOrderRequest(payload: CreateOrderRequest): Promise<Order> {
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
