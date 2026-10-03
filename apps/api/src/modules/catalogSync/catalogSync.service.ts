import type { Env } from "../../config/env.js";
import { BrandModel } from "../../db/models/Brand.model.js";
import { BrandStoreSettingsModel } from "../../db/models/BrandStoreSettings.model.js";
import { ComboModel } from "../../db/models/Combo.model.js";
import { MenuAddOnPriceModel } from "../../db/models/MenuAddOnPrice.model.js";
import { MenuItemModel } from "../../db/models/MenuItem.model.js";
import { STORE_SETTINGS_SINGLETON_ID, StoreSettingsModel } from "../../db/models/StoreSettings.model.js";
import {
  SYNC_SIGNATURE_HEADER,
  SYNC_TIMESTAMP_HEADER,
  signSyncBody,
  type CanonicalBrand,
  type CanonicalCombo,
  type CanonicalMenuItem,
  type CatalogEvent,
  type CatalogSnapshot,
} from "./catalogSync.types.js";

/** Brand ids that differ between the app and the website (app id → website id). The Biryani Lane
 * was created in the app as "TBL" before the website's lowercase-slug rule existed; every brand
 * created since must use a lowercase slug, so it's the same on both sides and needs no entry here.
 * Extra pairs can be added via CATALOG_SYNC_BRAND_ALIASES="appId=websiteId,...". */
const DEFAULT_BRAND_ALIASES: Record<string, string> = { TBL: "the-biryani-lane" };

interface SyncConfig {
  peerUrl: string;
  secret: string;
  appToCanonical: Map<string, string>;
  canonicalToApp: Map<string, string>;
}

let config: SyncConfig | null = null;
const SEND_BATCH_SIZE = 25;
const RETRY_DELAYS_MS = [1000, 4000];

function log(message: string, err?: unknown) {
  if (process.env.NODE_ENV === "test") return;
  if (err) console.error(`[catalog-sync] ${message}`, err);
  else console.log(`[catalog-sync] ${message}`);
}

/** Called once from createApp. Sync stays off (every call below becomes a no-op) unless both the
 * peer URL and the shared secret are set — local dev and tests run without it by default. */
export function configureCatalogSync(env: Env): void {
  if (!env.CATALOG_SYNC_PEER_URL || !env.CATALOG_SYNC_SECRET) {
    config = null;
    return;
  }
  const aliases = { ...DEFAULT_BRAND_ALIASES };
  for (const pair of (env.CATALOG_SYNC_BRAND_ALIASES ?? "").split(",")) {
    const [appId, siteId] = pair.split("=").map((s) => s.trim());
    if (appId && siteId) aliases[appId] = siteId;
  }
  config = {
    peerUrl: env.CATALOG_SYNC_PEER_URL.replace(/\/+$/, ""),
    secret: env.CATALOG_SYNC_SECRET,
    appToCanonical: new Map(Object.entries(aliases)),
    canonicalToApp: new Map(Object.entries(aliases).map(([a, s]) => [s, a])),
  };
}

export function catalogSyncConfigured(): boolean {
  return config !== null;
}

export function getCatalogSyncSecret(): string | null {
  return config?.secret ?? null;
}

// --- id + field mapping -------------------------------------------------------------------

export function toCanonicalBrandId(appId: string): string {
  return config?.appToCanonical.get(appId) ?? appId;
}

export function toAppBrandId(canonicalId: string): string {
  return config?.canonicalToApp.get(canonicalId) ?? canonicalId;
}

/** A path like "/static/menu-images/x.jpg" from the website is relative to ITS public API. */
function resolvePeerUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^(https?:|data:)/.test(url)) return url;
  return config ? `${config.peerUrl}${url.startsWith("/") ? "" : "/"}${url}` : url;
}

type Lean<T> = T & { _id: unknown };

