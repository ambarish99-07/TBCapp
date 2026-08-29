import type { Order } from "@tbc/shared-types";
import { Link } from "react-router-dom";
import { StatusBadge } from "./StatusBadge.js";
import { EmptyState } from "./ui/EmptyState.js";
import { Table, Td, Th, Thead, Tr } from "./ui/Table.js";

export function OrderTable({ orders }: { orders: Order[] }) {
  if (orders.length === 0) {
    return <EmptyState message="No orders match this filter." />;
  }

  return (
    <Table>
      <Thead>
        <Tr>
          <Th>Order #</Th>
          <Th>Customer</Th>
          <Th>Deliver To</Th>
          <Th>Status</Th>
          <Th>Total</Th>
          <Th>Payment</Th>
        </Tr>
      </Thead>
      <tbody>
        {orders.map((order) => {
          const isForRecipient = order.deliveryFor === "recipient";
          return (
            <Tr key={order.id}>
              <Td>
                <Link to={`/orders/${order.id}`} className="font-semibold text-primary-dark hover:underline">
                  {order.orderNumber}
                </Link>
              </Td>
              <Td>{order.customer?.name ?? order.delivery.fullName}</Td>
              <Td>
                {isForRecipient ? (
                  <span className="font-semibold text-danger">👤 {order.delivery.fullName}</span>
                ) : (
                  <span className="text-muted">Self</span>
                )}
              </Td>
              <Td>
                <StatusBadge status={order.status} />
              </Td>
              <Td>₹{order.totals.total}</Td>
              <Td>
                {order.payment.method} · {order.payment.status}
              </Td>
            </Tr>
          );
        })}
      </tbody>
    </Table>
  );
}
