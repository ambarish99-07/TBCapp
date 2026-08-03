import { resolveTier } from "@tbc/pricing";
import { useAuthStore } from "./authStore.js";

/** Derives the {isLoggedIn, tier, ordersSinceReward} shape cartStore.computeTotals expects. */
export function useAuthContext() {
  const user = useAuthStore((state) => state.user);

  if (!user) {
    return { isLoggedIn: false, tier: null, ordersSinceReward: 0 };
  }

  return {
    isLoggedIn: true,
    tier: resolveTier(user.loyalty.completedOrderCount, user.loyalty.isGoldMember),
    ordersSinceReward: user.punchCard.ordersSinceReward,
  };
}
