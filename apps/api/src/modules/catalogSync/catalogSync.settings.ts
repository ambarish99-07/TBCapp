import { BrandStoreClosureModel } from "../../db/models/BrandStoreClosure.model.js";
import { BrandStoreSettingsModel } from "../../db/models/BrandStoreSettings.model.js";
import { CouponModel } from "../../db/models/Coupon.model.js";
import { StoreClosureModel } from "../../db/models/StoreClosure.model.js";
import { STORE_SETTINGS_SINGLETON_ID, StoreSettingsModel } from "../../db/models/StoreSettings.model.js";
import { TiffinAddOnPriceModel } from "../../db/models/TiffinAddOnPrice.model.js";
import { TiffinClosureModel } from "../../db/models/TiffinClosure.model.js";
import { TiffinDishModel } from "../../db/models/TiffinDish.model.js";
import { TiffinMealPriceModel } from "../../db/models/TiffinMealPrice.model.js";
import { TiffinPlanModel } from "../../db/models/TiffinPlan.model.js";
import { sendInBackground, toCanonicalBrandId } from "./catalogSync.service.js";
import type { CanonicalCoupon, CanonicalTiffinDish, CanonicalTiffinPlan, CatalogEvent } from "./catalogSync.types.js";

/**
 * The shared settings beyond the menu — coupons, opening hours, planned closures and GG Tiffin
 * (plans, weekly dishes, single-meal prices, add-ons, closures). The app admin is the one admin
 * for both storefronts, so these flow app → website only; every admin write below sends its new
 * state in the background (never failing or slowing the save). "Push everything to website"
 * includes them too (allSettingsEvents).
 */

type Lean = Record<string, any> & { _id: unknown };

function couponToCanonical(c: Lean): CanonicalCoupon {
  return {
    code: c.code,
    type: c.type,
    value: c.value ?? 0,
    minOrderAmount: c.minOrderAmount ?? 0,
    maxDiscountAmount: c.maxDiscountAmount ?? null,
    brandId: c.brandId ? toCanonicalBrandId(c.brandId) : null,
    expiresAt: c.expiresAt ? new Date(c.expiresAt).toISOString() : null,
    isActive: c.isActive !== false,
    oncePerCustomer: !!c.oncePerCustomer,
    channels: c.channels?.length ? c.channels : ["app", "website"],
  };
}

function planToCanonical(p: Lean): CanonicalTiffinPlan {
  return {
    syncId: String(p._id),
    name: p.name,
    dietType: p.dietType,
    tier: p.tier ?? "regular",
    style: p.style,
    durationDays: p.durationDays,
    price: p.price,
    salePercent: p.salePercent ?? null,
    imageUrl: p.imageUrl ?? null,
    active: p.active !== false,
  };
}

function dishToCanonical(d: Lean): CanonicalTiffinDish {
  return {
    tier: d.tier,
    dietType: d.dietType,
    mealType: d.mealType,
    dayOfWeek: d.dayOfWeek,
    dishName: d.dishName,
    imageUrl: d.image ?? null,
    price: typeof d.price === "number" ? d.price : null,
    hasAddOns: d.hasAddOns !== false,
    riceSubstitute: d.riceSubstitute === "pulao" ? "pulao" : "rice",
    extraAddOnName: d.extraAddOnName ?? null,
  };
}

async function hoursEvent(appBrandId?: string): Promise<CatalogEvent> {
  const s = appBrandId ? await BrandStoreSettingsModel.findById(appBrandId).lean() : await StoreSettingsModel.findById(STORE_SETTINGS_SINGLETON_ID).lean();
  return {
    kind: "storeHours.upsert",
    data: {
      scope: appBrandId ? toCanonicalBrandId(appBrandId) : "lickyeat",
      enforceServiceHours: s?.enforceServiceHours ?? true,
      openHour: s?.openHour ?? 12,
      closeHour: s?.closeHour ?? 24,
    },
  };
}

async function closuresEvent(scope: "lickyeat" | "gg-tiffin" | { brandId: string }): Promise<CatalogEvent> {
  const rows =
    scope === "lickyeat"
      ? await StoreClosureModel.find().lean()
      : scope === "gg-tiffin"
        ? await TiffinClosureModel.find().lean()
        : await BrandStoreClosureModel.find({ brandId: scope.brandId }).lean();
  return {
    kind: "closures.replace",
    data: {
      scope: typeof scope === "string" ? scope : toCanonicalBrandId(scope.brandId),
      closures: rows.map((r) => ({ startDate: r.startDate, endDate: r.endDate, reason: r.reason ?? null })),
    },
  };
}

