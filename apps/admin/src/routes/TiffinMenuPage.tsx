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
import { useEffect, useMemo, useRef, useState } from "react";
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

/**
 * One filled dish slot's card — always fully editable in place, same "click a field, type, blur
 * to save" pattern MenuItemCard uses for every other brand's items — plus Remove, which deletes
 * the slot outright (it goes back to being an empty "+ Add" card, the same state Mini's breakfast
 * slots used to be permanently stuck in before this page could create/delete slots at all).
 */
function DishCard({ dish, onSaved, onDeleted }: { dish: TiffinDish; onSaved: (dish: TiffinDish) => void; onDeleted: (id: string) => void }) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function save(patch: Partial<TiffinDish>) {
    const merged = { ...dish, ...patch };
    const { data } = await adminClient.put<{ dish: TiffinDish }>("/admin/tiffin/dishes", {
      tier: merged.tier,
      dietType: merged.dietType,
      mealType: merged.mealType,
      dayOfWeek: merged.dayOfWeek,
      dishName: merged.dishName,
      image: merged.image,
      price: merged.price,
      hasAddOns: merged.hasAddOns,
      riceSubstitute: merged.riceSubstitute,
      extraAddOnName: merged.extraAddOnName,
    });
    onSaved(data.dish);
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const url = await uploadDishImage(file);
      await save({ image: url });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDelete() {
    if (!confirm(`Remove "${dish.dishName}" from ${dish.dayOfWeek} ${MEAL_TYPE_LABELS[dish.mealType]}? This can't be undone.`)) return;
    setIsDeleting(true);
    try {
      await adminClient.delete(`/admin/tiffin/dishes/${dish.id}`);
      onDeleted(dish.id);
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wide text-muted">
          {dish.dayOfWeek} · {MEAL_TYPE_LABELS[dish.mealType]}
        </p>
        <button onClick={handleDelete} disabled={isDeleting} className="text-xs font-bold text-danger hover:underline disabled:opacity-60">
          {isDeleting ? "Removing…" : "Remove"}
        </button>
      </div>

      <div className="relative">
        {dish.image ? (
          <img src={dish.image} alt={dish.dishName} className="h-32 w-full rounded-lg object-cover" />
        ) : (
          <div className="flex h-32 w-full items-center justify-center rounded-lg bg-surface text-xs text-muted">No photo</div>
        )}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="absolute bottom-2 right-2 rounded-lg bg-white/90 px-2.5 py-1.5 text-xs font-bold text-text shadow hover:bg-white disabled:opacity-60"
        >
          {isUploading ? "Uploading…" : "Change Photo"}
        </button>
        <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handlePhotoChange} />
      </div>

      <Input defaultValue={dish.dishName} onBlur={(e) => e.target.value.trim() && e.target.value !== dish.dishName && save({ dishName: e.target.value.trim() })} placeholder="Dish name" />

      <div>
        <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted">Price (₹)</p>
        <Input
          key={dish.id}
          type="number"
          min={0}
          defaultValue={dish.price ?? ""}
          placeholder={`Falls back to the ${dish.tier}/${dish.mealType} slot price`}
          onBlur={(e) => {
            const raw = e.target.value.trim();
            const parsed = raw === "" ? undefined : Number(raw);
            if (parsed !== dish.price) save({ price: parsed });
          }}
        />
      </div>

      <label className="flex items-center gap-1.5 text-sm font-semibold text-text">
        <input type="checkbox" checked={dish.hasAddOns} onChange={(e) => save({ hasAddOns: e.target.checked })} className="h-4 w-4 accent-primary" />
        Offers add-ons (staples + a top-up)
      </label>

      {dish.hasAddOns && (
        <>
          {dish.tier === "premium" && (
            <div>
              <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted">Rice Substitute</p>
              <Segmented options={RICE_SUBSTITUTE_OPTIONS} value={dish.riceSubstitute} onChange={(v) => save({ riceSubstitute: v })} />
            </div>
          )}
          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted">Extra-Portion Add-On</p>
            <Select value={dish.extraAddOnName ?? ""} onChange={(e) => save({ extraAddOnName: e.target.value || undefined })}>
              <option value="">Extra {dish.dishName} (veg top-up)</option>
              {PROTEIN_ADD_ON_NAMES.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </Select>
          </div>
        </>
      )}
    </Card>
  );
}

/**
 * An empty slot — no dish exists yet for this (tier, diet, meal, day). A small inline form that
 * creates one via the same upsert PUT the edit form above uses; the moment it saves, this card is
 * replaced by a real, fully-editable DishCard. This is what makes "add a dish" possible at all —
 * every slot starts out either filled (from seeding) or here, never a third "doesn't exist and
 * can't be created" state.
 */
function AddDishCard({
  tier,
  dietType,
  mealType,
  dayOfWeek,
  onCreated,
}: {
  tier: TiffinMealTier;
  dietType: TiffinDietType;
  mealType: SingleMealType;
  dayOfWeek: DayOfWeek;
  onCreated: (dish: TiffinDish) => void;
}) {
  const [dishName, setDishName] = useState("");
  const [price, setPrice] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!dishName.trim()) return;
    setError(null);
    setIsSaving(true);
    try {
      const { data } = await adminClient.put<{ dish: TiffinDish }>("/admin/tiffin/dishes", {
        tier,
        dietType,
        mealType,
        dayOfWeek,
        dishName: dishName.trim(),
        price: price.trim() ? Number(price) : undefined,
        hasAddOns: true,
        riceSubstitute: "rice",
      });
      onCreated(data.dish);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add dish");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card className="flex flex-col gap-3 border-dashed">
      <p className="text-xs font-bold uppercase tracking-wide text-muted">
        {dayOfWeek} · {MEAL_TYPE_LABELS[mealType]}
      </p>
      <div className="flex h-32 w-full items-center justify-center rounded-lg bg-surface text-xs text-muted">Nothing on the menu yet</div>
      <form onSubmit={handleAdd} className="flex flex-col gap-2">
        <Input placeholder="Dish name" value={dishName} onChange={(e) => setDishName(e.target.value)} required />
        <Input type="number" min={0} placeholder="Price (₹, optional)" value={price} onChange={(e) => setPrice(e.target.value)} />
        <Button type="submit" variant="secondary" disabled={isSaving || !dishName.trim()}>
          {isSaving ? "Adding…" : "+ Add Dish"}
        </Button>
      </form>
      {error && <p className="text-xs font-medium text-danger">{error}</p>}
    </Card>
  );
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

  // Every (day, mealType) slot for the selected tier/diet, whether or not a dish exists for it
  // yet — an empty one renders as an AddDishCard instead of just being left out, so "there's
  // nothing here" and "there could be something here" both stay visible and actionable.
  const slots = useMemo(() => {
    const map = new Map<string, TiffinDish>();
    for (const d of dishes) {
      if (d.tier === tier && d.dietType === dietType) map.set(`${d.dayOfWeek}|${d.mealType}`, d);
    }
    const ordered: { key: string; day: DayOfWeek; mealType: SingleMealType; dish: TiffinDish | null }[] = [];
    for (const day of DISPLAY_DAYS) {
      for (const mealType of SINGLE_MEAL_TYPES) {
        const dish = map.get(`${day}|${mealType}`) ?? null;
        ordered.push({ key: `${day}|${mealType}`, day, mealType, dish });
      }
    }
    return ordered;
  }, [dishes, tier, dietType]);

  async function saveAddOnPrice(name: string, price: number) {
    const { data } = await adminClient.put<{ addOnPrice: TiffinAddOnPrice }>("/admin/tiffin/add-on-prices", { name, price });
    setAddOnPrices((prev) => prev.map((p) => (p.id === data.addOnPrice.id ? data.addOnPrice : p)));
  }

  return (
    <div>
      <PageHeader
        title="GG Tiffin — Menu"
        description="The single-meal weekly rotation, one card per day — click any field to edit it directly, same as any other brand's menu items. A dashed card means nothing's on the menu for that slot yet; fill it in to add a dish, or Remove an existing one to take it off. Availability for subscription plans (e.g. a Twice Daily or Thrice Daily plan) follows these same dishes automatically — a style needs every day of the week filled in for its meal types before a plan can offer it."
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Segmented options={TIER_OPTIONS} value={tier} onChange={setTier} />
        <Segmented options={DIET_OPTIONS} value={dietType} onChange={setDietType} />
      </div>

      {loadError ? (
        <p className="text-sm font-medium text-danger">{loadError}</p>
      ) : isLoading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {slots.map((slot) =>
            slot.dish ? (
              <DishCard
                key={slot.key}
                dish={slot.dish}
                onSaved={(updated) => setDishes((prev) => prev.map((d) => (d.id === updated.id ? updated : d)))}
                onDeleted={(id) => setDishes((prev) => prev.filter((d) => d.id !== id))}
              />
            ) : (
              <AddDishCard
                key={slot.key}
                tier={tier}
                dietType={dietType}
                mealType={slot.mealType}
                dayOfWeek={slot.day}
                onCreated={(created) => setDishes((prev) => [...prev, created])}
              />
            )
          )}
        </div>
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
