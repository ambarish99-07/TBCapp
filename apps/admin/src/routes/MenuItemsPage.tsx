import { MenuCategorySchema, type Brand, type MenuCategory, type MenuItem } from "@tbc/shared-types";
import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { adminClient } from "../api/adminClient.js";
import { Button } from "../components/ui/Button.js";
import { Card } from "../components/ui/Card.js";
import { EmptyState } from "../components/ui/EmptyState.js";
import { Input, Select } from "../components/ui/Input.js";
import { PageHeader } from "../components/ui/PageHeader.js";

const CATEGORY_OPTIONS = MenuCategorySchema.options;
const CATEGORY_LABELS: Record<MenuCategory, string> = {
  "signature-shakes": "Signature Shake",
  "cold-coffee": "Cold Coffee",
  mocktails: "Mocktail",
};

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

const emptyForm = {
  id: "",
  signatureName: "",
  commonName: "",
  description: "",
  price: "",
  category: CATEGORY_OPTIONS[0] as MenuCategory,
  flavorBadges: "",
  salePercent: "",
  isPopular: false,
  isNew: false,
  isStaffPick: false,
};

function MenuItemCard({ item, onSaved, onDelete }: { item: MenuItem; onSaved: (item: MenuItem) => void; onDelete: (id: string) => void }) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function save(patch: Partial<MenuItem>) {
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
        <Select value={item.category} onChange={(e) => save({ category: e.target.value as MenuCategory })} className="flex-1">
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </Select>
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
  const [isLoading, setIsLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    setIsLoading(true);
    const [brandsRes, itemsRes] = await Promise.all([
      adminClient.get<{ brands: Brand[] }>("/admin/brands"),
      adminClient.get<{ items: MenuItem[] }>("/menu", { params: { brandId } }),
    ]);
    setBrand(brandsRes.data.brands.find((b) => b.id === brandId) ?? null);
    setItems(itemsRes.data.items);
    setIsLoading(false);
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId]);

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
      });
      setForm(emptyForm);
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

  return (
    <div>
      <PageHeader
        title={brand?.name ?? brandId ?? "Menu Items"}
        description="Full control over this brand's menu — names, prices, photos, and new additions."
        action={
          <Link to="/brands" className="text-sm font-semibold text-primary-dark hover:underline">
            ‹ Back to Brands
          </Link>
        }
      />

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
          <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as MenuCategory })}>
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </Select>
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
            <Button type="submit" disabled={isSubmitting} className="ml-auto">
              {isSubmitting ? "Adding…" : "Add Item"}
            </Button>
          </div>
        </form>
        {error && <p className="mt-3 text-sm font-medium text-danger">{error}</p>}
      </Card>

      {isLoading ? (
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
              onSaved={(updated) => setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)))}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
