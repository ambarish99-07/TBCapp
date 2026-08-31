import type { DeclareTiffinClosureRequest, TiffinMealType } from "@tbc/shared-types";
import { TiffinClosureModel } from "../../db/models/TiffinClosure.model.js";
import { TiffinScheduledMealModel } from "../../db/models/TiffinScheduledMeal.model.js";
import { TiffinSingleMealOrderModel } from "../../db/models/TiffinSingleMealOrder.model.js";
import { TiffinSubscriptionModel } from "../../db/models/TiffinSubscription.model.js";
import { addIsoDays, todayIsoInIst } from "../../utils/istDate.js";
import { buildRegularDishLookup, computeMealsForRange } from "./tiffinSchedule.js";

/** Every ISO calendar date from `startDate` to `endDate`, inclusive. Bounded — a closure is
 * always a handful of days by nature (the request schema doesn't cap it, but 400 days is well
 * past anything a real emergency declaration would ever need, so this only guards against a
 * mistyped year rather than a real use case). */
function expandDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  let cursor = startDate;
  let guard = 0;
  while (cursor <= endDate && guard < 400) {
    dates.push(cursor);
    cursor = addIsoDays(cursor, 1);
    guard += 1;
  }
  return dates;
}

export function listClosures() {
  return TiffinClosureModel.find().sort({ startDate: -1 });
}

/** Every date, from today (IST) onward, covered by any declared closure — used to keep new
 * single-meal ordering and new subscription signups skipping those dates for as long as they're
 * still upcoming. A closure entirely in the past is left out; it has nothing left to affect. */
export async function getUpcomingClosedDates(): Promise<Set<string>> {
  const today = todayIsoInIst();
  const closures = await TiffinClosureModel.find({ endDate: { $gte: today } }).select("startDate endDate").lean();
  const dates = new Set<string>();
  for (const closure of closures) {
    for (const date of expandDateRange(closure.startDate, closure.endDate)) dates.add(date);
  }
  return dates;
}

export async function isDateClosed(date: string): Promise<boolean> {
  const closure = await TiffinClosureModel.findOne({ startDate: { $lte: date }, endDate: { $gte: date } })
    .select("_id")
    .lean();
  return !!closure;
}

/**
 * Declares GG Tiffin closed for every date from `startDate` to `endDate` (inclusive) and
 * processes it immediately, once:
 *
 * - Every `TiffinScheduledMeal` still `"scheduled"` on one of those dates is marked `"closed"`,
 *   and its subscription's `endDate` is pushed out by however many distinct closed days actually
 *   hit that subscription — the exact same skip-and-extend shape `pauseSubscription` already uses
 *   for a customer-initiated pause, just applied to every affected subscription at once instead of
 *   one customer's own request. A subscription already fully cancelled has no `"scheduled"` rows
 *   left to match, so it's untouched; a subscription mid-pause is still extended for any of its
 *   own still-`"scheduled"` days that fall in range (its paused days are already `"skipped"`, not
 *   `"scheduled"`, so those aren't double-counted).
 * - Every `TiffinSingleMealOrder` for one of those dates that isn't already cancelled/delivered is
 *   auto-cancelled with a full refund (if it was actually paid) — the business caused this, not
 *   the customer, so the normal cancellation-window refund tiering doesn't apply here.
 *
 * There is no undo: once this has run, the extensions and cancellations already happened. The
 * closure record itself persists afterward only so ongoing ordering keeps skipping these dates.
 */
export async function declareClosure(request: DeclareTiffinClosureRequest) {
  const { startDate, endDate, reason } = request;
  const closedDates = expandDateRange(startDate, endDate);

  const closure = await TiffinClosureModel.create({ startDate, endDate, reason });

  // --- Single-meal orders: auto-cancel, full refund if paid.
  const affectedOrders = await TiffinSingleMealOrderModel.find({
    date: { $in: closedDates },
    status: { $nin: ["cancelled", "delivered"] },
  });
  let refundedAmount = 0;
  for (const order of affectedOrders) {
    const addOnsTotal = order.addOns.reduce((sum, addOn) => sum + addOn.price, 0);
    const orderTotal = (order.price + addOnsTotal) * order.quantity;
    order.status = "cancelled";
    order.statusHistory.push({ status: "cancelled", at: new Date().toISOString() });
    if (order.payment.status === "paid") {
      order.payment.status = "refunded";
      order.payment.refundAmount = orderTotal;
      refundedAmount += orderTotal;
    }
    await order.save();
  }

  // --- Subscriptions: mark the closed days, extend each affected subscription to compensate.
  const affectedMeals = await TiffinScheduledMealModel.find({ date: { $in: closedDates }, status: "scheduled" });
  const closedDaysBySubscription = new Map<string, Set<string>>();
  for (const meal of affectedMeals) {
    const subscriptionId = String(meal.subscriptionId);
    if (!closedDaysBySubscription.has(subscriptionId)) closedDaysBySubscription.set(subscriptionId, new Set());
    closedDaysBySubscription.get(subscriptionId)!.add(meal.date);
  }

  if (closedDaysBySubscription.size > 0) {
    await TiffinScheduledMealModel.updateMany({ date: { $in: closedDates }, status: "scheduled" }, { status: "closed" });

    const dishLookup = await buildRegularDishLookup();
    for (const [subscriptionId, closedDays] of closedDaysBySubscription) {
      const subscription = await TiffinSubscriptionModel.findById(subscriptionId);
      if (!subscription) continue; // shouldn't happen — the meal row's own subscriptionId ref would be dangling.

      const nextDay = addIsoDays(subscription.endDate, 1);
      const extraMeals = computeMealsForRange(
        dishLookup,
        subscription.dietType,
        subscription.mealTypes as TiffinMealType[],
        new Date(`${nextDay}T00:00:00Z`),
        closedDays.size
      );
      await TiffinScheduledMealModel.insertMany(extraMeals.map((meal) => ({ subscriptionId: subscription._id, ...meal })));
      subscription.endDate = extraMeals[extraMeals.length - 1].date;
      await subscription.save();
    }
  }

  return {
    closure,
    extendedSubscriptionCount: closedDaysBySubscription.size,
    cancelledSingleMealOrderCount: affectedOrders.length,
    refundedAmount,
  };
}
