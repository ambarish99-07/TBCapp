import { TIFFIN_PLAN_STYLES, type TiffinDietType, type TiffinPlan, type TiffinPlanStyle } from "@tbc/shared-types";
import { useEffect, useState } from "react";
import { adminClient } from "../api/adminClient.js";
import { Button } from "../components/ui/Button.js";
import { Card } from "../components/ui/Card.js";
import { EmptyState } from "../components/ui/EmptyState.js";
import { Input, Select } from "../components/ui/Input.js";
import { PageHeader } from "../components/ui/PageHeader.js";
import { Table, Td, Th, Thead, Tr } from "../components/ui/Table.js";

const DIET_OPTIONS: TiffinDietType[] = ["veg", "non-veg"];

const STYLE_LABELS: Record<TiffinPlanStyle, string> = {
  single: "Single (Breakfast, Lunch, or Dinner)",
  "twice-daily": "Twice Daily (Lunch & Dinner)",
  "thrice-daily": "Thrice Daily (Breakfast, Lunch & Dinner)",
};

const emptyForm = {
  name: "",
  dietType: "veg" as TiffinDietType,
  style: TIFFIN_PLAN_STYLES[0] as TiffinPlanStyle,
  durationDays: "7",
  price: "",
};

export function TiffinPlansPage() {
  const [plans, setPlans] = useState<TiffinPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    setIsLoading(true);
    const { data } = await adminClient.get<{ plans: TiffinPlan[] }>("/admin/tiffin/plans");
    setPlans(data.plans);
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
      await adminClient.post("/admin/tiffin/plans", {
        name: form.name,
        dietType: form.dietType,
        style: form.style,
        durationDays: Number(form.durationDays),
        price: Number(form.price),
        active: true,
      });
      setForm(emptyForm);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create plan");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleToggleActive(plan: TiffinPlan) {
    await adminClient.put(`/admin/tiffin/plans/${plan.id}`, { active: !plan.active });
    await reload();
  }

  async function handlePriceChange(plan: TiffinPlan, price: string) {
    const value = Number(price);
    if (Number.isNaN(value) || value <= 0) return;
    await adminClient.put(`/admin/tiffin/plans/${plan.id}`, { price: value });
    await reload();
  }

  return (
    <div>
      <PageHeader title="GG Tiffin Plans" />

      <Card title="Add a plan" className="mb-6">
        <form onSubmit={handleCreate} className="flex flex-wrap items-center gap-2">
          <Input placeholder="Plan name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Select value={form.dietType} onChange={(e) => setForm({ ...form, dietType: e.target.value as TiffinDietType })}>
            {DIET_OPTIONS.map((diet) => (
              <option key={diet} value={diet}>
                {diet}
              </option>
            ))}
          </Select>
          <Select value={form.style} onChange={(e) => setForm({ ...form, style: e.target.value as TiffinPlanStyle })}>
            {TIFFIN_PLAN_STYLES.map((style) => (
              <option key={style} value={style}>
                {STYLE_LABELS[style]}
              </option>
            ))}
          </Select>
          <Input
            type="number"
            min={1}
            placeholder="Duration (days)"
            value={form.durationDays}
            onChange={(e) => setForm({ ...form, durationDays: e.target.value })}
            required
            className="w-36"
          />
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
            Add plan
          </Button>
        </form>
        {error && <p className="mt-3 text-sm font-medium text-danger">{error}</p>}
      </Card>

      <Card>
        {isLoading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : plans.length === 0 ? (
          <EmptyState message="No plans yet." />
        ) : (
          <Table>
            <Thead>
              <Tr>
                <Th>Name</Th>
                <Th>Diet</Th>
                <Th>Style</Th>
                <Th>Duration</Th>
                <Th>Price</Th>
                <Th>Active</Th>
              </Tr>
            </Thead>
            <tbody>
              {plans.map((plan) => (
                <Tr key={plan.id}>
                  <Td>{plan.name}</Td>
                  <Td>{plan.dietType}</Td>
                  <Td>{STYLE_LABELS[plan.style]}</Td>
                  <Td>{plan.durationDays} days</Td>
                  <Td>
                    <Input type="number" defaultValue={plan.price} className="w-24" onBlur={(e) => handlePriceChange(plan, e.target.value)} />
                  </Td>
                  <Td>
                    <input type="checkbox" checked={plan.active} onChange={() => handleToggleActive(plan)} className="h-4 w-4 accent-primary" />
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
