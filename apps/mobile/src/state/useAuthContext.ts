import { useAuthStore } from "./authStore";

/** Derives the {isLoggedIn, loyalty, hasFreeDeliveryMembership} shape cartStore.computeTotals expects. */
export function useAuthContext() {
  const user = useAuthStore((state) => state.user);

  if (!user) {
    return { isLoggedIn: false, loyalty: { completedOrderCount: 0, isPremiumMemberOverride: false }, hasFreeDeliveryMembership: false };
  }

  return {
    isLoggedIn: true,
    loyalty: {
      completedOrderCount: user.loyalty.completedOrderCount,
      isPremiumMemberOverride: user.loyalty.isPremiumMemberOverride,
    },
    // A purchased Premium Membership — independent of the loyalty tier above.
    hasFreeDeliveryMembership: !!user.premiumMembershipExpiresAt && new Date(user.premiumMembershipExpiresAt) > new Date(),
  };
}
