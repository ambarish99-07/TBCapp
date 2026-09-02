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
  /** False when the admin has marked this add-on out of stock — resolved fresh from the shared
   * catalog at read time, same as `price`. The client shows it struck through/disabled rather
   * than hiding it (it still exists, just not orderable right now); the server rejects an order
   * that includes it either way, never trusting the client to have honored the display state. */
  isAvailable: z.boolean(),
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
  /** Out-of-stock toggle — global across every brand/item that offers this add-on, since it's a
   * shared supply (e.g. "out of whipped cream" is true for every item that offers it, not just
   * one). Defaults true so every add-on created before this existed keeps working unchanged. */
  isAvailable: z.boolean().default(true),
});
export type MenuAddOnPrice = z.infer<typeof MenuAddOnPriceSchema>;

export const UpsertMenuAddOnPriceRequestSchema = z.object({
  name: z.string().min(1),
  price: z.number().positive(),
  isAvailable: z.boolean().default(true),
});
export type UpsertMenuAddOnPriceRequest = z.infer<typeof UpsertMenuAddOnPriceRequestSchema>;

/** One extra size a customer can pick instead of the item's default (e.g. a 1kg biryani instead
 * of the default 500g, or a 500ml shake instead of the default 300ml) — `label` is free text
 * (no fixed unit), same "brand never needs a code change to name its own thing" reasoning as
 * MenuCategorySchema. Priced directly by the admin, not derived from a formula/multiplier, so a
 * bigger size can cost whatever it actually costs to make (packaging, bulk discount, etc.) rather
 * than always scaling linearly with the default size's price. */
export const MenuItemSizeVariantSchema = z.object({
  label: z.string().min(1),
  price: z.number().positive(),
  /** Out-of-stock toggle for just this one size — the item itself (its default size) and any
   * other size variant stay orderable regardless. Defaults true so every variant created before
   * this existed keeps working unchanged. */
  isAvailable: z.boolean().default(true),
});
export type MenuItemSizeVariant = z.infer<typeof MenuItemSizeVariantSchema>;

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
  /** Out-of-stock toggle for the whole item (its default size included) — false means every size
   * of this item is unorderable until switched back on. The item still shows on the menu, struck
   * through/disabled rather than hidden, so a customer knows it exists but isn't available right
   * now. Defaults true so every item created before this existed keeps working unchanged. */
  isAvailable: z.boolean().default(true),
  /** Other menu item ids this pairs well with — powers "frequently bought together" and recommendations. */
  pairsWith: z.array(z.string()).optional(),
  /** When set, this item's real charged price is `price * (1 - salePercent/100)` — `price` stays the shown strikethrough price. Only a few items should carry this, not the whole menu. */
  salePercent: z.number().min(1).max(99).optional(),
  /** Display label for `price`'s own portion — "300 ml" for a shake, "500 gm" for a biryani,
   * whatever unit actually applies. Free text, brand-agnostic, purely informational (never
   * affects pricing on its own — see MenuItemSizeVariantSchema for that). Optional so an item
   * with no meaningful portion concept doesn't need to fake one. */
  portionSize: z.string().optional(),
  /** Extra sizes beyond the default (`price`/`portionSize` above) a customer can pick instead —
   * e.g. a 1kg option alongside the default 500g. Empty means this item only ever comes in its
   * one default size. Every size (default included) is priced directly by the admin. */
  sizeVariants: z.array(MenuItemSizeVariantSchema).default([]),
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
export const UpsertMenuItemRequestSchema = z
  .object({
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
    isAvailable: z.boolean().default(true),
    salePercent: z.number().min(1).max(99).optional(),
    portionSize: z.string().optional(),
    sizeVariants: z.array(MenuItemSizeVariantSchema).default([]),
    hasSugarIceCustomization: z.boolean().default(true),
    addOnNames: z.array(z.string()).default([]),
  })
  // Every size variant needs a labeled default to distinguish itself from — a picker with one
  // unlabeled size and one labeled "1 kg" reads as broken, not as "two sizes."
  .refine((data) => data.sizeVariants.length === 0 || !!data.portionSize, {
    message: "Set a portion size for the default price before adding extra sizes",
    path: ["portionSize"],
  })
  .refine((data) => new Set(data.sizeVariants.map((v) => v.label)).size === data.sizeVariants.length, {
    message: "Size labels must be unique",
    path: ["sizeVariants"],
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
