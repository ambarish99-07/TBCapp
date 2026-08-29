import type { Order } from "@tbc/shared-types";
import { ArrowDown, ArrowUp, ArrowUpDown, MoreHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { StatusBadge } from "./StatusBadge.js";
import { EmptyState } from "./ui/EmptyState.js";
import { Table, Td, Th, Thead, Tr } from "./ui/Table.js";

type SortKey = "orderNumber" | "total";

function SortableTh({ label, active, dir, onClick }: { label: string; active: boolean; dir: "asc" | "desc"; onClick: () => void }) {
  const Icon = active ? (dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <Th>
      <button onClick={onClick} className="inline-flex items-center gap-1 hover:text-text">
        {label}
        <Icon size={12} />
      </button>
    </Th>
  );
}

interface Props {
  orders: Order[];
  /** Quick "Cancel order" from the row's own "…" menu — omit to hide the menu entirely (e.g. a
   * read-only embed elsewhere). */
  onCancel?: (orderId: string) => void;
}

export function OrderTable({ orders, onCancel }: Props) {
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  function toggleSort(key: SortKey) {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("desc");
      return;
    }
    setSortDir((dir) => (dir === "desc" ? "asc" : "desc"));
  }

  const sortedOrders = useMemo(() => {
    if (!sortKey) return orders;
    const factor = sortDir === "asc" ? 1 : -1;
    return [...orders].sort((a, b) => {
      if (sortKey === "orderNumber") return factor * a.orderNumber.localeCompare(b.orderNumber);
      return factor * (a.totals.total - b.totals.total);
    });
  }, [orders, sortKey, sortDir]);

  if (orders.length === 0) {
    return <EmptyState message="No orders match this filter." />;
  }

  return (
    <Table>
      <Thead>
        <Tr>
          <SortableTh label="Order #" active={sortKey === "orderNumber"} dir={sortDir} onClick={() => toggleSort("orderNumber")} />
          <Th>Customer</Th>
          <Th>Deliver To</Th>
          <Th>Status</Th>
          <SortableTh label="Total" active={sortKey === "total"} dir={sortDir} onClick={() => toggleSort("total")} />
          <Th>Payment</Th>
          {onCancel && <Th></Th>}
        </Tr>
      </Thead>
      <tbody>
        {sortedOrders.map((order) => {
          const isForRecipient = order.deliveryFor === "recipient";
          const canCancel = order.status !== "delivered" && order.status !== "cancelled";
          return (
            <Tr key={order.id}>
              <Td>
                <Link to={`/orders/${order.id}`} className="font-semibold text-primary-dark hover:underline">
                  {order.orderNumber}
                </Link>
              </Td>
              <Td>{order.customer?.name ?? order.delivery.fullName}</Td>
              <Td>
                {isForRecipient ? (
                  <span className="font-semibold text-danger">👤 {order.delivery.fullName}</span>
                ) : (
                  <span className="text-muted">Self</span>
                )}
              </Td>
              <Td>
                <StatusBadge status={order.status} />
              </Td>
              <Td>₹{order.totals.total}</Td>
              <Td>
                {order.payment.method} · {order.payment.status}
              </Td>
              {onCancel && (
                <Td className="relative text-right">
                  <button
                    onClick={() => setOpenMenuId((id) => (id === order.id ? null : order.id))}
                    className="rounded-lg p-1.5 hover:bg-surface"
                  >
                    <MoreHorizontal size={16} className="text-muted" />
                  </button>
                  {openMenuId === order.id && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                      <div className="absolute right-2 top-9 z-20 w-40 rounded-xl border border-border bg-white p-1.5 text-left shadow-lg">
                        <Link
                          to={`/orders/${order.id}`}
                          className="block rounded-lg px-2.5 py-2 text-sm font-semibold text-text hover:bg-surface"
                        >
                          View details
                        </Link>
                        {canCancel && (
                          <button
                            onClick={() => {
                              setOpenMenuId(null);
                              onCancel(order.id);
                            }}
                            className="w-full rounded-lg px-2.5 py-2 text-left text-sm font-semibold text-danger hover:bg-danger-soft"
                          >
                            Cancel order
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </Td>
              )}
            </Tr>
          );
        })}
      </tbody>
    </Table>
  );
}
