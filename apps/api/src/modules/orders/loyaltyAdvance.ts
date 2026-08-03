import { UserModel } from "../../db/models/User.model.js";

/**
 * Advances loyalty/punch-card counters on a GENUINELY completed order only —
 * callers must invoke this immediately for COD (trusted at face value) and only
 * after Razorpay signature verification succeeds for online payment, never at
 * order-creation time for the latter. A single aggregation-pipeline update keeps
 * the increment/reset atomic against concurrent orders from the same user.
 */
export async function advanceLoyaltyAndPunchCard(
  userId: string,
  { punchCardRewardUsed }: { punchCardRewardUsed: boolean }
): Promise<void> {
  await UserModel.findByIdAndUpdate(userId, [
    {
      $set: {
        "loyalty.completedOrderCount": { $add: ["$loyalty.completedOrderCount", 1] },
        "punchCard.ordersSinceReward": punchCardRewardUsed
          ? 0
          : { $add: ["$punchCard.ordersSinceReward", 1] },
      },
    },
  ]);
}
