import type { AnalyticsSummary, Order } from "@tbc/shared-types";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { adminClient } from "../api/adminClient.js";
import { OrderTable } from "../components/OrderTable.js";
import { TrendChart, type TrendPoint } from "../components/TrendChart.js";
import { Card } from "../components/ui/Card.js";
import { PageHeader } from "../components/ui/PageHeader.js";
import { Segmented } from "../components/ui/Segmented.js";
import { hourLabel, monthLabel, weekLabel } from "../utils/chartLabels.js";

type Granularity = "monthly" | "weekly" | "today";
const GRANULARITY_OPTIONS: { key: Granularity; label: string }[] = [
  { key: "monthly", label: "Monthly" },
  { key: "weekly", label: "Weekly" },
  { key: "today", label: "Today" },
];

type RecentPeriod = "today" | "week" | "month";
const RECENT_PERIOD_OPTIONS: { key: RecentPeriod; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
];
const RECENT_PERIOD_MS: Record<RecentPeriod, number> = {
  today: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
};

function formatRupees(amount: number): string {
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

function buildPoints(summary: AnalyticsSummary, granularity: Granularity, metric: "revenue" | "orders"): TrendPoint[] {
  if (granularity === "monthly") {
    return summary.monthlyRevenue.map((m) => ({
      label: monthLabel(m.month),
      value: metric === "revenue" ? m.revenue : m.orders,
      secondaryLabel: metric === "revenue" ? `${m.orders} orders` : formatRupees(m.revenue),
    }));
  }
  if (granularity === "weekly") {
    return summary.weeklyRevenue.map((w) => ({
      label: weekLabel(w.weekStart),
      value: metric === "revenue" ? w.revenue : w.orders,
      secondaryLabel: metric === "revenue" ? `${w.orders} orders` : formatRupees(w.revenue),
    }));
  }
  return summary.todayHourlyRevenue.map((h) => ({
    label: h.hour % 3 === 0 ? hourLabel(h.hour) : "",
    value: metric === "revenue" ? h.revenue : h.orders,
    secondaryLabel: `${hourLabel(h.hour)} · ${metric === "revenue" ? `${h.orders} orders` : formatRupees(h.revenue)}`,
  }));
}

function StatCard({
  label,
  value,
  sub,
  barPct,
  dark,
  to,
}: {
  label: string;
  value: string;
  sub?: string;
  barPct?: number;
  dark?: boolean;
  /** Where this stat's own detail lives — the whole card becomes a link there when set. */
  to?: string;
}) {
  const content = (
    <>
      <p className={`text-xs font-bold uppercase tracking-wide ${dark ? "text-white/60" : "text-muted"}`}>{label}</p>
      <p className="mt-1.5 text-2xl font-extrabold">{value}</p>
      {sub && <p className={`text-xs ${dark ? "text-white/70" : "text-muted"}`}>{sub}</p>}
      {barPct != null && (
        <div className={`mt-3 h-1.5 w-full overflow-hidden rounded-full ${dark ? "bg-white/20" : "bg-surface"}`}>
          <div
            className={`h-full rounded-full ${dark ? "bg-white" : "bg-primary"}`}
            style={{ width: `${Math.min(100, Math.max(0, barPct))}%` }}
          />
        </div>
      )}
    </>
  );
  const className = `block rounded-2xl p-5 shadow-sm transition-shadow ${
    dark ? "bg-text text-white" : "border border-border bg-white"
  } ${to ? "hover:shadow-md" : ""}`;

  if (to) {
    return (
      <Link to={to} className={className}>
        {content}
      </Link>
    );
  }
  return <div className={className}>{content}</div>;
}

function loadErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Failed to load";
}

