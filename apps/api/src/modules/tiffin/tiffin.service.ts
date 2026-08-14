import type { CreateTiffinSubscriptionRequest, PauseTiffinSubscriptionRequest, CreateTiffinPlanRequest, UpdateTiffinPlanRequest } from "@tbc/shared-types";
import type { Env } from "../../config/env.js";
import { TiffinPlanModel } from "../../db/models/TiffinPlan.model.js";
import { TiffinScheduledMealModel } from "../../db/models/TiffinScheduledMeal.model.js";
import { TiffinSubscriptionModel } from "../../db/models/TiffinSubscription.model.js";
import { UserModel } from "../../db/models/User.model.js";
import { sendNewTiffinSubscriptionAlert } from "../../integrations/whatsapp/sendNewTiffinSubscriptionAlert.js";
import { assertWithinDeliveryZone } from "../orders/deliveryZone.js";
import { generateSubscriptionNumber } from "./subscriptionNumber.js";
import { computeMealsForRange } from "./tiffinSchedule.js";
import { TiffinValidationError } from "./tiffin.errors.js";

/** How far in advance a scheduled meal must still be for a customer to skip it — configurable
 * in this one place, not hardcoded inline wherever the check happens. */
const SKIP_DEADLINE_HOURS = 12;

export function listActivePlans() {
  return TiffinPlanModel.find({ active: true }).sort({ price: 1 });
}

export async function createSubscription(env: Env, userId: string, request: CreateTiffinSubscriptionRequest) {
  const plan = await TiffinPlanModel.findById(request.planId);
  if (!plan || !plan.active) {
    throw new TiffinValidationError("This plan is not currently available");
  }
  if (plan.dietType === "veg" && !request.sundayVegChoice) {
    throw new TiffinValidationError("Please choose Paneer or Chole for Sunday");
  }

  // Same zone check every TBC/TAT order already goes through — imported, not duplicated.
  assertWithinDeliveryZone(request.delivery);

  const user = await UserModel.findById(userId);
  if (!user) throw new TiffinValidationError("User not found");

  const startDate = new Date();
  startDate.setUTCHours(0, 0, 0, 0);
  const sundayVegChoice = plan.dietType === "veg" ? request.sundayVegChoice : undefined;
  const meals = computeMealsForRange(plan.dietType, plan.mealType, startDate, plan.durationDays, sundayVegChoice);

  const subscription = await TiffinSubscriptionModel.create({
    subscriptionNumber: generateSubscriptionNumber(),
    userId,
    planId: plan._id,
    planName: plan.name,
    dietType: plan.dietType,
    mealType: plan.mealType,
    sundayVegChoice,
    status: "active",
    startDate: meals[0].date,
    endDate: meals[meals.length - 1].date,
    delivery: request.delivery,
    price: plan.price,
    // Phase 1 is Cash on Delivery only — same reasoning as the rest of the app's COD path:
    // no live Razorpay credentials configured, and recurring/subscription billing is a
    // separate Razorpay API not wired up yet.
    payment: { method: "cod", status: "pending" },
  });

  await TiffinScheduledMealModel.insertMany(meals.map((meal) => ({ subscriptionId: subscription._id, ...meal })));

  sendNewTiffinSubscriptionAlert(env, {
    subscriptionNumber: subscription.subscriptionNumber,
    customerName: user.fullName,
    planName: plan.name,
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

export async function skipMeal(userId: string, subscriptionId: string, mealId: string) {
  await findOwnedSubscription(userId, subscriptionId);

  const meal = await TiffinScheduledMealModel.findOne({ _id: mealId, subscriptionId });
  if (!meal) throw new TiffinValidationError("Scheduled meal not found");
  if (meal.status !== "scheduled") {
    throw new TiffinValidationError("Only a scheduled meal can be skipped");
  }

  const deadline = new Date(`${meal.date}T00:00:00Z`);
  deadline.setUTCHours(deadline.getUTCHours() - SKIP_DEADLINE_HOURS);
  if (new Date() > deadline) {
    throw new TiffinValidationError(`Meals can only be skipped at least ${SKIP_DEADLINE_HOURS} hours in advance`);
  }

  meal.status = "skipped";
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
    // append that many fresh scheduled meals right after the current endDate.
    const nextDay = new Date(`${subscription.endDate}T00:00:00Z`);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    const extraMeals = computeMealsForRange(
      subscription.dietType,
      subscription.mealType,
      nextDay,
      pausedMeals.length,
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
