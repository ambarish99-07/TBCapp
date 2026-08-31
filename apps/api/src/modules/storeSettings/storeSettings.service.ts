import type { StoreClosedReason, UpdateStoreSettingsRequest } from "@tbc/shared-types";
import { STORE_SETTINGS_SINGLETON_ID, StoreSettingsModel, type StoreSettingsDocument } from "../../db/models/StoreSettings.model.js";
import { istParts } from "../../utils/istDate.js";

/** There is exactly one of these — created with defaults (open, 12:00-24:00 IST) the first time
 * anything reads it, so there's no separate seed/migration step to remember. */
export async function getOrCreateStoreSettings(): Promise<StoreSettingsDocument & { _id: string }> {
  const settings = await StoreSettingsModel.findOneAndUpdate(
    { _id: STORE_SETTINGS_SINGLETON_ID },
    { $setOnInsert: { _id: STORE_SETTINGS_SINGLETON_ID } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();
  return settings as StoreSettingsDocument & { _id: string };
}

export async function updateStoreSettings(update: UpdateStoreSettingsRequest): Promise<StoreSettingsDocument & { _id: string }> {
  const settings = await StoreSettingsModel.findOneAndUpdate(
    { _id: STORE_SETTINGS_SINGLETON_ID },
    { $set: update, $setOnInsert: { _id: STORE_SETTINGS_SINGLETON_ID } },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  ).lean();
  return settings as StoreSettingsDocument & { _id: string };
}

/** True if the given IST hour falls inside [openHour, closeHour) — `closeHour <= openHour` means
 * the window crosses midnight (e.g. open 18 close 2 covers 18:00-23:59 and 00:00-01:59). */
function isWithinServiceHours(hour: number, openHour: number, closeHour: number): boolean {
  if (closeHour > openHour) return hour >= openHour && hour < closeHour;
  return hour >= openHour || hour < closeHour;
}

export interface StoreStatusResult {
  isOpen: boolean;
  reason?: StoreClosedReason;
  settings: { manuallyOpen: boolean; enforceServiceHours: boolean; openHour: number; closeHour: number };
}

/** The single source of truth for "can a catalog-brand order be placed right now" — used both by
 * the public status endpoint (for the mobile Home banner) and by orders.service.ts's own
 * enforcement at order-creation time. Deliberately does not apply to GG Tiffin, which has its own
 * separate cutoff system. */
export async function getStoreStatus(now: Date = new Date()): Promise<StoreStatusResult> {
  const doc = await getOrCreateStoreSettings();
  const settings = {
    manuallyOpen: doc.manuallyOpen,
    enforceServiceHours: doc.enforceServiceHours,
    openHour: doc.openHour,
    closeHour: doc.closeHour,
  };

  if (!settings.manuallyOpen) {
    return { isOpen: false, reason: "manually-closed", settings };
  }
  if (settings.enforceServiceHours) {
    const { hour } = istParts(now);
    if (!isWithinServiceHours(hour, settings.openHour, settings.closeHour)) {
      return { isOpen: false, reason: "outside-hours", settings };
    }
  }
  return { isOpen: true, settings };
}
