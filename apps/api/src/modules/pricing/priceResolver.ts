import { computeComboPrice, round, type CartLineInput, type DrinkCategory } from "@tbc/pricing";
import { CROSS_BRAND_ID, isComboLineId, type CartLineRequest, type ResolvedCartLine } from "@tbc/shared-types";
import { ComboModel } from "../../db/models/Combo.model.js";
import { MenuItemModel } from "../../db/models/MenuItem.model.js";
import { buildAddOnPriceLookup, liveBrandIds } from "../menu/menu.service.js";

export class PriceResolutionError extends Error {}

export interface ResolvedCart {
  resolvedLines: ResolvedCartLine[];
  pricingLines: CartLineInput[];
}

/** format: combo:<comboId>:<payload> — payload is only meaningful for choose-n combos (see resolveComboConstituentIds). */
function parseComboLineId(menuItemId: string): { comboId: string; payload: string } {
  const parts = menuItemId.split(":");
  return { comboId: parts[1] ?? "", payload: parts[2] ?? "" };
}

/**
 * Curated combos have fixed constituents. Choose-n combos encode the customer's
 * picks in the line id's payload (itemId1+itemId2+...) — validated here against
 * chooseCount and eligibleItemIds so a tampered payload can't sneak in an
 * ineligible or duplicate item.
 */
function resolveComboConstituentIds(
  combo: {
    type: string;
    itemIds?: string[] | null;
    chooseCount?: number | null;
    eligibleItemIds?: string[] | null;
  },
  payload: string
): string[] {
  if (combo.type === "curated") {
    return combo.itemIds ?? [];
  }

  const chosenIds = payload.split("+").filter(Boolean);
  if (chosenIds.length !== combo.chooseCount) {
    throw new PriceResolutionError(`This combo requires exactly ${combo.chooseCount} items`);
  }
  if (new Set(chosenIds).size !== chosenIds.length) {
    throw new PriceResolutionError("Combo selection cannot repeat the same item");
  }
  for (const id of chosenIds) {
    if (!combo.eligibleItemIds?.includes(id)) {
      throw new PriceResolutionError(`Item ${id} is not eligible for this combo`);
    }
  }
  return chosenIds;
}

/**
 * The base price for whichever size the customer picked — the item's own default (`price`) when
 * no size was selected or it matches `portionSize`, or the matching entry in `sizeVariants`
 * otherwise. Never trusts a client-submitted price for a size, same as add-ons: only the label is
 * taken from the request, the price always comes from what's actually stored on the item.
 */
function resolveSizeBasePrice(
  menuItem: {
    price: number;
    portionSize?: string | null;
    sizeVariants?: { label: string; price: number; isAvailable?: boolean | null }[] | null;
  },
  selectedSizeLabel: string | undefined
): number {
  if (!selectedSizeLabel || selectedSizeLabel === menuItem.portionSize) return menuItem.price;
  const variant = menuItem.sizeVariants?.find((v) => v.label === selectedSizeLabel);
  if (!variant) {
    throw new PriceResolutionError(`This item isn't available in size "${selectedSizeLabel}"`);
  }
  if (variant.isAvailable === false) {
    throw new PriceResolutionError(`Size "${selectedSizeLabel}" is currently out of stock`);
  }
  return variant.price;
}

/** A few items may carry a salePercent — the charged price is the marked-down one, `basePrice` stays the strikethrough display value. */
function resolveUnitPrice(menuItem: { salePercent?: number | null }, basePrice: number): number {
  if (!menuItem.salePercent) return basePrice;
  return round(basePrice * (1 - menuItem.salePercent / 100));
}

const DRINK_CATEGORIES = new Set<string>(["signature-shakes", "cold-coffee"] satisfies DrinkCategory[]);

/** Milestone rewards only ever check for "cold-coffee" specifically (see @tbc/pricing/milestoneReward) —
 * every other category (mocktails, GG Tiffin's veg/non-veg/mixed, ...) is functionally identical to
 * "not a drink" here, same as before those categories existed. */
function toDrinkCategory(category: string): DrinkCategory | undefined {
  return DRINK_CATEGORIES.has(category) ? (category as DrinkCategory) : undefined;
}

/**
 * THE IMPURE HALF of pricing: looks up every line's real, current price server-side
 * and validates every add-on id against the known list. A client-submitted price is
 * never read from the request — CartLineRequest has no price field at all (see
 * @tbc/shared-types), so there is nothing here to "ignore"; the shape itself makes
 * tampering structurally impossible. Throws PriceResolutionError on any unknown
 * menu item, unknown combo, unknown add-on, or add-ons attached to a combo line.
 */
