import { computePricing } from "@tbc/pricing";
import {
  isQuickDeliveryBrandId,
  ORDER_CANCELLATION_DELIVERED_REFUND_PERCENT,
  ORDER_CANCELLATION_DISPATCHED_REFUND_PERCENT,
  type CreateOrderRequest,
} from "@tbc/shared-types";
import type { Env } from "../../config/env.js";
import { OrderModel } from "../../db/models/Order.model.js";
import { UserModel } from "../../db/models/User.model.js";
import { sendNewOrderAlert } from "../../integrations/whatsapp/sendOrderAlert.js";
import { resolveCartLines } from "../pricing/priceResolver.js";
import { generateAccessToken } from "./accessToken.js";
import { assertWithinDeliveryZone } from "./deliveryZone.js";
import { estimateDeliveryMinutes } from "./estimateDeliveryTime.js";
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
  // Independent of `loyalty` above — a purchased Premium Membership (see modules/premiumMembership),
  // not the earned 15-order tier. Only ever waives the delivery fee, never the loyalty discount.
  let hasFreeDeliveryMembership = false;

  if (userId) {
    const user = await UserModel.findById(userId);
    if (!user) throw new OrderValidationError("User not found");
    loyalty.completedOrderCount = user.loyalty.completedOrderCount;
    loyalty.isPremiumMemberOverride = user.loyalty.isPremiumMemberOverride;
    customer = { name: user.fullName, phone: user.phone ?? undefined };
    hasFreeDeliveryMembership = !!user.premiumMembershipExpiresAt && user.premiumMembershipExpiresAt > new Date();
  }

  const pricingResult = computePricing({
    lines: pricingLines,
    isLoggedIn: userId !== null,
    loyalty,
    distanceFromShopKm: request.delivery.distanceFromShopKm ?? null,
    hasFreeDeliveryMembership,
    // The first/second-order new-customer offer only ever applies to TBC/Alchemy Tails — GG
    // Tiffin doesn't use this endpoint at all today, but this keeps that exclusion explicit and
    // enforced here rather than relying on that being true forever by accident.
    isQuickDeliveryBrand: isQuickDeliveryBrandId(request.brandId),
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
    estimatedMinutes: estimateDeliveryMinutes(
      resolvedLines.reduce((sum, line) => sum + line.quantity, 0),
      request.delivery.distanceFromShopKm ?? null
    ),
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

/**
 * Three-tier cancellation refund keyed off the order's status at the moment it's cancelled — see
 * ORDER_CANCELLATION_DISPATCHED_REFUND_PERCENT/ORDER_CANCELLATION_DELIVERED_REFUND_PERCENT for the
 * exact tiers. Works via accessToken rather than a userId+auth check, same trust model
 * getOrderByAccessToken already uses — the token itself is the capability, for guest and
 * logged-in orders alike. Nothing is charged back through Razorpay here — same "record the
 * entitled refund for the business to settle manually" approach tiffin cancellation uses.
 */
export async function cancelOrderByAccessToken(accessToken: string, reason: string | undefined) {
  const order = await OrderModel.findOne({ accessToken });
  if (!order) throw new OrderValidationError("Order not found");
  if (order.status === "cancelled") {
    throw new OrderValidationError("This order has already been cancelled");
  }

  const refundPercent =
    order.status === "received"
      ? 1
      : order.status === "delivered"
        ? ORDER_CANCELLATION_DELIVERED_REFUND_PERCENT
        : ORDER_CANCELLATION_DISPATCHED_REFUND_PERCENT; // "preparing" or "out-for-delivery"
  const refundAmount = order.payment.status === "paid" ? Math.round(order.totals.total * refundPercent) : 0;

  order.status = "cancelled";
  order.statusHistory.push({ status: "cancelled", at: new Date(), note: reason });
  if (reason) order.cancellationReason = reason;
  if (refundAmount > 0) {
    order.payment.status = "refunded";
    order.payment.refundAmount = refundAmount;
  }
  await order.save();
  return order;
}
