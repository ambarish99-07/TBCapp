import type { BrandStoreClosure, BrandStoreStatus, DeclareBrandStoreClosureRequest, UpdateStoreSettingsRequest } from "@tbc/shared-types";
import { BrandStoreClosureModel } from "../../db/models/BrandStoreClosure.model.js";
import { BrandStoreSettingsModel, type BrandStoreSettingsDocument } from "../../db/models/BrandStoreSettings.model.js";
import { todayIsoInIst } from "../../utils/istDate.js";
import { getStoreStatus } from "./storeSettings.service.js";
import { computeStoreStatus } from "./storeStatusCore.js";

/** One of these per brand, created with defaults (open, 12:00-24:00 IST) the first time
 * anything reads or writes a given brandId's settings — a brand-new brand needs no setup step
 * here, same convenience as the Lickyeat-wide singleton. */
export async function getOrCreateBrandStoreSettings(brandId: string): Promise<BrandStoreSettingsDocument & { _id: string }> {
  const settings = await BrandStoreSettingsModel.findOneAndUpdate(
    { _id: brandId },
    { $setOnInsert: { _id: brandId } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();
  return settings as BrandStoreSettingsDocument & { _id: string };
}

export async function updateBrandStoreSettings(
  brandId: string,
  update: UpdateStoreSettingsRequest
): Promise<BrandStoreSettingsDocument & { _id: string }> {
  const settings = await BrandStoreSettingsModel.findOneAndUpdate(
    { _id: brandId },
    { $set: update, $setOnInsert: { _id: brandId } },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  ).lean();
  return settings as BrandStoreSettingsDocument & { _id: string };
}

export function listBrandStoreClosures(brandId: string) {
  return BrandStoreClosureModel.find({ brandId }).sort({ startDate: -1 });
}

export function declareBrandStoreClosure(brandId: string, request: DeclareBrandStoreClosureRequest) {
  return BrandStoreClosureModel.create({ brandId, ...request });
}

async function getUpcomingBrandClosures(brandId: string): Promise<BrandStoreClosure[]> {
  const today = todayIsoInIst();
  const closures = await BrandStoreClosureModel.find({ brandId, endDate: { $gte: today } })
    .sort({ startDate: 1 })
    .lean();
  return closures.map((closure) => ({
    id: String(closure._id),
    brandId: closure.brandId,
    startDate: closure.startDate,
    endDate: closure.endDate,
    reason: closure.reason ?? undefined,
    createdAt: closure.createdAt.toISOString(),
  }));
}

/**
 * "Can this specific brand be ordered right now" — the one function both the public per-brand
 * status endpoint and orders.service.ts's own enforcement use. The Lickyeat-wide switch (see
 * storeSettings.service.ts) is an absolute override checked first: if it says closed, this brand
 * is closed too, no matter what its own settings say, reported as "lickyeat-closed" so an admin
 * can tell the two levels apart. Only once the parent is open does this brand's own
 * switch/hours/closures get a say. Never called for GG Tiffin, which has its own separate cutoff
 * system entirely outside this module.
 */
export async function getBrandStoreStatus(brandId: string, now: Date = new Date()): Promise<BrandStoreStatus> {
  const [lickyeatStatus, upcomingClosures] = await Promise.all([getStoreStatus(now), getUpcomingBrandClosures(brandId)]);

  // The parent switch is an absolute override — pass its own reason/closure/hours through
  // exactly as-is (not collapsed into a generic "closed" reason) so the customer message stays
  // just as specific as the Lickyeat-wide page itself would show.
  if (!lickyeatStatus.isOpen) {
    return {
      brandId,
      isOpen: false,
      reason: lickyeatStatus.reason,
      closedByLickyeat: true,
      settings: lickyeatStatus.settings,
      activeClosure: lickyeatStatus.activeClosure,
      upcomingClosures,
    };
  }

  const doc = await getOrCreateBrandStoreSettings(brandId);
  const settings = { manuallyOpen: doc.manuallyOpen, enforceServiceHours: doc.enforceServiceHours, openHour: doc.openHour, closeHour: doc.closeHour };
  const computed = computeStoreStatus(settings, upcomingClosures, now);

  return {
    brandId,
    isOpen: computed.isOpen,
    reason: computed.reason,
    closedByLickyeat: false,
    settings,
    activeClosure: computed.activeClosure,
    upcomingClosures,
  };
}
