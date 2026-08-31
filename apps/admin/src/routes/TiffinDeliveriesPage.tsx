import {
  TiffinScheduledMealStatusSchema,
  TiffinSingleMealOrderStatusSchema,
  type TiffinScheduledMeal,
  type TiffinSingleMealOrder,
  type TiffinSubscription,
} from "@tbc/shared-types";
import { useEffect, useMemo, useState } from "react";
import { adminClient } from "../api/adminClient.js";
import { Card } from "../components/ui/Card.js";
import { EmptyState } from "../components/ui/EmptyState.js";
import { Select } from "../components/ui/Input.js";
import { PageHeader } from "../components/ui/PageHeader.js";
import { Table, Td, Th, Thead, Tr } from "../components/ui/Table.js";

const MEAL_STATUS_OPTIONS = TiffinScheduledMealStatusSchema.options;
const SINGLE_MEAL_ORDER_STATUS_OPTIONS = TiffinSingleMealOrderStatusSchema.options;

export function TiffinDeliveriesPage() {
  const [meals, setMeals] = useState<TiffinScheduledMeal[]>([]);
  const [subscriptions, setSubscriptions] = useState<TiffinSubscription[]>([]);
  const [singleMealOrders, setSingleMealOrders] = useState<TiffinSingleMealOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // Without this, a failed request left the page stuck on "Loading…" forever with no way to
  // tell why.
  const [loadError, setLoadError] = useState<string | null>(null);

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
    for (const meal of meals) {
      if (meal.status === "cancelled" || meal.status === "skipped") continue;
      counts.set(meal.dishName, (counts.get(meal.dishName) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [meals]);

  if (loadError) return <p className="text-sm font-medium text-danger">{loadError}</p>;
  if (isLoading) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <div>
      <PageHeader title="GG Tiffin Deliveries" />

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
      </div>
    </div>
  );
}
