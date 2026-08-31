import { BROWSE_CATEGORIES, CROSS_BRAND_ID, type MenuAddOn, type UpsertMenuAddOnPriceRequest } from "@tbc/shared-types";
import { MenuItemModel } from "../../db/models/MenuItem.model.js";
import { MenuAddOnPriceModel } from "../../db/models/MenuAddOnPrice.model.js";
import { ComboModel } from "../../db/models/Combo.model.js";
import { BrandModel } from "../../db/models/Brand.model.js";

export function listMenuItems(brandId: string) {
  return MenuItemModel.find({ brandId }).lean();
}

export function findMenuItemById(id: string) {
  return MenuItemModel.findById(id).lean();
}

// --- Add-on price catalog (shared across every brand's menu, GG Tiffin's own catalog is separate) ---

export function listAddOnPrices() {
  return MenuAddOnPriceModel.find().sort({ name: 1 });
}

export function upsertAddOnPrice(data: UpsertMenuAddOnPriceRequest) {
  return MenuAddOnPriceModel.findOneAndUpdate({ name: data.name }, data, { new: true, upsert: true, runValidators: true });
}

/** Fetched once per request (not once per item) — same pattern GG Tiffin's buildAddOnPriceLookup uses. */
export async function buildAddOnPriceLookup(): Promise<Map<string, number>> {
  const prices = await MenuAddOnPriceModel.find().lean();
  return new Map(prices.map((p) => [p.name, p.price]));
}

/** Resolves an item's `addOnNames` into priced `{name, price}` pairs — any name whose price has
 * since been deleted from the catalog is dropped rather than shown at a misleading ₹0. */
export function resolveItemAddOns(addOnNames: string[], lookup: Map<string, number>): MenuAddOn[] {
  return addOnNames
    .map((name) => ({ name, price: lookup.get(name) }))
    .filter((addOn): addOn is MenuAddOn => addOn.price !== undefined);
}

/** Attaches the resolved `addOns` field to every item in one batch — the shared last step for
 * every read path (list, search, single lookup) so none of them can forget it. */
export async function withResolvedAddOns<T extends { addOnNames?: string[] | null }>(items: T[]): Promise<(T & { addOns: MenuAddOn[] })[]> {
  const lookup = await buildAddOnPriceLookup();
  return items.map((item) => ({ ...item, addOns: resolveItemAddOns(item.addOnNames ?? [], lookup) }));
}

export function listCombos(brandId: string) {
  return ComboModel.find({ brandId }).lean();
}

/** Cross-brand — every live brand's combos plus the cross-brand build-your-own combo, for the "Combos" page's brand tabs. */
export async function listAllCombos() {
  const brandIds = await liveBrandIds();
  return ComboModel.find({ $or: [{ brandId: { $in: brandIds } }, { brandId: CROSS_BRAND_ID }] }).lean();
}

export function findComboById(id: string) {
  return ComboModel.findById(id).lean();
}

export async function liveBrandIds(): Promise<string[]> {
  const brands = await BrandModel.find({ status: "live" }, "_id").lean();
  return brands.map((brand) => String(brand._id));
}

/** Escapes regex metacharacters so free-text search input can't be interpreted as a pattern. */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Cross-brand search — deliberately ignores the caller's currently-selected brand. Used by
 * the "search all brands" page, unlike `listMenuItems`, which is always scoped to one brand.
 */
export async function searchMenuItemsAcrossBrands(params: { q?: string; category?: string }) {
  const brandIds = await liveBrandIds();
  const filter: Record<string, unknown> = { brandId: { $in: brandIds } };

  if (params.category) {
    const def = BROWSE_CATEGORIES.find((c) => c.id === params.category);
    filter.category = { $in: def ? def.matchCategories : [] };
  }

  if (params.q && params.q.trim().length > 0) {
    const re = new RegExp(escapeRegExp(params.q.trim()), "i");
    filter.$or = [{ signatureName: re }, { commonName: re }];
  }

  return MenuItemModel.find(filter).lean();
}

/** One row per fixed browse category, each carrying a real photo from an actual seeded item (or none yet). */
export async function browseCategorySummaries() {
  const brandIds = await liveBrandIds();
  return Promise.all(
    BROWSE_CATEGORIES.map(async (def) => {
      const categoryFilter = { brandId: { $in: brandIds }, category: { $in: def.matchCategories } };
      const [sample, itemCount] = await Promise.all([
        MenuItemModel.findOne(categoryFilter).lean(),
        MenuItemModel.countDocuments(categoryFilter),
      ]);
      return { id: def.id, label: def.label, image: sample?.image ?? null, itemCount };
    })
  );
}
