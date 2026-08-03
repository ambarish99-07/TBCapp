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
      style={{
        backgroundColor: STATUS_COLORS[status],
        color: "#fff",
        borderRadius: 12,
        padding: "2px 10px",
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      {status}
    </span>
  );
}
