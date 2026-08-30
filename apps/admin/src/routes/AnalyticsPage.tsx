import type { AnalyticsSummary } from "@tbc/shared-types";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { adminClient } from "../api/adminClient.js";
import { TrendChart } from "../components/TrendChart.js";
import { Card } from "../components/ui/Card.js";
import { EmptyState } from "../components/ui/EmptyState.js";
import { PageHeader } from "../components/ui/PageHeader.js";
import { Table, Td, Th, Thead, Tr } from "../components/ui/Table.js";
import { monthLabel } from "../utils/chartLabels.js";

function formatRupees(amount: number): string {
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

function StatTile({ label, orders, revenue, dark }: { label: string; orders: number; revenue: number; dark?: boolean }) {
  if (dark) {
    // One dark tile stands out from the rest of the row as the "primary" figure — same idea as a
    // dashboard's featured stat card, using the brand's own dark text color rather than pure black.
    return (
      <div className="rounded-2xl bg-text p-5 text-white shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wide text-white/60">{label}</p>
        <p className="mt-1.5 text-2xl font-extrabold">{orders}</p>
        <p className="text-xs text-white/70">{formatRupees(revenue)} revenue</p>
      </div>
    );
  }
  return (
    <Card>
      <p className="text-xs font-bold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1.5 text-2xl font-extrabold text-text">{orders}</p>
      <p className="text-xs text-muted">{formatRupees(revenue)} revenue</p>
    </Card>
  );
}

function Metric({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-xl font-extrabold text-text">{value}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </div>
  );
}

export function AnalyticsPage() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const location = useLocation();

  useEffect(() => {
    adminClient.get<AnalyticsSummary>("/admin/analytics").then((res) => setSummary(res.data));
  }, []);

  // Arriving via a link like /analytics#revenue (the Dashboard's stat cards do this) — scroll the
  // matching section into view once its data has actually rendered, not before.
  useEffect(() => {
    if (!summary || !location.hash) return;
    const id = location.hash.slice(1);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [summary, location.hash]);

  // Called unconditionally (before the loading early-return below) to keep hook order stable.
  const monthlyPoints = useMemo(
    () =>
      (summary?.monthlyRevenue ?? []).map((m) => ({
        label: monthLabel(m.month),
        value: m.revenue,
        secondaryLabel: `${m.orders} order${m.orders === 1 ? "" : "s"}`,
      })),
    [summary]
  );

  if (!summary) {
    return (
      <div>
        <PageHeader title="Analytics" />
        <p className="text-sm text-muted">Loading…</p>
      </div>
    );
  }

  const totalRevenue12Months = summary.monthlyRevenue.reduce((sum, m) => sum + m.revenue, 0);

  return (
    <div>
      <PageHeader title="Analytics" description="Orders, revenue, and customer behavior across every brand." />

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile label="Today" orders={summary.ordersToday.orders} revenue={summary.ordersToday.revenue} dark />
        <StatTile label="Yesterday" orders={summary.ordersYesterday.orders} revenue={summary.ordersYesterday.revenue} />
        <StatTile label="Last 7 Days" orders={summary.ordersLast7Days.orders} revenue={summary.ordersLast7Days.revenue} />
        <StatTile label="Last 30 Days" orders={summary.ordersLast30Days.orders} revenue={summary.ordersLast30Days.revenue} />
        <StatTile label="All Time" orders={summary.allTime.orders} revenue={summary.allTime.revenue} />
      </div>

      <Card
        id="revenue"
        title="Revenue — Last 12 Months"
        action={<p className="text-sm font-bold text-text">{formatRupees(totalRevenue12Months)}</p>}
        className="mb-6 scroll-mt-6"
      >
        <TrendChart points={monthlyPoints} formatValue={formatRupees} />
      </Card>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Orders by Restaurant">
          {summary.byBrand.length === 0 ? (
            <EmptyState message="No orders yet." />
          ) : (
            <Table>
              <Thead>
                <Tr>
                  <Th>Restaurant</Th>
                  <Th>Orders</Th>
                  <Th>Revenue</Th>
                </Tr>
              </Thead>
              <tbody>
                {summary.byBrand.map((brand) => (
                  <Tr key={brand.brandId}>
                    <Td className="font-semibold">{brand.brandName}</Td>
                    <Td>{brand.orders}</Td>
                    <Td>{formatRupees(brand.revenue)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card id="customers" title="Customers" className="scroll-mt-6">
          <div className="grid grid-cols-2 gap-y-5">
            <Metric label="Registered Customers" value={summary.customers.totalRegisteredCustomers} />
            <Metric
              label="Repeat Customers"
              value={summary.customers.repeatCustomers}
              sub={`${Math.round(summary.customers.repeatCustomerRate * 100)}% of registered`}
            />
            <Metric label="One-Time Customers" value={summary.customers.oneTimeCustomers} />
            <Metric label="New — Today" value={summary.customers.newCustomersToday} />
            <Metric label="New — Last 7 Days" value={summary.customers.newCustomersLast7Days} />
            <Metric label="New — Last 30 Days" value={summary.customers.newCustomersLast30Days} />
          </div>
        </Card>
      </div>

      <Card title="Delivery Areas" description="Which neighborhood sends the most orders." className="mb-6">
        {summary.byArea.length === 0 ? (
          <EmptyState message="No orders yet." />
        ) : (
          <div className="flex flex-col gap-2.5">
            {summary.byArea.map((area, i) => {
              const pct = Math.round((area.orders / summary.byArea[0].orders) * 100);
              return (
                <div key={area.area} className="relative overflow-hidden rounded-lg bg-surface">
                  <div className="absolute inset-y-0 left-0 bg-primary/15" style={{ width: `${pct}%` }} />
                  <div className="relative flex items-center justify-between px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xs font-bold text-muted">#{i + 1}</span>
                      <span className="text-sm font-semibold text-text">{area.area}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-text">{area.orders} order{area.orders === 1 ? "" : "s"}</p>
                      <p className="text-xs text-muted">{formatRupees(area.revenue)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Most Ordered" description="Best sellers, by total quantity ordered.">
          {summary.topItems.length === 0 ? (
            <EmptyState message="No orders yet." />
          ) : (
            <div className="flex flex-col gap-3">
              {summary.topItems.map((item, i) => (
                <div key={item.menuItemId} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success-soft text-xs font-bold text-success">
                      {i + 1}
                    </span>
                    <span className="text-sm font-semibold text-text">{item.name}</span>
                  </div>
                  <span className="shrink-0 text-xs text-muted">
                    {item.totalQuantity} sold · {item.orderCount} order{item.orderCount === 1 ? "" : "s"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Least Ordered" description="Includes menu items that have never been ordered.">
          {summary.leastItems.length === 0 ? (
            <EmptyState message="No menu items yet." />
          ) : (
            <div className="flex flex-col gap-3">
              {summary.leastItems.map((item) => (
                <div key={item.menuItemId} className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-text">{item.name}</span>
                  <span
                    className={`shrink-0 text-xs font-semibold ${item.totalQuantity === 0 ? "text-danger" : "text-muted"}`}
                  >
                    {item.totalQuantity === 0 ? "Never ordered" : `${item.totalQuantity} sold · ${item.orderCount} orders`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card title="Orders — Repeat vs. First-Time">
        <div className="grid grid-cols-3 gap-4">
          <Metric label="First-Time Orders" value={summary.firstTimeOrders} />
          <Metric label="Repeat Orders" value={summary.repeatOrders} />
          <Metric label="Guest Orders (no account)" value={summary.guestOrders} />
        </div>
      </Card>
    </div>
  );
}
