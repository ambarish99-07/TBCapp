import { PUNCH_CARD_DISCOUNT_PCT, PUNCH_CARD_THRESHOLD } from "./constants.js";
import { round } from "./rounding.js";
import type { CartLineInput, PunchCardState } from "./types.js";

/**
 * "Order 5, get 50% off your 6th" — logged-in users only. Applies to a single unit
 * of the cheapest non-combo line, never the whole line if quantity > 1, and never
 * to combo lines. Repeats every 5 orders since the caller resets ordersSinceReward
 * to 0 the moment this fires (that reset happens outside this pure function, in
 * the order-completion flow).
 */
export function computePunchCardDiscount(
  lines: CartLineInput[],
  isLoggedIn: boolean,
  punchCard: PunchCardState
): number {
  if (!isLoggedIn) return 0;
  if (punchCard.ordersSinceReward < PUNCH_CARD_THRESHOLD) return 0;

  const eligibleLines = lines.filter((line) => !line.isCombo);
  if (eligibleLines.length === 0) return 0;

  const cheapestUnitPrice = Math.min(...eligibleLines.map((line) => line.unitPrice));
  return round(PUNCH_CARD_DISCOUNT_PCT * cheapestUnitPrice);
}
