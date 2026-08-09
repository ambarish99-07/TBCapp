import type { Order, OrderStatus } from "@tbc/shared-types";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { adminClient } from "../api/adminClient.js";
import { StatusAdvanceControl } from "../components/StatusAdvanceControl.js";
import { StatusBadge } from "../components/StatusBadge.js";

export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [recommendMessage, setRecommendMessage] = useState<string | null>(null);

  async function reload() {
    const { data } = await adminClient.get<{ order: Order }>(`/orders/${id}`);
    setOrder(data.order);
  }

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

  async function handleRecommend() {
    setRecommendMessage(null);
    const { data } = await adminClient.post<{ recommendedItemNames: string[] }>(`/admin/orders/${id}/recommend`);
    setRecommendMessage(
      data.recommendedItemNames.length > 0
        ? `Sent recommendation: ${data.recommendedItemNames.join(", ")}`
        : "No recommendations could be generated for this customer yet."
    );
  }

  if (!order) return <p>Loading…</p>;

  return (
    <div>
      <h1>
        {order.orderNumber} <StatusBadge status={order.status} />
      </h1>

      <section>
        <h3>Customer / Order Owner</h3>
        <p>{order.customer?.name ?? order.delivery.fullName}</p>
        {order.customer?.phone && <p>{order.customer.phone}</p>}
        {!order.customer && <p style={{ color: "#8A7B6C" }}>Guest checkout — no account</p>}
      </section>

      <section style={order.deliveryFor === "recipient" ? { border: "1px solid #B3261E", borderRadius: 8, padding: 12 } : undefined}>
        <h3>{order.deliveryFor === "recipient" ? "🚨 Delivery Recipient (not the customer)" : "Delivery Recipient (self)"}</h3>
        <p>{order.delivery.fullName}</p>
        <p>{order.delivery.phone}</p>
        <p>
          {[order.delivery.houseNumber, order.delivery.area, order.delivery.address].filter(Boolean).join(", ")}, {order.delivery.city}{" "}
          {order.delivery.pincode}
        </p>
        {order.delivery.landmark && <p>Landmark: {order.delivery.landmark}</p>}
        {order.delivery.specialInstructions && <p>Instructions: {order.delivery.specialInstructions}</p>}
      </section>

      <section>
        <h3>Items</h3>
        <ul>
          {order.items.map((line) => (
            <li key={line.lineId}>
              {line.quantity}× {line.signatureName} — ₹{line.unitPrice}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3>Totals</h3>
        <p>Total: ₹{order.totals.total}</p>
        <p>
          Payment: {order.payment.method} · {order.payment.status}
        </p>
      </section>

      <section>
        <h3>Update Status</h3>
        <StatusAdvanceControl status={order.status} onAdvance={handleAdvance} onCancel={handleCancel} />
      </section>

      {order.userId && (
        <section>
          <h3>WhatsApp Recommendation</h3>
          <button onClick={handleRecommend}>Send product recommendation</button>
          {recommendMessage && <p>{recommendMessage}</p>}
        </section>
      )}
    </div>
  );
}
