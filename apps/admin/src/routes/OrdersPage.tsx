import type { Brand, Order, OrderStatus } from "@tbc/shared-types";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { adminClient } from "../api/adminClient.js";
import { Card } from "../components/ui/Card.js";
import { PageHeader } from "../components/ui/PageHeader.js";
import { Segmented } from "../components/ui/Segmented.js";
import { Select } from "../components/ui/Input.js";
import { OrderTable } from "../components/OrderTable.js";
import { SourceSwitch, useSource } from "../components/SourceSwitch.js";
import { WebsiteOrdersTable, websiteOrderKitchens, type WebsiteOrder } from "../components/WebsiteOrdersTable.js";

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

function withinPeriod(order: { createdAt: string }, period: Period): boolean {
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
  // Without this, a failed request left the table stuck on "Loading…" forever with no way to
  // tell why.
  const [loadError, setLoadError] = useState<string | null>(null);
  // Unfiltered, fetched once — the counts in the stat row above the table need to reflect every
  // order regardless of whatever status/brand filter is currently applied to the table below.
  const [allOrders, setAllOrders] = useState<Order[]>([]);

  // App / Website / Both — website orders come over the admin-peer link, unfiltered (≤200 newest),
  // and are filtered here so the same status/brand/period controls work on both.
  const [source, setSource] = useSource();
  const [websiteOrders, setWebsiteOrders] = useState<WebsiteOrder[]>([]);
  const [websiteError, setWebsiteError] = useState<string | null>(null);
  const showApp = source !== "website";
  const showWebsite = source !== "app";

  async function reloadWebsiteOrders() {
    setWebsiteError(null);
    try {
      const res = await adminClient.get<{ orders: WebsiteOrder[] }>("/admin/website/orders");
      setWebsiteOrders(res.data.orders);
    } catch (err) {
      setWebsiteError(err instanceof Error ? err.message : "Couldn't load website orders");
    }
  }

  useEffect(() => {
    if (showWebsite) reloadWebsiteOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showWebsite]);

  const filteredWebsiteOrders = useMemo(
    () =>
      websiteOrders.filter(
        (o) =>
          withinPeriod(o, period) &&
          (statusFilter === "all" || o.status === statusFilter) &&
          (brandFilter === "all" || websiteOrderKitchens(o).includes(brandFilter))
      ),
    [websiteOrders, period, statusFilter, brandFilter]
  );

  useEffect(() => {
    adminClient.get<{ brands: Brand[] }>("/admin/brands").then((res) => setBrands(res.data.brands));
    adminClient
      .get<{ orders: Order[] }>("/admin/orders")
      .then((res) => setAllOrders(res.data.orders))
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Failed to load"));
  }, []);

  // Respects the period filter too, so the tiles stay in sync with whatever the table below is
  // actually showing.
  const statusCounts = useMemo(() => {
    const counts = new Map<OrderStatus, number>();
    const rows: { createdAt: string; status: OrderStatus }[] = [...(showApp ? allOrders : []), ...(showWebsite ? websiteOrders : [])];
    for (const order of rows) {
      if (!withinPeriod(order, period)) continue;
      counts.set(order.status, (counts.get(order.status) ?? 0) + 1);
    }
    return counts;
  }, [allOrders, websiteOrders, period, showApp, showWebsite]);

  async function reloadFilteredOrders() {
    setIsLoading(true);
    setLoadError(null);
    try {
      const params: Record<string, string> = {};
      if (statusFilter !== "all") params.status = statusFilter;
      if (brandFilter !== "all") params.brandId = brandFilter;
      const res = await adminClient.get<{ orders: Order[] }>("/admin/orders", { params });
      setOrders(res.data.orders);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load orders");
    } finally {
      setIsLoading(false);
    }
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
      <PageHeader
        title="Orders"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <SourceSwitch value={source} onChange={setSource} />
            <Segmented options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />
          </div>
        }
      />

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
        {showApp &&
          (source === "both" ? <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">📱 App orders</h3> : null)}
        {showApp &&
          (loadError ? (
            <p className="text-sm font-medium text-danger">{loadError}</p>
          ) : isLoading ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : (
            <OrderTable orders={periodFilteredOrders} onCancel={handleCancel} />
          ))}
        {showWebsite && (
          <div className={showApp ? "mt-8" : ""}>
            {source === "both" && <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">🌐 Website orders</h3>}
            {websiteError ? (
              <p className="text-sm font-medium text-danger">{websiteError}</p>
            ) : (
              <WebsiteOrdersTable orders={filteredWebsiteOrders} brands={brands} onChanged={reloadWebsiteOrders} />
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
