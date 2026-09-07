import {
  TIFFIN_MEAL_TIERS,
  TIFFIN_PLAN_DURATIONS,
  TIFFIN_PLAN_STYLES,
  type TiffinDietType,
  type TiffinMealTier,
  type TiffinPlan,
  type TiffinPlanStyle,
} from "@tbc/shared-types";
import { useEffect, useMemo, useState } from "react";
import { adminClient } from "../api/adminClient.js";
import { Button } from "../components/ui/Button.js";
import { Card } from "../components/ui/Card.js";
import { EmptyState } from "../components/ui/EmptyState.js";
import { Input, Select } from "../components/ui/Input.js";
import { PageHeader } from "../components/ui/PageHeader.js";
import { Segmented } from "../components/ui/Segmented.js";
import { Table, Td, Th, Thead, Tr } from "../components/ui/Table.js";

const DIET_OPTIONS: TiffinDietType[] = ["veg", "non-veg"];

// Mini has no breakfast dish configured anywhere in the system, so it can't be a thrice-daily
// plan — the server rejects that combination (see tiffin.service.ts#assertValidTierStyle).
const TIER_LABELS: Record<TiffinMealTier, string> = { regular: "Regular", mini: "Mini", premium: "Premium" };

const STYLE_LABELS: Record<TiffinPlanStyle, string> = {
  single: "Single (Breakfast, Lunch, or Dinner)",
  "twice-daily": "Twice Daily (Lunch & Dinner)",
  "thrice-daily": "Thrice Daily (Breakfast, Lunch & Dinner)",
  "lunch-only": "Lunch Only",
  "dinner-only": "Dinner Only",
};

type DurationFilter = "all" | "weekly" | "monthly";
type TierFilter = "all" | TiffinMealTier;
const DURATION_FILTER_OPTIONS: { key: DurationFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
];
const TIER_FILTER_OPTIONS: { key: TierFilter; label: string }[] = [
  { key: "all", label: "All Tiers" },
  { key: "regular", label: "Regular" },
  { key: "mini", label: "Mini" },
  { key: "premium", label: "Premium" },
];
const TIER_ORDER: Record<TiffinMealTier, number> = { regular: 0, mini: 1, premium: 2 };
const STYLE_ORDER: Record<TiffinPlanStyle, number> = { single: 0, "twice-daily": 1, "thrice-daily": 2, "lunch-only": 3, "dinner-only": 4 };

const emptyForm = {
  name: "",
  dietType: "veg" as TiffinDietType,
  tier: "regular" as TiffinMealTier,
  style: TIFFIN_PLAN_STYLES[0] as TiffinPlanStyle,
  durationDays: "7",
  price: "",
  salePercent: "",
};

