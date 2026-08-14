import {
  CANCELLATION_FULL_REFUND_WINDOW_DAYS,
  CANCELLATION_REFUND_PERCENT,
  TIFFIN_PLAN_DURATIONS,
  type CreateTiffinPlanRequest,
  type CreateTiffinSubscriptionRequest,
  type PauseTiffinSubscriptionRequest,
  type TiffinMealType,
  type UpdateTiffinPlanRequest,
} from "@tbc/shared-types";
import type { Env } from "../../config/env.js";
import { TiffinPlanModel } from "../../db/models/TiffinPlan.model.js";
import { TiffinScheduledMealModel } from "../../db/models/TiffinScheduledMeal.model.js";
import { TiffinSubscriptionModel } from "../../db/models/TiffinSubscription.model.js";
import { UserModel } from "../../db/models/User.model.js";
import { sendNewTiffinSubscriptionAlert } from "../../integrations/whatsapp/sendNewTiffinSubscriptionAlert.js";
import { assertWithinDeliveryZone } from "../orders/deliveryZone.js";
import { createRazorpayOrder } from "../payments/razorpay.client.js";
import { verifyRazorpaySignature } from "../payments/verifySignature.js";
import { generateSubscriptionNumber } from "./subscriptionNumber.js";
import { computeMealsForRange } from "./tiffinSchedule.js";
import { TiffinValidationError } from "./tiffin.errors.js";

/** How far in advance a scheduled meal must still be for a customer to skip it — configurable
 * in this one place, not hardcoded inline wherever the check happens. */
const SKIP_DEADLINE_HOURS = 12;

export function listActivePlans() {
  return TiffinPlanModel.find({ active: true }).sort({ price: 1 });
}

/** "single" needs the customer's lunch/dinner choice; "twice-daily" always schedules both, regardless of what (if anything) was sent. */
function resolveMealTypes(style: "single" | "twice-daily", requestedMealType: TiffinMealType | undefined): TiffinMealType[] {
  if (style === "twice-daily") return ["lunch", "dinner"];
  if (!requestedMealType) {
    throw new TiffinValidationError("Please choose Lunch or Dinner for this plan");
  }
  return [requestedMealType];
}

export async function createSubscription(env: Env, userId: string, request: CreateTiffinSubscriptionRequest) {
  const plan = await TiffinPlanModel.findById(request.planId);
  if (!plan || !plan.active) {
    throw new TiffinValidationError("This plan is not currently available");
  }
  if (plan.dietType === "veg" && !request.sundayVegChoice) {
    throw new TiffinValidationError("Please choose Paneer or Chole for Sunday");
  }
  if (plan.durationDays === TIFFIN_PLAN_DURATIONS.monthly && request.paymentMethod === "cod") {
    throw new TiffinValidationError("Cash on Delivery isn't available for monthly plans — please pay online");
  }
  const mealTypes = resolveMealTypes(plan.style, request.mealType);

  // Same zone check every TBC/TAT order already goes through — imported, not duplicated.
  assertWithinDeliveryZone(request.delivery);

  const user = await UserModel.findById(userId);
  if (!user) throw new TiffinValidationError("User not found");

  // Deliveries start the day after subscribing, never the same day — there's no way to have a
  // fresh tiffin ready and delivered within minutes of signing up.
  const startDate = new Date();
  startDate.setUTCHours(0, 0, 0, 0);
  startDate.setUTCDate(startDate.getUTCDate() + 1);
  const sundayVegChoice = plan.dietType === "veg" ? request.sundayVegChoice : undefined;
  const meals = computeMealsForRange(plan.dietType, mealTypes, startDate, plan.durationDays, sundayVegChoice);

  const subscription = await TiffinSubscriptionModel.create({
    subscriptionNumber: generateSubscriptionNumber(),
    userId,
    planId: plan._id,
    planName: plan.name,
    dietType: plan.dietType,
    style: plan.style,
    mealTypes,
    sundayVegChoice,
    status: "active",
    durationDays: plan.durationDays,
    startDate: meals[0].date,
    endDate: meals[meals.length - 1].date,
    delivery: request.delivery,
    price: plan.price,
    // A subscription is charged once, upfront, for the full price — the same one-time Razorpay
    // order/verify flow orders already use (see postTiffinRazorpayOrder/postTiffinRazorpayVerify
    // below), not a separate recurring-billing API. COD is trusted immediately, same as orders;
    // razorpay only becomes "paid" after signature verification succeeds.
    payment: { method: request.paymentMethod, status: "pending" },
  });

  await TiffinScheduledMealModel.insertMany(meals.map((meal) => ({ subscriptionId: subscription._id, ...meal })));

  if (request.paymentMethod === "cod") {
    sendNewTiffinSubscriptionAlert(env, {
      subscriptionNumber: subscription.subscriptionNumber,
      customerName: user.fullName,
      planName: plan.name,
    }).catch((err) => console.error("[tiffin] new-subscription alert threw unexpectedly:", err));
  }
  // razorpay subscriptions: the WhatsApp alert fires only in verifyTiffinRazorpayPayment,
  // after signature verification succeeds — same pattern as modules/payments/verifySignature.ts.

  return subscription;
}

