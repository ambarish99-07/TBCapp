import type { Brand, Feedback, FeedbackStatus, FeedbackType } from "@tbc/shared-types";
import { FEEDBACK_STATUSES } from "@tbc/shared-types";
import { MessageSquareWarning, Star } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { adminClient } from "../api/adminClient.js";
import { Card } from "../components/ui/Card.js";
import { EmptyState } from "../components/ui/EmptyState.js";
import { Select } from "../components/ui/Input.js";
import { PageHeader } from "../components/ui/PageHeader.js";
import { Button } from "../components/ui/Button.js";

const CATEGORY_LABELS: Record<string, string> = {
  "wrong-item": "Wrong item",
  "missing-item": "Missing item",
  "late-delivery": "Late delivery",
  "quality-issue": "Quality issue",
  other: "Other",
};

const STATUS_LABELS: Record<FeedbackStatus, string> = { open: "Open", "in-progress": "In Progress", resolved: "Resolved" };
const STATUS_TONE: Record<FeedbackStatus, string> = {
  open: "bg-danger-soft text-danger",
  "in-progress": "bg-accent/15 text-accent",
  resolved: "bg-success-soft text-success",
};

const TYPE_FILTERS: { key: FeedbackType | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "review", label: "Reviews" },
  { key: "complaint", label: "Complaints" },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={15} className={n <= rating ? "fill-accent text-accent" : "text-border"} />
      ))}
    </div>
  );
}

function FeedbackCard({ item, brandName, onReload }: { item: Feedback; brandName: string; onReload: () => void }) {
  const [responseDraft, setResponseDraft] = useState(item.adminResponse ?? "");
  const [isSaving, setIsSaving] = useState(false);

  async function handleStatusChange(status: string) {
    await adminClient.patch(`/admin/feedback/${item.id}/status`, { status });
    onReload();
  }

  async function handleRespond() {
    if (!responseDraft.trim()) return;
    setIsSaving(true);
    try {
      await adminClient.patch(`/admin/feedback/${item.id}/respond`, { adminResponse: responseDraft.trim() });
      onReload();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            {item.type === "review" ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2.5 py-1 text-xs font-bold text-accent">
                <Star size={13} className="fill-accent text-accent" /> Review
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-danger-soft px-2.5 py-1 text-xs font-bold text-danger">
                <MessageSquareWarning size={13} /> Complaint
              </span>
            )}
            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_TONE[item.status]}`}>{STATUS_LABELS[item.status]}</span>
          </div>
          <p className="mt-1.5 text-sm font-semibold text-text">
            {item.customerName} · {brandName} · {item.orderNumber}
          </p>
          <p className="text-xs text-muted">{formatDate(item.createdAt)}</p>
        </div>
        <div className="flex items-center gap-2">
          {item.rating != null && <Stars rating={item.rating} />}
          {item.category && <span className="text-xs font-semibold text-muted">{CATEGORY_LABELS[item.category] ?? item.category}</span>}
        </div>
      </div>

      {item.message && <p className="mb-3 text-sm text-text">"{item.message}"</p>}

      {item.adminResponse && (
        <div className="mb-3 rounded-lg bg-surface p-3">
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted">Your response</p>
          <p className="text-sm text-text">{item.adminResponse}</p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <Select value={item.status} onChange={(e) => handleStatusChange(e.target.value)} className="text-xs">
          {FEEDBACK_STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </Select>
        <input
          value={responseDraft}
          onChange={(e) => setResponseDraft(e.target.value)}
          placeholder={item.adminResponse ? "Update your response…" : "Write a response…"}
          className="min-w-[220px] flex-1 rounded-lg border border-border bg-white px-3 py-2 text-sm text-text placeholder:text-muted focus:border-primary focus:outline-none"
        />
        <Button variant="secondary" onClick={handleRespond} disabled={isSaving || !responseDraft.trim()}>
          {item.adminResponse ? "Update" : "Reply"}
        </Button>
      </div>
    </Card>
  );
}

export function FeedbackPage() {
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [typeFilter, setTypeFilter] = useState<FeedbackType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | "all">("all");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    adminClient.get<{ brands: Brand[] }>("/admin/brands").then((res) => setBrands(res.data.brands));
  }, []);

  function reload() {
    setIsLoading(true);
    const params: Record<string, string> = {};
    if (typeFilter !== "all") params.type = typeFilter;
    if (statusFilter !== "all") params.status = statusFilter;
    adminClient
      .get<{ feedback: Feedback[] }>("/admin/feedback", { params })
      .then((res) => setFeedback(res.data.feedback))
      .finally(() => setIsLoading(false));
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter, statusFilter]);

  const brandNameById = useMemo(() => new Map(brands.map((b) => [b.id, b.name])), [brands]);

  return (
    <div>
      <PageHeader title="Reviews & Complaints" description="Everything customers have said about a delivered order." />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {TYPE_FILTERS.map((filter) => (
          <button
            key={filter.key}
            onClick={() => setTypeFilter(filter.key)}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
              typeFilter === filter.key ? "bg-primary text-white" : "bg-surface text-muted hover:text-text"
            }`}
          >
            {filter.label}
          </button>
        ))}
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as FeedbackStatus | "all")} className="ml-auto">
          <option value="all">All statuses</option>
          {FEEDBACK_STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </Select>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : feedback.length === 0 ? (
        <Card>
          <EmptyState message="Nothing here yet." />
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {feedback.map((item) => (
            <FeedbackCard key={item.id} item={item} brandName={brandNameById.get(item.brandId) ?? item.brandId} onReload={reload} />
          ))}
        </div>
      )}
    </div>
  );
}

