import { TIFFIN_PLAN_STYLES, type TiffinDietType, type TiffinPlan, type TiffinPlanStyle } from "@tbc/shared-types";
import { useEffect, useState } from "react";
import { adminClient } from "../api/adminClient.js";

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
      <h1>GG Tiffin Plans</h1>

      <form onSubmit={handleCreate} style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 24, alignItems: "center" }}>
        <input placeholder="Plan name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <select value={form.dietType} onChange={(e) => setForm({ ...form, dietType: e.target.value as TiffinDietType })}>
          {DIET_OPTIONS.map((diet) => (
            <option key={diet} value={diet}>
              {diet}
            </option>
          ))}
        </select>
        <select value={form.style} onChange={(e) => setForm({ ...form, style: e.target.value as TiffinPlanStyle })}>
          {TIFFIN_PLAN_STYLES.map((style) => (
            <option key={style} value={style}>
              {STYLE_LABELS[style]}
            </option>
          ))}
        </select>
        <input
          type="number"
          min={1}
          placeholder="Duration (days)"
          value={form.durationDays}
          onChange={(e) => setForm({ ...form, durationDays: e.target.value })}
          required
        />
        <input
          type="number"
          min={1}
          placeholder="Price (₹)"
          value={form.price}
          onChange={(e) => setForm({ ...form, price: e.target.value })}
          required
        />
        <button type="submit" disabled={isSubmitting}>
          Add plan
        </button>
      </form>
      {error && <p style={{ color: "#B3261E" }}>{error}</p>}

      {isLoading ? (
        <p>Loading…</p>
      ) : plans.length === 0 ? (
        <p>No plans yet.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th align="left">Name</th>
              <th align="left">Diet</th>
              <th align="left">Style</th>
              <th align="left">Duration</th>
              <th align="left">Price</th>
              <th align="left">Active</th>
            </tr>
          </thead>
          <tbody>
            {plans.map((plan) => (
              <tr key={plan.id} style={{ borderTop: "1px solid #E4DCD3" }}>
                <td>{plan.name}</td>
                <td>{plan.dietType}</td>
                <td>{STYLE_LABELS[plan.style]}</td>
                <td>{plan.durationDays} days</td>
                <td>
                  <input
                    type="number"
                    defaultValue={plan.price}
                    style={{ width: 80 }}
                    onBlur={(e) => handlePriceChange(plan, e.target.value)}
                  />
                </td>
                <td>
                  <input type="checkbox" checked={plan.active} onChange={() => handleToggleActive(plan)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
