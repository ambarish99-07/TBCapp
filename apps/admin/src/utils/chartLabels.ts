const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-08" -> "Aug" */
export function monthLabel(month: string): string {
  const [, m] = month.split("-");
  return MONTH_LABELS[Number(m) - 1] ?? month;
}

/** "2026-08-12" -> "12 Aug" — a trailing-7-day window's start date. */
export function weekLabel(isoDate: string): string {
  const [, m, d] = isoDate.split("-");
  return `${Number(d)} ${MONTH_LABELS[Number(m) - 1] ?? m}`;
}

/** 0-23 -> "12am", "1am", ..., "11pm" */
export function hourLabel(hour: number): string {
  const period = hour < 12 ? "am" : "pm";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}${period}`;
}
