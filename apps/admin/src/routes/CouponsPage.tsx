import type { Brand, Coupon, CouponType } from "@tbc/shared-types";
import { useEffect, useState } from "react";
import { adminClient } from "../api/adminClient.js";
import { Button } from "../components/ui/Button.js";
import { Card } from "../components/ui/Card.js";
import { EmptyState } from "../components/ui/EmptyState.js";
import { Input, Select } from "../components/ui/Input.js";
import { PageHeader } from "../components/ui/PageHeader.js";
import { Table, Td, Th, Thead, Tr } from "../components/ui/Table.js";

const TYPE_OPTIONS: CouponType[] = ["flat", "percent"];

const emptyForm = {
  code: "",
  type: "flat" as CouponType,
  value: "",
  minOrderAmount: "",
  maxDiscountAmount: "",
  brandId: "all",
  expiresAt: "",
  isActive: true,
};

function isExpired(coupon: Coupon): boolean {
  return !!coupon.expiresAt && new Date(coupon.expiresAt) < new Date();
}

export function CouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    setIsLoading(true);
    const { data } = await adminClient.get<{ coupons: Coupon[] }>("/admin/coupons");
    setCoupons(data.coupons);
    setIsLoading(false);
  }

  useEffect(() => {
    reload();
    adminClient.get<{ brands: Brand[] }>("/admin/brands").then((res) => setBrands(res.data.brands));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await adminClient.post("/admin/coupons", {
        code: form.code,
        type: form.type,
        value: Number(form.value),
        minOrderAmount: form.minOrderAmount ? Number(form.minOrderAmount) : 0,
        maxDiscountAmount: form.maxDiscountAmount ? Number(form.maxDiscountAmount) : undefined,
        brandId: form.brandId === "all" ? undefined : form.brandId,
        expiresAt: form.expiresAt || undefined,
        isActive: form.isActive,
      });
      setForm(emptyForm);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create coupon");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUpdate(id: string, patch: Partial<Coupon>) {
    await adminClient.put(`/admin/coupons/${id}`, patch);
    await reload();
  }

  async function handleDelete(id: string, code: string) {
    if (!confirm(`Delete coupon "${code}"? This can't be undone.`)) return;
    await adminClient.delete(`/admin/coupons/${id}`);
    await reload();
  }

  return (
    <div>
      <PageHeader title="Coupons" description="Create and manage discount codes across every brand." />

      <Card title="Add a Coupon" className="mb-6">
        <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input placeholder="Code (e.g. WELCOME50)" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
          <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as CouponType })}>
            <option value="flat">Flat ₹ off</option>
            <option value="percent">% off</option>
          </Select>
          <Input
            type="number"
            min={1}
            placeholder={form.type === "percent" ? "Percent (e.g. 20)" : "Amount off (₹)"}
            value={form.value}
            onChange={(e) => setForm({ ...form, value: e.target.value })}
            required
          />
          <Input
            type="number"
            min={0}
            placeholder="Min order amount (₹)"
            value={form.minOrderAmount}
            onChange={(e) => setForm({ ...form, minOrderAmount: e.target.value })}
          />
          {form.type === "percent" && (
            <Input
              type="number"
              min={1}
              placeholder="Max discount cap (₹, optional)"
              value={form.maxDiscountAmount}
              onChange={(e) => setForm({ ...form, maxDiscountAmount: e.target.value })}
            />
          )}
          <Select value={form.brandId} onChange={(e) => setForm({ ...form, brandId: e.target.value })}>
            <option value="all">Every brand</option>
            {brands.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name} only
              </option>
            ))}
          </Select>
          <Input
            type="date"
            placeholder="Expires on (optional)"
            value={form.expiresAt}
            onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
          />
          <label className="flex items-center gap-1.5 text-sm font-semibold text-text">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              className="h-4 w-4 accent-primary"
            />
            Active immediately
          </label>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Adding…" : "Add Coupon"}
          </Button>
        </form>
        {error && <p className="mt-3 text-sm font-medium text-danger">{error}</p>}
      </Card>

      <Card>
        {isLoading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : coupons.length === 0 ? (
          <EmptyState message="No coupons yet — add the first one above." />
        ) : (
          <Table>
            <Thead>
              <Tr>
                <Th>Code</Th>
                <Th>Discount</Th>
                <Th>Min Order</Th>
                <Th>Brand</Th>
                <Th>Expires</Th>
                <Th>Status</Th>
                <Th></Th>
              </Tr>
            </Thead>
            <tbody>
              {coupons.map((coupon) => {
                const expired = isExpired(coupon);
                return (
                  <Tr key={coupon.id}>
                    <Td className="font-bold">{coupon.code}</Td>
                    <Td>
                      <div className="flex items-center gap-1.5">
                        <Input
                          type="number"
                          defaultValue={coupon.value}
                          className="w-20"
                          onBlur={(e) => {
                            const value = Number(e.target.value);
                            if (!Number.isNaN(value) && value > 0 && value !== coupon.value) handleUpdate(coupon.id, { value });
                          }}
                        />
                        <span className="text-sm text-muted">{coupon.type === "percent" ? "% off" : "₹ off"}</span>
                      </div>
                    </Td>
                    <Td>
                      <Input
                        type="number"
                        defaultValue={coupon.minOrderAmount}
                        className="w-24"
                        onBlur={(e) => {
                          const value = Number(e.target.value);
                          if (!Number.isNaN(value) && value >= 0 && value !== coupon.minOrderAmount) handleUpdate(coupon.id, { minOrderAmount: value });
                        }}
                      />
                    </Td>
                    <Td>{coupon.brandId ? (brands.find((b) => b.id === coupon.brandId)?.name ?? coupon.brandId) : "Every brand"}</Td>
                    <Td>{coupon.expiresAt ? new Date(coupon.expiresAt).toLocaleDateString() : "Never"}</Td>
                    <Td>
                      <button
                        onClick={() => handleUpdate(coupon.id, { isActive: !coupon.isActive })}
                        className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                          !coupon.isActive
                            ? "bg-surface text-muted"
                            : expired
                              ? "bg-danger-soft text-danger"
                              : "bg-success-soft text-success"
                        }`}
                      >
                        {!coupon.isActive ? "Inactive" : expired ? "Expired" : "Active"}
                      </button>
                    </Td>
                    <Td>
                      <Button variant="danger" onClick={() => handleDelete(coupon.id, coupon.code)}>
                        Delete
                      </Button>
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
