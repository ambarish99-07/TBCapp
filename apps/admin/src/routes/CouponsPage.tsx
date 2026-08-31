import type { Brand, Coupon, CouponType } from "@tbc/shared-types";
import { useEffect, useState } from "react";
import { adminClient } from "../api/adminClient.js";
import { Button } from "../components/ui/Button.js";
import { Card } from "../components/ui/Card.js";
import { EmptyState } from "../components/ui/EmptyState.js";
import { Input, Select } from "../components/ui/Input.js";
import { PageHeader } from "../components/ui/PageHeader.js";
import { Table, Td, Th, Thead, Tr } from "../components/ui/Table.js";

const TYPE_OPTIONS: CouponType[] = ["flat", "percent", "bogo"];
const TYPE_LABELS: Record<CouponType, string> = { flat: "Flat ₹ off", percent: "% off", bogo: "Buy 1 Get 1 Free" };

const emptyForm = {
  code: "",
  type: "flat" as CouponType,
  value: "",
  minOrderAmount: "",
  maxDiscountAmount: "",
  brandId: "all",
  expiresAt: "",
  isActive: true,
  oncePerCustomer: false,
};

/** One line of copy per mechanic — shown under the discount column instead of an editable value
 * for coupon types that have no admin-set number of their own. Add a case here (and a branch to
 * @tbc/pricing's computeCouponDiscount) any time a genuinely new discount mechanic is needed;
 * every plain "N% off" / "₹N off" offer needs no code change at all — just fill in the form. */
function discountSummary(coupon: Coupon): string {
  if (coupon.type === "bogo") return "Cheapest eligible item free";
  if (coupon.type === "percent") return `${coupon.value}% off${coupon.maxDiscountAmount ? ` (up to ₹${coupon.maxDiscountAmount})` : ""}`;
  return `₹${coupon.value} off`;
}

function isExpired(coupon: Coupon): boolean {
  return !!coupon.expiresAt && new Date(coupon.expiresAt) < new Date();
}

export function CouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
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
      const { data } = await adminClient.get<{ coupons: Coupon[] }>("/admin/coupons");
      setCoupons(data.coupons);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load coupons");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    reload();
    // GG Tiffin never appears here — coupons are a TBC/Alchemy Tails mechanic only; GG Tiffin gets
    // its own Festival Specials instead (see the GG Tiffin nav group).
    adminClient
      .get<{ brands: Brand[] }>("/admin/brands")
      .then((res) => setBrands(res.data.brands.filter((b) => b.id !== "gg-tiffin")));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await adminClient.post("/admin/coupons", {
        code: form.code,
        type: form.type,
        // Ignored server-side for "bogo" — there's no admin-set number for that mechanic.
        value: form.type === "bogo" ? 0 : Number(form.value),
        minOrderAmount: form.minOrderAmount ? Number(form.minOrderAmount) : 0,
        maxDiscountAmount: form.maxDiscountAmount ? Number(form.maxDiscountAmount) : undefined,
        brandId: form.brandId === "all" ? undefined : form.brandId,
        expiresAt: form.expiresAt || undefined,
        isActive: form.isActive,
        oncePerCustomer: form.oncePerCustomer,
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
      <PageHeader title="Coupons" description="Create and manage discount codes for TBC and Alchemy Tails — GG Tiffin has its own Festival Specials instead." />

      <Card title="Add a Coupon" className="mb-6">
        <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input placeholder="Code (e.g. FESTIVAL25)" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
          <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as CouponType })}>
            {TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
          {form.type === "bogo" ? (
            // No admin-set number for this mechanic — the discount is always "the cheapest
            // eligible item in the cart", worked out from the cart's own prices at checkout.
            <div className="flex items-center rounded-lg border border-border bg-surface px-3 text-sm text-muted">
              Cheapest eligible item is free
            </div>
          ) : (
            <Input
              type="number"
              min={1}
              placeholder={form.type === "percent" ? "Percent (e.g. 20)" : "Amount off (₹)"}
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
              required
            />
          )}
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
          <label className="flex items-center gap-1.5 text-sm font-semibold text-text" title="Each customer account can redeem it once, ever — for welcome-style offers.">
            <input
              type="checkbox"
              checked={form.oncePerCustomer}
              onChange={(e) => setForm({ ...form, oncePerCustomer: e.target.checked })}
              className="h-4 w-4 accent-primary"
            />
            One-time per customer (welcome offer)
          </label>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Adding…" : "Add Coupon"}
          </Button>
        </form>
        {error && <p className="mt-3 text-sm font-medium text-danger">{error}</p>}
      </Card>

      <Card>
        {loadError ? (
          <p className="text-sm font-medium text-danger">{loadError}</p>
        ) : isLoading ? (
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
                <Th>Welcome Offer</Th>
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
                      {coupon.type === "bogo" ? (
                        <span className="text-sm text-muted">{discountSummary(coupon)}</span>
                      ) : (
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
                      )}
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
                      <button
                        onClick={() => handleUpdate(coupon.id, { oncePerCustomer: !coupon.oncePerCustomer })}
                        title="Toggle whether each customer account can only redeem this coupon once, ever"
                        className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                          coupon.oncePerCustomer ? "bg-primary/10 text-primary-dark" : "bg-surface text-muted"
                        }`}
                      >
                        {coupon.oncePerCustomer ? `Once per customer · used ${coupon.usedCount ?? 0}×` : "Reusable"}
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
