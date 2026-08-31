import {
  SINGLE_MEAL_TYPES,
  TIFFIN_MEAL_TIERS,
  TiffinDietTypeSchema,
  type SingleMealType,
  type TiffinDietType,
  type TiffinDish,
  type TiffinFestivalSpecial,
  type TiffinMealTier,
} from "@tbc/shared-types";
import { useEffect, useRef, useState } from "react";
import { adminClient } from "../api/adminClient.js";
import { Button } from "../components/ui/Button.js";
import { Card } from "../components/ui/Card.js";
import { EmptyState } from "../components/ui/EmptyState.js";
import { Input, Select } from "../components/ui/Input.js";
import { PageHeader } from "../components/ui/PageHeader.js";
import { Table, Td, Th, Thead, Tr } from "../components/ui/Table.js";

const TIER_LABELS: Record<TiffinMealTier, string> = { regular: "Regular", mini: "Mini", premium: "Premium" };
const MEAL_TYPE_LABELS: Record<SingleMealType, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner" };
const DIET_LABELS: Record<TiffinDietType, string> = { veg: "🟢 Veg", "non-veg": "🔴 Non-Veg" };
// Only these are ever a dish's own "extra portion" add-on — mirrors TiffinMenuPage's own list.
const PROTEIN_ADD_ON_NAMES = ["Fish piece", "Egg piece", "Chicken piece", "Mutton piece"];

async function uploadDishImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("image", file);
  // Reuses the regular dish-photo upload endpoint — festival photos live in the same pool.
  const { data } = await adminClient.post<{ url: string }>("/admin/tiffin/dishes/upload-image", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data.url;
}

function isPast(dateIso: string): boolean {
  return dateIso < new Date().toISOString().slice(0, 10);
}

function SpecialRow({
  special,
  onSaved,
  onDelete,
}: {
  special: TiffinFestivalSpecial;
  onSaved: (special: TiffinFestivalSpecial) => void;
  onDelete: (id: string) => void;
}) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function save(patch: Partial<TiffinFestivalSpecial>) {
    const { data } = await adminClient.put<{ special: TiffinFestivalSpecial }>("/admin/tiffin/festival-specials", {
      date: special.date,
      label: special.label,
      tier: special.tier,
      dietType: special.dietType,
      mealType: special.mealType,
      dishName: special.dishName,
      image: special.image,
      hasAddOns: special.hasAddOns,
      riceSubstitute: special.riceSubstitute,
      extraAddOnName: special.extraAddOnName,
      active: special.active,
      ...patch,
    });
    onSaved(data.special);
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

  return (
    <Tr className={isPast(special.date) ? "opacity-50" : ""}>
      <Td className="whitespace-nowrap font-bold">{special.date}</Td>
      <Td>
        <div className="flex items-center gap-2">
          {special.image && <img src={special.image} alt={special.dishName} className="h-8 w-8 shrink-0 rounded object-cover" />}
          <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="text-xs font-semibold text-primary-dark hover:underline">
            {isUploading ? "…" : special.image ? "Change" : "Add photo"}
          </button>
          <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handlePhotoChange} />
        </div>
      </Td>
      <Td>
        <Input
          defaultValue={special.label}
          className="w-36"
          onBlur={(e) => e.target.value.trim() && e.target.value !== special.label && save({ label: e.target.value.trim() })}
        />
      </Td>
      <Td>{TIER_LABELS[special.tier]}</Td>
      <Td>{DIET_LABELS[special.dietType]}</Td>
      <Td>{MEAL_TYPE_LABELS[special.mealType]}</Td>
      <Td>
        <Input
          defaultValue={special.dishName}
          className="w-36"
          onBlur={(e) => e.target.value.trim() && e.target.value !== special.dishName && save({ dishName: e.target.value.trim() })}
        />
      </Td>
      <Td>
        {special.mealType === "breakfast" ? (
          <span className="text-xs text-muted">— (none for breakfast)</span>
        ) : (
          <div className="flex flex-col gap-1">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-text">
              <input type="checkbox" checked={special.hasAddOns} onChange={(e) => save({ hasAddOns: e.target.checked })} className="h-3.5 w-3.5 accent-primary" />
              Add-ons
            </label>
            {special.hasAddOns && special.tier === "premium" && (
              <Select value={special.riceSubstitute} onChange={(e) => save({ riceSubstitute: e.target.value as "rice" | "pulao" })} className="text-xs">
                <option value="rice">Rice</option>
                <option value="pulao">Pulao</option>
              </Select>
            )}
            {special.hasAddOns && (
              <Select value={special.extraAddOnName ?? ""} onChange={(e) => save({ extraAddOnName: e.target.value || undefined })} className="text-xs">
                <option value="">Extra {special.dishName} (veg)</option>
                {PROTEIN_ADD_ON_NAMES.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </Select>
            )}
          </div>
        )}
      </Td>
      <Td>
        <button
          onClick={() => save({ active: !special.active })}
          className={`rounded-full px-2.5 py-1 text-xs font-bold ${special.active ? "bg-success-soft text-success" : "bg-surface text-muted"}`}
        >
          {special.active ? "Active" : "Inactive"}
        </button>
      </Td>
      <Td>
        <Button variant="danger" onClick={() => onDelete(special.id)}>
          Delete
        </Button>
      </Td>
    </Tr>
  );
}

