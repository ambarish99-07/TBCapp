import type { SingleMealType } from "@tbc/shared-types";

const IST_TIME_ZONE = "Asia/Kolkata";

/** Local (IST) hour each same-day meal window closes — breakfast has no same-day window, see
 * `resolveSingleMealTargetDate` below. */
const MEAL_WINDOW_END_HOUR: Partial<Record<SingleMealType, number>> = {
  lunch: 14,
  dinner: 22,
};

function istParts(date: Date): { isoDate: string; hour: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: IST_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const hour = get("hour");
  return {
    isoDate: `${get("year")}-${String(get("month")).padStart(2, "0")}-${String(get("day")).padStart(2, "0")}`,
    // Some environments render midnight as "24" with hour12:false — normalize to 0.
    hour: hour === 24 ? 0 : hour,
  };
}

function addIsoDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

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

/** Same IST-anchored "today" used above — keeps the admin's daily prep list aligned with the
 * dates single-meal orders actually get stored under. */
export function todayIsoInIst(now: Date = new Date()): string {
  return istParts(now).isoDate;
}