export async function createTiffinRazorpayOrder(env: Env, userId: string, subscriptionId: string) {
  const subscription = await findOwnedSubscription(userId, subscriptionId);
  if (subscription.payment.method !== "razorpay" || subscription.payment.status !== "pending") {
    throw new TiffinValidationError("This subscription is not awaiting a Razorpay payment");
  }

  const razorpayOrder = await createRazorpayOrder(env, subscription.price, subscription.subscriptionNumber);
  subscription.payment.razorpayOrderId = razorpayOrder.id;
  await subscription.save();

  return {
    razorpayOrderId: razorpayOrder.id,
    amount: razorpayOrder.amount,
    currency: razorpayOrder.currency,
    keyId: env.RAZORPAY_KEY_ID,
  };
}

export async function verifyTiffinRazorpayPayment(
  env: Env,
  userId: string,
  subscriptionId: string,
  params: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }
) {
  const subscription = await findOwnedSubscription(userId, subscriptionId);
  if (!env.RAZORPAY_KEY_SECRET) {
    throw new TiffinValidationError("Payment verification is not configured");
  }
  if (subscription.payment.razorpayOrderId !== params.razorpay_order_id) {
    throw new TiffinValidationError("Razorpay order id does not match this subscription");
  }

  const isValid = verifyRazorpaySignature(
    params.razorpay_order_id,
    params.razorpay_payment_id,
    params.razorpay_signature,
    env.RAZORPAY_KEY_SECRET
  );

  if (!isValid) {
    subscription.payment.status = "failed";
    await subscription.save();
    throw new TiffinValidationError("Payment signature verification failed");
  }

  subscription.payment.status = "paid";
  subscription.payment.razorpayPaymentId = params.razorpay_payment_id;
  await subscription.save();

  const user = await UserModel.findById(userId);
  sendNewTiffinSubscriptionAlert(env, {
    subscriptionNumber: subscription.subscriptionNumber,
    customerName: user?.fullName ?? subscription.delivery.fullName,
    planName: subscription.planName,
  }).catch((err) => console.error("[tiffin] new-subscription alert threw unexpectedly:", err));

  return subscription;
}

export function listMySubscriptions(userId: string) {
  return TiffinSubscriptionModel.find({ userId }).sort({ createdAt: -1 });
}

async function findOwnedSubscription(userId: string, subscriptionId: string) {
  const subscription = await TiffinSubscriptionModel.findOne({ _id: subscriptionId, userId });
  if (!subscription) throw new TiffinValidationError("Subscription not found");
  return subscription;
}

export async function listUpcomingMeals(userId: string, subscriptionId: string) {
  await findOwnedSubscription(userId, subscriptionId);
  return TiffinScheduledMealModel.find({ subscriptionId }).sort({ date: 1 });
}

function assertBeforeSkipDeadline(mealDate: string, action: "skipped" | "restored") {
  const deadline = new Date(`${mealDate}T00:00:00Z`);
  deadline.setUTCHours(deadline.getUTCHours() - SKIP_DEADLINE_HOURS);
  if (new Date() > deadline) {
    throw new TiffinValidationError(`Meals can only be ${action} at least ${SKIP_DEADLINE_HOURS} hours in advance`);
  }
}

export async function skipMeal(userId: string, subscriptionId: string, mealId: string) {
  await findOwnedSubscription(userId, subscriptionId);

  const meal = await TiffinScheduledMealModel.findOne({ _id: mealId, subscriptionId });
  if (!meal) throw new TiffinValidationError("Scheduled meal not found");
  if (meal.status !== "scheduled") {
    throw new TiffinValidationError("Only a scheduled meal can be skipped");
  }
  assertBeforeSkipDeadline(meal.date, "skipped");

  meal.status = "skipped";
  await meal.save();
  return meal;
}

/** Undo a skip — same deadline as skipping in the first place, so a change of mind can't slip
 * in after the kitchen would already be relying on the skip. */
export async function unskipMeal(userId: string, subscriptionId: string, mealId: string) {
  await findOwnedSubscription(userId, subscriptionId);

  const meal = await TiffinScheduledMealModel.findOne({ _id: mealId, subscriptionId });
  if (!meal) throw new TiffinValidationError("Scheduled meal not found");
  if (meal.status !== "skipped") {
    throw new TiffinValidationError("Only a skipped meal can be restored");
  }
  assertBeforeSkipDeadline(meal.date, "restored");

  meal.status = "scheduled";
  await meal.save();
  return meal;
}

