import {
  TiffinScheduledMealStatusSchema,
  TiffinSingleMealOrderStatusSchema,
  type TiffinScheduledMeal,
  type TiffinSingleMealOrder,
  type TiffinSubscription,
} from "@tbc/shared-types";
import { useEffect, useMemo, useState } from "react";
import { adminClient } from "../api/adminClient.js";
import { SourceSwitch, useSource } from "../components/SourceSwitch.js";
import { StatusBadge } from "../components/StatusBadge.js";
import { Card } from "../components/ui/Card.js";
import { EmptyState } from "../components/ui/EmptyState.js";
import { Select } from "../components/ui/Input.js";
import { PageHeader } from "../components/ui/PageHeader.js";
import { Table, Td, Th, Thead, Tr } from "../components/ui/Table.js";

const MEAL_STATUS_OPTIONS = TiffinScheduledMealStatusSchema.options;
const SINGLE_MEAL_ORDER_STATUS_OPTIONS = TiffinSingleMealOrderStatusSchema.options;

/** The website's GG Tiffin, as the admin-peer link returns it. */
interface WebsiteSingleMeal {
  id: string;
  code: string;
  diet: string;
  tier: string;
  meal: string;
  date: string;
  dishName: string;
  quantity: number;
  contactName: string;
  contactPhone: string;
  total: number;
  status: "received" | "preparing" | "out-for-delivery" | "delivered" | "cancelled";
  deliveryPartner?: { name: string } | null;
}
interface WebsiteSubscription {
  id: string;
  planName: string;
  status: string;
  startDate: string;
  endDate: string;
  todaysMeals: { meal: string; dishName: string; status: string }[];
}
interface WebsiteTiffin {
  today: string;
  singleMealOrders: WebsiteSingleMeal[];
  subscriptions: WebsiteSubscription[];
}
const WEBSITE_NEXT: Partial<Record<WebsiteSingleMeal["status"], string>> = {
  received: "preparing",
  preparing: "out-for-delivery",
  "out-for-delivery": "delivered",
};

