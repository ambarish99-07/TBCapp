import type { Order } from "@tbc/shared-types";
import { Link } from "react-router-dom";
import { StatusBadge } from "./StatusBadge.js";

export function OrderTable({ orders }: { orders: Order[] }) {
  if (orders.length === 0) {
    return <p>No orders match this filter.</p>;
  }

  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr>
          <th align="left">Order #</th>
          <th align="left">Customer</th>
          <th align="left">Deliver To</th>
          <th align="left">Status</th>
          <th align="left">Total</th>
          <th align="left">Payment</th>
        </tr>
      </thead>
      <tbody>
        {orders.map((order) => {
          const isForRecipient = order.deliveryFor === "recipient";
          return (
            <tr key={order.id} style={{ borderTop: "1px solid #E4DCD3" }}>
              <td>
                <Link to={`/orders/${order.id}`}>{order.orderNumber}</Link>
              </td>
              <td>{order.customer?.name ?? order.delivery.fullName}</td>
              <td>
                {isForRecipient ? (
                  <span style={{ color: "#B3261E", fontWeight: 600 }}>👤 {order.delivery.fullName}</span>
                ) : (
                  <span style={{ color: "#8A7B6C" }}>Self</span>
                )}
              </td>
              <td>
                <StatusBadge status={order.status} />
              </td>
              <td>₹{order.totals.total}</td>
              <td>
                {order.payment.method} · {order.payment.status}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
