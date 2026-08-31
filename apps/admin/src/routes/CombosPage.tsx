import type { Brand, Combo, MenuItem } from "@tbc/shared-types";
import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { adminClient } from "../api/adminClient.js";
import { Button } from "../components/ui/Button.js";
import { Card } from "../components/ui/Card.js";
import { EmptyState } from "../components/ui/EmptyState.js";
import { Input, Select } from "../components/ui/Input.js";
import { PageHeader } from "../components/ui/PageHeader.js";

const DEFAULT_DISCOUNT_PCT = 15;

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function uploadImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("image", file);
  // Reuses the menu items' upload endpoint — combo images live in the same public/menu-images pool.
  const { data } = await adminClient.post<{ url: string }>("/menu/upload-image", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data.url;
}

/** Checkbox grid for picking which of this brand's menu items belong to a combo. */
function ItemPicker({ items, selectedIds, onToggle }: { items: MenuItem[]; selectedIds: string[]; onToggle: (id: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onToggle(item.id)}
          className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${
            selectedIds.includes(item.id) ? "border-primary bg-primary/10 text-primary-dark" : "border-border text-text hover:bg-surface"
          }`}
        >
          {item.signatureName}
        </button>
      ))}
    </div>
  );
}

function ComboCard({
  combo,
  items,
  onSaved,
  onDelete,
}: {
  combo: Combo;
  items: MenuItem[];
  onSaved: (combo: Combo) => void;
  onDelete: (id: string) => void;
}) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function save(patch: Record<string, unknown>) {
    const base =
      combo.type === "curated"
        ? { itemIds: combo.itemIds }
        : { chooseCount: combo.chooseCount, eligibleItemIds: combo.eligibleItemIds };
    const { data } = await adminClient.put<{ combo: Combo }>("/menu/combos", {
      id: combo.id,
      brandId: combo.brandId,
      type: combo.type,
      name: combo.name,
      description: combo.description,
      image: combo.image,
      discountPercent: combo.discountPercent,
      ...base,
      ...patch,
    });
    onSaved(data.combo);
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const url = await uploadImage(file);
      await save({ image: url });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function toggleItem(id: string) {
    if (combo.type === "curated") {
      const itemIds = combo.itemIds.includes(id) ? combo.itemIds.filter((i) => i !== id) : [...combo.itemIds, id];
      save({ itemIds });
    } else {
      const eligibleItemIds = combo.eligibleItemIds.includes(id)
        ? combo.eligibleItemIds.filter((i) => i !== id)
        : [...combo.eligibleItemIds, id];
      save({ eligibleItemIds });
    }
  }

  const selectedIds = combo.type === "curated" ? combo.itemIds : combo.eligibleItemIds;

  return (
    <Card className="flex flex-col gap-3">
      <div className="relative">
        {combo.image ? (
          <img src={combo.image} alt={combo.name} className="h-36 w-full rounded-lg object-cover" />
        ) : (
          <div className="flex h-36 w-full items-center justify-center rounded-lg bg-surface text-sm text-muted">No photo</div>
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

      <span className="w-fit rounded-full bg-surface px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-muted">
        {combo.type === "curated" ? "Curated" : "Choose Your Own"}
      </span>

      <Input defaultValue={combo.name} onBlur={(e) => e.target.value !== combo.name && save({ name: e.target.value })} placeholder="Name" />
      <Input
        defaultValue={combo.description}
        onBlur={(e) => e.target.value !== combo.description && save({ description: e.target.value })}
        placeholder="Description"
      />

      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={1}
          max={99}
          defaultValue={combo.discountPercent ?? ""}
          placeholder={`Discount % (default ${DEFAULT_DISCOUNT_PCT})`}
          onBlur={(e) => {
            const value = e.target.value.trim();
            // null (not undefined) so a cleared field actually clears the stored override —
            // see UpsertComboRequestSchema's doc-comment for why undefined can't do this.
            const parsed = value ? Number(value) : null;
            if (parsed !== (combo.discountPercent ?? null)) save({ discountPercent: parsed });
          }}
          className="w-56"
        />
        {combo.type === "choose-n" && (
          <Input
            type="number"
            min={1}
            defaultValue={combo.chooseCount}
            onBlur={(e) => {
              const value = Number(e.target.value);
              if (!Number.isNaN(value) && value > 0 && value !== combo.chooseCount) save({ chooseCount: value });
            }}
            className="w-32"
            placeholder="Choose count"
          />
        )}
      </div>

      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
          {combo.type === "curated" ? "Items in this combo" : "Eligible items"}
        </p>
        <ItemPicker items={items} selectedIds={selectedIds} onToggle={toggleItem} />
      </div>

      <Button variant="danger" onClick={() => onDelete(combo.id)}>
        Delete
      </Button>
    </Card>
  );
}

const emptyForm = {
  id: "",
  type: "curated" as "curated" | "choose-n",
  name: "",
  description: "",
  discountPercent: "",
  chooseCount: "2",
};

export function CombosPage() {
  const { brandId } = useParams<{ brandId: string }>();
  const [brand, setBrand] = useState<Brand | null>(null);
  const [combos, setCombos] = useState<Combo[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    setIsLoading(true);
    const [brandsRes, combosRes, itemsRes] = await Promise.all([
      adminClient.get<{ brands: Brand[] }>("/admin/brands"),
      adminClient.get<{ combos: Combo[] }>("/menu/combos", { params: { brandId } }),
      adminClient.get<{ items: MenuItem[] }>("/menu", { params: { brandId } }),
    ]);
    setBrand(brandsRes.data.brands.find((b) => b.id === brandId) ?? null);
    setCombos(combosRes.data.combos);
    setItems(itemsRes.data.items);
    setIsLoading(false);
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId]);

  function toggleSelected(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const minNeeded = form.type === "curated" ? 2 : Number(form.chooseCount) || 1;
    if (selectedIds.length < minNeeded) {
      setError(form.type === "curated" ? "Pick at least 2 items for a curated combo." : "Pick at least as many eligible items as the choose count.");
      return;
    }
    setIsSubmitting(true);
    try {
      const image = imageFile ? await uploadImage(imageFile) : undefined;
      const id = form.id.trim() || slugify(form.name);
      await adminClient.put("/menu/combos", {
        id,
        brandId,
        type: form.type,
        name: form.name,
        description: form.description,
        image,
        discountPercent: form.discountPercent ? Number(form.discountPercent) : undefined,
        ...(form.type === "curated" ? { itemIds: selectedIds } : { chooseCount: Number(form.chooseCount), eligibleItemIds: selectedIds }),
      });
      setForm(emptyForm);
      setSelectedIds([]);
      setImageFile(null);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add combo");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this combo? This can't be undone.")) return;
    await adminClient.delete(`/menu/combos/${id}`);
    await reload();
  }

  return (
    <div>
      <PageHeader
        title={brand ? `${brand.name} — Combos` : "Combos"}
        description="Curated and choose-your-own combos — items, photos, and the discount applied to each."
        action={
          <Link to="/brands" className="text-sm font-semibold text-primary-dark hover:underline">
            ‹ Back to Brands
          </Link>
        }
      />

      <Card title="Add a New Combo" className="mb-6">
        <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Select
            value={form.type}
            onChange={(e) => {
              setForm({ ...form, type: e.target.value as "curated" | "choose-n" });
              setSelectedIds([]);
            }}
          >
            <option value="curated">Curated (fixed items)</option>
            <option value="choose-n">Choose Your Own</option>
          </Select>
          <Input
            placeholder="Name (e.g. Chocolate Duo)"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value, id: form.id || slugify(e.target.value) })}
            required
          />
          <Input placeholder="ID / slug" value={form.id || slugify(form.name)} onChange={(e) => setForm({ ...form, id: e.target.value })} />
          <Input placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
          <Input
            type="number"
            min={1}
            max={99}
            placeholder={`Discount % (default ${DEFAULT_DISCOUNT_PCT})`}
            value={form.discountPercent}
            onChange={(e) => setForm({ ...form, discountPercent: e.target.value })}
          />
          {form.type === "choose-n" && (
            <Input
              type="number"
              min={1}
              placeholder="Choose count"
              value={form.chooseCount}
              onChange={(e) => setForm({ ...form, chooseCount: e.target.value })}
              required
            />
          )}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
            className="text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
          />

          <div className="sm:col-span-2 lg:col-span-3">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
              {form.type === "curated" ? "Items in this combo (pick at least 2)" : "Eligible items (pick at least the choose count)"}
            </p>
            <ItemPicker items={items} selectedIds={selectedIds} onToggle={toggleSelected} />
          </div>

          <div className="sm:col-span-2 lg:col-span-3">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Adding…" : "Add Combo"}
            </Button>
          </div>
        </form>
        {error && <p className="mt-3 text-sm font-medium text-danger">{error}</p>}
      </Card>

      {isLoading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : combos.length === 0 ? (
        <Card>
          <EmptyState message="No combos yet — add the first one above." />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {combos.map((combo) => (
            <ComboCard
              key={combo.id}
              combo={combo}
              items={items}
              onSaved={(updated) => setCombos((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
