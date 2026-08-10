import { computePricing } from "@tbc/pricing";
import type { CreateOrderRequest } from "@tbc/shared-types";
import type { Env } from "../../config/env.js";
import { OrderModel } from "../../db/models/Order.model.js";
import { UserModel } from "../../db/models/User.model.js";
import { sendNewOrderAlert } from "../../integrations/whatsapp/sendOrderAlert.js";
import { resolveCartLines } from "../pricing/priceResolver.js";
import { generateAccessToken } from "./accessToken.js";
import { assertWithinDeliveryZone } from "./deliveryZone.js";
import { advanceLoyaltyOrderCount } from "./loyaltyAdvance.js";
import { generateOrderNumber } from "./orderNumber.js";
import { OrderValidationError } from "./orders.errors.js";

export { OrderValidationError };

export async function createOrder(env: Env, request: CreateOrderRequest, userId: string | null) {
  const { resolvedLines, pricingLines } = await resolveCartLines(request.items, request.brandId);
  assertWithinDeliveryZone(request.delivery);

  const loyalty = { completedOrderCount: 0, isPremiumMemberOverride: false };
  // Snapshot the account's own identity at order time — independent of
  // `delivery`, which may belong to someone else entirely (see deliveryFor).
  let customer: { name: string; phone?: string } | undefined;

  if (userId) {
    const user = await UserModel.findById(userId);
    if (!user) throw new OrderValidationError("User not found");
    loyalty.completedOrderCount = user.loyalty.completedOrderCount;
    loyalty.isPremiumMemberOverride = user.loyalty.isPremiumMemberOverride;
    customer = { name: user.fullName, phone: user.phone ?? undefined };
  }

  const pricingResult = computePricing({
    lines: pricingLines,
    isLoggedIn: userId !== null,
    loyalty,
    distanceFromShopKm: request.delivery.distanceFromShopKm ?? null,
  });

  const order = await OrderModel.create({
    accessToken: generateAccessToken(),
    orderNumber: generateOrderNumber(),
    brandId: request.brandId,
    userId,
    customer,
    deliveryFor: request.deliveryFor,
    items: resolvedLines,
    delivery: request.delivery,
    totals: {
      subtotal: pricingResult.subtotal,
      discountAmount: pricingResult.discountAmount,
      discountReason: pricingResult.discountReason,
      rewardAmount: pricingResult.rewardAmount,
      rewardReason: pricingResult.rewardReason,
      deliveryFee: pricingResult.deliveryFee,
      tax: pricingResult.tax,
      total: pricingResult.total,
    },
    isPremiumMemberAtOrder: pricingResult.isPremiumMember,
    estimatedMinutes: 35,
    status: "received",
    statusHistory: [{ status: "received", at: new Date() }],
    payment: { method: request.paymentMethod, status: "pending" },
  });

  if (request.paymentMethod === "cod") {
    // COD orders are trusted at face value — genuinely "complete" immediately.
    if (userId) {
      await advanceLoyaltyOrderCount(userId);
    }
    sendNewOrderAlert(env, {
      orderNumber: order.orderNumber,
      total: pricingResult.total,
      customerName: customer?.name ?? request.delivery.fullName,
      recipientName: request.deliveryFor === "recipient" ? request.delivery.fullName : undefined,
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
