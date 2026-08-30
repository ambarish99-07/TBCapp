import type {
  CreateSingleMealOrderRequest,
  CreateTiffinSubscriptionRequest,
  PauseTiffinSubscriptionRequest,
  SingleMealMenuItem,
  TiffinDish,
  TiffinPlan,
  TiffinScheduledMeal,
  TiffinSingleMealOrder,
  TiffinSubscription,
} from "@tbc/shared-types";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "./client";

/** Not brand-scoped — GG Tiffin's plan catalog is entirely separate from the brandId-based menu system. */
export function useTiffinPlans() {
  return useQuery({
    queryKey: ["tiffin-plans"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ plans: TiffinPlan[] }>("/tiffin/plans");
      return data.plans;
    },
  });
}

/** The full single-meal weekly rotation — powers the menu-browsing screens (Weekly Menu, plan
 * preview) directly from the admin-editable source of truth, instead of a local hardcoded copy. */
export function useTiffinWeeklyMenu() {
  return useQuery({
    queryKey: ["tiffin-weekly-menu"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ dishes: TiffinDish[] }>("/tiffin/weekly-menu");
      return data.dishes;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useMyTiffinSubscriptions() {
  return useQuery({
    queryKey: ["tiffin-subscriptions-mine"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ subscriptions: TiffinSubscription[] }>("/tiffin/subscriptions/mine");
      return data.subscriptions;
    },
  });
}

export function useTiffinUpcomingMeals(subscriptionId: string | null) {
  return useQuery({
    queryKey: ["tiffin-meals", subscriptionId],
    queryFn: async () => {
      const { data } = await apiClient.get<{ meals: TiffinScheduledMeal[] }>(`/tiffin/subscriptions/${subscriptionId}/meals`);
      return data.meals;
    },
    enabled: !!subscriptionId,
  });
}

export async function createTiffinSubscriptionRequest(payload: CreateTiffinSubscriptionRequest): Promise<TiffinSubscription> {
  const { data } = await apiClient.post<{ subscription: TiffinSubscription }>("/tiffin/subscriptions", payload);
  return data.subscription;
}

export async function skipTiffinMealRequest(subscriptionId: string, mealId: string): Promise<TiffinScheduledMeal> {
  const { data } = await apiClient.post<{ meal: TiffinScheduledMeal }>(`/tiffin/subscriptions/${subscriptionId}/meals/${mealId}/skip`);
  return data.meal;
}

export async function unskipTiffinMealRequest(subscriptionId: string, mealId: string): Promise<TiffinScheduledMeal> {
  const { data } = await apiClient.post<{ meal: TiffinScheduledMeal }>(`/tiffin/subscriptions/${subscriptionId}/meals/${mealId}/unskip`);
  return data.meal;
}

export async function pauseTiffinSubscriptionRequest(subscriptionId: string, payload: PauseTiffinSubscriptionRequest): Promise<TiffinSubscription> {
  const { data } = await apiClient.post<{ subscription: TiffinSubscription }>(`/tiffin/subscriptions/${subscriptionId}/pause`, payload);
  return data.subscription;
}

export async function resumeTiffinSubscriptionRequest(subscriptionId: string): Promise<TiffinSubscription> {
  const { data } = await apiClient.post<{ subscription: TiffinSubscription }>(`/tiffin/subscriptions/${subscriptionId}/resume`);
  return data.subscription;
}

export async function cancelTiffinSubscriptionRequest(subscriptionId: string): Promise<TiffinSubscription> {
  const { data } = await apiClient.post<{ subscription: TiffinSubscription }>(`/tiffin/subscriptions/${subscriptionId}/cancel`);
  return data.subscription;
}

interface CreateTiffinRazorpayOrderResponse {
  razorpayOrderId: string;
  amount: number;
  currency: string;
  keyId?: string;
}

export async function createTiffinRazorpayOrderRequest(subscriptionId: string): Promise<CreateTiffinRazorpayOrderResponse> {
  const { data } = await apiClient.post<CreateTiffinRazorpayOrderResponse>(`/tiffin/subscriptions/${subscriptionId}/razorpay-order`);
  return data;
}

export async function verifyTiffinRazorpayPaymentRequest(
  subscriptionId: string,
  params: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }
): Promise<void> {
  await apiClient.post(`/tiffin/subscriptions/${subscriptionId}/razorpay-verify`, params);
}

// --- Single-meal purchase (a one-off tiffin, no subscription) ---

/** Public — same as useTiffinPlans, no auth needed just to browse tomorrow's menu. */
export function useSingleMealMenu() {
  return useQuery({
    queryKey: ["tiffin-single-meal-menu"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ menu: SingleMealMenuItem[] }>("/tiffin/single-meal/menu");
      return data.menu;
    },
  });
}

export function useMySingleMealOrders() {
  return useQuery({
    queryKey: ["tiffin-single-meal-orders-mine"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ orders: TiffinSingleMealOrder[] }>("/tiffin/single-meal/orders/mine");
      return data.orders;
    },
    // Keeps the order-tracking screen (and the app-wide "Track Order" pill) reasonably fresh
    // without the customer having to manually reload — same interval OrderStatusScreen uses.
    refetchInterval: 15000,
  });
}

export async function createSingleMealOrderRequest(payload: CreateSingleMealOrderRequest): Promise<TiffinSingleMealOrder> {
  const { data } = await apiClient.post<{ order: TiffinSingleMealOrder }>("/tiffin/single-meal/orders", payload);
  return data.order;
}

export async function cancelSingleMealOrderRequest(orderId: string): Promise<TiffinSingleMealOrder> {
  const { data } = await apiClient.post<{ order: TiffinSingleMealOrder }>(`/tiffin/single-meal/orders/${orderId}/cancel`);
  return data.order;
}

export async function createSingleMealRazorpayOrderRequest(orderId: string): Promise<CreateTiffinRazorpayOrderResponse> {
  const { data } = await apiClient.post<CreateTiffinRazorpayOrderResponse>(`/tiffin/single-meal/orders/${orderId}/razorpay-order`);
  return data;
}

export async function verifySingleMealRazorpayPaymentRequest(
  orderId: string,
  params: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }
): Promise<void> {
  await apiClient.post(`/tiffin/single-meal/orders/${orderId}/razorpay-verify`, params);
}
