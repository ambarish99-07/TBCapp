import { computeComboPrice } from "@tbc/pricing";
import { makeComboLineId } from "@tbc/shared-types";
import type { CartLine } from "../state/cartStore";

/**
 * Builds the synthetic combo cart line both CombosScreen (curated) and
 * ChooseComboScreen (choose-your-own) add. Price is always computed live from
 * the constituent items' base prices — 15% off their sum — never a stored
 * value, so it can't drift from what the server independently recomputes.
 * `payload` is the discriminator encoded into the line id: an arbitrary token
 * for curated combos (items are fixed), or the chosen item ids joined with
 * "+" for choose-n combos (so the server can validate/reprice the same pick).
 */
export function makeComboCartLine(params: {
  comboId: string;
  name: string;
  description: string;
  image?: string;
  constituentBasePrices: number[];
  payload: string;
}): CartLine {
  // menuItemId must stay exactly `combo:<comboId>:<payload>` — the server parses
  // payload to recover which items were chosen. lineId only needs to be unique
  // within the local cart array (React keys, removeLine/setQuantity lookups), so
  // it gets its own timestamp suffix — otherwise adding the same curated combo
  // twice would produce two lines sharing one id and corrupt local cart edits.
  const menuItemId = makeComboLineId(params.comboId, params.payload);
  const lineId = `${menuItemId}:${Date.now()}`;
  const price = computeComboPrice(params.constituentBasePrices);
  const fullPriceSum = params.constituentBasePrices.reduce((sum, p) => sum + p, 0);

  return {
    lineId,
    menuItemId,
    signatureName: params.name,
    commonName: params.description,
    image: params.image ?? "",
    unitPrice: price,
    originalUnitPrice: fullPriceSum,
    addOnPrices: [],
    quantity: 1,
    sugarLevel: "regular",
    iceLevel: "regular",
    addOnIds: [],
    isCombo: true,
  };
}
