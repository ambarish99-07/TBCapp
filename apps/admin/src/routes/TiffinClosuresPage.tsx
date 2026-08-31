import type { TiffinClosure, TiffinClosureResult } from "@tbc/shared-types";
import axios from "axios";
import { useEffect, useState } from "react";
import { adminClient } from "../api/adminClient.js";
import { Button } from "../components/ui/Button.js";
import { Card } from "../components/ui/Card.js";
import { EmptyState } from "../components/ui/EmptyState.js";
import { Input } from "../components/ui/Input.js";
import { PageHeader } from "../components/ui/PageHeader.js";
import { Table, Td, Th, Thead, Tr } from "../components/ui/Table.js";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function extractErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const message = (err.response?.data as { error?: string } | undefined)?.error;
    if (message) return message;
  }
  return err instanceof Error ? err.message : fallback;
}

const PRESETS: { label: string; days: number }[] = [
  { label: "1 day", days: 1 },
  { label: "2 days", days: 2 },
  { label: "1 week", days: 7 },
];

/**
 * Declares GG Tiffin closed for a date range — a real emergency (kitchen issue, no staff
 * available, etc.), entirely separate from the TBC/TAT Store Status switch. Every active
 * subscriber's affected meals get skipped and their subscription's end date pushed out by the
 * same number of days; any already-placed single-meal order in range is auto-cancelled with a
 * full refund. There is no undo, so this asks for confirmation before declaring.
 */
export function TiffinClosuresPage() {
  const [closures, setClosures] = useState<TiffinClosure[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [startDate, setStartDate] = useState(addDays(todayIso(), 1));
  const [endDate, setEndDate] = useState(addDays(todayIso(), 1));
  const [reason, setReason] = useState("");
  const [isDeclaring, setIsDeclaring] = useState(false);
  const [declareError, setDeclareError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<TiffinClosureResult | null>(null);

  async function reload() {
    setIsLoading(true);
    setLoadError(null);
    try {
      const { data } = await adminClient.get<{ closures: TiffinClosure[] }>("/admin/tiffin/closures");
      setClosures(data.closures);
    } catch (err) {
      setLoadError(extractErrorMessage(err, "Failed to load closures"));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  function applyPreset(days: number) {
    const from = addDays(todayIso(), 1);
    setStartDate(from);
    setEndDate(addDays(from, days - 1));
  }

  async function handleDeclare() {
    const dayCount = Math.round((new Date(`${endDate}T00:00:00Z`).getTime() - new Date(`${startDate}T00:00:00Z`).getTime()) / 86400000) + 1;
    if (
      !confirm(
        `Close GG Tiffin from ${startDate} to ${endDate} (${dayCount} day${dayCount > 1 ? "s" : ""})?\n\n` +
          "Every affected subscriber will be extended by that many days, and any single-meal orders already placed for those dates will be cancelled and fully refunded. This can't be undone."
      )
    ) {
      return;
    }

    setIsDeclaring(true);
    setDeclareError(null);
    setLastResult(null);
    try {
      const { data } = await adminClient.post<TiffinClosureResult>("/admin/tiffin/closures", {
        startDate,
        endDate,
        reason: reason.trim() || undefined,
      });
      setLastResult(data);
      setReason("");
      await reload();
    } catch (err) {
      setDeclareError(extractErrorMessage(err, "Failed to declare closure"));
    } finally {
      setIsDeclaring(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="GG Tiffin Emergency Closure"
        description="A separate switch from Store Status, for when GG Tiffin itself can't operate — kitchen issue, no staff available, etc. Doesn't affect TBC/TAT/other catalog brands."
      />

      <div className="flex flex-col gap-5">
        <Card title="Declare a Closure" description="Every date in range is blocked from new ordering; affected subscribers are extended automatically.">
          <div className="mb-4 flex flex-wrap gap-2">
            {PRESETS.map((preset) => (
              <Button key={preset.label} variant="secondary" onClick={() => applyPreset(preset.days)} disabled={isDeclaring}>
                {preset.label}
              </Button>
            ))}
          </div>

          <div className="mb-4 flex flex-wrap items-end gap-3">
            <div>
              <p className="mb-1 text-xs font-semibold text-muted">From</p>
              <Input type="date" value={startDate} disabled={isDeclaring} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold text-muted">To</p>
              <Input type="date" value={endDate} disabled={isDeclaring} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>

          <p className="mb-1 text-xs font-semibold text-muted">Reason (optional, shown internally only)</p>
          <textarea
            value={reason}
            disabled={isDeclaring}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Kitchen flooding, no staff available…"
            rows={2}
            className="mb-4 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text placeholder:text-muted focus:border-primary focus:outline-none"
          />

          {declareError && <p className="mb-3 text-sm font-medium text-danger">{declareError}</p>}

          <Button onClick={handleDeclare} disabled={isDeclaring || !startDate || !endDate || endDate < startDate}>
            {isDeclaring ? "Declaring…" : "Declare Closure"}
          </Button>

          {lastResult && (
            <div className="mt-4 rounded-lg bg-success-soft p-3 text-sm text-success">
              Closed {lastResult.closure.startDate} to {lastResult.closure.endDate}. {lastResult.extendedSubscriptionCount} subscription
              {lastResult.extendedSubscriptionCount === 1 ? "" : "s"} extended · {lastResult.cancelledSingleMealOrderCount} single-meal order
              {lastResult.cancelledSingleMealOrderCount === 1 ? "" : "s"} cancelled · ₹{lastResult.refundedAmount} refunded.
            </div>
          )}
        </Card>

        <Card title="Closure History">
          {loadError ? (
            <p className="text-sm font-medium text-danger">{loadError}</p>
          ) : isLoading ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : closures.length === 0 ? (
            <EmptyState message="No closures declared yet." />
          ) : (
            <Table>
              <Thead>
                <Tr>
                  <Th>From</Th>
                  <Th>To</Th>
                  <Th>Reason</Th>
                  <Th>Declared</Th>
                </Tr>
              </Thead>
              <tbody>
                {closures.map((closure) => (
                  <Tr key={closure.id}>
                    <Td>{closure.startDate}</Td>
                    <Td>{closure.endDate}</Td>
                    <Td>{closure.reason ?? "—"}</Td>
                    <Td>{new Date(closure.createdAt).toLocaleString()}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>
    </div>
  );
}
