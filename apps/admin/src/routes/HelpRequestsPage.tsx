import { SUPPORT_TOPIC_LABELS, type SupportTicket, type SupportTicketStatus } from "@tbc/shared-types";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { adminClient } from "../api/adminClient.js";
import { Button } from "../components/ui/Button.js";
import { Card } from "../components/ui/Card.js";
import { EmptyState } from "../components/ui/EmptyState.js";
import { Select } from "../components/ui/Input.js";
import { PageHeader } from "../components/ui/PageHeader.js";

const STATUS_LABELS: Record<SupportTicketStatus, string> = { open: "Open", "in-progress": "In progress", resolved: "Resolved" };
const STATUS_TONE: Record<SupportTicketStatus, string> = {
  open: "bg-danger-soft text-danger",
  "in-progress": "bg-accent/15 text-accent",
  resolved: "bg-success-soft text-success",
};
const FILTERS: { key: SupportTicketStatus | "all"; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "in-progress", label: "In progress" },
  { key: "resolved", label: "Resolved" },
  { key: "all", label: "All" },
];

function TicketCard({ ticket, onSaved }: { ticket: SupportTicket; onSaved: (t: SupportTicket) => void }) {
  const [reply, setReply] = useState(ticket.adminReply ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const digits = (ticket.customerPhone ?? "").replace(/\D/g, "");
  const whatsapp = digits ? `https://wa.me/${digits.length === 10 ? `91${digits}` : digits}` : null;

  async function save(patch: { status?: SupportTicketStatus; adminReply?: string }) {
    setSaving(true);
    setError(null);
    try {
      const { data } = await adminClient.patch<{ ticket: SupportTicket }>(`/admin/support-tickets/${ticket.id}`, patch);
      onSaved(data.ticket);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-bold">{ticket.ticketNumber}</span>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_TONE[ticket.status]}`}>{STATUS_LABELS[ticket.status]}</span>
        <span className="rounded-full bg-surface px-2.5 py-0.5 text-xs font-bold text-muted">{SUPPORT_TOPIC_LABELS[ticket.topic]}</span>
        <span className="ml-auto text-xs text-muted">{new Date(ticket.createdAt).toLocaleString()}</span>
      </div>

      <div className="text-sm">
        <span className="font-semibold">{ticket.customerName}</span>
        {ticket.customerPhone && (
          <>
            {" · "}
            <a className="text-primary-dark hover:underline" href={`tel:${ticket.customerPhone}`}>
              {ticket.customerPhone}
            </a>
            {whatsapp && (
              <>
                {" · "}
                <a className="text-primary-dark hover:underline" href={whatsapp} target="_blank" rel="noreferrer">
                  WhatsApp
                </a>
              </>
            )}
          </>
        )}
        {ticket.orderId && (
          <>
            {" · "}
            <Link className="text-primary-dark hover:underline" to={`/orders/${ticket.orderId}`}>
              Order {ticket.orderNumber}
            </Link>
          </>
        )}
      </div>

      <p className="whitespace-pre-wrap text-sm">{ticket.message}</p>
      {ticket.photoUrl && (
        <a href={ticket.photoUrl} target="_blank" rel="noreferrer">
          <img src={ticket.photoUrl} alt="Customer's photo" className="h-40 w-40 rounded-lg object-cover" />
        </a>
      )}

      <div>
        <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted">Reply (the customer sees this in the app&rsquo;s chat)</p>
        <textarea
          className="w-full rounded-lg border border-border px-3 py-2 text-sm"
          rows={2}
          maxLength={1000}
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder="e.g. Sorry about that — we've refunded ₹120 for the missing fries."
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button disabled={saving || !reply.trim() || reply === (ticket.adminReply ?? "")} onClick={() => save({ adminReply: reply.trim() })}>
          {saving ? "Saving…" : "Send reply"}
        </Button>
        <Select value={ticket.status} onChange={(e) => save({ status: e.target.value as SupportTicketStatus })} className="w-40">
          {(Object.keys(STATUS_LABELS) as SupportTicketStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
        {ticket.repliedAt && <span className="text-xs text-muted">Last reply {new Date(ticket.repliedAt).toLocaleString()}</span>}
      </div>
      {error && <p className="text-sm font-medium text-danger">{error}</p>}
    </Card>
  );
}

/** Help requests raised from the app's support assistant (payment not confirmed, missing/wrong/
 * spilled items, ...). Replies show up in the customer's chat under "My help requests". */
export function HelpRequestsPage() {
  const [filter, setFilter] = useState<SupportTicketStatus | "all">("open");
  const [tickets, setTickets] = useState<SupportTicket[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTickets(null);
    setError(null);
    adminClient
      .get<{ tickets: SupportTicket[] }>("/admin/support-tickets", { params: filter === "all" ? {} : { status: filter } })
      .then((res) => setTickets(res.data.tickets))
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load help requests"));
  }, [filter]);

  return (
    <div>
      <PageHeader
        title="Help Requests"
        description="Raised by customers from the app's support assistant. Payment issues first — call or WhatsApp the customer, then reply here so they see it in the app."
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${filter === f.key ? "bg-primary text-white" : "bg-surface text-text hover:bg-border"}`}
          >
            {f.label}
          </button>
        ))}
      </div>
      {error && <p className="text-sm font-medium text-danger">{error}</p>}
      {!tickets && !error && <p className="text-sm text-muted">Loading…</p>}
      {tickets && tickets.length === 0 && (
        <Card>
          <EmptyState message="Nothing here — no help requests in this list." />
        </Card>
      )}
      <div className="flex flex-col gap-4">
        {[...(tickets ?? [])]
          // Payment problems are the most urgent (money taken, no order) — always on top.
          .sort((a, b) => Number(b.topic === "payment-not-confirmed") - Number(a.topic === "payment-not-confirmed"))
          .map((t) => (
            <TicketCard key={t.id} ticket={t} onSaved={(updated) => setTickets((prev) => prev?.map((x) => (x.id === updated.id ? updated : x)) ?? null)} />
          ))}
      </div>
    </div>
  );
}
