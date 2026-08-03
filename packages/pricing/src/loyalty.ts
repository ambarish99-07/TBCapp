import { LOYALTY_PERCENT_BY_TIER } from "./constants.js";
import type { LoyaltyTier } from "./types.js";

export function loyaltyPercent(tier: LoyaltyTier): number {
  if (tier === null) return 0;
  return LOYALTY_PERCENT_BY_TIER[tier];
}

/**
 * Registered users only — guests never have a tier. `isGoldMember` overrides the
 * order-count-derived tier so a manually-flagged gold member stays gold even if
 * their count would otherwise put them at "returning".
 */
export function resolveTier(completedOrderCount: number, isGoldMember: boolean): LoyaltyTier {
  if (isGoldMember || completedOrderCount >= 5) return "gold";
  if (completedOrderCount >= 1) return "returning";
  return "first-order";
}
