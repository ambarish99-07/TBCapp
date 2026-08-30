import { isComboLineId, type AnalyticsSummary } from "@tbc/shared-types";
import { BrandModel } from "../../db/models/Brand.model.js";
import { ComboModel } from "../../db/models/Combo.model.js";
import { MenuItemModel } from "../../db/models/MenuItem.model.js";
import { OrderModel } from "../../db/models/Order.model.js";
import { addIsoDays, istMidnightUtc, istParts, todayIsoInIst } from "../../utils/istDate.js";

interface AnalyticsOrderLine {
  menuItemId: string;
  signatureName: string;
  quantity: number;
}

interface AnalyticsOrder {
  createdAt: Date;
  status: string;
  brandId: string;
  userId: string | null;
  total: number;
  area: string;
  items: AnalyticsOrderLine[];
}

const UNKNOWN_AREA = "Unknown";

/** Order count (always) + revenue (cancelled orders excluded) for orders created in
 * `[since, until)` — either bound omitted means unbounded on that side. */
function periodStats(orders: AnalyticsOrder[], since: Date | null, until: Date | null) {
  const inRange = orders.filter((o) => (!since || o.createdAt >= since) && (!until || o.createdAt < until));
  return {
    orders: inRange.length,
    revenue: inRange.filter((o) => o.status !== "cancelled").reduce((sum, o) => sum + o.total, 0),
  };
}