function brandToCanonical(b: Lean<Record<string, unknown>>): CanonicalBrand {
  return {
    id: toCanonicalBrandId(String(b._id)),
    name: String(b.name),
    tagline: (b.tagline as string) ?? null,
    status: b.status === "coming-soon" ? "coming-soon" : "live",
    logoUrl: (b.logoUrl as string) ?? null,
    heroImageUrl: (b.heroImageUrl as string) ?? null,
    heroImageUrlDark: (b.heroImageUrlDark as string) ?? null,
    primaryColor: (b.primaryColor as string) ?? null,
    accentColor: (b.accentColor as string) ?? null,
    displayOrder: typeof b.displayOrder === "number" ? b.displayOrder : null,
  };
}

function menuItemToCanonical(i: Lean<Record<string, any>>): CanonicalMenuItem {
  return {
    id: String(i._id),
    brandId: toCanonicalBrandId(i.brandId),
    signatureName: i.signatureName,
    commonName: i.commonName ?? "",
    description: i.description ?? "",
    price: i.price,
    category: i.category,
    imageUrl: i.image || null,
    dietType: i.dietType === "non-veg" ? "non-veg" : "veg",
    flavorBadges: i.flavorBadges ?? [],
    isPopular: !!i.isPopular,
    isNew: !!i.isNew,
    isStaffPick: !!i.isStaffPick,
    isAvailable: i.isAvailable !== false,
    pairsWith: i.pairsWith ?? [],
    salePercent: i.salePercent ?? null,
    portionSize: i.portionSize ?? null,
    sizeVariants: (i.sizeVariants ?? []).map((v: any) => ({ label: v.label, price: v.price, isAvailable: v.isAvailable !== false })),
    hasSugarIceCustomization: i.hasSugarIceCustomization !== false,
    addOnNames: i.addOnNames ?? [],
  };
}

function comboToCanonical(c: Lean<Record<string, any>>): CanonicalCombo {
  return {
    id: String(c._id),
    brandId: toCanonicalBrandId(c.brandId),
    type: c.type,
    name: c.name,
    description: c.description ?? "",
    imageUrl: c.image ?? null,
    itemIds: c.itemIds ?? [],
    chooseCount: c.chooseCount ?? null,
    eligibleItemIds: c.eligibleItemIds ?? [],
    discountPercent: c.discountPercent ?? null,
    feastSize: c.feastSize ?? null,
  };
}

// --- outbound -----------------------------------------------------------------------------

export async function postSigned(path: string, payload: unknown): Promise<Response> {
  if (!config) throw new Error("Catalog sync is not configured");
  const body = JSON.stringify(payload);
  const timestamp = String(Date.now());
  return fetch(`${config.peerUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      [SYNC_TIMESTAMP_HEADER]: timestamp,
      [SYNC_SIGNATURE_HEADER]: signSyncBody(config.secret, timestamp, body),
    },
    body,
    signal: AbortSignal.timeout(10_000),
  });
}

/** Sends events to the website, in batches, retrying a failed batch twice. Throws on final failure. */
export async function sendCatalogEvents(events: CatalogEvent[]): Promise<void> {
  if (!config || events.length === 0) return;
  for (let start = 0; start < events.length; start += SEND_BATCH_SIZE) {
    const batch = events.slice(start, start + SEND_BATCH_SIZE);
    for (let attempt = 0; ; attempt++) {
      try {
        const res = await postSigned("/internal/catalog-sync", { events: batch });
        if (res.ok) break;
        throw new Error(`website answered ${res.status}: ${(await res.text()).slice(0, 300)}`);
      } catch (err) {
        if (attempt >= RETRY_DELAYS_MS.length) throw err;
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
      }
    }
  }
}

/** Fire-and-forget: an admin's save must never fail or wait because the website is slow or down.
 * A missed change is caught up by the admin's "Push everything to website" button. */
export function sendInBackground(describe: string, build: () => Promise<CatalogEvent[]>): void {
  if (!config) return;
  void (async () => {
    try {
      await sendCatalogEvents(await build());
    } catch (err) {
      log(`couldn't send ${describe} to the website — use "Push everything to website" to catch up`, err);
    }
  })();
}

