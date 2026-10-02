import { FEAST_COMBO_BRAND_ID } from "@tbc/shared-types";
import { useCartStore, type CartLine } from "../state/cartStore";

/**
 * The single "Add to cart" entry point. Every kitchen shares one location, so one cart (and one
 * order, one delivery, one payment) can freely mix kitchens — biryani from one, a shake from
 * another. The server derives each line's kitchen itself and checks every kitchen in the order is
 * open, so nothing here needs to guard against mixing any more.
 */
export function addLineToCart(line: CartLine) {
  useCartStore.getState().addLine(line);
}

/** Every real kitchen the cart's lines come from (a Feast combo contributes each of its items'
 * kitchens), deduplicated in cart order — what the cart checks are open, and what coupons scope to. */
export function cartKitchenIds(lines: CartLine[]): string[] {
  const ids = new Set<string>();
  for (const line of lines) {
    for (const id of line.kitchenBrandIds ?? [line.brandId]) {
      if (id && id !== FEAST_COMBO_BRAND_ID) ids.add(id);
    }
  }
  return [...ids];
}