export async function pauseSubscription(userId: string, subscriptionId: string, request: PauseTiffinSubscriptionRequest) {
  const subscription = await findOwnedSubscription(userId, subscriptionId);
  if (subscription.status !== "active") {
    throw new TiffinValidationError("Only an active subscription can be paused");
  }
  if (request.from > request.until) {
    throw new TiffinValidationError("Pause end date must be after the start date");
  }

  const pausedMeals = await TiffinScheduledMealModel.find({
    subscriptionId,
    date: { $gte: request.from, $lte: request.until },
    status: "scheduled",
  });
  if (pausedMeals.length > 0) {
    await TiffinScheduledMealModel.updateMany({ _id: { $in: pausedMeals.map((meal) => meal._id) } }, { status: "skipped" });

    // Extend the subscription so the customer still receives every meal they paid for —
    // append that many fresh scheduled *days* right after the current endDate. Count distinct
    // dates, not meal rows: a "twice-daily" plan's paused days have 2 rows each (lunch + dinner),
    // and computeMealsForRange already re-expands each day back into that many rows.
    const pausedDayCount = new Set(pausedMeals.map((meal) => meal.date)).size;
    const nextDay = new Date(`${subscription.endDate}T00:00:00Z`);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    const extraMeals = computeMealsForRange(
      subscription.dietType,
      subscription.mealTypes as TiffinMealType[],
      nextDay,
      pausedDayCount,
      subscription.sundayVegChoice ?? undefined
    );
    await TiffinScheduledMealModel.insertMany(extraMeals.map((meal) => ({ subscriptionId: subscription._id, ...meal })));
    subscription.endDate = extraMeals[extraMeals.length - 1].date;
  }

  subscription.status = "paused";
  subscription.pausedFrom = request.from;
  subscription.pausedUntil = request.until;
  await subscription.save();
  return subscription;
}

export async function resumeSubscription(userId: string, subscriptionId: string) {
  const subscription = await findOwnedSubscription(userId, subscriptionId);
  if (subscription.status !== "paused") {
    throw new TiffinValidationError("Only a paused subscription can be resumed");
  }

  if (subscription.pausedFrom && subscription.pausedUntil) {
    const today = new Date().toISOString().slice(0, 10);
    const restoreFrom = subscription.pausedFrom > today ? subscription.pausedFrom : today;
    await TiffinScheduledMealModel.updateMany(
      { subscriptionId, date: { $gte: restoreFrom, $lte: subscription.pausedUntil }, status: "skipped" },
      { status: "scheduled" }
    );
  }

  subscription.status = "active";
  subscription.pausedFrom = undefined;
  subscription.pausedUntil = undefined;
  await subscription.save();
  return subscription;
}

/**
 * Weekly (7-day) plans can't be cancelled at all. A monthly (30-day) plan cancelled before
 * CANCELLATION_FULL_REFUND_WINDOW_DAYS have elapsed since its (next-day) start refunds
 * CANCELLATION_REFUND_PERCENT of what was actually paid; on or after that day, no refund.
 * Nothing is charged back through Razorpay here — Phase 1 records the entitled refund amount
 * the same way COD "trusts" a payment immediately, for the business to settle manually.
 */
export async function cancelSubscription(userId: string, subscriptionId: string) {
  const subscription = await findOwnedSubscription(userId, subscriptionId);
  if (subscription.status === "cancelled" || subscription.status === "completed") {
    throw new TiffinValidationError("This subscription can't be cancelled");
  }
  if (subscription.durationDays === TIFFIN_PLAN_DURATIONS.weekly) {
    throw new TiffinValidationError("Weekly plans can't be cancelled");
  }

  const today = new Date().toISOString().slice(0, 10);
  const daysElapsed = Math.floor(
    (new Date(`${today}T00:00:00Z`).getTime() - new Date(`${subscription.startDate}T00:00:00Z`).getTime()) / (1000 * 60 * 60 * 24)
  );
  const refundAmount =
    subscription.payment.status === "paid" && daysElapsed < CANCELLATION_FULL_REFUND_WINDOW_DAYS
      ? Math.round(subscription.price * CANCELLATION_REFUND_PERCENT)
      : 0;

  await TiffinScheduledMealModel.updateMany(
    { subscriptionId, date: { $gte: today }, status: { $in: ["scheduled", "skipped"] } },
    { status: "cancelled" }
  );

  subscription.status = "cancelled";
  subscription.cancelledAt = new Date();
  if (refundAmount > 0) {
    subscription.payment.status = "refunded";
    subscription.payment.refundAmount = refundAmount;
  }
  await subscription.save();
  return subscription;
}

// --- Admin-only ---

export function listAllSubscriptions() {
  return TiffinSubscriptionModel.find().sort({ createdAt: -1 });
}

export function listTodaysScheduledMeals() {
  const today = new Date().toISOString().slice(0, 10);
  return TiffinScheduledMealModel.find({ date: today }).sort({ dishName: 1 });
}

export async function updateScheduledMealStatus(mealId: string, status: string) {
  const meal = await TiffinScheduledMealModel.findByIdAndUpdate(mealId, { status }, { new: true });
  if (!meal) throw new TiffinValidationError("Scheduled meal not found");
  return meal;
}

export function listAllPlansAdmin() {
  return TiffinPlanModel.find().sort({ createdAt: -1 });
}

export function createPlan(data: CreateTiffinPlanRequest) {
  return TiffinPlanModel.create(data);
}

export async function updatePlan(id: string, data: UpdateTiffinPlanRequest) {
  const plan = await TiffinPlanModel.findByIdAndUpdate(id, data, { new: true });
  if (!plan) throw new TiffinValidationError("Plan not found");
  return plan;
}
