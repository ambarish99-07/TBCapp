import { computePricing, resolveTier, type LoyaltyTier } from "@tbc/pricing";
import type { CreateOrderRequest } from "@tbc/shared-types";
import type { Env } from "../../config/env.js";
import { OrderModel } from "../../db/models/Order.model.js";
import { UserModel } from "../../db/models/User.model.js";
import { sendNewOrderAlert } from "../../integrations/whatsapp/sendOrderAlert.js";
import { resolveCartLines } from "../pricing/priceResolver.js";
import { generateAccessToken } from "./accessToken.js";
import { advanceLoyaltyAndPunchCard } from "./loyaltyAdvance.js";
import { generateOrderNumber } from "./orderNumber.js";

export class OrderValidationError extends Error {}

export async function createOrder(env: Env, request: CreateOrderRequest, userId: string | null) {
  const { resolvedLines, pricingLines } = await resolveCartLines(request.items);

  let tier: LoyaltyTier = null;
  let punchCard = { ordersSinceReward: 0 };

  if (userId) {
    const user = await UserModel.findById(userId);
    if (!user) throw new OrderValidationError("User not found");
    tier = resolveTier(user.loyalty.completedOrderCount, user.loyalty.isGoldMember);
    punchCard = { ordersSinceReward: user.punchCard.ordersSinceReward };
  }

  const pricingResult = computePricing({
    lines: pricingLines,
    isLoggedIn: userId !== null,
    tier,
    punchCard,
  });

  const order = await OrderModel.create({
    accessToken: generateAccessToken(),
    orderNumber: generateOrderNumber(),
    userId,
    items: resolvedLines,
    delivery: request.delivery,
    totals: {
      subtotal: pricingResult.subtotal,
      punchCardDiscount: pricingResult.punchCardDiscount,
      websiteDiscount: pricingResult.websiteDiscountAmount,
      loyaltyDiscount: pricingResult.loyaltyDiscountAmount,
      deliveryFee: pricingResult.deliveryFee,
      tax: pricingResult.tax,
      total: pricingResult.total,
    },
    loyaltyTierAtOrder: tier,
    estimatedMinutes: 35,
    status: "received",
    statusHistory: [{ status: "received", at: new Date() }],
    payment: { method: request.paymentMethod, status: "pending" },
  });

  if (request.paymentMethod === "cod") {
    // COD orders are trusted at face value — genuinely "complete" immediately.
    if (userId) {
      const punchCardRewardUsed = pricingResult.punchCardDiscount > 0;
      await advanceLoyaltyAndPunchCard(userId, { punchCardRewardUsed });
    }
    sendNewOrderAlert(env, {
      orderNumber: order.orderNumber,
      total: pricingResult.total,
      customerName: request.delivery.fullName,
    }).catch((err) => console.error("[orders] new-order alert threw unexpectedly:", err));
  }
  // razorpay orders: loyalty advance + WA alert happen only in
  // modules/payments/verifySignature.ts, after signature verification succeeds.

  return order;
}

export function findOrderByAccessToken(accessToken: string) {
  return OrderModel.findOne({ accessToken });
}

export function findOrderById(id: string) {
  return OrderModel.findById(id);
}

export function listOrdersForUser(userId: string) {
  return OrderModel.find({ userId }).sort({ createdAt: -1 });
}
