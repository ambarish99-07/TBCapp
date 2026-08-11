import { BROWSE_CATEGORIES } from "@tbc/shared-types";
import { MenuItemModel } from "../../db/models/MenuItem.model.js";
import { ComboModel } from "../../db/models/Combo.model.js";
import { BrandModel } from "../../db/models/Brand.model.js";

export function listMenuItems(brandId: string) {
  return MenuItemModel.find({ brandId }).lean();
}

export function findMenuItemById(id: string) {
  return MenuItemModel.findById(id).lean();
}

export function listCombos(brandId: string) {
  return ComboModel.find({ brandId }).lean();
}

export function findComboById(id: string) {
  return ComboModel.findById(id).lean();
}

async function liveBrandIds(): Promise<string[]> {
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
