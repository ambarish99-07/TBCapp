import { z } from "zod";

export const MenuCategorySchema = z.enum(["signature-shakes", "cold-coffee", "mocktails"]);
export type MenuCategory = z.infer<typeof MenuCategorySchema>;

/** Keys must match packages/pricing's ADD_ON_PRICES exactly — that's the source of truth for price. */
export const AddOnIdSchema = z.enum([
  "whipped-cream",
  "extra-chocolate-syrup",
  "oreo-crumbs",
  "kitkat-crumbs",
  "dry-fruits",
  "extra-mint",
  "lemon-wedge",
  "chilli-salt-rim",
  "extra-fizz",
  "fruit-garnish",
]);
export type AddOnId = z.infer<typeof AddOnIdSchema>;

/** Which add-ons a customer can attach to an item of this category — a shake topping makes no sense on a mocktail, and vice versa. */
export const ADD_ONS_BY_CATEGORY: Record<MenuCategory, AddOnId[]> = {
  "signature-shakes": ["whipped-cream", "extra-chocolate-syrup", "oreo-crumbs", "kitkat-crumbs", "dry-fruits"],
  "cold-coffee": ["whipped-cream", "extra-chocolate-syrup", "oreo-crumbs", "kitkat-crumbs", "dry-fruits"],
  mocktails: ["extra-mint", "lemon-wedge", "chilli-salt-rim", "extra-fizz", "fruit-garnish"],
};

export const MenuItemSchema = z.object({
  id: z.string(),
  brandId: z.string(),
  signatureName: z.string(),
  commonName: z.string(),
  description: z.string(),
  price: z.number().positive(),
  category: MenuCategorySchema,
  image: z.string(),
  flavorBadges: z.array(z.string()),
  isPopular: z.boolean().optional(),
  isNew: z.boolean().optional(),
  isStaffPick: z.boolean().optional(),
  /** Other menu item ids this pairs well with — powers "frequently bought together" and recommendations. */
  pairsWith: z.array(z.string()).optional(),
  /** When set, this item's real charged price is `price * (1 - salePercent/100)` — `price` stays the shown strikethrough price. Only a few items should carry this, not the whole menu. */
  salePercent: z.number().min(1).max(99).optional(),
});
export type MenuItem = z.infer<typeof MenuItemSchema>;

/** Admin create/update payload — `id` is the slug (auto-generated from `signatureName` for a new
 * item; unchanged for an edit, since it's also the Mongo `_id` and other records key off it). */
export const UpsertMenuItemRequestSchema = z.object({
  id: z.string().min(1),
  brandId: z.string().min(1),
  signatureName: z.string().min(1),
  commonName: z.string().min(1),
  description: z.string().min(1),
  price: z.number().positive(),
  category: MenuCategorySchema,
  image: z.string().min(1),
  flavorBadges: z.array(z.string()).default([]),
  isPopular: z.boolean().optional(),
  isNew: z.boolean().optional(),
  isStaffPick: z.boolean().optional(),
  salePercent: z.number().min(1).max(99).optional(),
});
export type UpsertMenuItemRequest = z.infer<typeof UpsertMenuItemRequestSchema>;

/**
 * Fixed/curated combo (e.g. "Chocolate Duo", always exactly two shakes). No
 * stored price — always computed live as 15% off the sum of the constituent
 * items' current base prices (see @tbc/pricing's computeComboPrice), so it can
 * never drift out of sync if an item's price changes later.
 */
export const CuratedComboSchema = z.object({
  type: z.literal("curated"),
  id: z.string(),
  brandId: z.string(),
  name: z.string(),
  description: z.string(),
  itemIds: z.array(z.string()).min(2),
  image: z.string().optional(),
});
export type CuratedCombo = z.infer<typeof CuratedComboSchema>;

/**
 * "Choose N" combo (e.g. "pick any 2 shakes") — the customer picks which
 * eligible items fill the slots; price is likewise always computed live as
 * 15% off the sum of whichever items they picked, not a flat advertised price.
 */
export const ChooseNComboSchema = z.object({
  type: z.literal("choose-n"),
  id: z.string(),
  brandId: z.string(),
  name: z.string(),
  description: z.string(),
  chooseCount: z.number().int().positive(),
  eligibleItemIds: z.array(z.string()).min(2),
  image: z.string().optional(),
});
export type ChooseNCombo = z.infer<typeof ChooseNComboSchema>;

export const ComboSchema = z.discriminatedUnion("type", [CuratedComboSchema, ChooseNComboSchema]);
export type Combo = z.infer<typeof ComboSchema>;
