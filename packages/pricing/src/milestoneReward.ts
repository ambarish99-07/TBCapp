import {
  REWARD_CYCLE_LENGTH,
  SIXTH_ORDER_CYCLE_POSITION,
  SIXTH_ORDER_REWARD_PCT,
  TENTH_ORDER_CYCLE_POSITION,
} from "./constants.js";
import { round } from "./rounding.js";
import type { CartLineInput } from "./types.js";

export interface MilestoneReward {
  amount: number;
  reason: "none" | "sixth-order-cold-coffee" | "tenth-order-free-drink";
}

const NO_REWARD: MilestoneReward = { amount: 0, reason: "none" };

function cheapestUnitPrice(lines: CartLineInput[]): number | null {
  if (lines.length === 0) return null;
  return Math.min(...lines.map((line) => line.unitPrice));
}

/**
 * Repeating milestone rewards, registered users only: every 6th/16th/26th...
 * order gets 50% off the cheapest cold-coffee unit in the cart (only if one is
 * present); every 10th/20th/30th... order gets the cheapest eligible drink unit
 * entirely free. Combo lines never qualify for either. The two cycles never
 * collide (6 mod 10 = 6, never 0), so at most one reward applies per order.
 */
export function computeMilestoneReward(
  lines: CartLineInput[],
  isLoggedIn: boolean,
  completedOrderCount: number
): MilestoneReward {
  if (!isLoggedIn) return NO_REWARD;

  const thisOrderNumber = completedOrderCount + 1;
  const cyclePosition = thisOrderNumber % REWARD_CYCLE_LENGTH;

  if (cyclePosition === SIXTH_ORDER_CYCLE_POSITION) {
    const coldCoffeeLines = lines.filter((line) => !line.isCombo && line.category === "cold-coffee");
    const cheapest = cheapestUnitPrice(coldCoffeeLines);
    if (cheapest === null) return NO_REWARD;
    return { amount: round(SIXTH_ORDER_REWARD_PCT * cheapest), reason: "sixth-order-cold-coffee" };
  }

  if (cyclePosition === TENTH_ORDER_CYCLE_POSITION) {
    const eligibleLines = lines.filter((line) => !line.isCombo);
    const cheapest = cheapestUnitPrice(eligibleLines);
    if (cheapest === null) return NO_REWARD;
    return { amount: cheapest, reason: "tenth-order-free-drink" };
  }

  return NO_REWARD;
}
