import { useEffect, useState } from "react";
import { adminClient } from "../api/adminClient.js";
import { Badge } from "../components/ui/Badge.js";
import { Button } from "../components/ui/Button.js";
import { Card } from "../components/ui/Card.js";
import { EmptyState } from "../components/ui/EmptyState.js";
import { Input, Select } from "../components/ui/Input.js";
import { PageHeader } from "../components/ui/PageHeader.js";

const LEAD_STATUSES = [
  "new",
  "contacted",
  "in-discussion",
  "won",
  "lost",
] as const;
type LeadStatus = (typeof LEAD_STATUSES)[number];

/** A franchise / catering / call-back enquiry from the website's forms. */
interface Lead {
  id: string;
  kind: "franchise" | "catering" | "callback";
  name: string;
  whatsapp: string;
  email?: string | null;
  city: string;
  message?: string | null;
  callbackRequested: boolean;
  callbackRequestedAt?: string | null;
  status: LeadStatus;
  details: Record<string, unknown>;
  notes: { body: string; at: string; by?: string }[];
  createdAt: string;
}

const KIND_FILTERS = [
  { key: "", label: "All" },
  { key: "franchise", label: "Franchise" },
  { key: "catering", label: "Catering" },
  { key: "callback", label: "Call back" },
] as const;
const KIND_LABEL: Record<Lead["kind"], string> = {
  franchise: "Franchise",
  catering: "Catering",
  callback: "Call back",
};
const STATUS_TONE: Record<
  LeadStatus,
  "neutral" | "primary" | "success" | "danger" | "accent"
> = {
  new: "accent",
  contacted: "primary",
  "in-discussion": "primary",
  won: "success",
  lost: "neutral",
};

/** A call back is promised within 24 hours of the request — how much of that is left. */
function sla(lead: Lead): { label: string; className: string } | null {
  if (!lead.callbackRequested || lead.status !== "new") return null;
  const hrs =
    (Date.now() -
      new Date(lead.callbackRequestedAt ?? lead.createdAt).getTime()) /
    3_600_000;
  if (hrs >= 24)
    return { label: "overdue", className: "bg-danger-soft text-danger" };
  if (hrs >= 12)
    return {
      label: `${Math.round(24 - hrs)}h left`,
      className: "bg-accent/15 text-accent",
    };
  return {
    label: `${Math.round(24 - hrs)}h left`,
    className: "bg-success-soft text-success",
  };
}

/** Franchise, catering and call-back enquiries left on the website. */
export function WebsiteLeadsPage() {
  const [kind, setKind] = useState("");
  const [callbackOnly, setCallbackOnly] = useState(false);
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  async function reload() {
    setLoadError(null);
    try {
      const params: Record<string, string> = {};
      if (kind) params.kind = kind;
      if (callbackOnly) params.callback = "1";
      const res = await adminClient.get<{ leads: Lead[] }>(
        "/admin/website/leads",
        { params },
      );
      setLeads(res.data.leads);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Couldn't load leads");
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, callbackOnly]);

  async function patch(
    id: string,
    body: { status?: LeadStatus; note?: string },
  ) {
    try {
      await adminClient.patch(`/admin/website/leads/${id}`, body);
      await reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Couldn't update the lead");
    }
  }

  return (
    <div>
      <PageHeader
        title="Leads"
        description="Franchise, catering and call-back requests from the website's forms."
      />
      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {KIND_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setKind(f.key)}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${kind === f.key ? "bg-primary text-white" : "bg-surface text-muted hover:text-text"}`}
            >
              {f.label}
            </button>
          ))}
          <label className="ml-2 flex items-center gap-2 text-sm font-semibold text-text">
            <input
              type="checkbox"
              checked={callbackOnly}
              onChange={(e) => setCallbackOnly(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            Call backs only
          </label>
        </div>

        {loadError ? (
          <p className="text-sm font-medium text-danger">{loadError}</p>
        ) : leads === null ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : leads.length === 0 ? (
          <EmptyState message="No leads yet." />
        ) : (
          <div className="divide-y divide-border">
            {leads.map((lead) => {
              const badge = sla(lead);
              const open = openId === lead.id;
              const details = Object.entries(lead.details ?? {}).filter(
                ([, v]) =>
                  v !== "" &&
                  v != null &&
                  !(Array.isArray(v) && v.length === 0),
              );
              return (
                <div key={lead.id} className="py-3">
                  <button
                    className="flex w-full flex-wrap items-center gap-3 text-left"
                    onClick={() => setOpenId(open ? null : lead.id)}
                  >
                    <Badge>{KIND_LABEL[lead.kind]}</Badge>
                    <span className="font-semibold text-text">{lead.name}</span>
                    <span className="text-sm text-muted">{lead.city}</span>
                    <Badge tone={STATUS_TONE[lead.status]}>{lead.status}</Badge>
                    {lead.callbackRequested && (
                      <Badge tone="primary">call back</Badge>
                    )}
                    {badge && (
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                    )}
                    <span className="ml-auto text-xs text-muted">
                      {new Date(lead.createdAt).toLocaleString()}
                    </span>
                  </button>

                  {open && (
                    <div className="mt-3 space-y-3 rounded-lg bg-surface p-3 text-sm">
                      <div className="flex flex-wrap gap-x-6 gap-y-1">
                        <a
                          href={`tel:${lead.whatsapp}`}
                          className="font-semibold text-primary-dark hover:underline"
                        >
                          📞 {lead.whatsapp}
                        </a>
                        <a
                          href={`https://wa.me/${lead.whatsapp.replace(/\D/g, "").replace(/^(?!91)/, "91")}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold text-primary-dark hover:underline"
                        >
                          WhatsApp chat
                        </a>
                        {lead.email && (
                          <a
                            href={`mailto:${lead.email}`}
                            className="font-semibold text-primary-dark hover:underline"
                          >
                            {lead.email}
                          </a>
                        )}
                      </div>

                      {details.length > 0 && (
                        <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
                          {details.map(([k, v]) => (
                            <div key={k}>
                              <dt className="inline text-muted">{k}: </dt>
                              <dd className="inline font-medium text-text">
                                {Array.isArray(v) ? v.join(", ") : String(v)}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      )}

                      {lead.message && (
                        <p className="rounded-lg bg-white p-3 text-text">
                          {lead.message}
                        </p>
                      )}

                      {lead.notes.length > 0 && (
                        <ul className="space-y-1">
                          {lead.notes.map((n, i) => (
                            <li key={i} className="text-xs text-muted">
                              {new Date(n.at).toLocaleString()}{" "}
                              {n.by ? `· ${n.by}` : ""} — {n.body}
                            </li>
                          ))}
                        </ul>
                      )}

                      <div className="flex flex-wrap items-center gap-2">
                        <Select
                          value={lead.status}
                          onChange={(e) =>
                            patch(lead.id, {
                              status: e.target.value as LeadStatus,
                            })
                          }
                        >
                          {LEAD_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </Select>
                        <NoteInput onAdd={(note) => patch(lead.id, { note })} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

function NoteInput({ onAdd }: { onAdd: (note: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <form
      className="flex flex-1 gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) {
          onAdd(value.trim());
          setValue("");
        }
      }}
    >
      <Input
        className="flex-1"
        placeholder="Add a note…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <Button variant="secondary" type="submit">
        Add
      </Button>
    </form>
  );
}
