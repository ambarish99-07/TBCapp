import type { TiffinSingleMealOrderStatus } from "@tbc/shared-types";
import { useMemo, useState } from "react";
import { useMySingleMealOrders } from "../api/tiffin.api";
import { navigationRef } from "../navigation/navigationRef";
import { useTheme } from "../state/themeStore";
import { ActiveOrderChip, makePillStyles } from "./ActiveOrderChip";
import { ActiveOrdersPickerModal } from "./ActiveOrdersPickerModal";

const ACTIVE_STATUSES: TiffinSingleMealOrderStatus[] = ["placed", "preparing", "out-for-delivery"];
const STATUS_LABELS: Record<TiffinSingleMealOrderStatus, string> = {
  placed: "Placed",
  preparing: "Preparing",
  "out-for-delivery": "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

/**
 * One row of the app-wide order tracker (see ActiveOrderPills.tsx for the floating column it's
 * mounted inside) — jumps straight to whichever GG Tiffin single-meal order is still in flight,
 * so closing or backing out of the tracking screen never loses the thread. When more than one
 * single-meal order is active at once (e.g. lunch and dinner ordered separately), shows a count
 * instead and opens a picker so neither order gets stranded behind the other. Renders nothing
 * when there's no active order.
 */
export function TiffinActiveOrderPill() {
  const { colors } = useTheme();
  const styles = useMemo(() => makePillStyles(colors), [colors]);
  const { data: orders } = useMySingleMealOrders();
  const [showPicker, setShowPicker] = useState(false);
  const activeOrders = useMemo(() => (orders ?? []).filter((order) => ACTIVE_STATUSES.includes(order.status)), [orders]);

  if (activeOrders.length === 0) return null;

  function goToOrder(orderId: string) {
    setShowPicker(false);
    if (navigationRef.isReady()) {
      navigationRef.navigate("TiffinSingleMealOrderTracking", { orderId });
    }
  }

  return (
    <>
      <ActiveOrderChip
        label={activeOrders.length === 1 ? "📦 Track Tiffin Order" : `📦 ${activeOrders.length} Tiffin Orders`}
        styles={styles}
        onPress={() => (activeOrders.length === 1 ? goToOrder(activeOrders[0].id) : setShowPicker(true))}
      />
      <ActiveOrdersPickerModal
        visible={showPicker}
        title="Your Active Tiffin Orders"
        entries={activeOrders.map((order) => ({
          key: order.id,
          title: order.dishName,
          subtitle: `${order.orderNumber} · ${order.mealType}`,
          statusLabel: STATUS_LABELS[order.status],
        }))}
        onSelect={goToOrder}
        onDismiss={() => setShowPicker(false)}
      />
    </>
  );
}