export function TiffinPlansPage() {
  const [plans, setPlans] = useState<TiffinPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // Without this, a failed request left the page stuck on "Loading…" forever with no way to
  // tell why.
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isNewPlanMonthly = Number(form.durationDays) === TIFFIN_PLAN_DURATIONS.monthly;
  // The catalog now spans 3 tiers x up to 5 styles x 2 durations x 2 diets — filtering and a
  // stable sort keep the table actually usable instead of a long list in creation order.
  const [durationFilter, setDurationFilter] = useState<DurationFilter>("all");
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");

  const visiblePlans = useMemo(() => {
    return plans
      .filter((plan) => {
        if (tierFilter !== "all" && plan.tier !== tierFilter) return false;
        if (durationFilter === "weekly" && plan.durationDays !== TIFFIN_PLAN_DURATIONS.weekly) return false;
        if (durationFilter === "monthly" && plan.durationDays !== TIFFIN_PLAN_DURATIONS.monthly) return false;
        return true;
      })
      .sort(
        (a, b) =>
          TIER_ORDER[a.tier] - TIER_ORDER[b.tier] ||
          STYLE_ORDER[a.style] - STYLE_ORDER[b.style] ||
          a.durationDays - b.durationDays ||
          a.dietType.localeCompare(b.dietType)
      );
  }, [plans, durationFilter, tierFilter]);

  async function reload() {
    setIsLoading(true);
    setLoadError(null);
    try {
      const { data } = await adminClient.get<{ plans: TiffinPlan[] }>("/admin/tiffin/plans");
      setPlans(data.plans);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load plans");
    } finally {
      setIsLoading(false);
    }
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
        tier: form.tier,
        style: form.style,
        durationDays: Number(form.durationDays),
        price: Number(form.price),
        salePercent: isNewPlanMonthly && form.salePercent ? Number(form.salePercent) : undefined,
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

  async function handleSalePercentChange(plan: TiffinPlan, input: string) {
    const trimmed = input.trim();
    if (trimmed === "") {
      // null (not undefined) so a cleared field actually clears the stored discount — a bare
      // `undefined` never survives JSON.stringify, so the key would just go missing and look
      // identical to "leave it untouched" server-side.
      if (plan.salePercent == null) return;
      await adminClient.put(`/admin/tiffin/plans/${plan.id}`, { salePercent: null });
      await reload();
      return;
    }
    const value = Number(trimmed);
    if (Number.isNaN(value) || value < 1 || value > 99 || value === plan.salePercent) return;
    await adminClient.put(`/admin/tiffin/plans/${plan.id}`, { salePercent: value });
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
          <Select value={form.tier} onChange={(e) => setForm({ ...form, tier: e.target.value as TiffinMealTier })}>
            {TIFFIN_MEAL_TIERS.map((tier) => (
              <option key={tier} value={tier}>
                {TIER_LABELS[tier]}
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
          {isNewPlanMonthly && (
            <Input
              type="number"
              min={1}
              max={99}
              placeholder="Discount % (optional)"
              value={form.salePercent}
              onChange={(e) => setForm({ ...form, salePercent: e.target.value })}
              className="w-40"
            />
          )}
          <Button type="submit" disabled={isSubmitting}>
            Add plan
          </Button>
        </form>
        {error && <p className="mt-3 text-sm font-medium text-danger">{error}</p>}
      </Card>

      {plans.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Segmented options={DURATION_FILTER_OPTIONS} value={durationFilter} onChange={setDurationFilter} />
          <Segmented options={TIER_FILTER_OPTIONS} value={tierFilter} onChange={setTierFilter} />
          <span className="text-xs font-semibold text-muted">
            {visiblePlans.length} of {plans.length} plans
          </span>
        </div>
      )}

      <Card>
        {loadError ? (
          <p className="text-sm font-medium text-danger">{loadError}</p>
        ) : isLoading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : plans.length === 0 ? (
          <EmptyState message="No plans yet." />
        ) : visiblePlans.length === 0 ? (
          <EmptyState message="No plans match this filter." />
        ) : (
          <Table>
            <Thead>
              <Tr>
                <Th>Name</Th>
                <Th>Diet</Th>
                <Th>Tier</Th>
                <Th>Style</Th>
                <Th>Duration</Th>
                <Th>Price</Th>
                <Th>Discount</Th>
                <Th>Active</Th>
              </Tr>
            </Thead>
            <tbody>
              {visiblePlans.map((plan) => {
                const isMonthly = plan.durationDays === TIFFIN_PLAN_DURATIONS.monthly;
                return (
                  <Tr key={plan.id}>
                    <Td>{plan.name}</Td>
                    <Td>{plan.dietType}</Td>
                    <Td>{TIER_LABELS[plan.tier] ?? plan.tier}</Td>
                    <Td>{STYLE_LABELS[plan.style]}</Td>
                    <Td>{plan.durationDays} days</Td>
                    <Td>
                      <Input type="number" defaultValue={plan.price} className="w-24" onBlur={(e) => handlePriceChange(plan, e.target.value)} />
                    </Td>
                    <Td>
                      {isMonthly ? (
                        <div className="flex items-center gap-1.5">
                          <Input
                            type="number"
                            min={1}
                            max={99}
                            placeholder="—"
                            defaultValue={plan.salePercent ?? ""}
                            className="w-20"
                            onBlur={(e) => handleSalePercentChange(plan, e.target.value)}
                          />
                          <span className="text-sm text-muted">% off</span>
                        </div>
                      ) : (
                        <span className="text-sm text-muted" title="Discounts are only available on monthly plans">
                          — monthly only
                        </span>
                      )}
                    </Td>
                    <Td>
                      <input type="checkbox" checked={plan.active} onChange={() => handleToggleActive(plan)} className="h-4 w-4 accent-primary" />
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
