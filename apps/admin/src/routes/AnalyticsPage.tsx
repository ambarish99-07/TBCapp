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
