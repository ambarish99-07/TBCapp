import { FEAST_COMBO_BRAND_ID, type Brand, type Order, type OrderStatus } from "@tbc/shared-types";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { adminClient } from "../api/adminClient.js";
import { StatusAdvanceControl } from "../components/StatusAdvanceControl.js";
import { StatusBadge } from "../components/StatusBadge.js";
import { Card } from "../components/ui/Card.js";
import { PageHeader } from "../components/ui/PageHeader.js";

/** Order lines grouped by the kitchen that makes them, in cart order. Orders placed before lines
 * carried their own kitchen fall back to the order's brandId. */
function groupByKitchen(order: Order) {
  const groups: { kitchenId: string; lines: Order["items"] }[] = [];
  for (const line of order.items) {
    const kitchenId = line.brandId ?? order.brandId;
    const group = groups.find((candidate) => candidate.kitchenId === kitchenId);
    if (group) group.lines.push(line);
    else groups.push({ kitchenId, lines: [line] });
  }
  return groups;
}

export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  // Without this, a failed request left the page stuck on "Loading…" forever with no way to
  // tell why — `order` only ever got set on the success path.
  const [loadError, setLoadError] = useState<string | null>(null);

  async function reload() {
    try {
      const { data } = await adminClient.get<{ order: Order }>(`/orders/${id}`);
      setOrder(data.order);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load this order");
    }
  }

  useEffect(() => {
    adminClient
      .get<{ brands: Brand[] }>("/admin/brands")
      .then((res) => setBrands(res.data.brands))
      .catch(() => {});
  }, []);

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleAdvance(next: OrderStatus) {
    await adminClient.patch(`/admin/orders/${id}/status`, { status: next });
    await reload();
  }

  async function handleCancel() {
    await adminClient.patch(`/admin/orders/${id}/status`, { status: "cancelled" });
    await reload();
  }

  if (loadError) {
    return (
      <div>
        <PageHeader title="Couldn't load this order" action={<Link to="/orders" className="text-sm font-semibold text-primary-dark hover:underline">‹ Back to Orders</Link>} />
        <Card>
          <p className="text-sm font-medium text-danger">{loadError}</p>
        </Card>
      </div>
    );
  }

  if (!order) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <div>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            {order.orderNumber} <StatusBadge status={order.status} />
          </span>
        }
      />

      <div className="flex flex-col gap-4">
        <Card title="Customer / Order Owner">
          <p className="text-sm font-medium">{order.customer?.name ?? order.delivery.fullName}</p>
          {order.customer?.phone && <p className="text-sm text-muted">{order.customer.phone}</p>}
          {!order.customer && <p className="text-sm text-muted">Guest checkout — no account</p>}
          {/* Order history, recommendations (manual, purchase-history-suggested, and the persisted
              in-app "Recommended For You" pick), and the WhatsApp tool all live on the Customer
              page now — one place to review and edit, rather than scattered per order. */}
          {order.userId && (
            <Link to={`/customers/${order.userId}`} className="mt-2 inline-block text-sm font-semibold text-primary-dark hover:underline">
              View Customer & Recommendations ›
            </Link>
          )}
        </Card>

        <Card
          className={order.deliveryFor === "recipient" ? "border-danger/40 bg-danger-soft/40" : undefined}
          title={order.deliveryFor === "recipient" ? "🚨 Delivery Recipient (not the customer)" : "Delivery Recipient (self)"}
        >
          <p className="text-sm font-medium">{order.delivery.fullName}</p>
          <p className="text-sm">{order.delivery.phone}</p>
          <p className="text-sm">
            {[order.delivery.houseNumber, order.delivery.area, order.delivery.address].filter(Boolean).join(", ")},{" "}
            {order.delivery.city} {order.delivery.pincode}
          </p>
          {order.delivery.landmark && <p className="text-sm text-muted">Landmark: {order.delivery.landmark}</p>}
          {order.delivery.specialInstructions && (
            <p className="text-sm text-muted">Instructions: {order.delivery.specialInstructions}</p>
          )}
        </Card>

        {/* Grouped by kitchen — one order can mix kitchens (they share one location), so each
            kitchen sees exactly what it has to cook. A Feast combo spanning kitchens gets its own
            group, with its contents listed so every kitchen involved can see its part. */}
        <Card title="Items">
          <div className="flex flex-col gap-3">
            {groupByKitchen(order).map(({ kitchenId, lines }) => (
              <div key={kitchenId}>
                <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted">
                  {kitchenId === FEAST_COMBO_BRAND_ID
                    ? "Feast (several kitchens)"
                    : (brands.find((brand) => brand.id === kitchenId)?.name ?? kitchenId)}
                </p>
                <ul className="flex flex-col gap-1.5">
                  {lines.map((line) => (
                    <li key={line.lineId} className="text-sm">
                      {line.quantity}× {line.signatureName} — ₹{line.unitPrice}
                      {line.menuItemId.startsWith("combo:") && line.commonName !== line.signatureName && (
                        <span className="block text-xs text-muted">{line.commonName}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Totals">
          <p className="text-sm font-semibold">Total: ₹{order.totals.total}</p>
          <p className="text-sm text-muted">
            Payment: {order.payment.method} · {order.payment.status}
          </p>
        </Card>

        <Card title="Update Status">
          <StatusAdvanceControl status={order.status} onAdvance={handleAdvance} onCancel={handleCancel} />
        </Card>
      </div>
    </div>
  );
}