// --- per-change senders (called right after the admin's write succeeds) ----------------------

export function syncCoupon(code: string): void {
  sendInBackground(`coupon ${code}`, async () => {
    const coupon = await CouponModel.findOne({ code }).lean();
    return [coupon ? { kind: "coupon.upsert", data: couponToCanonical(coupon as Lean) } : { kind: "coupon.delete", code }];
  });
}

/** `appBrandId` omitted = the Lickyeat-wide hours. */
export function syncStoreHours(appBrandId?: string): void {
  sendInBackground(`opening hours for ${appBrandId ?? "Lickyeat"}`, async () => [await hoursEvent(appBrandId)]);
}

export function syncStoreClosures(appBrandId?: string): void {
  sendInBackground(`planned closures for ${appBrandId ?? "Lickyeat"}`, async () => [await closuresEvent(appBrandId ? { brandId: appBrandId } : "lickyeat")]);
}

export function syncTiffinClosures(): void {
  sendInBackground("GG Tiffin closures", async () => [await closuresEvent("gg-tiffin")]);
}

export function syncTiffinPlan(id: string): void {
  sendInBackground(`tiffin plan ${id}`, async () => {
    const plan = await TiffinPlanModel.findById(id).lean();
    return [plan ? { kind: "tiffinPlan.upsert", data: planToCanonical(plan as Lean) } : { kind: "tiffinPlan.delete", syncId: id }];
  });
}

/** Called with the dish's natural key — after a delete the row is gone, so the key is all there is. */
export function syncTiffinDish(key: Pick<CanonicalTiffinDish, "tier" | "dietType" | "mealType" | "dayOfWeek">): void {
  sendInBackground(`tiffin dish ${key.tier}/${key.dietType}/${key.mealType}/${key.dayOfWeek}`, async () => {
    const dish = await TiffinDishModel.findOne(key).lean();
    return [dish ? { kind: "tiffinDish.upsert", data: dishToCanonical(dish as Lean) } : { kind: "tiffinDish.delete", key }];
  });
}

export function syncTiffinMealPrice(id: string): void {
  sendInBackground(`tiffin meal price ${id}`, async () => {
    const p = await TiffinMealPriceModel.findById(id).lean();
    return p ? [{ kind: "tiffinMealPrice.upsert", data: { tier: p.tier, mealType: p.mealType, price: p.price, active: p.active !== false } }] : [];
  });
}

export function syncTiffinAddOn(name: string): void {
  sendInBackground(`tiffin add-on ${name}`, async () => {
    const a = await TiffinAddOnPriceModel.findOne({ name }).lean();
    return a ? [{ kind: "tiffinAddOn.upsert", data: { name: a.name, price: a.price } }] : [];
  });
}

// --- full push ---------------------------------------------------------------------------------

export async function allSettingsEvents(): Promise<CatalogEvent[]> {
  const [coupons, brandSettings, brandClosureBrands, plans, dishes, mealPrices, addOns] = await Promise.all([
    CouponModel.find().lean(),
    BrandStoreSettingsModel.find({}, "_id").lean(),
    BrandStoreClosureModel.distinct("brandId"),
    TiffinPlanModel.find().lean(),
    TiffinDishModel.find().lean(),
    TiffinMealPriceModel.find().lean(),
    TiffinAddOnPriceModel.find().lean(),
  ]);
  const brandIds = [...new Set([...brandSettings.map((b) => String(b._id)), ...brandClosureBrands.map(String)])];
  return [
    ...coupons.map((c) => ({ kind: "coupon.upsert" as const, data: couponToCanonical(c as Lean) })),
    await hoursEvent(),
    ...(await Promise.all(brandSettings.map((b) => hoursEvent(String(b._id))))),
    await closuresEvent("lickyeat"),
    ...(await Promise.all(brandIds.map((brandId) => closuresEvent({ brandId })))),
    ...plans.map((p) => ({ kind: "tiffinPlan.upsert" as const, data: planToCanonical(p as Lean) })),
    ...dishes.map((d) => ({ kind: "tiffinDish.upsert" as const, data: dishToCanonical(d as Lean) })),
    ...mealPrices.map((p) => ({ kind: "tiffinMealPrice.upsert" as const, data: { tier: p.tier, mealType: p.mealType, price: p.price, active: p.active !== false } })),
    ...addOns.map((a) => ({ kind: "tiffinAddOn.upsert" as const, data: { name: a.name, price: a.price } })),
    await closuresEvent("gg-tiffin"),
  ];
}