export function syncMenuItem(id: string): void {
  sendInBackground(`menu item "${id}"`, async () => {
    const item = await MenuItemModel.findById(id).lean();
    return [item ? { kind: "menuItem.upsert", data: menuItemToCanonical(item as Lean<Record<string, any>>) } : { kind: "menuItem.delete", id }];
  });
}

export function syncCombo(id: string): void {
  sendInBackground(`combo "${id}"`, async () => {
    const combo = await ComboModel.findById(id).lean();
    return [combo ? { kind: "combo.upsert", data: comboToCanonical(combo as Lean<Record<string, any>>) } : { kind: "combo.delete", id }];
  });
}

export function syncAddOn(name: string): void {
  sendInBackground(`add-on "${name}"`, async () => {
    const addOn = await MenuAddOnPriceModel.findOne({ name }).lean();
    return [
      addOn
        ? { kind: "addOn.upsert", data: { name: addOn.name, price: addOn.price, isAvailable: addOn.isAvailable !== false } }
        : { kind: "addOn.delete", name },
    ];
  });
}

export function syncBrand(appBrandId: string): void {
  sendInBackground(`brand "${appBrandId}"`, async () => {
    const brand = await BrandModel.findById(appBrandId).lean();
    return [
      brand
        ? { kind: "brand.upsert", data: brandToCanonical(brand as Lean<Record<string, unknown>>) }
        : { kind: "brand.delete", id: toCanonicalBrandId(appBrandId) },
    ];
  });
}

/** `appBrandId` omitted = the Lickyeat-wide switch. */
export function syncStoreSwitch(appBrandId?: string): void {
  sendInBackground(`open/closed switch for ${appBrandId ?? "Lickyeat"}`, async () => {
    const open = appBrandId
      ? ((await BrandStoreSettingsModel.findById(appBrandId).lean())?.manuallyOpen ?? true)
      : ((await StoreSettingsModel.findById(STORE_SETTINGS_SINGLETON_ID).lean())?.manuallyOpen ?? true);
    return [{ kind: "storeSwitch.upsert", data: { scope: appBrandId ? toCanonicalBrandId(appBrandId) : "lickyeat", open } }];
  });
}

// --- inbound (changes made on the website) -------------------------------------------------

