import type { SingleMealType } from "@tbc/shared-types";
import { addIsoDays, istParts, todayIsoInIst } from "../../utils/istDate.js";

// Re-exported so existing importers (singleMeal.service.ts, this file's own test) keep working
// unchanged — the actual IST date math now lives in the shared utils/istDate.ts (also used by
// admin analytics for its today/yesterday/last-N-days boundaries).
export { todayIsoInIst };

/** Local (IST) hour each same-day meal window closes — breakfast has no same-day window, see
 * `resolveSingleMealTargetDate` below. */
const MEAL_WINDOW_END_HOUR: Partial<Record<SingleMealType, number>> = {
  lunch: 14,
  dinner: 22,
};

/**
 * Breakfast is always ordered the night before for next-day delivery — there's no time to prep
 * fresh between waking up and a morning window, so it's always orderable "today" for "tomorrow."
 * Lunch and dinner are cooked fresh same-day: they stay orderable for *today's* window until an
 * hour before it closes (e.g. dinner's 8-10pm IST window closes for ordering at 9pm) — past that
 * cutoff, the order simply rolls to the same meal the next day rather than being rejected.
 * All of this is evaluated in IST, the business's local time, regardless of what timezone the
 * server itself runs in.
 */
export function resolveSingleMealTargetDate(mealType: SingleMealType, now: Date = new Date()): string {
  const { isoDate, hour } = istParts(now);
  if (mealType === "breakfast") return addIsoDays(isoDate, 1);

  const endHour = MEAL_WINDOW_END_HOUR[mealType];
  if (endHour == null) return addIsoDays(isoDate, 1);

  const cutoffHour = endHour - 1;
  return hour < cutoffHour ? isoDate : addIsoDays(isoDate, 1);
}
