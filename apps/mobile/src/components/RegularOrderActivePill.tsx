import type { OrderStatus } from "@tbc/shared-types";
import { useMemo, useState } from "react";
import { useBrands } from "../api/brands.api";
import { useMyOrders } from "../api/orders.api";
import { navigationRef } from "../navigation/navigationRef";
import { useTheme } from "../state/themeStore";
import { ActiveOrderChip, makePillStyles } from "./ActiveOrderChip";
import { ActiveOrdersPickerModal } from "./ActiveOrdersPickerModal";

const ACTIVE_STATUSES: OrderStatus[] = ["received", "preparing", "out-for-delivery"];
const STATUS_LABELS: Record<OrderStatus, string> = {
  received: "Received",
  preparing: "Preparing",
  "out-for-delivery": "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

/**
 * One row of the app-wide order tracker (see ActiveOrderPills.tsx) — jumps straight to whichever
 * TBC/Alchemy Tails order is still in flight, so closing or backing out of OrderStatusScreen
 * never loses the thread. When more than one order is active at once (e.g. a TBC order and an
 * Alchemy Tails order placed minutes apart), shows a count instead and opens a picker so neither
 * order gets stranded behind the other. Renders nothing when there's no active order.
 */
export function RegularOrderActivePill() {
  const { colors } = useTheme();
  const styles = useMemo(() => makePillStyles(colors), [colors]);
  const { data: orders } = useMyOrders();
  const { data: brands } = useBrands();
  const [showPicker, setShowPicker] = useState(false);
  const activeOrders = useMemo(() => (orders ?? []).filter((order) => ACTIVE_STATUSES.includes(order.status)), [orders]);

  if (activeOrders.length === 0) return null;

  function goToOrder(accessToken: string) {
    setShowPicker(false);
    if (navigationRef.isReady()) {
      navigationRef.navigate("OrderStatus", { accessToken });
    }
  }

  return (
    <>
      <ActiveOrderChip
        label={activeOrders.length === 1 ? "🥤 View Order Status" : `🥤 ${activeOrders.length} Active Orders`}
        styles={styles}
        onPress={() => (activeOrders.length === 1 ? goToOrder(activeOrders[0].accessToken) : setShowPicker(true))}
      />
      <ActiveOrdersPickerModal
        visible={showPicker}
        title="Your Active Orders"
        entries={activeOrders.map((order) => ({
          key: order.accessToken,
          title: brands?.find((brand) => brand.id === order.brandId)?.name ?? order.brandId,
          subtitle: `${order.orderNumber} · ₹${order.totals.total}`,
          statusLabel: STATUS_LABELS[order.status],
        }))}
        onSelect={goToOrder}
        onDismiss={() => setShowPicker(false)}
      />
    </>
  );
}