/** Applies one event from the website straight to this database — never re-sent back. */
export async function applyCatalogEvent(event: CatalogEvent): Promise<void> {
  switch (event.kind) {
    case "brand.upsert": {
      const b = event.data;
      const set: Record<string, unknown> = { name: b.name, status: b.status };
      for (const key of ["tagline", "primaryColor", "accentColor"] as const) if (b[key]) set[key] = b[key];
      for (const key of ["logoUrl", "heroImageUrl", "heroImageUrlDark"] as const) if (b[key]) set[key] = resolvePeerUrl(b[key]);
      if (typeof b.displayOrder === "number") set.displayOrder = b.displayOrder;
      await BrandModel.findByIdAndUpdate(toAppBrandId(b.id), { $set: set }, { upsert: true, setDefaultsOnInsert: true });
      return;
    }
    case "brand.delete":
      await BrandModel.findByIdAndDelete(toAppBrandId(event.id));
      return;
    case "menuItem.upsert": {
      const i = event.data;
      const set: Record<string, unknown> = {
        brandId: toAppBrandId(i.brandId),
        signatureName: i.signatureName,
        commonName: i.commonName || i.signatureName,
        description: i.description,
        price: i.price,
        category: i.category,
        dietType: i.dietType,
        flavorBadges: i.flavorBadges,
        isPopular: i.isPopular,
        isNew: i.isNew,
        isStaffPick: i.isStaffPick,
        isAvailable: i.isAvailable,
        pairsWith: i.pairsWith,
        sizeVariants: i.sizeVariants,
        hasSugarIceCustomization: i.hasSugarIceCustomization,
        addOnNames: i.addOnNames,
      };
      const unset: Record<string, ""> = {};
      const setOnInsert: Record<string, unknown> = {};
      const image = resolvePeerUrl(i.imageUrl);
      if (image) set.image = image;
      else setOnInsert.image = "";
      if (i.salePercent) set.salePercent = i.salePercent;
      else unset.salePercent = "";
      if (i.portionSize) set.portionSize = i.portionSize;
      else unset.portionSize = "";
      await MenuItemModel.findByIdAndUpdate(
        i.id,
        { $set: set, $unset: unset, $setOnInsert: setOnInsert },
        { upsert: true, setDefaultsOnInsert: true }
      );
      return;
    }
    case "menuItem.delete":
      await MenuItemModel.findByIdAndDelete(event.id);
      return;
    case "addOn.upsert":
      await MenuAddOnPriceModel.findOneAndUpdate({ name: event.data.name }, { $set: event.data }, { upsert: true });
      return;
    case "addOn.delete":
      await MenuAddOnPriceModel.deleteOne({ name: event.name });
      return;
    case "combo.upsert": {
      const c = event.data;
      const set: Record<string, unknown> = { brandId: toAppBrandId(c.brandId), type: c.type, name: c.name, description: c.description || c.name };
      const unset: Record<string, ""> = {};
      if (c.type === "curated") {
        set.itemIds = c.itemIds;
        unset.chooseCount = "";
        unset.eligibleItemIds = "";
      } else {
        set.chooseCount = c.chooseCount ?? 2;
        set.eligibleItemIds = c.eligibleItemIds;
        unset.itemIds = "";
      }
      const image = resolvePeerUrl(c.imageUrl);
      if (image) set.image = image;
      else unset.image = "";
      if (c.discountPercent) set.discountPercent = c.discountPercent;
      else unset.discountPercent = "";
      if (c.feastSize) set.feastSize = c.feastSize;
      else unset.feastSize = "";
      await ComboModel.findByIdAndUpdate(c.id, { $set: set, $unset: unset }, { upsert: true });
      return;
    }
    case "combo.delete":
      await ComboModel.findByIdAndDelete(event.id);
      return;
    case "storeSwitch.upsert": {
      const { scope, open } = event.data;
      if (scope === "lickyeat") {
        await StoreSettingsModel.findOneAndUpdate(
          { _id: STORE_SETTINGS_SINGLETON_ID },
          { $set: { manuallyOpen: open }, $setOnInsert: { _id: STORE_SETTINGS_SINGLETON_ID } },
          { upsert: true, setDefaultsOnInsert: true }
        );
      } else {
        const brandId = toAppBrandId(scope);
        await BrandStoreSettingsModel.findOneAndUpdate(
          { _id: brandId },
          { $set: { manuallyOpen: open }, $setOnInsert: { _id: brandId } },
          { upsert: true, setDefaultsOnInsert: true }
        );
      }
      return;
    }
  }
}

export async function localSnapshot(): Promise<CatalogSnapshot> {
  const [brands, items, combos, addOns] = await Promise.all([
    BrandModel.find({}, "_id").lean(),
    MenuItemModel.find({}, "_id").lean(),
    ComboModel.find({}, "_id").lean(),
    MenuAddOnPriceModel.find({}, "name").lean(),
  ]);
  return {
    brandIds: brands.map((b) => toCanonicalBrandId(String(b._id))),
    menuItemIds: items.map((i) => String(i._id)),
    comboIds: combos.map((c) => String(c._id)),
    addOnNames: addOns.map((a) => a.name),
  };
}

// --- full push (admin button) ---------------------------------------------------------------

export interface CatalogDiff {
  /** On the website but not in the app — candidates for removal. */
  websiteOnly: { brandIds: string[]; menuItemIds: string[]; comboIds: string[]; addOnNames: string[] };
  /** In the app but not yet on the website. */
  appOnly: { brandIds: string[]; menuItemIds: string[]; comboIds: string[]; addOnNames: string[] };
}

export async function fetchPeerSnapshot(): Promise<CatalogSnapshot> {
  const res = await postSigned("/internal/catalog-sync/snapshot", {});
  if (!res.ok) throw new Error(`website answered ${res.status}`);
  return (await res.json()) as CatalogSnapshot;
}