export function TiffinDeliveriesPage() {
  const [meals, setMeals] = useState<TiffinScheduledMeal[]>([]);
  const [subscriptions, setSubscriptions] = useState<TiffinSubscription[]>([]);
  const [singleMealOrders, setSingleMealOrders] = useState<TiffinSingleMealOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // Without this, a failed request left the page stuck on "Loading…" forever with no way to
  // tell why.
  const [loadError, setLoadError] = useState<string | null>(null);

  // App / Website / Both — the website's GG Tiffin comes over the admin-peer link.
  const [source, setSource] = useSource();
  const showApp = source !== "website";
  const showWebsite = source !== "app";
  const [website, setWebsite] = useState<WebsiteTiffin | null>(null);
  const [websiteError, setWebsiteError] = useState<string | null>(null);

  async function reloadWebsite() {
    setWebsiteError(null);
    try {
      const res = await adminClient.get<WebsiteTiffin>("/admin/website/tiffin");
      setWebsite(res.data);
    } catch (err) {
      setWebsiteError(err instanceof Error ? err.message : "Couldn't load the website's GG Tiffin");
    }
  }

  useEffect(() => {
    if (showWebsite) reloadWebsite();
  }, [showWebsite]);

  async function advanceWebsiteSingleMeal(id: string, status: string) {
    try {
      await adminClient.post(`/admin/website/tiffin/single-meal/${id}/status`, { status });
      await reloadWebsite();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Couldn't update the order");
    }
  }

  async function reload() {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [mealsRes, subscriptionsRes, singleMealOrdersRes] = await Promise.all([
        adminClient.get<{ meals: TiffinScheduledMeal[] }>("/admin/tiffin/deliveries/today"),
        adminClient.get<{ subscriptions: TiffinSubscription[] }>("/admin/tiffin/subscriptions"),
        adminClient.get<{ orders: TiffinSingleMealOrder[] }>("/admin/tiffin/single-meal/orders/today"),
      ]);
      setMeals(mealsRes.data.meals);
      setSubscriptions(subscriptionsRes.data.subscriptions);
      setSingleMealOrders(singleMealOrdersRes.data.orders);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load deliveries");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  async function handleStatusChange(id: string, status: string) {
    await adminClient.patch(`/admin/tiffin/meals/${id}/status`, { status });
    await reload();
  }

  async function handleSingleMealOrderStatusChange(id: string, status: string) {
    await adminClient.patch(`/admin/tiffin/single-meal/orders/${id}/status`, { status });
    await reload();
  }

  // Kitchen-prep summary — how many of each dish are needed today.
  const dishCounts = useMemo(() => {
    const counts = new Map<string, number>();
    const rows = [...(showApp ? meals : []), ...(showWebsite && website ? website.subscriptions.flatMap((s) => s.todaysMeals) : [])];
    for (const meal of rows) {
      if (meal.status === "cancelled" || meal.status === "skipped" || meal.status === "closed") continue;
      counts.set(meal.dishName, (counts.get(meal.dishName) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [meals, website, showApp, showWebsite]);

  if (loadError) return <p className="text-sm font-medium text-danger">{loadError}</p>;
  if (isLoading) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <div>
      <PageHeader title="GG Tiffin Deliveries" action={<SourceSwitch value={source} onChange={setSource} />} />

      <div className="flex flex-col gap-6">
        <Card title="Today's Prep">
          {dishCounts.length === 0 ? (
            <EmptyState message="No meals scheduled for today." />
          ) : (
            <Table>
              <Thead>
                <Tr>
                  <Th>Dish</Th>
                  <Th>Count</Th>
                </Tr>
              </Thead>
              <tbody>
                {dishCounts.map(([dish, count]) => (
                  <Tr key={dish}>
                    <Td>{dish}</Td>
                    <Td>{count}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        {showApp && (
        <Card title="Today's Deliveries">
          {meals.length === 0 ? (
            <EmptyState message="No deliveries today." />
          ) : (
            <Table>
              <Thead>
                <Tr>
                  <Th>Dish</Th>
                  <Th>Status</Th>
                </Tr>
              </Thead>
              <tbody>
                {meals.map((meal) => (
                  <Tr key={meal.id}>
                    <Td>{meal.dishName}</Td>
                    <Td>
                      <Select value={meal.status} onChange={(e) => handleStatusChange(meal.id, e.target.value)}>
                        {MEAL_STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </Select>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        )}

        {showApp && (
        <Card title="Today's Single-Meal Orders">
          {singleMealOrders.length === 0 ? (
            <EmptyState message="No single-meal orders today." />
          ) : (
            <Table>
              <Thead>
                <Tr>
                  <Th>Order #</Th>
                  <Th>Diet</Th>
                  <Th>Tier</Th>
                  <Th>Meal</Th>
                  <Th>Dish</Th>
                  <Th>Status</Th>
                </Tr>
              </Thead>
              <tbody>
                {singleMealOrders.map((order) => (
                  <Tr key={order.id}>
                    <Td>{order.orderNumber}</Td>
                    <Td>{order.dietType}</Td>
                    <Td>{order.tier}</Td>
                    <Td>
                      {order.mealType}
                      {order.carbChoice ? ` (${order.carbChoice})` : ""}
                    </Td>
                    <Td>{order.dishName}</Td>
                    <Td>
                      <Select value={order.status} onChange={(e) => handleSingleMealOrderStatusChange(order.id, e.target.value)}>
                        {SINGLE_MEAL_ORDER_STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </Select>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        )}

        {showApp && (
        <Card title="Active Subscribers">
          {subscriptions.length === 0 ? (
            <EmptyState message="No subscriptions yet." />
          ) : (
            <Table>
              <Thead>
                <Tr>
                  <Th>Subscription #</Th>
                  <Th>Plan</Th>
                  <Th>Status</Th>
                  <Th>Start</Th>
                  <Th>End</Th>
                </Tr>
              </Thead>
              <tbody>
                {subscriptions.map((sub) => (
                  <Tr key={sub.id}>
                    <Td>{sub.subscriptionNumber}</Td>
                    <Td>{sub.planName}</Td>
                    <Td>{sub.status}</Td>
                    <Td>{sub.startDate}</Td>
                    <Td>{sub.endDate}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
        )}

        {showWebsite && websiteError && <p className="text-sm font-medium text-danger">{websiteError}</p>}
        {showWebsite && website && (
          <>
            <Card title="🌐 Website Single-Meal Orders (today and upcoming)">
              {website.singleMealOrders.length === 0 ? (
                <EmptyState message="No upcoming single-meal orders on the website." />
              ) : (
                <Table>
                  <Thead>
                    <Tr>
                      <Th>Order #</Th>
                      <Th>Date</Th>
                      <Th>Customer</Th>
                      <Th>Meal</Th>
                      <Th>Dish</Th>
                      <Th>Status</Th>
                      <Th></Th>
                    </Tr>
                  </Thead>
                  <tbody>
                    {website.singleMealOrders.map((order) => {
                      const next = WEBSITE_NEXT[order.status];
                      return (
                        <Tr key={order.id}>
                          <Td className="font-semibold">{order.code}</Td>
                          <Td>{order.date === website.today ? "Today" : order.date}</Td>
                          <Td>
                            <p>{order.contactName}</p>
                            <p className="text-xs text-muted">{order.contactPhone}</p>
                          </Td>
                          <Td>
                            {order.tier} · {order.diet} · {order.meal}
                          </Td>
                          <Td>
                            {order.quantity > 1 ? `${order.quantity}× ` : ""}
                            {order.dishName}
                          </Td>
                          <Td>
                            <StatusBadge status={order.status} />
                            {order.deliveryPartner && <p className="mt-1 text-xs text-muted">🛵 {order.deliveryPartner.name}</p>}
                          </Td>
                          <Td>
                            {next && (
                              <button
                                onClick={() => advanceWebsiteSingleMeal(order.id, next)}
                                className="whitespace-nowrap rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white hover:bg-primary-dark"
                              >
                                → {next.replace(/-/g, " ")}
                              </button>
                            )}
                          </Td>
                        </Tr>
                      );
                    })}
                  </tbody>
                </Table>
              )}
            </Card>

            <Card title="🌐 Website Subscribers">
              {website.subscriptions.length === 0 ? (
                <EmptyState message="No active website subscriptions." />
              ) : (
                <Table>
                  <Thead>
                    <Tr>
                      <Th>Plan</Th>
                      <Th>Status</Th>
                      <Th>Start</Th>
                      <Th>End</Th>
                      <Th>Today</Th>
                    </Tr>
                  </Thead>
                  <tbody>
                    {website.subscriptions.map((sub) => (
                      <Tr key={sub.id}>
                        <Td>{sub.planName}</Td>
                        <Td>{sub.status}</Td>
                        <Td>{sub.startDate}</Td>
                        <Td>{sub.endDate}</Td>
                        <Td className="text-xs">
                          {sub.todaysMeals.length ? sub.todaysMeals.map((m) => `${m.meal}: ${m.dishName} (${m.status})`).join(" · ") : "—"}
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
