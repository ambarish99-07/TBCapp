import type {
  CreateTiffinSubscriptionRequest,
  PauseTiffinSubscriptionRequest,
  TiffinPlan,
  TiffinScheduledMeal,
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

export async function pauseTiffinSubscriptionRequest(subscriptionId: string, payload: PauseTiffinSubscriptionRequest): Promise<TiffinSubscription> {
  const { data } = await apiClient.post<{ subscription: TiffinSubscription }>(`/tiffin/subscriptions/${subscriptionId}/pause`, payload);
  return data.subscription;
}

export async function resumeTiffinSubscriptionRequest(subscriptionId: string): Promise<TiffinSubscription> {
  const { data } = await apiClient.post<{ subscription: TiffinSubscription }>(`/tiffin/subscriptions/${subscriptionId}/resume`);
  return data.subscription;
}