export async function catalogDiff(): Promise<CatalogDiff> {
  const [mine, theirs] = await Promise.all([localSnapshot(), fetchPeerSnapshot()]);
  const only = (a: string[], b: string[]) => a.filter((x) => !b.includes(x)).sort();
  return {
    websiteOnly: {
      brandIds: only(theirs.brandIds, mine.brandIds),
      menuItemIds: only(theirs.menuItemIds, mine.menuItemIds),
      comboIds: only(theirs.comboIds, mine.comboIds),
      addOnNames: only(theirs.addOnNames, mine.addOnNames),
    },
    appOnly: {
      brandIds: only(mine.brandIds, theirs.brandIds),
      menuItemIds: only(mine.menuItemIds, theirs.menuItemIds),
      comboIds: only(mine.comboIds, theirs.comboIds),
      addOnNames: only(mine.addOnNames, theirs.addOnNames),
    },
  };
}

/**
 * Sends the whole catalog to the website — brands, add-ons, menu items, combos (incl. Feasts) and
 * every open/closed switch. With `removeWebsiteOnly`, menu items, combos and add-ons that exist
 * only on the website are deleted there too (brands are never deleted this way — too destructive
 * to do in bulk). Order matters: brands and add-ons first, so items referencing them land after.
 */
export async function pushFullCatalog(options: { removeWebsiteOnly: boolean }) {
  const [brands, addOns, items, combos, brandSwitches, storeSettings] = await Promise.all([
    BrandModel.find().lean(),
    MenuAddOnPriceModel.find().lean(),
    MenuItemModel.find().lean(),
    ComboModel.find().lean(),
    BrandStoreSettingsModel.find().lean(),
    StoreSettingsModel.findById(STORE_SETTINGS_SINGLETON_ID).lean(),
  ]);
  const events: CatalogEvent[] = [
    ...brands.map((b) => ({ kind: "brand.upsert" as const, data: brandToCanonical(b as Lean<Record<string, unknown>>) })),
    ...addOns.map((a) => ({ kind: "addOn.upsert" as const, data: { name: a.name, price: a.price, isAvailable: a.isAvailable !== false } })),
    ...items.map((i) => ({ kind: "menuItem.upsert" as const, data: menuItemToCanonical(i as Lean<Record<string, any>>) })),
    ...combos.map((c) => ({ kind: "combo.upsert" as const, data: comboToCanonical(c as Lean<Record<string, any>>) })),
    { kind: "storeSwitch.upsert", data: { scope: "lickyeat", open: storeSettings?.manuallyOpen ?? true } },
    ...brandSwitches.map((s) => ({
      kind: "storeSwitch.upsert" as const,
      data: { scope: toCanonicalBrandId(String(s._id)), open: s.manuallyOpen !== false },
    })),
  ];

  let removed = { menuItemIds: [] as string[], comboIds: [] as string[], addOnNames: [] as string[] };
  if (options.removeWebsiteOnly) {
    const diff = await catalogDiff();
    removed = { menuItemIds: diff.websiteOnly.menuItemIds, comboIds: diff.websiteOnly.comboIds, addOnNames: diff.websiteOnly.addOnNames };
  }
  await sendCatalogEvents(events);
  // Coupons, opening hours, closures and GG Tiffin — imported lazily to avoid a module cycle
  // (catalogSync.settings imports this file).
  const { allSettingsEvents } = await import("./catalogSync.settings.js");
  await sendCatalogEvents(await allSettingsEvents());
  await sendCatalogEvents([
    ...removed.comboIds.map((id) => ({ kind: "combo.delete" as const, id })),
    ...removed.menuItemIds.map((id) => ({ kind: "menuItem.delete" as const, id })),
    ...removed.addOnNames.map((name) => ({ kind: "addOn.delete" as const, name })),
  ]);

  return {
    sent: { brands: brands.length, addOns: addOns.length, menuItems: items.length, combos: combos.length, storeSwitches: brandSwitches.length + 1 },
    removed,
  };
}
