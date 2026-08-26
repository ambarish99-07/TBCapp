import { Alert } from "react-native";
import { CROSS_BRAND_ID } from "@tbc/shared-types";
import { useCartStore, type CartLine } from "../state/cartStore";

/**
 * TBC, Alchemy Tails, and GG Tiffin items can never share one cart or one order — the server
 * rejects a mismatched brandId/menuItemId pair at checkout (see priceResolver's
 * `{ _id: line.menuItemId, brandId }` lookup). Every "Add to cart" entry point should route
 * through this instead of calling `addLine` directly, so a customer adding a second brand's item
 * on top of an existing cart is asked first, rather than the add silently going through and only
 * failing (or mis-pricing) later.
 */
export function addLineWithBrandGuard(line: CartLine) {
  const { lines, addLine, clear } = useCartStore.getState();
  const existingBrandId = lines.find((l) => l.brandId && l.brandId !== CROSS_BRAND_ID)?.brandId;

  if (!existingBrandId || existingBrandId === line.brandId || line.brandId === CROSS_BRAND_ID) {
    addLine(line);
    return;
  }

  Alert.alert(
    "Start a new order?",
    "Your cart has items from another restaurant. You can only order from one restaurant at a time — adding this item will clear your cart.",
    [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear Cart & Add",
        style: "destructive",
        onPress: () => {
          clear();
          addLine(line);
        },
      },
    ]
  );
}
