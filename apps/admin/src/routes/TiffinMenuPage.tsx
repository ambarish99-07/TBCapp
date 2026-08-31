import {
  DAYS_OF_WEEK,
  SINGLE_MEAL_TYPES,
  TIFFIN_MEAL_TIERS,
  TiffinDietTypeSchema,
  type DayOfWeek,
  type SingleMealType,
  type TiffinAddOnPrice,
  type TiffinDietType,
  type TiffinDish,
  type TiffinMealTier,
} from "@tbc/shared-types";
import { useEffect, useMemo, useState } from "react";
import { adminClient } from "../api/adminClient.js";
import { Button } from "../components/ui/Button.js";
import { Card } from "../components/ui/Card.js";
import { Input, Select } from "../components/ui/Input.js";
import { PageHeader } from "../components/ui/PageHeader.js";
import { Segmented } from "../components/ui/Segmented.js";

// Monday-first for display — DAYS_OF_WEEK itself starts Sunday (matching the schema's canonical
// order), which reads oddly as a weekly grid.
const DISPLAY_DAYS: DayOfWeek[] = [...DAYS_OF_WEEK.slice(1), DAYS_OF_WEEK[0]];

const TIER_OPTIONS = TIFFIN_MEAL_TIERS.map((t) => ({ key: t, label: t.charAt(0).toUpperCase() + t.slice(1) }));
const DIET_OPTIONS = TiffinDietTypeSchema.options.map((d) => ({ key: d, label: d === "veg" ? "🟢 Veg" : "🔴 Non-Veg" }));
const RICE_SUBSTITUTE_OPTIONS = [
  { key: "rice", label: "Rice" },
  { key: "pulao", label: "Pulao" },
] as const;
const MEAL_TYPE_LABELS: Record<SingleMealType, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner" };
// Only these are ever a dish's own "extra portion" add-on — the flat staples (Rice/Roti/etc.) and
// the generic "Extra Portion" fallback price itself are never picked here.
const PROTEIN_ADD_ON_NAMES = ["Fish piece", "Egg piece", "Chicken piece", "Mutton piece"];

async function uploadDishImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("image", file);
  const { data } = await adminClient.post<{ url: string }>("/admin/tiffin/dishes/upload-image", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data.url;
}

