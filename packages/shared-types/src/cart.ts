import { z } from "zod";
import { MenuCategorySchema } from "./menu.js";

export const MAX_LINE_ITEMS_PER_ORDER = 50;
export const MAX_QUANTITY_PER_LINE = 20;

export const SugarLevelSchema = z.enum(["less", "regular", "extra"]);
export type SugarLevel = z.infer<typeof SugarLevelSchema>;

export const IceLevelSchema = z.enum(["less", "regular", "extra"]);
export type IceLevel = z.infer<typeof IceLevelSchema>;

export const CustomizationSchema = z.object({
  /** Absent for an item with no sugar/ice concept at all (see MenuItem.hasSugarIceCustomization)
   * — never defaulted to "regular" under the hood, since that would misleadingly imply the
   * customer chose something for, say, a biryani. */
  sugarLevel: SugarLevelSchema.optional(),
  iceLevel: IceLevelSchema.optional(),
  /** Names from the shared MenuAddOnPrice catalog (see menu.ts) — no longer a closed enum, so a
   * new brand's own add-ons (e.g. "Extra Raita") need no shared-types change to exist. */
  addOnIds: z.array(z.string()),
  /** Which size the customer picked — must match the item's own `portionSize` (the default) or
   * one of its `sizeVariants` labels (see MenuItem in menu.ts); absent means "the default size,"
   * same as sugarLevel/iceLevel above being absent means "no such concept for this item." Never
   * trusted for pricing — the server re-resolves the price for whichever label this names. */
  selectedSizeLabel: z.string().optional(),
  /** Free-text notes from the customer (e.g. "extra hot", "no straw") — shown to the kitchen as-is, never parsed. */
  comment: z.string().max(200).optional(),
});
export type Customization = z.infer<typeof CustomizationSchema>;

/** "Choose N" combo lines use a synthetic id `combo:<comboId>:<anything>` instead of a real menu item id. */
const COMBO_LINE_ID_PREFIX = "combo:";

export function isComboLineId(menuItemId: string): boolean {
  return menuItemId.startsWith(COMBO_LINE_ID_PREFIX);
}

export function makeComboLineId(comboId: string, discriminator: string): string {
  return `${COMBO_LINE_ID_PREFIX}${comboId}:${discriminator}`;
}

/**
 * What the client sends when building a cart/placing an order. Deliberately has
 * NO price fields and no display fields (name/image) — those are always
 * server-resolved and snapshotted, never accepted from the client. This is what
 * makes "never trust a client-submitted price" structurally true rather than a
 * convention someone has to remember to enforce.
 */
export const CartLineRequestSchema = z.object({
  lineId: z.string(),
  menuItemId: z.string(),
  quantity: z.number().int().min(1).max(MAX_QUANTITY_PER_LINE),
  customization: CustomizationSchema,
});
export type CartLineRequest = z.infer<typeof CartLineRequestSchema>;

export const CreateOrderCartSchema = z.array(CartLineRequestSchema).min(1).max(MAX_LINE_ITEMS_PER_ORDER);

/**
 * A cart line after the server has resolved it against the current menu — this is
 * what actually gets persisted on an Order and returned to clients for display.
 */
export const ResolvedCartLineSchema = z.object({
  lineId: z.string(),
  menuItemId: z.string(),
  signatureName: z.string(),
  commonName: z.string(),
  /** Absent for combos without a representative photo (e.g. "choose your own"). */
  image: z.string().optional(),
  unitPrice: z.number().nonnegative(),
  /** Pre-sale-discount price, for strikethrough display — equals unitPrice when the item wasn't on sale. */
  originalUnitPrice: z.number().nonnegative(),
  /** Snapshotted alongside unitPrice at order time — add-on prices can change later without altering past orders. */
  addOnPrices: z.array(z.number().nonnegative()),
  quantity: z.number().int().min(1).max(MAX_QUANTITY_PER_LINE),
  customization: CustomizationSchema,
  /** Absent for combo lines — drives milestone-reward eligibility (see @tbc/pricing). */
  category: MenuCategorySchema.optional(),
});
export type ResolvedCartLine = z.infer<typeof ResolvedCartLineSchema>;
