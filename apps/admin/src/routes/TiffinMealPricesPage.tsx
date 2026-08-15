import { SINGLE_MEAL_TYPES, TIFFIN_MEAL_TIERS, type SingleMealType, type TiffinMealPrice, type TiffinMealTier } from "@tbc/shared-types";
import { useEffect, useState } from "react";
import { adminClient } from "../api/adminClient.js";

const TIER_LABELS: Record<TiffinMealTier, string> = { regular: "Regular", mini: "Mini Meal", premium: "Premium" };
const MEAL_TYPE_LABELS: Record<SingleMealType, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner" };

const emptyForm = {
  tier: TIFFIN_MEAL_TIERS[0] as TiffinMealTier,
  mealType: SINGLE_MEAL_TYPES[0] as SingleMealType,
  price: "",
};

/** Admin-configurable price per (tier, mealType) for the single-meal purchase — same pattern as
 * TiffinPlansPage. Not every combo needs a row (e.g. Mini has no breakfast row, so it's simply
 * not offered on the customer-facing single-meal screen). */
export function TiffinMealPricesPage() {
  const [prices, setPrices] = useState<TiffinMealPrice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    setIsLoading(true);
    const { data } = await adminClient.get<{ prices: TiffinMealPrice[] }>("/admin/tiffin/meal-prices");
    setPrices(data.prices);
    setIsLoading(false);
  }

  useEffect(() => {
    reload();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await adminClient.post("/admin/tiffin/meal-prices", {
        tier: form.tier,
        mealType: form.mealType,
        price: Number(form.price),
        active: true,
      });
      setForm(emptyForm);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create meal price");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleToggleActive(price: TiffinMealPrice) {
    await adminClient.put(`/admin/tiffin/meal-prices/${price.id}`, { active: !price.active });
    await reload();
  }

  async function handlePriceChange(price: TiffinMealPrice, value: string) {
    const amount = Number(value);
    if (Number.isNaN(amount) || amount <= 0) return;
    await adminClient.put(`/admin/tiffin/meal-prices/${price.id}`, { price: amount });
    await reload();
  }

  return (
    <div>
      <h1>GG Tiffin — Single-Meal Prices</h1>

      <form onSubmit={handleCreate} style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 24, alignItems: "center" }}>
        <select value={form.tier} onChange={(e) => setForm({ ...form, tier: e.target.value as TiffinMealTier })}>
          {TIFFIN_MEAL_TIERS.map((tier) => (
            <option key={tier} value={tier}>
              {TIER_LABELS[tier]}
            </option>
          ))}
        </select>
        <select value={form.mealType} onChange={(e) => setForm({ ...form, mealType: e.target.value as SingleMealType })}>
          {SINGLE_MEAL_TYPES.map((mealType) => (
            <option key={mealType} value={mealType}>
              {MEAL_TYPE_LABELS[mealType]}
            </option>
          ))}
        </select>
        <input type="number" min={1} placeholder="Price (₹)" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
        <button type="submit" disabled={isSubmitting}>
          Add price
        </button>
      </form>
      {error && <p style={{ color: "#B3261E" }}>{error}</p>}

      {isLoading ? (
        <p>Loading…</p>
      ) : prices.length === 0 ? (
        <p>No meal prices yet.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th align="left">Tier</th>
              <th align="left">Meal</th>
              <th align="left">Price</th>
              <th align="left">Active</th>
            </tr>
          </thead>
          <tbody>
            {prices.map((price) => (
              <tr key={price.id} style={{ borderTop: "1px solid #E4DCD3" }}>
                <td>{TIER_LABELS[price.tier]}</td>
                <td>{MEAL_TYPE_LABELS[price.mealType]}</td>
                <td>
                  <input type="number" defaultValue={price.price} style={{ width: 80 }} onBlur={(e) => handlePriceChange(price, e.target.value)} />
                </td>
                <td>
                  <input type="checkbox" checked={price.active} onChange={() => handleToggleActive(price)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
