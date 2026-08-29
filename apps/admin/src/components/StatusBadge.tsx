import type { OrderStatus } from "@tbc/shared-types";

const STATUS_COLORS: Record<OrderStatus, string> = {
  received: "#8A7B6C",
  preparing: "#D98E4A",
  "out-for-delivery": "#3B7DD8",
  delivered: "#2E8B57",
  cancelled: "#B3261E",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold text-white"
      style={{ backgroundColor: STATUS_COLORS[status] }}
    >
      {status}
    </span>
  );
}
