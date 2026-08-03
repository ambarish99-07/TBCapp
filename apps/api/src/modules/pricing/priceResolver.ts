import { ADD_ON_PRICES, type CartLineInput } from "@tbc/pricing";
import { isComboLineId, type AddOnId, type CartLineRequest, type ResolvedCartLine } from "@tbc/shared-types";
import { ComboModel } from "../../db/models/Combo.model.js";
import { MenuItemModel } from "../../db/models/MenuItem.model.js";

export class PriceResolutionError extends Error {}

export interface ResolvedCart {
  resolvedLines: ResolvedCartLine[];
  pricingLines: CartLineInput[];
}

function parseComboId(menuItemId: string): string {
  // format: combo:<comboId>:<discriminator>
  const parts = menuItemId.split(":");
  return parts[1] ?? "";
}

/**
 * THE IMPURE HALF of pricing: looks up every line's real, current price server-side
 * and validates every add-on id against the known list. A client-submitted price is
 * never read from the request — CartLineRequest has no price field at all (see
 * @tbc/shared-types), so there is nothing here to "ignore"; the shape itself makes
 * tampering structurally impossible. Throws PriceResolutionError on any unknown
 * menu item, unknown combo, unknown add-on, or add-ons attached to a combo line.
 */
export async function resolveCartLines(lines: CartLineRequest[]): Promise<ResolvedCart> {
  const resolvedLines: ResolvedCartLine[] = [];
  const pricingLines: CartLineInput[] = [];

  for (const line of lines) {
    if (isComboLineId(line.menuItemId)) {
      const comboId = parseComboId(line.menuItemId);
      const combo = await ComboModel.findById(comboId).lean();
      if (!combo || combo.type !== "choose-n") {
        throw new PriceResolutionError(`Unknown combo: ${comboId}`);
      }
      if (line.customization.addOnIds.length > 0) {
        throw new PriceResolutionError("Add-ons are not allowed on combo lines");
      }

      resolvedLines.push({
        lineId: line.lineId,
        menuItemId: line.menuItemId,
        signatureName: combo.name,
        commonName: combo.name,
        image: combo.image ?? "",
        unitPrice: combo.price,
        addOnPrices: [],
        quantity: line.quantity,
        customization: line.customization,
      });
      pricingLines.push({
        unitPrice: combo.price,
        addOnPrices: [],
        quantity: line.quantity,
        isCombo: true,
      });
      continue;
    }

    const menuItem = await MenuItemModel.findById(line.menuItemId).lean();
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

    resolvedLines.push({
      lineId: line.lineId,
      menuItemId: line.menuItemId,
      signatureName: menuItem.signatureName,
      commonName: menuItem.commonName,
      image: menuItem.image,
      unitPrice: menuItem.price,
      addOnPrices,
      quantity: line.quantity,
      customization: line.customization,
    });
    pricingLines.push({
      unitPrice: menuItem.price,
      addOnPrices,
      quantity: line.quantity,
      isCombo: false,
    });
  }

  return { resolvedLines, pricingLines };
}
