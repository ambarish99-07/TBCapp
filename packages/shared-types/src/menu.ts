import { z } from "zod";

/**
 * Free text, not a fixed enum — deliberately so a genuinely new kind of brand (biryani, momos,
 * thali, ...) never needs a code change just to name its own categories. "signature-shakes" /
 * "cold-coffee" / "mocktails" are just what TBC and Alchemy Tails happen to use; nothing in this
 * schema privileges them. The only place any of the three names are still checked against is
 * priceResolver.ts's milestone-reward eligibility (a TBC/Alchemy-specific loyalty mechanic) and
 * HomeCollections.tsx's "Signature" row — both degrade harmlessly for any other category string.
 */
export const MenuCategorySchema = z.string().min(1);
export type MenuCategory = z.infer<typeof MenuCategorySchema>;

/**
 * One named, priced extra a customer can add to a menu item — resolved server-side (name looked
 * up against the shared, admin-managed add-on price catalog) and embedded directly on a MenuItem
 * as `addOns`, the same "server resolves, client just renders" shape SingleMealMenuItem.addOns
 * already uses for GG Tiffin. Never trusted from the client at order time either way (see
 * priceResolver.ts).
 */
export const MenuAddOnSchema = z.object({
  name: z.string(),
  price: z.number().nonnegative(),
});
export type MenuAddOn = z.infer<typeof MenuAddOnSchema>;

/** A named add-on's shared flat price, admin-managed and global across every brand (a shake's
 * "Whipped Cream" and a biryani's "Extra Raita" both live in this one catalog) — same shape and
 * convention as GG Tiffin's TiffinAddOnPriceSchema, kept as its own separate collection since the
 * two menus (this one, and GG Tiffin's) have entirely independent lifecycles. */
export const MenuAddOnPriceSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number().positive(),
});
export type MenuAddOnPrice = z.infer<typeof MenuAddOnPriceSchema>;

export const UpsertMenuAddOnPriceRequestSchema = z.object({
  name: z.string().min(1),
  price: z.number().positive(),
});
export type UpsertMenuAddOnPriceRequest = z.infer<typeof UpsertMenuAddOnPriceRequestSchema>;

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
  /** False for an item with no "sugar level"/"ice level" concept (a biryani, a momo plate, ...) —
   * the customize screen skips both pickers entirely rather than showing a nonsensical default.
   * Defaults true so every existing shake/cold-coffee/mocktail item keeps behaving exactly as
   * before without needing a migration. */
  hasSugarIceCustomization: z.boolean().default(true),
  /** Which named add-ons (from the shared MenuAddOnPrice catalog) this item offers — resolved
   * with their current price into `addOns` below for display; empty means no add-ons at all,
   * same as a GG Tiffin dish flagged `hasAddOns: false`. */
  addOnNames: z.array(z.string()).default([]),
  /** Server-resolved from `addOnNames` against the current MenuAddOnPrice catalog — never
   * stored, always fresh. Absent on the admin upsert request; present on every read. */
  addOns: z.array(MenuAddOnSchema).optional(),
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
  hasSugarIceCustomization: z.boolean().default(true),
  addOnNames: z.array(z.string()).default([]),
});
export type UpsertMenuItemRequest = z.infer<typeof UpsertMenuItemRequestSchema>;

/**
 * Fixed/curated combo (e.g. "Chocolate Duo", always exactly two shakes). No
 * stored price — always computed live as `discountPercent`% off (falling back to
 * the flat 15% default when unset) the sum of the constituent items' current base
 * prices (see @tbc/pricing's computeComboPrice), so it can never drift out of sync
 * if an item's price changes later.
 */
export const CuratedComboSchema = z.object({
  type: z.literal("curated"),
  id: z.string(),
  brandId: z.string(),
  name: z.string(),
  description: z.string(),
  itemIds: z.array(z.string()).min(2),
  image: z.string().optional(),
  /** Admin-set override, e.g. 20 for 20% off. Unset ⇒ the global 15% default. */
  discountPercent: z.number().min(1).max(99).optional(),
});
export type CuratedCombo = z.infer<typeof CuratedComboSchema>;

/**
 * "Choose N" combo (e.g. "pick any 2 shakes") — the customer picks which
 * eligible items fill the slots; price is likewise always computed live as
 * `discountPercent`% off (falling back to the flat 15% default when unset) the
 * sum of whichever items they picked, not a flat advertised price.
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
  /** Admin-set override, e.g. 20 for 20% off. Unset ⇒ the global 15% default. */
  discountPercent: z.number().min(1).max(99).optional(),
});
export type ChooseNCombo = z.infer<typeof ChooseNComboSchema>;

export const ComboSchema = z.discriminatedUnion("type", [CuratedComboSchema, ChooseNComboSchema]);
export type Combo = z.infer<typeof ComboSchema>;

/** Admin create/update payload — `id` is the slug (auto-generated from `name` for a new combo;
 * unchanged for an edit, since it's also the Mongo `_id`). One flexible object rather than a
 * discriminated union so a single admin form can submit either shape through the same call;
 * `.refine()` enforces the type-specific required fields below. */
export const UpsertComboRequestSchema = z
  .object({
    id: z.string().min(1),
    brandId: z.string().min(1),
    type: z.enum(["curated", "choose-n"]),
    name: z.string().min(1),
    description: z.string().min(1),
    image: z.string().optional(),
    // Omitted ⇒ leave whatever's stored untouched; explicit `null` ⇒ clear the override back to
    // the global 15% default — the admin form's "leave discount blank" case needs a real way to
    // clear a previously-set override, and a bare `undefined` can't do that (it never survives
    // JSON serialization, so the key would just be missing and look identical to "don't touch").
    discountPercent: z.number().min(1).max(99).nullable().optional(),
    itemIds: z.array(z.string()).optional(),
    chooseCount: z.number().int().positive().optional(),
    eligibleItemIds: z.array(z.string()).optional(),
  })
  .refine((data) => data.type !== "curated" || (data.itemIds?.length ?? 0) >= 2, {
    message: "A curated combo needs at least 2 itemIds",
    path: ["itemIds"],
  })
  .refine((data) => data.type !== "choose-n" || data.chooseCount != null, {
    message: "A choose-n combo needs a chooseCount",
    path: ["chooseCount"],
  })
  .refine((data) => data.type !== "choose-n" || (data.eligibleItemIds?.length ?? 0) >= (data.chooseCount ?? 0), {
    message: "A choose-n combo needs at least chooseCount eligibleItemIds",
    path: ["eligibleItemIds"],
  });
export type UpsertComboRequest = z.infer<typeof UpsertComboRequestSchema>;

/**
 * An admin-curated "Recommended For You" pick for one customer + brand — set from the admin
 * panel's Customer Detail page after reviewing that customer's real order history, and surfaced
 * ahead of their own reorder history and the brand's isPopular fill-ins on their Home screen (see
 * apps/mobile/src/screens/Menu/MenuScreen.tsx). Capped at 2 items — a deliberate one-or-two
 * hand-picked nudge, not a general-purpose list; an empty array clears it back to "no picks".
 */
export const AdminRecommendationSchema = z.object({
  brandId: z.string(),
  itemIds: z.array(z.string()).max(2),
});
export type AdminRecommendation = z.infer<typeof AdminRecommendationSchema>;

export const SetAdminRecommendationRequestSchema = z.object({
  brandId: z.string().min(1),
  itemIds: z.array(z.string()).max(2),
});
export type SetAdminRecommendationRequest = z.infer<typeof SetAdminRecommendationRequestSchema>;
