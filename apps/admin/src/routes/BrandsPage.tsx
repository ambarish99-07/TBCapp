import type { Brand, BrandStatus } from "@tbc/shared-types";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { adminClient } from "../api/adminClient.js";
import { Button } from "../components/ui/Button.js";
import { Card } from "../components/ui/Card.js";
import { EmptyState } from "../components/ui/EmptyState.js";
import { Input, Select } from "../components/ui/Input.js";
import { PageHeader } from "../components/ui/PageHeader.js";
import { Table, Td, Th, Thead, Tr } from "../components/ui/Table.js";

const STATUS_OPTIONS: BrandStatus[] = ["live", "coming-soon"];

const emptyForm = { id: "", name: "", tagline: "", primaryColor: "", accentColor: "", status: "live" as BrandStatus, logoUrl: "" };

async function uploadBrandLogo(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("image", file);
  const { data } = await adminClient.post<{ url: string }>("/admin/brands/upload-image", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data.url;
}

export function BrandsPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // Without this, a failed request left the page stuck on "Loading…" forever with no way to
  // tell why.
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Per-row "uploading…" state for the existing-brands table's own logo swap, keyed by brand id
  // so uploading for one brand doesn't disable every other row's control.
  const [uploadingLogoForId, setUploadingLogoForId] = useState<string | null>(null);

  async function reload() {
    setIsLoading(true);
    setLoadError(null);
    try {
      const { data } = await adminClient.get<{ brands: Brand[] }>("/admin/brands");
      setBrands(data.brands);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load brands");
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
      await adminClient.post("/admin/brands", {
        id: form.id,
        name: form.name,
        tagline: form.tagline || undefined,
        primaryColor: form.primaryColor || undefined,
        accentColor: form.accentColor || undefined,
        status: form.status,
        logoUrl: form.logoUrl || undefined,
      });
      setForm(emptyForm);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create brand");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleStatusChange(id: string, status: BrandStatus) {
    await adminClient.put(`/admin/brands/${id}`, { status });
    await reload();
  }

  async function handleCreateFormLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingLogo(true);
    try {
      const url = await uploadBrandLogo(file);
      setForm((prev) => ({ ...prev, logoUrl: url }));
    } finally {
      setIsUploadingLogo(false);
    }
  }

  async function handleExistingLogoChange(id: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogoForId(id);
    try {
      const url = await uploadBrandLogo(file);
      await adminClient.put(`/admin/brands/${id}`, { logoUrl: url });
      await reload();
    } finally {
      setUploadingLogoForId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(`Delete brand "${id}"? This does not delete its menu items or orders.`)) return;
    await adminClient.delete(`/admin/brands/${id}`);
    await reload();
  }

  return (
    <div>
      <PageHeader title="Brands" />

      <Card title="Add a brand" className="mb-6">
        <form onSubmit={handleCreate} className="flex flex-wrap items-center gap-2">
          <Input placeholder="id (e.g. tbc)" value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} required />
          <Input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Input placeholder="Tagline" value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} />
          <Input
            placeholder="Primary color (#hex)"
            value={form.primaryColor}
            onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
          />
          <Input
            placeholder="Accent color (#hex)"
            value={form.accentColor}
            onChange={(e) => setForm({ ...form, accentColor: e.target.value })}
          />
          <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as BrandStatus })}>
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </Select>
          <Button type="submit" disabled={isSubmitting}>
            Add brand
          </Button>
        </form>
        <div className="mt-3 flex items-center gap-3">
          {form.logoUrl && <img src={form.logoUrl} alt="Logo preview" className="h-12 w-12 rounded-full object-cover" />}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleCreateFormLogoChange}
            disabled={isUploadingLogo}
            className="text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
          />
          {isUploadingLogo && <span className="text-sm text-muted">Uploading…</span>}
        </div>
        {error && <p className="mt-3 text-sm font-medium text-danger">{error}</p>}
      </Card>

      <Card>
        {loadError ? (
          <p className="text-sm font-medium text-danger">{loadError}</p>
        ) : isLoading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : brands.length === 0 ? (
          <EmptyState message="No brands yet." />
        ) : (
          <Table>
            <Thead>
              <Tr>
                <Th>Logo</Th>
                <Th>Id</Th>
                <Th>Name</Th>
                <Th>Tagline</Th>
                <Th>Status</Th>
                <Th></Th>
                <Th></Th>
                <Th></Th>
              </Tr>
            </Thead>
            <tbody>
              {brands.map((brand) => (
                <Tr key={brand.id}>
                  <Td>
                    <div className="flex items-center gap-2">
                      {brand.logoUrl ? (
                        <img src={brand.logoUrl} alt={brand.name} className="h-10 w-10 rounded-full object-cover" />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-surface" />
                      )}
                      <label className="cursor-pointer text-xs font-semibold text-primary-dark hover:underline">
                        {uploadingLogoForId === brand.id ? "Uploading…" : "Change"}
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          onChange={(e) => handleExistingLogoChange(brand.id, e)}
                          disabled={uploadingLogoForId === brand.id}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </Td>
                  <Td>{brand.id}</Td>
                  <Td>{brand.name}</Td>
                  <Td>{brand.tagline ?? "—"}</Td>
                  <Td>
                    <Select value={brand.status} onChange={(e) => handleStatusChange(brand.id, e.target.value as BrandStatus)}>
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </Select>
                  </Td>
                  <Td>
                    {/* GG Tiffin has no MenuItem catalog of its own — its "menu" is the single-meal
                        weekly rotation, a differently-shaped thing with its own dedicated page. */}
                    <Link to={brand.id === "gg-tiffin" ? "/tiffin-menu" : `/brands/${brand.id}/menu-items`}>
                      <Button variant="secondary">Manage Menu ›</Button>
                    </Link>
                  </Td>
                  <Td>
                    {/* GG Tiffin has no combos concept either — same skip as Manage Menu above. */}
                    {brand.id !== "gg-tiffin" && (
                      <Link to={`/brands/${brand.id}/combos`}>
                        <Button variant="secondary">Manage Combos ›</Button>
                      </Link>
                    )}
                  </Td>
                  <Td>
                    <Button variant="danger" onClick={() => handleDelete(brand.id)}>
                      Delete
                    </Button>
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
