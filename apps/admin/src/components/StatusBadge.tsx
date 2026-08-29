import type { OrderStatus } from "@tbc/shared-types";

const STATUS_COLORS: Record<OrderStatus, string> = {
  received: "#8A7B6C",
  preparing: "#D98E4A",
  "out-for-delivery": "#3B7DD8",
  delivered: "#2E8B57",
  cancelled: "#B3261E",
};

/** Light pill + colored dot, not a solid-fill badge — reads calmer across a long list of rows
 * while the dot still carries the same at-a-glance color coding. */
export function StatusBadge({ status }: { status: OrderStatus }) {
  const color = STATUS_COLORS[status];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-1 text-xs font-bold text-text">
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      {status}
    </span>
  );
}