interface MealDraft {
  dishName: string;
  image: File | null;
}
const emptyMealDraft: MealDraft = { dishName: "", image: null };

const emptyDayForm = {
  date: "",
  label: "",
  dietType: "veg" as TiffinDietType,
};

export function TiffinFestivalSpecialsPage() {
  const [specials, setSpecials] = useState<TiffinFestivalSpecial[]>([]);
  // The regular weekly rotation — read-only here, just to work out which tiers actually offer
  // each meal type (e.g. Mini has no breakfast today). Not hardcoded, so this stays correct on
  // its own if that ever changes — e.g. Mini gaining its own breakfast dishes later would make it
  // start showing up here automatically, no code change needed.
  const [regularDishes, setRegularDishes] = useState<TiffinDish[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dayForm, setDayForm] = useState(emptyDayForm);
  const [meals, setMeals] = useState<Record<SingleMealType, MealDraft>>({
    breakfast: { ...emptyMealDraft },
    lunch: { ...emptyMealDraft },
    dinner: { ...emptyMealDraft },
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    setIsLoading(true);
    const [specialsRes, dishesRes] = await Promise.all([
      adminClient.get<{ specials: TiffinFestivalSpecial[] }>("/admin/tiffin/festival-specials"),
      adminClient.get<{ dishes: TiffinDish[] }>("/admin/tiffin/dishes"),
    ]);
    setSpecials(specialsRes.data.specials);
    setRegularDishes(dishesRes.data.dishes);
    setIsLoading(false);
  }

  useEffect(() => {
    reload();
  }, []);

  function tiersOffering(mealType: SingleMealType): TiffinMealTier[] {
    return TIFFIN_MEAL_TIERS.filter((tier) => regularDishes.some((d) => d.tier === tier && d.mealType === mealType));
  }

  function updateMeal(mealType: SingleMealType, patch: Partial<MealDraft>) {
    setMeals((prev) => ({ ...prev, [mealType]: { ...prev[mealType], ...patch } }));
  }

  /**
   * One admin action covers the whole festival day, every tier at once — whichever of
   * breakfast/lunch/dinner got a dish name is saved as an override for every tier that normally
   * offers that meal (Regular and Premium for breakfast today, all three for lunch/dinner — see
   * tiersOffering), skipping the rest entirely so an untouched meal time just keeps showing its
   * normal dish, exactly as if nothing had changed.
   */
  async function handleCreateDay(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const entries = SINGLE_MEAL_TYPES.filter((mealType) => meals[mealType].dishName.trim());
    if (entries.length === 0) {
      setError("Enter a dish for at least one meal time.");
      return;
    }
    setIsSubmitting(true);
    try {
      await Promise.all(
        entries.map(async (mealType) => {
          const draft = meals[mealType];
          // Uploaded once per meal type here, then reused across every tier's row below — not
          // once per tier, which would silently create 2-3 duplicate copies of the same photo.
          const image = draft.image ? await uploadDishImage(draft.image) : undefined;
          await Promise.all(
            tiersOffering(mealType).map((tier) =>
              adminClient.put("/admin/tiffin/festival-specials", {
                date: dayForm.date,
                label: dayForm.label,
                tier,
                dietType: dayForm.dietType,
                mealType,
                dishName: draft.dishName.trim(),
                image,
                // Sensible starting defaults — breakfast never offers add-ons regardless of this
                // flag (see singleMealMenu.ts#resolveAddOns), and fine-tuning riceSubstitute/
                // extraAddOnName per tier afterward is a row-level edit in the table below.
                hasAddOns: mealType !== "breakfast",
                riceSubstitute: "rice",
                active: true,
              })
            )
          );
        })
      );
      setDayForm(emptyDayForm);
      setMeals({ breakfast: { ...emptyMealDraft }, lunch: { ...emptyMealDraft }, dinner: { ...emptyMealDraft } });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save this festival day");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this festival special? The slot reverts to its regular weekly dish.")) return;
    await adminClient.delete(`/admin/tiffin/festival-specials/${id}`);
    await reload();
  }

  const upcoming = [...specials].sort((a, b) => a.date.localeCompare(b.date) || a.mealType.localeCompare(b.mealType));

  return (
    <div>
      <PageHeader
        title="GG Tiffin — Festival Specials"
        description="Plan a festival day ahead of time — whichever meals you set here replace the normal menu for every tier that offers it (Regular, Mini, and Premium alike); anything you leave blank keeps showing its regular dish, no matter how far in advance you set this up."
      />

      <Card title="Plan a Festival Day" className="mb-6">
        <form onSubmit={handleCreateDay} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Input type="date" value={dayForm.date} onChange={(e) => setDayForm({ ...dayForm, date: e.target.value })} required />
            <Input
              placeholder="Label shown to customers (e.g. 🪔 Diwali Special)"
              value={dayForm.label}
              onChange={(e) => setDayForm({ ...dayForm, label: e.target.value })}
              required
            />
            <Select value={dayForm.dietType} onChange={(e) => setDayForm({ ...dayForm, dietType: e.target.value as TiffinDietType })}>
              {TiffinDietTypeSchema.options.map((d) => (
                <option key={d} value={d}>
                  {DIET_LABELS[d]}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {SINGLE_MEAL_TYPES.map((mealType) => (
              <div key={mealType} className="rounded-lg border border-border p-3">
                <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted">{MEAL_TYPE_LABELS[mealType]}</p>
                <p className="mb-2 text-[11px] text-muted">Applies to {tiersOffering(mealType).map((t) => TIER_LABELS[t]).join(", ") || "no tier yet"}</p>
                <Input
                  placeholder="Dish name (leave blank to keep the regular menu)"
                  value={meals[mealType].dishName}
                  onChange={(e) => updateMeal(mealType, { dishName: e.target.value })}
                  className="mb-2"
                />
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => updateMeal(mealType, { image: e.target.files?.[0] ?? null })}
                  className="w-full text-xs text-muted file:mr-2 file:rounded-lg file:border-0 file:bg-primary file:px-2.5 file:py-1.5 file:text-xs file:font-semibold file:text-white"
                />
              </div>
            ))}
          </div>

          <div>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : "Save Festival Day"}
            </Button>
          </div>
        </form>
        {error && <p className="mt-3 text-sm font-medium text-danger">{error}</p>}
      </Card>

      <Card>
        {isLoading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : upcoming.length === 0 ? (
          <EmptyState message="No festival specials yet — plan a day above for an upcoming date." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <Thead>
                <Tr>
                  <Th>Date</Th>
                  <Th>Photo</Th>
                  <Th>Label</Th>
                  <Th>Tier</Th>
                  <Th>Diet</Th>
                  <Th>Meal</Th>
                  <Th>Dish</Th>
                  <Th>Add-ons</Th>
                  <Th>Status</Th>
                  <Th></Th>
                </Tr>
              </Thead>
              <tbody>
                {upcoming.map((special) => (
                  <SpecialRow
                    key={special.id}
                    special={special}
                    onSaved={(updated) => setSpecials((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))}
                    onDelete={handleDelete}
                  />
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
