import type { Brand, Order, OrderStatus } from "@tbc/shared-types";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { adminClient } from "../api/adminClient.js";
import { Card } from "../components/ui/Card.js";
import { PageHeader } from "../components/ui/PageHeader.js";
import { Segmented } from "../components/ui/Segmented.js";
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

// Same five statuses as the filter bar (minus "All") — each tile is also a shortcut into that
// filter, so the at-a-glance summary and the table below always agree with each other.
const STAT_TILES = STATUS_FILTERS.filter((f): f is { key: OrderStatus; label: string } => f.key !== "all");

type Period = "all" | "today" | "week" | "month";
const PERIOD_OPTIONS: { key: Period; label: string }[] = [
  { key: "all", label: "All time" },
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
];
const PERIOD_MS: Record<Period, number | null> = {
  all: null,
  today: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
};

function withinPeriod(order: Order, period: Period): boolean {
  const ms = PERIOD_MS[period];
  if (ms == null) return true;
  return new Date(order.createdAt).getTime() >= Date.now() - ms;
}

export function OrdersPage() {
  // Lets a link elsewhere in the admin (e.g. the Dashboard's "Orders Today" stat card) land here
  // pre-filtered — /orders?period=today — instead of just dumping the visitor on the unfiltered list.
  const [searchParams] = useSearchParams();
  const initialPeriod = searchParams.get("period");
  const [period, setPeriod] = useState<Period>(initialPeriod === "today" || initialPeriod === "week" || initialPeriod === "month" ? initialPeriod : "all");

  const [orders, setOrders] = useState<Order[]>([]);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [brands, setBrands] = useState<Brand[]>([]);
  const [brandFilter, setBrandFilter] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);
  // Unfiltered, fetched once — the counts in the stat row above the table need to reflect every
  // order regardless of whatever status/brand filter is currently applied to the table below.
  const [allOrders, setAllOrders] = useState<Order[]>([]);

  useEffect(() => {
    adminClient.get<{ brands: Brand[] }>("/admin/brands").then((res) => setBrands(res.data.brands));
    adminClient.get<{ orders: Order[] }>("/admin/orders").then((res) => setAllOrders(res.data.orders));
  }, []);

  // Respects the period filter too, so the tiles stay in sync with whatever the table below is
  // actually showing.
  const statusCounts = useMemo(() => {
    const counts = new Map<OrderStatus, number>();
    for (const order of allOrders) {
      if (!withinPeriod(order, period)) continue;
      counts.set(order.status, (counts.get(order.status) ?? 0) + 1);
    }
    return counts;
  }, [allOrders, period]);

  async function reloadFilteredOrders() {
    setIsLoading(true);
    const params: Record<string, string> = {};
    if (statusFilter !== "all") params.status = statusFilter;
    if (brandFilter !== "all") params.brandId = brandFilter;
    const res = await adminClient.get<{ orders: Order[] }>("/admin/orders", { params });
    setOrders(res.data.orders);
    setIsLoading(false);
  }

  useEffect(() => {
    reloadFilteredOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, brandFilter]);

  const periodFilteredOrders = useMemo(() => orders.filter((order) => withinPeriod(order, period)), [orders, period]);

  async function handleCancel(orderId: string) {
    if (!confirm("Cancel this order?")) return;
    await adminClient.patch(`/admin/orders/${orderId}/status`, { status: "cancelled" });
    await Promise.all([reloadFilteredOrders(), adminClient.get<{ orders: Order[] }>("/admin/orders").then((res) => setAllOrders(res.data.orders))]);
  }

  return (
    <div>
      <PageHeader title="Orders" action={<Segmented options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />} />

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {STAT_TILES.map((tile) => (
          <button key={tile.key} onClick={() => setStatusFilter(tile.key)} className="text-left">
            <Card
              className={`transition-shadow hover:shadow ${statusFilter === tile.key ? "border-primary/50 ring-1 ring-primary/30" : ""}`}
            >
              <p className="text-xs font-bold uppercase tracking-wide text-muted">{tile.label}</p>
              <p className="mt-1.5 text-2xl font-extrabold text-text">{statusCounts.get(tile.key) ?? 0}</p>
            </Card>
          </button>
        ))}
      </div>

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
        {isLoading ? <p className="text-sm text-muted">Loading…</p> : <OrderTable orders={periodFilteredOrders} onCancel={handleCancel} />}
      </Card>
    </div>
  );
}
