import { z } from "zod";

export const MenuCategorySchema = z.enum(["signature-shakes", "cold-coffee"]);
export type MenuCategory = z.infer<typeof MenuCategorySchema>;

/** Keys must match packages/pricing's ADD_ON_PRICES exactly — that's the source of truth for price. */
export const AddOnIdSchema = z.enum([
  "whipped-cream",
  "extra-chocolate-syrup",
  "oreo-crumbs",
  "kitkat-crumbs",
  "dry-fruits",
]);
export type AddOnId = z.infer<typeof AddOnIdSchema>;

export const MenuItemSchema = z.object({
  id: z.string(),
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
});
export type MenuItem = z.infer<typeof MenuItemSchema>;

/** Fixed/curated combo (e.g. "Chocolate Duo") — priced as a bundle of specific constituent items. */
export const CuratedComboSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  itemIds: z.array(z.string()).min(2),
  price: z.number().positive(),
  image: z.string().optional(),
});
export type CuratedCombo = z.infer<typeof CuratedComboSchema>;

/** "Choose N" combo (e.g. "pick any 2 for ₹379") — flat bundle price, no add-ons allowed. */
export const ChooseNComboSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  chooseCount: z.number().int().positive(),
  eligibleItemIds: z.array(z.string()).min(2),
  price: z.number().positive(),
  image: z.string().optional(),
});
export type ChooseNCombo = z.infer<typeof ChooseNComboSchema>;
