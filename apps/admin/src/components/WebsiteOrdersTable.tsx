import type { Brand } from "@tbc/shared-types";
import { useState } from "react";
import { adminClient } from "../api/adminClient.js";
import { StatusBadge } from "./StatusBadge.js";
import { EmptyState } from "./ui/EmptyState.js";
import { Table, Td, Th, Thead, Tr } from "./ui/Table.js";

/** A website order as the admin-peer link returns it (brand ids already mapped to the app's). */
export interface WebsiteOrder {
  id: string;
  code: string;
  createdAt: string;
  status:
    "received" | "preparing" | "out-for-delivery" | "delivered" | "cancelled";
  brandId: string;
  brandIds?: string[];
  contactName: string;
  contactPhone: string;
  address?: { line1?: string; line2?: string; pincode?: string };
  lines: {
    quantity: number;
    name: string;
    signatureName?: string;
    commonName?: string;
    isCombo?: boolean;
    brandId?: string | null;
  }[];
  pricing: { total: number };
  payment: { method: string; status: string };
  deliveryPartner?: { name: string; phone: string } | null;
  riderToken?: string | null;
  cancellation?: { refundAmount?: number; refundStatus?: string } | null;
}

const NEXT: Partial<
  Record<WebsiteOrder["status"], "preparing" | "out-for-delivery" | "delivered">
> = {
  received: "preparing",
  preparing: "out-for-delivery",
  "out-for-delivery": "delivered",
};

// The rider page lives on the website itself — same origin as its admin bridge.
const WEBSITE_ORIGIN = new URL(
  import.meta.env.VITE_WEBSITE_ADMIN_URL ??
    "http://localhost:3100/admin-bridge",
).origin;

export function websiteOrderKitchens(o: WebsiteOrder): string[] {
  return o.brandIds?.length ? o.brandIds : [o.brandId];
}

interface Props {
  orders: WebsiteOrder[];
  brands: Brand[];
  /** Called after a status change so the page can reload its lists and counts. */
  onChanged: () => void;
}

/** Website orders inside the Lickyeat Admin — same actions as the website's own admin had:
 * move to the next status (out-for-delivery assigns a rider) and copy the rider's live-location link. */
export function WebsiteOrdersTable({ orders, brands, onChanged }: Props) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const brandName = (id: string) => brands.find((b) => b.id === id)?.name ?? id;

  async function advance(order: WebsiteOrder) {
    const next = NEXT[order.status];
    if (!next) return;
    setBusyId(order.id);
    try {
      await adminClient.post(`/admin/website/orders/${order.id}/status`, {
        status: next,
      });
      onChanged();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Couldn't update the order");
    } finally {
      setBusyId(null);
    }
  }

  async function copyRiderLink(order: WebsiteOrder) {
    const url = `${WEBSITE_ORIGIN}/rider/${order.riderToken}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(order.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      window.prompt("Rider link", url);
    }
  }

  if (orders.length === 0)
    return <EmptyState message="No website orders match this filter." />;

  return (
    <Table>
      <Thead>
        <Tr>
          <Th>Order #</Th>
          <Th>Customer</Th>
          <Th>Items</Th>
          <Th>Status</Th>
          <Th>Total</Th>
          <Th>Payment</Th>
          <Th></Th>
        </Tr>
      </Thead>
      <tbody>
        {orders.map((o) => {
          const next = NEXT[o.status];
          return (
            <Tr key={o.id}>
              <Td>
                <p className="font-semibold text-text">🌐 {o.code}</p>
                <p className="text-xs text-muted">
                  {new Date(o.createdAt).toLocaleString()}
                </p>
              </Td>
              <Td>
                <p className="font-semibold">{o.contactName}</p>
                <p className="text-xs text-muted">{o.contactPhone}</p>
                {o.address && (
                  <p className="text-xs text-muted">
                    {[o.address.line1, o.address.line2, o.address.pincode]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                )}
              </Td>
              <Td className="max-w-xs">
                <p className="text-xs font-semibold text-muted">
                  {websiteOrderKitchens(o).map(brandName).join(" + ")}
                </p>
                <p className="text-xs">
                  {o.lines
                    .map(
                      (l) =>
                        `${l.quantity}× ${l.signatureName || l.name}${l.isCombo && l.commonName ? ` (${l.commonName})` : ""}`,
                    )
                    .join(" · ")}
                </p>
              </Td>
              <Td>
                <StatusBadge status={o.status} />
                {o.deliveryPartner && (
                  <p className="mt-1 text-xs text-muted">
                    🛵 {o.deliveryPartner.name}
                  </p>
                )}
              </Td>
              <Td className="font-semibold">₹{o.pricing.total}</Td>
              <Td className="text-xs">
                {o.payment.method.toUpperCase()} · {o.payment.status}
                {o.cancellation?.refundAmount ? (
                  <p className="text-muted">
                    refund ₹{o.cancellation.refundAmount} ·{" "}
                    {o.cancellation.refundStatus}
                  </p>
                ) : null}
              </Td>
              <Td>
                <div className="flex flex-col items-end gap-1.5">
                  {next && (
                    <button
                      onClick={() => advance(o)}
                      disabled={busyId === o.id}
                      className="whitespace-nowrap rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white hover:bg-primary-dark disabled:opacity-50"
                    >
                      → {next.replace(/-/g, " ")}
                    </button>
                  )}
                  {o.status === "out-for-delivery" && o.riderToken && (
                    <button
                      onClick={() => copyRiderLink(o)}
                      className="whitespace-nowrap text-xs font-semibold text-primary-dark hover:underline"
                    >
                      {copiedId === o.id ? "Link copied" : "Copy rider link"}
                    </button>
                  )}
                </div>
              </Td>
            </Tr>
          );
        })}
      </tbody>
    </Table>
  );
}
