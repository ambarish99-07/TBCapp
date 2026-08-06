import { UserModel } from "../../db/models/User.model.js";

/**
 * Advances completedOrderCount on a GENUINELY completed order only — callers
 * must invoke this immediately for COD (trusted at face value) and only after
 * Razorpay signature verification succeeds for online payment, never at
 * order-creation time for the latter. completedOrderCount alone drives the
 * quantity-tier/premium/milestone-reward logic in @tbc/pricing — no separate
 * "since last reward" counter to reset, since those rewards are now derived
 * purely from the customer's absolute order position (6th, 10th, 16th, ...).
 */
export async function advanceLoyaltyOrderCount(userId: string): Promise<void> {
  await UserModel.findByIdAndUpdate(userId, { $inc: { "loyalty.completedOrderCount": 1 } });
}
