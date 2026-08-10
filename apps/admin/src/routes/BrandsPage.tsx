import type { Brand, BrandStatus } from "@tbc/shared-types";
import { useEffect, useState } from "react";
import { adminClient } from "../api/adminClient.js";

const STATUS_OPTIONS: BrandStatus[] = ["live", "coming-soon"];

const emptyForm = { id: "", name: "", tagline: "", primaryColor: "", accentColor: "", status: "live" as BrandStatus };

export function BrandsPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    setIsLoading(true);
    const { data } = await adminClient.get<{ brands: Brand[] }>("/admin/brands");
    setBrands(data.brands);
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
      await adminClient.post("/admin/brands", {
        id: form.id,
        name: form.name,
        tagline: form.tagline || undefined,
        primaryColor: form.primaryColor || undefined,
        accentColor: form.accentColor || undefined,
        status: form.status,
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

  async function handleDelete(id: string) {
    if (!confirm(`Delete brand "${id}"? This does not delete its menu items or orders.`)) return;
    await adminClient.delete(`/admin/brands/${id}`);
    await reload();
  }

  return (
    <div>
      <h1>Brands</h1>

      <form onSubmit={handleCreate} style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 24, alignItems: "center" }}>
        <input placeholder="id (e.g. tbc)" value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} required />
        <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <input placeholder="Tagline" value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} />
        <input
          placeholder="Primary color (#hex)"
          value={form.primaryColor}
          onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
        />
        <input
          placeholder="Accent color (#hex)"
          value={form.accentColor}
          onChange={(e) => setForm({ ...form, accentColor: e.target.value })}
        />
        <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as BrandStatus })}>
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        <button type="submit" disabled={isSubmitting}>
          Add brand
        </button>
      </form>
      {error && <p style={{ color: "#B3261E" }}>{error}</p>}

      {isLoading ? (
        <p>Loading…</p>
      ) : brands.length === 0 ? (
        <p>No brands yet.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th align="left">Id</th>
              <th align="left">Name</th>
              <th align="left">Tagline</th>
              <th align="left">Status</th>
              <th align="left"></th>
            </tr>
          </thead>
          <tbody>
            {brands.map((brand) => (
              <tr key={brand.id} style={{ borderTop: "1px solid #E4DCD3" }}>
                <td>{brand.id}</td>
                <td>{brand.name}</td>
                <td>{brand.tagline ?? "—"}</td>
                <td>
                  <select value={brand.status} onChange={(e) => handleStatusChange(brand.id, e.target.value as BrandStatus)}>
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <button onClick={() => handleDelete(brand.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
