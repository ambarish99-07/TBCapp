import { ADD_ON_PRICES, computeComboPrice, round, type CartLineInput } from "@tbc/pricing";
import { isComboLineId, type AddOnId, type CartLineRequest, type ResolvedCartLine } from "@tbc/shared-types";
import { ComboModel } from "../../db/models/Combo.model.js";
import { MenuItemModel } from "../../db/models/MenuItem.model.js";

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

/** A few items may carry a salePercent — the charged price is the marked-down one, `price` stays the strikethrough display value. */
function resolveUnitPrice(menuItem: { price: number; salePercent?: number | null }): number {
  if (!menuItem.salePercent) return menuItem.price;
  return round(menuItem.price * (1 - menuItem.salePercent / 100));
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

  for (const line of lines) {
    if (isComboLineId(line.menuItemId)) {
      const { comboId, payload } = parseComboLineId(line.menuItemId);
      const combo = await ComboModel.findOne({ _id: comboId, brandId }).lean();
      if (!combo) {
        throw new PriceResolutionError(`Unknown combo: ${comboId}`);
      }
      if (line.customization.addOnIds.length > 0) {
        throw new PriceResolutionError("Add-ons are not allowed on combo lines");
      }

      const constituentIds = resolveComboConstituentIds(combo, payload);
      const constituentItems = await MenuItemModel.find({ _id: { $in: constituentIds }, brandId }).lean();
      if (constituentItems.length !== constituentIds.length) {
        throw new PriceResolutionError("One or more combo items no longer exist");
      }

      // Always the base price, never a sale-discounted one — the combo discount
      // and a per-item sale are separate mechanisms and shouldn't stack.
      const basePrices = constituentIds.map((id) => constituentItems.find((item) => item._id === id)!.price);
      const fullPriceSum = basePrices.reduce((sum, price) => sum + price, 0);
      const comboPrice = computeComboPrice(basePrices);

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

    const addOnPrices = line.customization.addOnIds.map((addOnId) => {
      const price = ADD_ON_PRICES[addOnId as AddOnId];
      if (price === undefined) {
        throw new PriceResolutionError(`Unknown add-on: ${addOnId}`);
      }
      return price;
    });

    const unitPrice = resolveUnitPrice(menuItem);

    resolvedLines.push({
      lineId: line.lineId,
      menuItemId: line.menuItemId,
      signatureName: menuItem.signatureName,
      commonName: menuItem.commonName,
      image: menuItem.image,
      unitPrice,
      originalUnitPrice: menuItem.price,
      addOnPrices,
      quantity: line.quantity,
      customization: line.customization,
      category: menuItem.category,
    });
    pricingLines.push({
      unitPrice,
      addOnPrices,
      quantity: line.quantity,
      isCombo: false,
      category: menuItem.category,
    });
  }

  return { resolvedLines, pricingLines };
}