export async function getAnalyticsSummary(): Promise<AnalyticsSummary> {
  const [orderDocs, brandDocs, menuItemDocs, totalCombos] = await Promise.all([
    OrderModel.find().select("createdAt status brandId userId totals.total delivery.area items.menuItemId items.signatureName items.quantity").lean(),
    BrandModel.find().select("name status").lean(),
    MenuItemModel.find().select("signatureName brandId").lean(),
    ComboModel.countDocuments(),
  ]);
  const brandNameById = new Map(brandDocs.map((b) => [String(b._id), b.name]));

  const orders: AnalyticsOrder[] = orderDocs.map((o) => ({
    createdAt: o.createdAt as unknown as Date,
    status: o.status ?? "received",
    brandId: o.brandId,
    userId: o.userId ? String(o.userId) : null,
    total: o.totals.total,
    area: o.delivery?.area?.trim() || UNKNOWN_AREA,
    items: o.items.map((line) => ({ menuItemId: line.menuItemId, signatureName: line.signatureName, quantity: line.quantity })),
  }));

  // All boundaries anchored to IST "today", not server-local time or the request's own instant —
  // see utils/istDate.ts.
  const todayIso = todayIsoInIst();
  const todayStart = istMidnightUtc(todayIso);
  const yesterdayStart = istMidnightUtc(addIsoDays(todayIso, -1));
  const last7Start = istMidnightUtc(addIsoDays(todayIso, -6)); // trailing 7 days, today inclusive
  const last30Start = istMidnightUtc(addIsoDays(todayIso, -29)); // trailing 30 days, today inclusive

  const ordersToday = periodStats(orders, todayStart, null);
  const ordersYesterday = periodStats(orders, yesterdayStart, todayStart);
  const ordersLast7Days = periodStats(orders, last7Start, null);
  const ordersLast30Days = periodStats(orders, last30Start, null);
  const allTime = periodStats(orders, null, null);

  // Which restaurant (brand) got how many orders / how much revenue.
  const byBrandMap = new Map<string, { orders: number; revenue: number }>();
  for (const o of orders) {
    const entry = byBrandMap.get(o.brandId) ?? { orders: 0, revenue: 0 };
    entry.orders += 1;
    if (o.status !== "cancelled") entry.revenue += o.total;
    byBrandMap.set(o.brandId, entry);
  }
  const byBrand = Array.from(byBrandMap.entries())
    .map(([brandId, stats]) => ({ brandId, brandName: brandNameById.get(brandId) ?? brandId, ...stats }))
    .sort((a, b) => b.orders - a.orders);

  // Which delivery area (locality/neighborhood, not pincode) sends the most orders — capped to
  // the top 10 so a long tail of one-off free-text areas doesn't bloat the payload.
  const byAreaMap = new Map<string, { orders: number; revenue: number }>();
  for (const o of orders) {
    const entry = byAreaMap.get(o.area) ?? { orders: 0, revenue: 0 };
    entry.orders += 1;
    if (o.status !== "cancelled") entry.revenue += o.total;
    byAreaMap.set(o.area, entry);
  }
  const byArea = Array.from(byAreaMap.entries())
    .map(([area, stats]) => ({ area, ...stats }))
    .sort((a, b) => b.orders - a.orders)
    .slice(0, 10);

  // Monthly revenue trend — always exactly 12 months (oldest to newest), zero-filled for any
  // month with no orders, so a chart never has to special-case a gap.
  const monthlyMap = new Map<string, { orders: number; revenue: number }>();
  for (const o of orders) {
    const month = o.createdAt.toISOString().slice(0, 7);
    const entry = monthlyMap.get(month) ?? { orders: 0, revenue: 0 };
    entry.orders += 1;
    if (o.status !== "cancelled") entry.revenue += o.total;
    monthlyMap.set(month, entry);
  }
  const now = new Date();
  const monthlyRevenue = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (11 - i), 1));
    const month = d.toISOString().slice(0, 7);
    const entry = monthlyMap.get(month) ?? { orders: 0, revenue: 0 };
    return { month, ...entry };
  });

  // Weekly revenue trend — 12 trailing, non-overlapping 7-day windows (IST-anchored), most
  // recent one ending "now" (today inclusive), oldest to newest.
  const weeklyRevenue = Array.from({ length: 12 }, (_, i) => {
    const weekStart = addIsoDays(todayIso, -(7 * (11 - i) + 6));
    const windowStart = istMidnightUtc(weekStart);
    const windowEnd = istMidnightUtc(addIsoDays(weekStart, 7));
    const stats = periodStats(orders, windowStart, windowEnd);
    return { weekStart, ...stats };
  });

  // Today's revenue by the hour (IST) — 24 entries, hour 0-23, so the Dashboard's "Today" chart
  // granularity has something real to plot instead of one flat bar.
  const hourlyBuckets = Array.from({ length: 24 }, () => ({ orders: 0, revenue: 0 }));
  for (const o of orders) {
    const parts = istParts(o.createdAt);
    if (parts.isoDate !== todayIso) continue;
    hourlyBuckets[parts.hour].orders += 1;
    if (o.status !== "cancelled") hourlyBuckets[parts.hour].revenue += o.total;
  }
  const todayHourlyRevenue = hourlyBuckets.map((stats, hour) => ({ hour, ...stats }));

  // Item preferences — combo lines (synthetic "combo:..." ids) are excluded since they aren't a
  // single real menu item. `topItems` comes straight from what was actually ordered, so it stays
  // correct even for an item since renamed or removed from the catalog; `leastItems` instead
  // starts from the *current* live catalog so it can surface items with zero orders, which
  // aggregating order lines alone could never reveal.
  const itemStatsById = new Map<string, { name: string; brandId: string; totalQuantity: number; orderIds: Set<number> }>();
  orders.forEach((o, orderIndex) => {
    for (const line of o.items) {
      if (isComboLineId(line.menuItemId)) continue;
      const entry = itemStatsById.get(line.menuItemId) ?? { name: line.signatureName, brandId: o.brandId, totalQuantity: 0, orderIds: new Set() };
      entry.totalQuantity += line.quantity;
      entry.orderIds.add(orderIndex);
      itemStatsById.set(line.menuItemId, entry);
    }
  });

  const topItems = Array.from(itemStatsById.entries())
    .map(([menuItemId, stats]) => ({ menuItemId, name: stats.name, brandId: stats.brandId, totalQuantity: stats.totalQuantity, orderCount: stats.orderIds.size }))
    .sort((a, b) => b.totalQuantity - a.totalQuantity)
    .slice(0, 5);

  const leastItems = menuItemDocs
    .map((item) => {
      const stats = itemStatsById.get(String(item._id));
      return {
        menuItemId: String(item._id),
        name: item.signatureName,
        brandId: item.brandId,
        totalQuantity: stats?.totalQuantity ?? 0,
        orderCount: stats?.orderIds.size ?? 0,
      };
    })
    .sort((a, b) => a.totalQuantity - b.totalQuantity)
    .slice(0, 5);

  // Repeat vs. new customers, repeat vs. first-time orders — registered customers only (a guest
  // checkout has no account to link repeat behavior to; those orders are counted separately as
  // `guestOrders` below rather than silently dropped).
  const ordersByUser = new Map<string, AnalyticsOrder[]>();
  let guestOrders = 0;
  for (const o of orders) {
    if (!o.userId) {
      guestOrders += 1;
      continue;
    }
    const list = ordersByUser.get(o.userId) ?? [];
    list.push(o);
    ordersByUser.set(o.userId, list);
  }

  let repeatCustomers = 0;
  let oneTimeCustomers = 0;
  let newCustomersToday = 0;
  let newCustomersLast7Days = 0;
  let newCustomersLast30Days = 0;
  let repeatOrders = 0;
  let firstTimeOrders = 0;
  for (const userOrders of ordersByUser.values()) {
    const sortedByDate = [...userOrders].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    if (sortedByDate.length >= 2) repeatCustomers += 1;
    else oneTimeCustomers += 1;
    firstTimeOrders += 1;
    repeatOrders += sortedByDate.length - 1;

    const firstOrderAt = sortedByDate[0].createdAt;
    if (firstOrderAt >= todayStart) newCustomersToday += 1;
    if (firstOrderAt >= last7Start) newCustomersLast7Days += 1;
    if (firstOrderAt >= last30Start) newCustomersLast30Days += 1;
  }
  const totalRegisteredCustomers = ordersByUser.size;

  return {
    ordersToday,
    ordersYesterday,
    ordersLast7Days,
    ordersLast30Days,
    allTime,
    totalOrders: orders.length,
    guestOrders,
    repeatOrders,
    firstTimeOrders,
    byBrand,
    byArea,
    topItems,
    leastItems,
    monthlyRevenue,
    weeklyRevenue,
    todayHourlyRevenue,
    customers: {
      totalRegisteredCustomers,
      newCustomersToday,
      newCustomersLast7Days,
      newCustomersLast30Days,
      repeatCustomers,
      oneTimeCustomers,
      repeatCustomerRate: totalRegisteredCustomers > 0 ? repeatCustomers / totalRegisteredCustomers : 0,
    },
    catalog: {
      totalBrands: brandDocs.filter((b) => b.status === "live").length,
      totalMenuItems: menuItemDocs.length,
      totalCombos,
    },
  };
}
