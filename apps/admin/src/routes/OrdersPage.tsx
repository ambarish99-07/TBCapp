import type { Order, OrderStatus } from "@tbc/shared-types";
import { useEffect, useState } from "react";
import { adminClient } from "../api/adminClient.js";
import { OrderTable } from "../components/OrderTable.js";

const STATUS_FILTERS: { key: OrderStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "received", label: "Received" },
  { key: "preparing", label: "Preparing" },
  { key: "out-for-delivery", label: "Out for delivery" },
  { key: "delivered", label: "Delivered" },
  { key: "cancelled", label: "Cancelled" },
];

export function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    adminClient
      .get<{ orders: Order[] }>("/admin/orders", { params: statusFilter === "all" ? {} : { status: statusFilter } })
      .then((res) => {
        if (!cancelled) setOrders(res.data.orders);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [statusFilter]);

  return (
    <div>
      <h1>Orders</h1>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {STATUS_FILTERS.map((filter) => (
          <button
            key={filter.key}
            onClick={() => setStatusFilter(filter.key)}
            style={{ fontWeight: statusFilter === filter.key ? 700 : 400 }}
          >
            {filter.label}
          </button>
        ))}
      </div>
      {isLoading ? <p>Loading…</p> : <OrderTable orders={orders} />}
    </div>
  );
}
