import type { Brand, Order, OrderStatus } from "@tbc/shared-types";
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
  const [brands, setBrands] = useState<Brand[]>([]);
  const [brandFilter, setBrandFilter] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    adminClient.get<{ brands: Brand[] }>("/admin/brands").then((res) => setBrands(res.data.brands));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    const params: Record<string, string> = {};
    if (statusFilter !== "all") params.status = statusFilter;
    if (brandFilter !== "all") params.brandId = brandFilter;
    adminClient
      .get<{ orders: Order[] }>("/admin/orders", { params })
      .then((res) => {
        if (!cancelled) setOrders(res.data.orders);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [statusFilter, brandFilter]);

  return (
    <div>
      <h1>Orders</h1>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center" }}>
        {STATUS_FILTERS.map((filter) => (
          <button
            key={filter.key}
            onClick={() => setStatusFilter(filter.key)}
            style={{ fontWeight: statusFilter === filter.key ? 700 : 400 }}
          >
            {filter.label}
          </button>
        ))}
        <select value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)} style={{ marginLeft: 16 }}>
          <option value="all">All brands</option>
          {brands.map((brand) => (
            <option key={brand.id} value={brand.id}>
              {brand.name}
            </option>
          ))}
        </select>
      </div>
      {isLoading ? <p>Loading…</p> : <OrderTable orders={orders} />}
    </div>
  );
}
