import { CROSS_BRAND_ID, type CreateOrderRequest, type Order } from "@tbc/shared-types";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "./client";
import { useBrandStore } from "../state/brandStore";
import { useCartStore } from "../state/cartStore";

/**
 * Which brand this order belongs to — always derived from what's actually IN the cart, never
 * from whichever brand happens to be ambiently "selected" right now. Those can disagree: the
 * Home carousel auto-rotates `selectedBrandId` in the background (deliberately, without
 * clearing the cart), so a customer who added items under one brand and then let the carousel
 * rotate away — or just browsed another brand's menu without adding anything — would otherwise
 * have their order submitted under the wrong brandId and fail server-side price resolution
 * (the item genuinely doesn't exist under that brand). The one cross-brand combo has no brand of
 * its own, so it's skipped when picking the representative line; `selectedBrandId` is only a
 * fallback for the (should-be-impossible, given selectBrand clears the cart on a deliberate
 * switch) case of an empty or all-cross-brand cart.
 */
function resolveCartBrandId(): string {
  const ownedLine = useCartStore.getState().lines.find((line) => line.brandId && line.brandId !== CROSS_BRAND_ID);
  const brandId = ownedLine?.brandId ?? useBrandStore.getState().selectedBrandId;
  if (!brandId) throw new Error("Can't place an order with no brand context — the cart is empty and no brand is selected.");
  return brandId;
}

export async function createOrderRequest(payload: Omit<CreateOrderRequest, "brandId">): Promise<Order> {
  const brandId = resolveCartBrandId();
  const { data } = await apiClient.post<{ order: Order }>("/orders", { ...payload, brandId });
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
