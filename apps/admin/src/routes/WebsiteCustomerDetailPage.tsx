import { SUPPORT_TOPIC_LABELS, type SupportTopic } from "@tbc/shared-types";
import axios from "axios";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { adminClient } from "../api/adminClient.js";
import { Card } from "../components/ui/Card.js";
import { EmptyState } from "../components/ui/EmptyState.js";
import { PageHeader } from "../components/ui/PageHeader.js";
import { Table, Td, Th, Thead, Tr } from "../components/ui/Table.js";

interface WebsiteCustomerDetail {
  customer: { id: string; name: string; email: string | null; phone: string | null; createdAt: string; addresses?: { label: string; line1: string; line2: string; city: string; pincode: string }[] };
  orders: {
    id: string;
    code: string;
    status: string;
    brandId: string;
    pricing?: { total: number };
    createdAt: string;
    lines: { signatureName?: string; name?: string; quantity: number }[];
    payment?: { method: string };
  }[];
  feedback: { id: string; orderCode: string; type: string; rating: number | null; category: string | null; message: string; status: string; adminResponse: string | null; createdAt: string }[];
  tickets: { id: string; ticketNumber: string; topic: SupportTopic; message: string; status: string; adminReply: string | null; createdAt: string }[];
}

/** A website customer's profile, orders, reviews & complaints and help requests — read from the
 * website over the signed admin-peer link. Website accounts are separate from app accounts. */
export function WebsiteCustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<WebsiteCustomerDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminClient
      .get<WebsiteCustomerDetail>(`/admin/website/customers/${id}`)
      .then((res) => setData(res.data))
      .catch((err) =>
        setError(axios.isAxiosError(err) ? ((err.response?.data as { error?: string })?.error ?? err.message) : "Couldn't load this customer")
      );
  }, [id]);

  const back = (
    <Link to="/customers" className="text-sm font-semibold text-primary-dark hover:underline">
      ‹ Back to Customers
    </Link>
  );

  if (error) {
    return (
      <div>
        <PageHeader title="Website customer" action={back} />
        <Card>
          <p className="text-sm font-medium text-danger">{error}</p>
        </Card>
      </div>
    );
  }
  if (!data) return <p className="text-sm text-muted">Loading…</p>;

  const { customer, orders, feedback, tickets } = data;
  const spent = orders.filter((o) => o.status !== "cancelled").reduce((sum, o) => sum + (o.pricing?.total ?? 0), 0);
  const digits = (customer.phone ?? "").replace(/\D/g, "");

  return (
    <div>
      <PageHeader title={customer.name} description="🌐 Website customer" action={back} />
      <div className="flex flex-col gap-4">
        <Card title="Contact">
          <p className="text-sm">
            {customer.phone ? (
              <>
                <a className="text-primary-dark hover:underline" href={`tel:${customer.phone}`}>
                  {customer.phone}
                </a>
                {digits && (
                  <>
                    {" · "}
                    <a className="text-primary-dark hover:underline" href={`https://wa.me/${digits.length === 10 ? `91${digits}` : digits}`} target="_blank" rel="noreferrer">
                      WhatsApp
                    </a>
                  </>
                )}
              </>
            ) : (
              "No phone"
            )}
            {customer.email && <> · {customer.email}</>}
          </p>
          <p className="mt-1 text-sm text-muted">
            Joined {new Date(customer.createdAt).toLocaleDateString()} · {orders.length} order{orders.length === 1 ? "" : "s"} · ₹{spent} spent
          </p>
          {customer.addresses?.[0] && (
            <p className="mt-1 text-sm text-muted">
              {customer.addresses[0].line1}
              {customer.addresses[0].line2 ? `, ${customer.addresses[0].line2}` : ""}, {customer.addresses[0].city} {customer.addresses[0].pincode}
            </p>
          )}
        </Card>

        <Card title="Website orders">
          {orders.length === 0 ? (
            <EmptyState message="No website orders yet." />
          ) : (
            <Table>
              <Thead>
                <Tr>
                  <Th>Order</Th>
                  <Th>Date</Th>
                  <Th>Items</Th>
                  <Th>Total</Th>
                  <Th>Status</Th>
                </Tr>
              </Thead>
              <tbody>
                {orders.map((o) => (
                  <Tr key={o.id}>
                    <Td className="font-semibold">{o.code}</Td>
                    <Td>{new Date(o.createdAt).toLocaleString()}</Td>
                    <Td className="text-sm">{o.lines.map((l) => `${l.quantity}× ${l.signatureName || l.name}`).join(", ")}</Td>
                    <Td>₹{o.pricing?.total ?? 0}</Td>
                    <Td>{o.status.replace(/-/g, " ")}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card title="Reviews & complaints">
          {feedback.length === 0 ? (
            <EmptyState message="None yet." />
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {feedback.map((f) => (
                <li key={f.id}>
                  <span className="font-semibold">{f.type === "review" ? `★ ${f.rating}` : `Complaint (${f.category ?? "other"})`}</span> · order {f.orderCode} · {f.status}
                  {f.message && <span className="block text-muted">"{f.message}"</span>}
                  {f.adminResponse && <span className="block text-muted">Your reply: {f.adminResponse}</span>}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Help requests">
          {tickets.length === 0 ? (
            <EmptyState message="None yet." />
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {tickets.map((t) => (
                <li key={t.id}>
                  <span className="font-semibold">{t.ticketNumber}</span> · {SUPPORT_TOPIC_LABELS[t.topic]} · {t.status}
                  <span className="block text-muted">{t.message}</span>
                  {t.adminReply && <span className="block text-muted">Your reply: {t.adminReply}</span>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
