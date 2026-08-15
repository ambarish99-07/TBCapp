import { PREMIUM_MEMBERSHIP_DURATION_DAYS, PREMIUM_MEMBERSHIP_PRICE, type PaymentMethod } from "@tbc/shared-types";
import type { Env } from "../../config/env.js";
import { PremiumMembershipPurchaseModel } from "../../db/models/PremiumMembershipPurchase.model.js";
import { UserModel } from "../../db/models/User.model.js";
import { toPublicUser } from "../auth/auth.controller.js";
import { sendNewPremiumMembershipAlert } from "../../integrations/whatsapp/sendNewPremiumMembershipAlert.js";
import { createRazorpayOrder } from "../payments/razorpay.client.js";
import { verifyRazorpaySignature } from "../payments/verifySignature.js";
import { generatePremiumMembershipOrderNumber } from "./premiumMembershipOrderNumber.js";
import { PremiumMembershipValidationError } from "./premiumMembership.errors.js";

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Extends from the account's current expiry if it's still in the future, rather than resetting
 * to a flat 30 days from today — renewing early adds on top, same as any real subscription. */
function computeNewExpiry(currentExpiresAt: Date | null | undefined): Date {
  const now = new Date();
  const base = currentExpiresAt && currentExpiresAt > now ? currentExpiresAt : now;
  const expiresAt = new Date(base);
  expiresAt.setUTCDate(expiresAt.getUTCDate() + PREMIUM_MEMBERSHIP_DURATION_DAYS);
  return expiresAt;
}

export async function purchaseMembership(env: Env, userId: string, paymentMethod: PaymentMethod) {
  // Unlike tiffin (COD is fine for weekly plans, only monthly requires online payment), a paid
  // membership is never fulfilled in person — it can only ever be paid online.
  if (paymentMethod === "cod") {
    throw new PremiumMembershipValidationError("Premium Membership can only be paid online — Cash on Delivery isn't available");
  }

  const user = await UserModel.findById(userId);
  if (!user) throw new PremiumMembershipValidationError("User not found");

  const expiresAt = computeNewExpiry(user.premiumMembershipExpiresAt);

  const purchase = await PremiumMembershipPurchaseModel.create({
    orderNumber: generatePremiumMembershipOrderNumber(),
    userId,
    price: PREMIUM_MEMBERSHIP_PRICE,
    startDate: toIsoDate(new Date()),
    expiresAt: toIsoDate(expiresAt),
    payment: { method: paymentMethod, status: "pending" },
  });
  // user.premiumMembershipExpiresAt is only written in verifyMembershipRazorpayPayment, after
  // signature verification succeeds.

  return { purchase, user: toPublicUser(user) };
}

async function findOwnedPurchase(userId: string, purchaseId: string) {
  const purchase = await PremiumMembershipPurchaseModel.findOne({ _id: purchaseId, userId });
  if (!purchase) throw new PremiumMembershipValidationError("Purchase not found");
  return purchase;
}

export async function createMembershipRazorpayOrder(env: Env, userId: string, purchaseId: string) {
  const purchase = await findOwnedPurchase(userId, purchaseId);
  if (purchase.payment.method !== "razorpay" || purchase.payment.status !== "pending") {
    throw new PremiumMembershipValidationError("This purchase is not awaiting a Razorpay payment");
  }

  const razorpayOrder = await createRazorpayOrder(env, purchase.price, purchase.orderNumber);
  purchase.payment.razorpayOrderId = razorpayOrder.id;
  await purchase.save();

  return {
    razorpayOrderId: razorpayOrder.id,
    amount: razorpayOrder.amount,
    currency: razorpayOrder.currency,
    keyId: env.RAZORPAY_KEY_ID,
  };
}

export async function verifyMembershipRazorpayPayment(
  env: Env,
  userId: string,
  purchaseId: string,
  params: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }
) {
  const purchase = await findOwnedPurchase(userId, purchaseId);
  if (!env.RAZORPAY_KEY_SECRET) {
    throw new PremiumMembershipValidationError("Payment verification is not configured");
  }
  if (purchase.payment.razorpayOrderId !== params.razorpay_order_id) {
    throw new PremiumMembershipValidationError("Razorpay order id does not match this purchase");
  }

  const isValid = verifyRazorpaySignature(
    params.razorpay_order_id,
    params.razorpay_payment_id,
    params.razorpay_signature,
    env.RAZORPAY_KEY_SECRET
  );

  if (!isValid) {
    purchase.payment.status = "failed";
    await purchase.save();
    throw new PremiumMembershipValidationError("Payment signature verification failed");
  }

  purchase.payment.status = "paid";
  purchase.payment.razorpayPaymentId = params.razorpay_payment_id;
  await purchase.save();

  const user = await UserModel.findById(userId);
  if (!user) throw new PremiumMembershipValidationError("User not found");
  // Apply the same expiry computed (and extend-if-active-resolved) at purchase time, now that
  // payment is confirmed.
  user.premiumMembershipExpiresAt = new Date(`${purchase.expiresAt}T00:00:00Z`);
  await user.save();

  sendNewPremiumMembershipAlert(env, {
    orderNumber: purchase.orderNumber,
    customerName: user.fullName,
    expiresAt: purchase.expiresAt,
  }).catch((err) => console.error("[premiumMembership] new-membership alert threw unexpectedly:", err));

  return { purchase, user: toPublicUser(user) };
}

export async function getMembershipStatus(userId: string) {
  const user = await UserModel.findById(userId);
  if (!user) throw new PremiumMembershipValidationError("User not found");
  const active = !!user.premiumMembershipExpiresAt && user.premiumMembershipExpiresAt > new Date();
  return { active, expiresAt: user.premiumMembershipExpiresAt?.toISOString() };
}
