// The business operates on India time regardless of what timezone the server process itself runs
// in (e.g. UTC on Render) — every date boundary anywhere in the app (tiffin ordering cutoffs,
// admin analytics "today"/"yesterday" buckets) is computed here, in IST, not server-local time.
const IST_TIME_ZONE = "Asia/Kolkata";

/** Breaks an instant down into its IST calendar date and hour. */
export function istParts(date: Date): { isoDate: string; hour: number } {
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

export function addIsoDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** The IST calendar date for a given instant (defaults to now). */
export function todayIsoInIst(now: Date = new Date()): string {
  return istParts(now).isoDate;
}

/** The UTC instant of IST midnight for a given IST calendar date — IST has a fixed +05:30 offset
 * (no DST), so this is a plain, always-correct string-to-Date parse. Used to turn an IST calendar
 * boundary (e.g. "today") into a `createdAt >=` cutoff for querying UTC-stored timestamps. */
export function istMidnightUtc(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00+05:30`);
}
