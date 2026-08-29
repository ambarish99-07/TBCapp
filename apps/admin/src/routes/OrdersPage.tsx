import type { Brand, Order, OrderStatus } from "@tbc/shared-types";
import { useEffect, useState } from "react";
import { adminClient } from "../api/adminClient.js";
import { Card } from "../components/ui/Card.js";
import { PageHeader } from "../components/ui/PageHeader.js";
import { Select } from "../components/ui/Input.js";
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
      <PageHeader title="Orders" />
      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.key}
              onClick={() => setStatusFilter(filter.key)}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
                statusFilter === filter.key ? "bg-primary text-white" : "bg-surface text-muted hover:text-text"
              }`}
            >
              {filter.label}
            </button>
          ))}
          <Select value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)} className="ml-auto">
            <option value="all">All brands</option>
            {brands.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name}
              </option>
            ))}
          </Select>
        </div>
        {isLoading ? <p className="text-sm text-muted">Loading…</p> : <OrderTable orders={orders} />}
      </Card>
    </div>
  );
}
