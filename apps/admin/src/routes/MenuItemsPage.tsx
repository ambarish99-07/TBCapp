import type { Brand, MenuAddOnPrice, MenuItem } from "@tbc/shared-types";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { adminClient } from "../api/adminClient.js";
import { Button } from "../components/ui/Button.js";
import { Card } from "../components/ui/Card.js";
import { EmptyState } from "../components/ui/EmptyState.js";
import { Input } from "../components/ui/Input.js";
import { PageHeader } from "../components/ui/PageHeader.js";

const CATEGORY_DATALIST_ID = "menu-category-suggestions";

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
  const { data } = await adminClient.post<{ url: string }>("/menu/upload-image", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data.url;
}

/** Free-text add-on names this item currently offers — toggled against the shared, admin-managed
 * add-on price catalog. A brand-new kind of item (a biryani, a momo plate, ...) just needs its
 * own rows added to that catalog once (below), then picks from them here like any other item. */
function AddOnPicker({ addOnPrices, selected, onToggle }: { addOnPrices: MenuAddOnPrice[]; selected: string[]; onToggle: (name: string) => void }) {
  if (addOnPrices.length === 0) {
    return <p className="text-xs text-muted">No add-ons in the catalog yet — add some in "Add-On Prices" below.</p>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {addOnPrices.map((addOn) => (
        <button
          key={addOn.id}
          type="button"
          onClick={() => onToggle(addOn.name)}
          className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${
            selected.includes(addOn.name) ? "border-primary bg-primary/10 text-primary-dark" : "border-border text-text hover:bg-surface"
          }`}
        >
          {addOn.name} (₹{addOn.price})
        </button>
      ))}
    </div>
  );
}

const emptyForm = {
  id: "",
  signatureName: "",
  commonName: "",
  description: "",
  price: "",
  category: "",
  flavorBadges: "",
  salePercent: "",
  isPopular: false,
  isNew: false,
  isStaffPick: false,
  hasSugarIceCustomization: true,
};

function MenuItemCard({
  item,
  addOnPrices,
  onSaved,
  onDelete,
}: {
  item: MenuItem;
  addOnPrices: MenuAddOnPrice[];
  onSaved: (item: MenuItem) => void;
  onDelete: (id: string) => void;
}) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function save(patch: Record<string, unknown>) {
    const { data } = await adminClient.put<{ item: MenuItem }>("/menu", {
      id: item.id,
      brandId: item.brandId,
      signatureName: item.signatureName,
      commonName: item.commonName,
      description: item.description,
      price: item.price,
      category: item.category,
      image: item.image,
      flavorBadges: item.flavorBadges,
      isPopular: item.isPopular,
      isNew: item.isNew,
      isStaffPick: item.isStaffPick,
      salePercent: item.salePercent,
      hasSugarIceCustomization: item.hasSugarIceCustomization ?? true,
      addOnNames: item.addOnNames ?? [],
      ...patch,
    });
    onSaved(data.item);
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

  function toggleAddOn(name: string) {
    const current = item.addOnNames ?? [];
    save({ addOnNames: current.includes(name) ? current.filter((n) => n !== name) : [...current, name] });
  }

  return (
    <Card className="flex flex-col gap-3">
      <div className="relative">
        <img src={item.image} alt={item.signatureName} className="h-36 w-full rounded-lg object-cover" />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="absolute bottom-2 right-2 rounded-lg bg-white/90 px-2.5 py-1.5 text-xs font-bold text-text shadow hover:bg-white disabled:opacity-60"
        >
          {isUploading ? "Uploading…" : "Change Photo"}
        </button>
        <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handlePhotoChange} />
      </div>

      <Input defaultValue={item.signatureName} onBlur={(e) => e.target.value !== item.signatureName && save({ signatureName: e.target.value })} placeholder="Signature name" />
      <Input defaultValue={item.commonName} onBlur={(e) => e.target.value !== item.commonName && save({ commonName: e.target.value })} placeholder="Common name" />
      <Input
        defaultValue={item.description}
        onBlur={(e) => e.target.value !== item.description && save({ description: e.target.value })}
        placeholder="Description"
      />

      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={1}
          defaultValue={item.price}
          onBlur={(e) => {
            const value = Number(e.target.value);
            if (!Number.isNaN(value) && value > 0 && value !== item.price) save({ price: value });
          }}
          className="w-24"
        />
        <Input
          defaultValue={item.category}
          list={CATEGORY_DATALIST_ID}
          placeholder="Category (e.g. Biryani)"
          onBlur={(e) => e.target.value.trim() && e.target.value !== item.category && save({ category: e.target.value.trim() })}
          className="flex-1"
        />
      </div>

      <Input
        defaultValue={item.flavorBadges.join(", ")}
        onBlur={(e) => {
          const badges = e.target.value.split(",").map((b) => b.trim()).filter(Boolean);
          save({ flavorBadges: badges });
        }}
        placeholder="Flavor badges, comma separated"
      />

      <Input
        type="number"
        min={1}
        max={99}
        defaultValue={item.salePercent ?? ""}
        placeholder="Sale % (optional)"
        onBlur={(e) => {
          const value = e.target.value.trim();
          const parsed = value ? Number(value) : undefined;
          if (parsed !== item.salePercent) save({ salePercent: parsed });
        }}
      />

      <div className="flex flex-wrap gap-3 text-sm font-semibold text-text">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={!!item.isPopular} onChange={(e) => save({ isPopular: e.target.checked })} className="h-4 w-4 accent-primary" />
          Popular
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={!!item.isNew} onChange={(e) => save({ isNew: e.target.checked })} className="h-4 w-4 accent-primary" />
          New
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={!!item.isStaffPick} onChange={(e) => save({ isStaffPick: e.target.checked })} className="h-4 w-4 accent-primary" />
          Staff Pick
        </label>
        <label className="flex items-center gap-1.5" title="Uncheck for an item with no sugar/ice concept at all (e.g. food, not a drink) — the customize screen then skips both pickers entirely.">
          <input
            type="checkbox"
            checked={item.hasSugarIceCustomization ?? true}
            onChange={(e) => save({ hasSugarIceCustomization: e.target.checked })}
            className="h-4 w-4 accent-primary"
          />
          Sugar/Ice pickers
        </label>
      </div>

      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Add-Ons Offered</p>
        <AddOnPicker addOnPrices={addOnPrices} selected={item.addOnNames ?? []} onToggle={toggleAddOn} />
      </div>

      <Button variant="danger" onClick={() => onDelete(item.id)}>
        Delete
      </Button>
    </Card>
  );
}

export function MenuItemsPage() {
  const { brandId } = useParams<{ brandId: string }>();
  const [brand, setBrand] = useState<Brand | null>(null);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [addOnPrices, setAddOnPrices] = useState<MenuAddOnPrice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // Without this, a failed request left the page stuck on "Loading…" forever with no way to
  // tell why.
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [newItemAddOns, setNewItemAddOns] = useState<string[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newAddOnName, setNewAddOnName] = useState("");
  const [newAddOnPrice, setNewAddOnPrice] = useState("");

  async function reload() {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [brandsRes, itemsRes, addOnPricesRes] = await Promise.all([
        adminClient.get<{ brands: Brand[] }>("/admin/brands"),
        adminClient.get<{ items: MenuItem[] }>("/menu", { params: { brandId } }),
        adminClient.get<{ addOnPrices: MenuAddOnPrice[] }>("/menu/add-on-prices"),
      ]);
      setBrand(brandsRes.data.brands.find((b) => b.id === brandId) ?? null);
      setItems(itemsRes.data.items);
      setAddOnPrices(addOnPricesRes.data.addOnPrices);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load menu items");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId]);

  // Every category already in use on this brand's menu — offered as datalist suggestions so
  // typos don't quietly create a near-duplicate category ("Biryani" vs "biryani").
  const categorySuggestions = useMemo(() => Array.from(new Set(items.map((i) => i.category))).sort(), [items]);

  function toggleNewItemAddOn(name: string) {
    setNewItemAddOns((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!imageFile) {
      setError("Please choose a photo for this item.");
      return;
    }
    setIsSubmitting(true);
    try {
      const image = await uploadImage(imageFile);
      const id = form.id.trim() || slugify(form.signatureName);
      await adminClient.put("/menu", {
        id,
        brandId,
        signatureName: form.signatureName,
        commonName: form.commonName,
        description: form.description,
        price: Number(form.price),
        category: form.category,
        image,
        flavorBadges: form.flavorBadges.split(",").map((b) => b.trim()).filter(Boolean),
        isPopular: form.isPopular,
        isNew: form.isNew,
        isStaffPick: form.isStaffPick,
        salePercent: form.salePercent ? Number(form.salePercent) : undefined,
        hasSugarIceCustomization: form.hasSugarIceCustomization,
        addOnNames: newItemAddOns,
      });
      setForm(emptyForm);
      setNewItemAddOns([]);
      setImageFile(null);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add item");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this menu item? This can't be undone.")) return;
    await adminClient.delete(`/menu/${id}`);
    await reload();
  }

  async function handleAddOnPriceSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newAddOnName.trim() || !newAddOnPrice) return;
    await adminClient.put("/menu/add-on-prices", { name: newAddOnName.trim(), price: Number(newAddOnPrice) });
    setNewAddOnName("");
    setNewAddOnPrice("");
    await reload();
  }

  async function handleAddOnPriceChange(name: string, price: number) {
    await adminClient.put("/menu/add-on-prices", { name, price });
    await reload();
  }

  return (
    <div>
      <PageHeader
        title={brand?.name ?? brandId ?? "Menu Items"}
        description="Full control over this brand's menu — names, prices, photos, categories, and new additions."
        action={
          <Link to="/brands" className="text-sm font-semibold text-primary-dark hover:underline">
            ‹ Back to Brands
          </Link>
        }
      />

      {/* Shared by every brand's menu, not just this one — a new brand's own add-ons (e.g. "Extra
          Raita" for a biryani item) get a row here once, then any item on any brand can offer them. */}
      <Card title="Add-On Prices" description="Shared across every brand's menu — add a new named add-on here, then offer it on whichever items want it below." className="mb-6">
        <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {addOnPrices.map((addOn) => (
            <div key={addOn.id}>
              <p className="mb-1 text-xs font-bold text-muted">{addOn.name}</p>
              <Input
                type="number"
                min={0}
                defaultValue={addOn.price}
                onBlur={(e) => {
                  const value = Number(e.target.value);
                  if (!Number.isNaN(value) && value >= 0 && value !== addOn.price) handleAddOnPriceChange(addOn.name, value);
                }}
                className="w-full"
              />
            </div>
          ))}
        </div>
        <form onSubmit={handleAddOnPriceSubmit} className="flex flex-wrap items-center gap-2">
          <Input placeholder="New add-on name (e.g. Extra Raita)" value={newAddOnName} onChange={(e) => setNewAddOnName(e.target.value)} className="flex-1" />
          <Input type="number" min={0} placeholder="Price (₹)" value={newAddOnPrice} onChange={(e) => setNewAddOnPrice(e.target.value)} className="w-28" />
          <Button type="submit" variant="secondary">
            Add
          </Button>
        </form>
      </Card>

      <Card title="Add a New Item" className="mb-6">
        <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Input
            placeholder="Signature name (e.g. Choco Crush)"
            value={form.signatureName}
            onChange={(e) => setForm({ ...form, signatureName: e.target.value, id: form.id || slugify(e.target.value) })}
            required
          />
          <Input placeholder="Common name (e.g. Rich Chocolate Shake)" value={form.commonName} onChange={(e) => setForm({ ...form, commonName: e.target.value })} required />
          <Input
            placeholder="ID / slug"
            value={form.id || slugify(form.signatureName)}
            onChange={(e) => setForm({ ...form, id: e.target.value })}
          />
          <Input placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
          <Input
            type="number"
            min={1}
            placeholder="Price (₹)"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            required
          />
          <Input
            placeholder="Category (e.g. Biryani, Signature Shake)"
            list={CATEGORY_DATALIST_ID}
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            required
          />
          <Input
            placeholder="Flavor badges, comma separated"
            value={form.flavorBadges}
            onChange={(e) => setForm({ ...form, flavorBadges: e.target.value })}
          />
          <Input
            type="number"
            min={1}
            max={99}
            placeholder="Sale % (optional)"
            value={form.salePercent}
            onChange={(e) => setForm({ ...form, salePercent: e.target.value })}
          />
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
            className="text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
          />

          <div className="flex flex-wrap items-center gap-3 text-sm font-semibold text-text sm:col-span-2 lg:col-span-3">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={form.isPopular} onChange={(e) => setForm({ ...form, isPopular: e.target.checked })} className="h-4 w-4 accent-primary" />
              Popular
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={form.isNew} onChange={(e) => setForm({ ...form, isNew: e.target.checked })} className="h-4 w-4 accent-primary" />
              New
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={form.isStaffPick} onChange={(e) => setForm({ ...form, isStaffPick: e.target.checked })} className="h-4 w-4 accent-primary" />
              Staff Pick
            </label>
            <label className="flex items-center gap-1.5" title="Uncheck for an item with no sugar/ice concept at all (e.g. food, not a drink).">
              <input
                type="checkbox"
                checked={form.hasSugarIceCustomization}
                onChange={(e) => setForm({ ...form, hasSugarIceCustomization: e.target.checked })}
                className="h-4 w-4 accent-primary"
              />
              Sugar/Ice pickers
            </label>
          </div>

          <div className="sm:col-span-2 lg:col-span-3">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Add-Ons Offered</p>
            <AddOnPicker addOnPrices={addOnPrices} selected={newItemAddOns} onToggle={toggleNewItemAddOn} />
          </div>

          <div className="sm:col-span-2 lg:col-span-3">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Adding…" : "Add Item"}
            </Button>
          </div>
        </form>
        {error && <p className="mt-3 text-sm font-medium text-danger">{error}</p>}
      </Card>

      <datalist id={CATEGORY_DATALIST_ID}>
        {categorySuggestions.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      {loadError ? (
        <p className="text-sm font-medium text-danger">{loadError}</p>
      ) : isLoading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : items.length === 0 ? (
        <Card>
          <EmptyState message="No menu items yet — add the first one above." />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <MenuItemCard
              key={item.id}
              item={item}
              addOnPrices={addOnPrices}
              onSaved={(updated) => setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)))}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
