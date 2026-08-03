import type { OrderStatus } from "@tbc/shared-types";

const FORWARD_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  received: "preparing",
  preparing: "out-for-delivery",
  "out-for-delivery": "delivered",
};

interface Props {
  status: OrderStatus;
  onAdvance: (next: OrderStatus) => void;
  onCancel: () => void;
}

export function StatusAdvanceControl({ status, onAdvance, onCancel }: Props) {
  const next = FORWARD_STATUS[status];
  const isTerminal = status === "delivered" || status === "cancelled";

  return (
    <div style={{ display: "flex", gap: 8 }}>
      {next && <button onClick={() => onAdvance(next)}>Advance to {next}</button>}
      {!isTerminal && (
        <button onClick={onCancel} style={{ color: "#B3261E" }}>
          Cancel order
        </button>
      )}
    </div>
  );
}
