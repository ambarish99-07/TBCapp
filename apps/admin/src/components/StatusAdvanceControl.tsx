import type { OrderStatus } from "@tbc/shared-types";
import { Button } from "./ui/Button.js";

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
    <div className="flex gap-2">
      {next && <Button onClick={() => onAdvance(next)}>Advance to {next}</Button>}
      {!isTerminal && (
        <Button variant="danger" onClick={onCancel}>
          Cancel order
        </Button>
      )}
    </div>
  );
}
