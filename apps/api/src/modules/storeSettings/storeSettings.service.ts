import type { DeclareStoreClosureRequest, StoreClosedReason, StoreClosure, UpdateStoreSettingsRequest } from "@tbc/shared-types";
import { STORE_SETTINGS_SINGLETON_ID, StoreSettingsModel, type StoreSettingsDocument } from "../../db/models/StoreSettings.model.js";
import { StoreClosureModel } from "../../db/models/StoreClosure.model.js";
import { todayIsoInIst } from "../../utils/istDate.js";
import { computeStoreStatus } from "./storeStatusCore.js";

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

export function listStoreClosures() {
  return StoreClosureModel.find().sort({ startDate: -1 });
}

export function declareStoreClosure(request: DeclareStoreClosureRequest) {
  return StoreClosureModel.create(request);
}

/** Every declared closure whose end date hasn't passed yet (today, IST, inclusive) — a closure
 * entirely in the past has nothing left to affect or announce. */
async function getUpcomingClosures(): Promise<StoreClosure[]> {
  const today = todayIsoInIst();
  const closures = await StoreClosureModel.find({ endDate: { $gte: today } })
    .sort({ startDate: 1 })
    .lean();
  return closures.map((closure) => ({
    id: String(closure._id),
    startDate: closure.startDate,
    endDate: closure.endDate,
    reason: closure.reason ?? undefined,
    createdAt: closure.createdAt.toISOString(),
  }));
}

export interface StoreStatusResult {
  isOpen: boolean;
  reason?: StoreClosedReason;
  settings: { manuallyOpen: boolean; enforceServiceHours: boolean; openHour: number; closeHour: number };
  activeClosure?: StoreClosure;
  upcomingClosures: StoreClosure[];
}

/** The single source of truth for "can a catalog-brand order be placed right now" — used both by
 * the public status endpoint (for the mobile Home banner) and by orders.service.ts's own
 * enforcement at order-creation time. Deliberately does not apply to GG Tiffin, which has its own
 * separate cutoff system.
 *
 * Checked in order: the manual switch (an immediate override either way) — then a declared
 * planned closure (known ahead of time, e.g. a holiday) — then the daily service-hours schedule.
 * `upcomingClosures` is always returned regardless of which of these actually applies, so the
 * customer app can show a heads-up about a closure that hasn't started yet even while the store
 * is otherwise open right now.
 */
export async function getStoreStatus(now: Date = new Date()): Promise<StoreStatusResult> {
  const [doc, upcomingClosures] = await Promise.all([getOrCreateStoreSettings(), getUpcomingClosures()]);
  const settings = {
    manuallyOpen: doc.manuallyOpen,
    enforceServiceHours: doc.enforceServiceHours,
    openHour: doc.openHour,
    closeHour: doc.closeHour,
  };
  const computed = computeStoreStatus(settings, upcomingClosures, now);
  return { isOpen: computed.isOpen, reason: computed.reason, settings, activeClosure: computed.activeClosure, upcomingClosures };
}
