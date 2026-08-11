import { z } from "zod";

/**
 * Fixed, cross-brand browse taxonomy for the "search all brands" page — deliberately NOT
 * derived from whatever `category` strings a brand's own menu items happen to use (that
 * per-brand list is what MenuScreen's tabs already show). Each entry's `matchCategories`
 * are the raw `MenuItem.category` values that count as belonging to it; a brand's seed data
 * should use these exact strings for any item it wants to surface here (e.g. GG Tiffin's
 * chicken dishes should be seeded with `category: "chicken"`).
 */
export const BROWSE_CATEGORIES = [
  { id: "shakes", label: "Shakes", matchCategories: ["signature-shakes"] },
  { id: "cold-coffee", label: "Cold Coffee", matchCategories: ["cold-coffee"] },
  { id: "mocktails", label: "Mocktails", matchCategories: ["mocktails"] },
  { id: "veg", label: "Veg", matchCategories: ["veg"] },
  { id: "non-veg", label: "Non-Veg", matchCategories: ["non-veg"] },
  { id: "breads", label: "Breads", matchCategories: ["breads"] },
  { id: "chicken", label: "Chicken", matchCategories: ["chicken"] },
  { id: "mutton", label: "Mutton", matchCategories: ["mutton"] },
  { id: "paneer", label: "Paneer", matchCategories: ["paneer"] },
] as const;

export type BrowseCategoryId = (typeof BROWSE_CATEGORIES)[number]["id"];

export const BrowseCategorySummarySchema = z.object({
  id: z.string(),
  label: z.string(),
  /** A real photo from one of this category's actual items, or null if none are seeded yet. */
  image: z.string().nullable(),
  itemCount: z.number().int().nonnegative(),
});
export type BrowseCategorySummary = z.infer<typeof BrowseCategorySummarySchema>;
