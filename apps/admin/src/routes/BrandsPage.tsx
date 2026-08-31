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

const emptyForm = { id: "", name: "", tagline: "", primaryColor: "", accentColor: "", status: "live" as BrandStatus };

export function BrandsPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // Without this, a failed request left the page stuck on "Loading…" forever with no way to
  // tell why.
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