export function DashboardPage() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [revenueGranularity, setRevenueGranularity] = useState<Granularity>("monthly");
  const [ordersGranularity, setOrdersGranularity] = useState<Granularity>("weekly");
  const [recentPeriod, setRecentPeriod] = useState<RecentPeriod>("today");
  // Without this, a failed request left the page stuck on "Loading…" forever with no way to
  // tell why — `summary`/`orders` only ever got set on the success path.
  const [loadError, setLoadError] = useState<string | null>(null);

  function reloadOrders() {
    adminClient
      .get<{ orders: Order[] }>("/admin/orders")
      .then((res) => setOrders(res.data.orders))
      .catch((err) => setLoadError(loadErrorMessage(err)));
  }

  useEffect(() => {
    adminClient
      .get<AnalyticsSummary>("/admin/analytics")
      .then((res) => setSummary(res.data))
      .catch((err) => setLoadError(loadErrorMessage(err)));
    reloadOrders();
  }, []);

  const revenuePoints = useMemo(() => (summary ? buildPoints(summary, revenueGranularity, "revenue") : []), [summary, revenueGranularity]);
  const orderPoints = useMemo(() => (summary ? buildPoints(summary, ordersGranularity, "orders") : []), [summary, ordersGranularity]);

  const recentOrders = useMemo(() => {
    const cutoff = Date.now() - RECENT_PERIOD_MS[recentPeriod];
    return [...orders]
      .filter((order) => new Date(order.createdAt).getTime() >= cutoff)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 8);
  }, [orders, recentPeriod]);

  async function handleCancel(orderId: string) {
    if (!confirm("Cancel this order?")) return;
    await adminClient.patch(`/admin/orders/${orderId}/status`, { status: "cancelled" });
    reloadOrders();
  }

  if (loadError) {
    return (
      <div>
        <PageHeader title="Dashboard" />
        <Card>
          <p className="text-sm font-medium text-danger">{loadError}</p>
          <p className="mt-2 text-sm text-muted">Try refreshing the page, or logging out and back in.</p>
        </Card>
      </div>
    );
  }

  if (!summary) {
    return (
      <div>
        <PageHeader title="Dashboard" />
        <p className="text-sm text-muted">Loading…</p>
      </div>
    );
  }

  const ordersVsYesterdayPct =
    summary.ordersYesterday.orders > 0
      ? Math.round((summary.ordersToday.orders / summary.ordersYesterday.orders) * 100)
      : summary.ordersToday.orders > 0
        ? 100
        : 0;
  const revenueVsYesterdayPct =
    summary.ordersYesterday.revenue > 0
      ? Math.round((summary.ordersToday.revenue / summary.ordersYesterday.revenue) * 100)
      : summary.ordersToday.revenue > 0
        ? 100
        : 0;
  const newCustomerSharePct =
    summary.ordersToday.orders > 0 ? Math.round((summary.customers.newCustomersToday / summary.ordersToday.orders) * 100) : 0;

  return (
    <div>
      <PageHeader title="Dashboard" description="Today's live snapshot across every brand." />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          dark
          to="/brands"
          label="Menu Items"
          value={String(summary.catalog.totalMenuItems)}
          sub={`${summary.catalog.totalCombos} combos · ${summary.catalog.totalBrands} live brands`}
        />
        <StatCard
          to="/orders?period=today"
          label="Orders Today"
          value={String(summary.ordersToday.orders)}
          sub={`${ordersVsYesterdayPct}% of yesterday (${summary.ordersYesterday.orders})`}
          barPct={ordersVsYesterdayPct}
        />
        <StatCard
          to="/analytics#revenue"
          label="Revenue Today"
          value={formatRupees(summary.ordersToday.revenue)}
          sub={`${revenueVsYesterdayPct}% of yesterday`}
          barPct={revenueVsYesterdayPct}
        />
        <StatCard
          to="/analytics#customers"
          label="New Customers Today"
          value={String(summary.customers.newCustomersToday)}
          sub={`${newCustomerSharePct}% of today's orders`}
          barPct={newCustomerSharePct}
        />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card
          title="Revenue"
          action={
            <div className="flex items-center gap-3">
              <Segmented options={GRANULARITY_OPTIONS} value={revenueGranularity} onChange={setRevenueGranularity} />
              <Link to="/analytics#revenue" className="text-sm font-semibold text-primary-dark hover:underline">
                Details ›
              </Link>
            </div>
          }
        >
          <TrendChart points={revenuePoints} variant="line" formatValue={formatRupees} />
        </Card>

        <Card
          title="Order Summary"
          action={
            <div className="flex items-center gap-3">
              <Segmented options={GRANULARITY_OPTIONS} value={ordersGranularity} onChange={setOrdersGranularity} />
              <Link to="/orders" className="text-sm font-semibold text-primary-dark hover:underline">
                Details ›
              </Link>
            </div>
          }
        >
          <TrendChart points={orderPoints} variant="bar" formatValue={(n) => `${n} order${n === 1 ? "" : "s"}`} />
        </Card>
      </div>

      <Card
        title="Recent Orders"
        action={
          <div className="flex items-center gap-3">
            <Segmented options={RECENT_PERIOD_OPTIONS} value={recentPeriod} onChange={setRecentPeriod} />
            <Link to="/orders" className="text-sm font-semibold text-primary-dark hover:underline">
              View all ›
            </Link>
          </div>
        }
      >
        <OrderTable orders={recentOrders} onCancel={handleCancel} />
      </Card>
    </div>
  );
}
