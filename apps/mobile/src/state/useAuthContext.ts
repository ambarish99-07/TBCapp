import { useAuthStore } from "./authStore";

/** Derives the {isLoggedIn, loyalty} shape cartStore.computeTotals expects. */
export function useAuthContext() {
  const user = useAuthStore((state) => state.user);

  if (!user) {
    return { isLoggedIn: false, loyalty: { completedOrderCount: 0, isPremiumMemberOverride: false } };
  }

  return {
    isLoggedIn: true,
    loyalty: {
      completedOrderCount: user.loyalty.completedOrderCount,
      isPremiumMemberOverride: user.loyalty.isPremiumMemberOverride,
    },
  };
}