export function TiffinMenuPage() {
  const [dishes, setDishes] = useState<TiffinDish[]>([]);
  const [addOnPrices, setAddOnPrices] = useState<TiffinAddOnPrice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // Without this, a failed request left the page stuck on "Loading…" forever with no way to
  // tell why.
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tier, setTier] = useState<TiffinMealTier>("regular");
  const [dietType, setDietType] = useState<TiffinDietType>("veg");
  const [selected, setSelected] = useState<TiffinDish | null>(null);

  async function reload() {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [dishesRes, addOnsRes] = await Promise.all([
        adminClient.get<{ dishes: TiffinDish[] }>("/admin/tiffin/dishes"),
        adminClient.get<{ addOnPrices: TiffinAddOnPrice[] }>("/admin/tiffin/add-on-prices"),
      ]);
      setDishes(dishesRes.data.dishes);
      setAddOnPrices(addOnsRes.data.addOnPrices);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load the menu");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  const gridDishes = useMemo(() => {
    const map = new Map<string, TiffinDish>();
    for (const d of dishes) {
      if (d.tier === tier && d.dietType === dietType) map.set(`${d.dayOfWeek}|${d.mealType}`, d);
    }
    return map;
  }, [dishes, tier, dietType]);

  const mealTypesForTier = tier === "mini" ? SINGLE_MEAL_TYPES.filter((m) => m !== "breakfast") : SINGLE_MEAL_TYPES;

  async function saveSelected(patch: Partial<TiffinDish>) {
    if (!selected) return;
    const merged = { ...selected, ...patch };
    const { data } = await adminClient.put<{ dish: TiffinDish }>("/admin/tiffin/dishes", {
      tier: merged.tier,
      dietType: merged.dietType,
      mealType: merged.mealType,
      dayOfWeek: merged.dayOfWeek,
      dishName: merged.dishName,
      image: merged.image,
      hasAddOns: merged.hasAddOns,
      riceSubstitute: merged.riceSubstitute,
      extraAddOnName: merged.extraAddOnName,
    });
    setSelected(data.dish);
    setDishes((prev) => prev.map((d) => (d.id === data.dish.id ? data.dish : d)));
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadDishImage(file);
    await saveSelected({ image: url });
  }

  async function saveAddOnPrice(name: string, price: number) {
    const { data } = await adminClient.put<{ addOnPrice: TiffinAddOnPrice }>("/admin/tiffin/add-on-prices", { name, price });
    setAddOnPrices((prev) => prev.map((p) => (p.id === data.addOnPrice.id ? data.addOnPrice : p)));
  }

  if (loadError) {
    return (
      <div>
        <PageHeader title="GG Tiffin — Menu" />
        <p className="text-sm font-medium text-danger">{loadError}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div>
        <PageHeader title="GG Tiffin — Menu" />
        <p className="text-sm text-muted">Loading…</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="GG Tiffin — Menu"
        description="The single-meal weekly rotation — what's served each day, per tier and diet."
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Segmented options={TIER_OPTIONS} value={tier} onChange={setTier} />
        <Segmented options={DIET_OPTIONS} value={dietType} onChange={setDietType} />
      </div>

      <Card className="mb-6">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="px-2 pb-2 text-left text-xs font-bold uppercase tracking-wide text-muted">Day</th>
                {mealTypesForTier.map((m) => (
                  <th key={m} className="px-2 pb-2 text-left text-xs font-bold uppercase tracking-wide text-muted">
                    {MEAL_TYPE_LABELS[m]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DISPLAY_DAYS.map((day) => (
                <tr key={day} className="border-t border-border">
                  <td className="whitespace-nowrap px-2 py-2 text-sm font-semibold text-text">{day}</td>
                  {mealTypesForTier.map((mealType) => {
                    const dish = gridDishes.get(`${day}|${mealType}`);
                    const isSelected = selected?.id === dish?.id && !!dish;
                    return (
                      <td key={mealType} className="px-2 py-2">
                        <button
                          onClick={() => dish && setSelected(dish)}
                          disabled={!dish}
                          className={`flex w-full min-w-[140px] items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors ${
                            isSelected ? "border-primary bg-primary/10" : "border-border hover:bg-surface"
                          } ${!dish ? "cursor-default opacity-40" : ""}`}
                        >
                          {dish?.image && <img src={dish.image} alt={dish.dishName} className="h-8 w-8 shrink-0 rounded object-cover" />}
                          <span className="truncate text-xs font-semibold text-text">{dish?.dishName ?? "—"}</span>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {selected && (
        <Card
          className="mb-6"
          title={`${selected.dayOfWeek} · ${MEAL_TYPE_LABELS[selected.mealType]} · ${
            TIER_OPTIONS.find((t) => t.key === selected.tier)?.label
          } · ${selected.dietType === "veg" ? "Veg" : "Non-Veg"}`}
          action={
            <Button variant="secondary" onClick={() => setSelected(null)}>
              Close
            </Button>
          }
        >
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="flex flex-col gap-3">
              <Input
                defaultValue={selected.dishName}
                onBlur={(e) => e.target.value.trim() && e.target.value !== selected.dishName && saveSelected({ dishName: e.target.value.trim() })}
                placeholder="Dish name"
              />
              <div className="flex items-center gap-3">
                {selected.image && <img src={selected.image} alt={selected.dishName} className="h-16 w-16 rounded-lg object-cover" />}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handlePhotoChange}
                  className="text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
                />
              </div>
              <label className="flex items-center gap-1.5 text-sm font-semibold text-text">
                <input
                  type="checkbox"
                  checked={selected.hasAddOns}
                  onChange={(e) => saveSelected({ hasAddOns: e.target.checked })}
                  className="h-4 w-4 accent-primary"
                />
                Offers add-ons (staples + a top-up)
              </label>
            </div>

            {selected.hasAddOns && (
              <div className="flex flex-col gap-4">
                {selected.tier === "premium" && (
                  <div>
                    <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted">Rice Substitute</p>
                    <Segmented
                      options={RICE_SUBSTITUTE_OPTIONS}
                      value={selected.riceSubstitute}
                      onChange={(v) => saveSelected({ riceSubstitute: v })}
                    />
                  </div>
                )}
                <div>
                  <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted">Extra-Portion Add-On</p>
                  <Select
                    value={selected.extraAddOnName ?? ""}
                    onChange={(e) => saveSelected({ extraAddOnName: e.target.value || undefined })}
                  >
                    <option value="">Extra {selected.dishName} (veg top-up)</option>
                    {PROTEIN_ADD_ON_NAMES.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      <Card title="Add-On Prices" description="Shared prices for Rice, Roti, Daal, and every other named add-on.">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {addOnPrices.map((p) => (
            <div key={p.id}>
              <p className="mb-1 text-xs font-bold text-muted">{p.name}</p>
              <Input
                type="number"
                min={1}
                defaultValue={p.price}
                onBlur={(e) => {
                  const value = Number(e.target.value);
                  if (!Number.isNaN(value) && value > 0 && value !== p.price) saveAddOnPrice(p.name, value);
                }}
                className="w-full"
              />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
