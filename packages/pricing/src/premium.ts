import { PREMIUM_ORDER_THRESHOLD } from "./constants.js";
import type { LoyaltyState } from "./types.js";

/**
 * Premium unlocks after PREMIUM_ORDER_THRESHOLD completed orders, or via an
 * admin-set override (e.g. for manually comped VIP customers) — mirrors how
 * the old isGoldMember override worked.
 */
export function resolveIsPremiumMember(loyalty: LoyaltyState): boolean {
  return loyalty.isPremiumMemberOverride || loyalty.completedOrderCount >= PREMIUM_ORDER_THRESHOLD;
}