export async function resolveCartLines(lines: CartLineRequest[], brandId: string): Promise<ResolvedCart> {
  const resolvedLines: ResolvedCartLine[] = [];
  const pricingLines: CartLineInput[] = [];
  // Fetched once per order, not once per add-on — same DB-driven lookup menu.service.ts's
  // withResolvedAddOns uses for the browsable menu, so a cart never disagrees with the menu on
  // what an add-on costs. No longer a fixed, closed list (see @tbc/shared-types' Customization
  // doc-comment), so a brand new food category's own add-ons (e.g. "Extra Raita") just need a row
  // in the shared MenuAddOnPrice catalog, not a code change.
  const addOnPriceLookup = await buildAddOnPriceLookup();

  for (const line of lines) {
    if (isComboLineId(line.menuItemId)) {
      const { comboId, payload } = parseComboLineId(line.menuItemId);
      // Looked up by id alone, not yet brand-scoped — the one cross-brand combo isn't owned
      // by the order's brand at all, so it would never match a `{_id, brandId}` filter.
      const combo = await ComboModel.findOne({ _id: comboId }).lean();
      if (!combo || (combo.brandId !== brandId && combo.brandId !== CROSS_BRAND_ID)) {
        throw new PriceResolutionError(`Unknown combo: ${comboId}`);
      }
      if (line.customization.addOnIds.length > 0) {
        throw new PriceResolutionError("Add-ons are not allowed on combo lines");
      }

      const constituentIds = resolveComboConstituentIds(combo, payload);
      // A normal combo's items are scoped to its own brand (the existing tamper guard);
      // the cross-brand combo's items may come from any live brand instead.
      const constituentFilter =
        combo.brandId === CROSS_BRAND_ID
          ? { _id: { $in: constituentIds }, brandId: { $in: await liveBrandIds() } }
          : { _id: { $in: constituentIds }, brandId };
      const constituentItems = await MenuItemModel.find(constituentFilter).lean();
      if (constituentItems.length !== constituentIds.length) {
        throw new PriceResolutionError("One or more combo items no longer exist");
      }
      const outOfStockConstituent = constituentItems.find((item) => item.isAvailable === false);
      if (outOfStockConstituent) {
        throw new PriceResolutionError(`${outOfStockConstituent.signatureName} is currently out of stock`);
      }

      // Always the base price, never a sale-discounted one — the combo discount
      // and a per-item sale are separate mechanisms and shouldn't stack.
      const basePrices = constituentIds.map((id) => constituentItems.find((item) => item._id === id)!.price);
      const fullPriceSum = basePrices.reduce((sum, price) => sum + price, 0);
      const comboPrice = computeComboPrice(basePrices, combo.discountPercent ?? undefined);

      resolvedLines.push({
        lineId: line.lineId,
        menuItemId: line.menuItemId,
        signatureName: combo.name,
        commonName: combo.name,
        image: combo.image ?? undefined,
        unitPrice: comboPrice,
        originalUnitPrice: fullPriceSum,
        addOnPrices: [],
        quantity: line.quantity,
        customization: line.customization,
      });
      pricingLines.push({
        unitPrice: comboPrice,
        addOnPrices: [],
        quantity: line.quantity,
        isCombo: true,
      });
      continue;
    }

    const menuItem = await MenuItemModel.findOne({ _id: line.menuItemId, brandId }).lean();
    if (!menuItem) {
      throw new PriceResolutionError(`Unknown menu item: ${line.menuItemId}`);
    }
    if (menuItem.isAvailable === false) {
      throw new PriceResolutionError(`${menuItem.signatureName} is currently out of stock`);
    }

    const addOnPrices = line.customization.addOnIds.map((addOnName) => {
      const entry = addOnPriceLookup.get(addOnName);
      if (entry === undefined) {
        throw new PriceResolutionError(`Unknown add-on: ${addOnName}`);
      }
      if (!entry.isAvailable) {
        throw new PriceResolutionError(`Add-on "${addOnName}" is currently out of stock`);
      }
      return entry.price;
    });

    const sizeBasePrice = resolveSizeBasePrice(menuItem, line.customization.selectedSizeLabel);
    const unitPrice = resolveUnitPrice(menuItem, sizeBasePrice);
    // Both the saved order line and the pricing line only ever care about "is this a drink
    // category the milestone rewards track" — anything else (mocktails, premium mains, ...) must
    // stay undefined here, not the raw menu category, since Order.model's `category` enum only
    // accepts "signature-shakes"/"cold-coffee" and rejects the document outright otherwise.
    const drinkCategory = toDrinkCategory(menuItem.category);

    resolvedLines.push({
      lineId: line.lineId,
      menuItemId: line.menuItemId,
      signatureName: menuItem.signatureName,
      commonName: menuItem.commonName,
      image: menuItem.image,
      unitPrice,
      // The selected size's own pre-discount price, for strikethrough display — not always the
      // default size's price, since a customer who picked a bigger size should see THAT size's
      // sale discount, not the default size's.
      originalUnitPrice: sizeBasePrice,
      addOnPrices,
      quantity: line.quantity,
      customization: line.customization,
      category: drinkCategory,
    });
    pricingLines.push({
      unitPrice,
      addOnPrices,
      quantity: line.quantity,
      isCombo: false,
      category: drinkCategory,
    });
  }

  return { resolvedLines, pricingLines };
}
