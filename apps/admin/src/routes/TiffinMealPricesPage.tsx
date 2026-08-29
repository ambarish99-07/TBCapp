import { SINGLE_MEAL_TYPES, TIFFIN_MEAL_TIERS, type SingleMealType, type TiffinMealPrice, type TiffinMealTier } from "@tbc/shared-types";
import { useEffect, useState } from "react";
import { adminClient } from "../api/adminClient.js";
import { Button } from "../components/ui/Button.js";
import { Card } from "../components/ui/Card.js";
import { EmptyState } from "../components/ui/EmptyState.js";
import { Input, Select } from "../components/ui/Input.js";
import { PageHeader } from "../components/ui/PageHeader.js";
import { Table, Td, Th, Thead, Tr } from "../components/ui/Table.js";

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
      <PageHeader title="GG Tiffin — Single-Meal Prices" />

      <Card title="Add a price" className="mb-6">
        <form onSubmit={handleCreate} className="flex flex-wrap items-center gap-2">
          <Select value={form.tier} onChange={(e) => setForm({ ...form, tier: e.target.value as TiffinMealTier })}>
            {TIFFIN_MEAL_TIERS.map((tier) => (
              <option key={tier} value={tier}>
                {TIER_LABELS[tier]}
              </option>
            ))}
          </Select>
          <Select value={form.mealType} onChange={(e) => setForm({ ...form, mealType: e.target.value as SingleMealType })}>
            {SINGLE_MEAL_TYPES.map((mealType) => (
              <option key={mealType} value={mealType}>
                {MEAL_TYPE_LABELS[mealType]}
              </option>
            ))}
          </Select>
          <Input
            type="number"
            min={1}
            placeholder="Price (₹)"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            required
            className="w-28"
          />
          <Button type="submit" disabled={isSubmitting}>
            Add price
          </Button>
        </form>
        {error && <p className="mt-3 text-sm font-medium text-danger">{error}</p>}
      </Card>

      <Card>
        {isLoading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : prices.length === 0 ? (
          <EmptyState message="No meal prices yet." />
        ) : (
          <Table>
            <Thead>
              <Tr>
                <Th>Tier</Th>
                <Th>Meal</Th>
                <Th>Price</Th>
                <Th>Active</Th>
              </Tr>
            </Thead>
            <tbody>
              {prices.map((price) => (
                <Tr key={price.id}>
                  <Td>{TIER_LABELS[price.tier]}</Td>
                  <Td>{MEAL_TYPE_LABELS[price.mealType]}</Td>
                  <Td>
                    <Input type="number" defaultValue={price.price} className="w-24" onBlur={(e) => handlePriceChange(price, e.target.value)} />
                  </Td>
                  <Td>
                    <input type="checkbox" checked={price.active} onChange={() => handleToggleActive(price)} className="h-4 w-4 accent-primary" />
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
