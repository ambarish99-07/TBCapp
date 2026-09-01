import { istParts, todayIsoInIst } from "../../utils/istDate.js";

/** True if the given IST hour falls inside [openHour, closeHour) — `closeHour <= openHour` means
 * the window crosses midnight (e.g. open 18 close 2 covers 18:00-23:59 and 00:00-01:59). */
export function isWithinServiceHours(hour: number, openHour: number, closeHour: number): boolean {
  if (closeHour > openHour) return hour >= openHour && hour < closeHour;
  return hour >= openHour || hour < closeHour;
}

export interface StoreLikeSettings {
  manuallyOpen: boolean;
  enforceServiceHours: boolean;
  openHour: number;
  closeHour: number;
}

interface DateRange {
  startDate: string;
  endDate: string;
}

export interface ComputedStatus<TClosure extends DateRange> {
  isOpen: boolean;
  reason?: "manually-closed" | "planned-closure" | "outside-hours";
  activeClosure?: TClosure;
}

/**
 * The one place both the Lickyeat-wide StoreSettings and each brand's own BrandStoreSettings
 * compute "can this be ordered right now" — identical logic, just applied to whichever
 * settings/closures the caller passes in. Checked in order: the manual switch (an absolute
 * override either way) — then a declared closure covering today — then the daily service-hours
 * schedule.
 */
export function computeStoreStatus<TClosure extends DateRange>(
  settings: StoreLikeSettings,
  upcomingClosures: TClosure[],
  now: Date
): ComputedStatus<TClosure> {
  if (!settings.manuallyOpen) {
    return { isOpen: false, reason: "manually-closed" };
  }

  const today = todayIsoInIst(now);
  const activeClosure = upcomingClosures.find((closure) => closure.startDate <= today && today <= closure.endDate);
  if (activeClosure) {
    return { isOpen: false, reason: "planned-closure", activeClosure };
  }

  if (settings.enforceServiceHours) {
    const { hour } = istParts(now);
    if (!isWithinServiceHours(hour, settings.openHour, settings.closeHour)) {
      return { isOpen: false, reason: "outside-hours" };
    }
  }
  return { isOpen: true };
}
