import { z } from "zod";

/** Order count + revenue for one fixed time bucket. Revenue always excludes cancelled orders;
 * order count does not (a cancelled order is still an order that came in). */
export const AnalyticsPeriodStatsSchema = z.object({
  orders: z.number(),
  revenue: z.number(),
});
export type AnalyticsPeriodStats = z.infer<typeof AnalyticsPeriodStatsSchema>;

export const AnalyticsBrandStatsSchema = z.object({
  brandId: z.string(),
  brandName: z.string(),
  orders: z.number(),
  revenue: z.number(),
});
export type AnalyticsBrandStats = z.infer<typeof AnalyticsBrandStatsSchema>;

/** One calendar month's totals, `month` as "YYYY-MM". */
export const AnalyticsMonthlyStatsSchema = z.object({
  month: z.string(),
  orders: z.number(),
  revenue: z.number(),
});
export type AnalyticsMonthlyStats = z.infer<typeof AnalyticsMonthlyStatsSchema>;

/** One trailing 7-day window's totals, `weekStart` as an IST "YYYY-MM-DD". */
export const AnalyticsWeeklyStatsSchema = z.object({
  weekStart: z.string(),
  orders: z.number(),
  revenue: z.number(),
});
export type AnalyticsWeeklyStats = z.infer<typeof AnalyticsWeeklyStatsSchema>;

/** One hour (0-23, IST) of today's totals. */
export const AnalyticsHourlyStatsSchema = z.object({
  hour: z.number(),
  orders: z.number(),
  revenue: z.number(),
});
export type AnalyticsHourlyStats = z.infer<typeof AnalyticsHourlyStatsSchema>;

export const AnalyticsCustomerStatsSchema = z.object({
  // Only customers with an account (userId set on the order) — guest checkouts have no identity
  // to link repeat/new-customer behavior to, and are counted separately via `guestOrders` below.
  totalRegisteredCustomers: z.number(),
  newCustomersToday: z.number(),
  newCustomersLast7Days: z.number(),
  newCustomersLast30Days: z.number(),
  // "Repeat" = placed 2 or more orders, ever.
  repeatCustomers: z.number(),
  oneTimeCustomers: z.number(),
  repeatCustomerRate: z.number(),
});
export type AnalyticsCustomerStats = z.infer<typeof AnalyticsCustomerStatsSchema>;

/** Live catalog size — not order-derived, just a snapshot count of what's currently sellable. */
export const AnalyticsCatalogStatsSchema = z.object({
  totalBrands: z.number(),
  totalMenuItems: z.number(),
  totalCombos: z.number(),
});
export type AnalyticsCatalogStats = z.infer<typeof AnalyticsCatalogStatsSchema>;

/** One delivery area's totals — `area` is the free-text locality/neighborhood field on the
 * order's delivery address (e.g. "Kankarbagh"), not the pincode. */
export const AnalyticsAreaStatsSchema = z.object({
  area: z.string(),
  orders: z.number(),
  revenue: z.number(),
});
export type AnalyticsAreaStats = z.infer<typeof AnalyticsAreaStatsSchema>;

/** One menu item's order-preference stats — `orderCount` is the number of distinct orders it
 * appeared in (not summed with its own quantity across those orders, unlike `totalQuantity`). */
export const AnalyticsItemStatsSchema = z.object({
  menuItemId: z.string(),
  name: z.string(),
  brandId: z.string(),
  totalQuantity: z.number(),
  orderCount: z.number(),
});
export type AnalyticsItemStats = z.infer<typeof AnalyticsItemStatsSchema>;

export const AnalyticsSummarySchema = z.object({
  ordersToday: AnalyticsPeriodStatsSchema,
  ordersYesterday: AnalyticsPeriodStatsSchema,
  ordersLast7Days: AnalyticsPeriodStatsSchema,
  ordersLast30Days: AnalyticsPeriodStatsSchema,
  allTime: AnalyticsPeriodStatsSchema,
  totalOrders: z.number(),
  guestOrders: z.number(),
  // Orders that were NOT the placing customer's first order, vs. ones that were — registered
  // customers only, same scope as `customers` below.
  repeatOrders: z.number(),
  firstTimeOrders: z.number(),
  byBrand: z.array(AnalyticsBrandStatsSchema),
  // Always exactly 12 entries, oldest to newest, one per calendar month — zero-filled for any
  // month with no orders so a chart never has to special-case a gap.
  monthlyRevenue: z.array(AnalyticsMonthlyStatsSchema),
  // Always exactly 12 entries, oldest to newest, one per trailing 7-day window.
  weeklyRevenue: z.array(AnalyticsWeeklyStatsSchema),
  // Always exactly 24 entries (hour 0-23), today only, IST.
  todayHourlyRevenue: z.array(AnalyticsHourlyStatsSchema),
  customers: AnalyticsCustomerStatsSchema,
  catalog: AnalyticsCatalogStatsSchema,
  // Sorted desc by order count, capped to the top 10 areas so the payload stays bounded even
  // with a long tail of one-off free-text localities.
  byArea: z.array(AnalyticsAreaStatsSchema),
  // Best-sellers — from real order data, sorted desc by total quantity ordered, top 5.
  topItems: z.array(AnalyticsItemStatsSchema),
  // Least preferred among items currently on the menu (includes ones with zero orders, which a
  // best-sellers-only view could never surface) — sorted asc by total quantity ordered, bottom 5.
  leastItems: z.array(AnalyticsItemStatsSchema),
});
export type AnalyticsSummary = z.infer<typeof AnalyticsSummarySchema>;
