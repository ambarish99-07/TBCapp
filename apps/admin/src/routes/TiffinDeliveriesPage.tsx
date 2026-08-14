import { TiffinScheduledMealStatusSchema, type TiffinScheduledMeal, type TiffinSubscription } from "@tbc/shared-types";
import { useEffect, useMemo, useState } from "react";
import { adminClient } from "../api/adminClient.js";

const MEAL_STATUS_OPTIONS = TiffinScheduledMealStatusSchema.options;

export function TiffinDeliveriesPage() {
  const [meals, setMeals] = useState<TiffinScheduledMeal[]>([]);
  const [subscriptions, setSubscriptions] = useState<TiffinSubscription[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  async function reload() {
    setIsLoading(true);
    const [mealsRes, subscriptionsRes] = await Promise.all([
      adminClient.get<{ meals: TiffinScheduledMeal[] }>("/admin/tiffin/deliveries/today"),
      adminClient.get<{ subscriptions: TiffinSubscription[] }>("/admin/tiffin/subscriptions"),
    ]);
    setMeals(mealsRes.data.meals);
    setSubscriptions(subscriptionsRes.data.subscriptions);
    setIsLoading(false);
  }

  useEffect(() => {
    reload();
  }, []);

  async function handleStatusChange(id: string, status: string) {
    await adminClient.patch(`/admin/tiffin/meals/${id}/status`, { status });
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

  if (isLoading) return <p>Loading…</p>;

  return (
    <div>
      <h1>GG Tiffin Deliveries</h1>

      <h2>Today's Prep</h2>
      {dishCounts.length === 0 ? (
        <p>No meals scheduled for today.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24 }}>
          <thead>
            <tr>
              <th align="left">Dish</th>
              <th align="left">Count</th>
            </tr>
          </thead>
          <tbody>
            {dishCounts.map(([dish, count]) => (
              <tr key={dish} style={{ borderTop: "1px solid #E4DCD3" }}>
                <td>{dish}</td>
                <td>{count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>Today's Deliveries</h2>
      {meals.length === 0 ? (
        <p>No deliveries today.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24 }}>
          <thead>
            <tr>
              <th align="left">Dish</th>
              <th align="left">Status</th>
            </tr>
          </thead>
          <tbody>
            {meals.map((meal) => (
              <tr key={meal.id} style={{ borderTop: "1px solid #E4DCD3" }}>
                <td>{meal.dishName}</td>
                <td>
                  <select value={meal.status} onChange={(e) => handleStatusChange(meal.id, e.target.value)}>
                    {MEAL_STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>Active Subscribers</h2>
      {subscriptions.length === 0 ? (
        <p>No subscriptions yet.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th align="left">Subscription #</th>
              <th align="left">Plan</th>
              <th align="left">Status</th>
              <th align="left">Start</th>
              <th align="left">End</th>
            </tr>
          </thead>
          <tbody>
            {subscriptions.map((sub) => (
              <tr key={sub.id} style={{ borderTop: "1px solid #E4DCD3" }}>
                <td>{sub.subscriptionNumber}</td>
                <td>{sub.planName}</td>
                <td>{sub.status}</td>
                <td>{sub.startDate}</td>
                <td>{sub.endDate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
