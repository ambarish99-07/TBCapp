import axios from "axios";
import { useEffect, useState } from "react";
import { adminClient } from "../api/adminClient.js";
import { Button } from "./ui/Button.js";
import { Card } from "./ui/Card.js";
import { EmptyState } from "./ui/EmptyState.js";
import { Input, Select } from "./ui/Input.js";
import { PageHeader } from "./ui/PageHeader.js";
import { Table, Td, Th, Thead, Tr } from "./ui/Table.js";

const HOURS_12H = Array.from({ length: 24 }, (_, h) => h);
// closeHour also allows 24 (midnight, as the end of the day) — openHour never needs it.
const CLOSE_HOURS_12H = [...HOURS_12H, 24];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatHour(h: number): string {
  const hourOfDay = h % 24;
  const hour12 = hourOfDay % 12 === 0 ? 12 : hourOfDay % 12;
  const suffix = hourOfDay < 12 ? "AM" : "PM";
  return `${hour12} ${suffix}`;
}

function extractErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const message = (err.response?.data as { error?: string } | undefined)?.error;
    if (message) return message;
  }
  return err instanceof Error ? err.message : fallback;
}

interface PanelClosure {
  id: string;
  startDate: string;
  endDate: string;
  reason?: string;
  createdAt: string;
}

/** Structurally matches both the Lickyeat-wide StoreStatus and a single brand's BrandStoreStatus
 * — this panel doesn't care which one it's rendering, it just needs these fields either way. */
interface PanelStatus {
  isOpen: boolean;
  reason?: "manually-closed" | "outside-hours" | "planned-closure";
  /** Only ever present on a brand-scoped status — true means the Lickyeat-wide switch is what's
   * actually blocking this brand, not its own settings. */
  closedByLickyeat?: boolean;
  settings: { manuallyOpen: boolean; enforceServiceHours: boolean; openHour: number; closeHour: number };
  activeClosure?: { startDate: string; endDate: string; reason?: string };
  upcomingClosures: PanelClosure[];
}

interface Props {
  /** e.g. "/admin/store-settings" (Lickyeat-wide) or "/admin/brands/tbc/store-settings" (one brand). */
  settingsPath: string;
  closuresPath: string;
  title: string;
  description: string;
  /** Shown in the "Planned Closures" card, explaining what this panel's closures do NOT affect —
   * differs between the Lickyeat-wide panel (doesn't touch any one brand's own settings) and a
   * brand-scoped one (doesn't touch other brands, or GG Tiffin). */
  closuresNote: string;
  /** Label used in the "Accepting Orders" card's description — "every catalog brand" for the
   * Lickyeat-wide panel, or this specific brand's name for a brand-scoped one. */
  scopeLabel: string;
}

/**
 * The manual switch + daily service-hours schedule + planned-closures UI — reused as-is for both
 * the Lickyeat-wide Store Status page and every individual brand's own Store Status tab, since
 * the two systems are identical in shape (see storeSettings.service.ts / brandStoreSettings
 * .service.ts), just pointed at different API paths. A future brand's Store Status tab needs zero
 * new code — it's this same component, just given that brand's own settings/closures paths.
 */
export function StoreStatusPanel({ settingsPath, closuresPath, title, description, closuresNote, scopeLabel }: Props) {
  const [status, setStatus] = useState<PanelStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Local draft for the hours form — separate from `status.settings` so editing openHour/closeHour
  // doesn't fight with the periodic reload below before Save is pressed.
  const [openHour, setOpenHour] = useState(12);
  const [closeHour, setCloseHour] = useState(24);

  const [closures, setClosures] = useState<PanelClosure[]>([]);
  const [closureStartDate, setClosureStartDate] = useState(addDays(todayIso(), 1));
  const [closureEndDate, setClosureEndDate] = useState(addDays(todayIso(), 1));
  const [closureReason, setClosureReason] = useState("");
  const [isDeclaringClosure, setIsDeclaringClosure] = useState(false);
  const [declareClosureError, setDeclareClosureError] = useState<string | null>(null);

  async function load() {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [statusRes, closuresRes] = await Promise.all([
        adminClient.get<PanelStatus>(settingsPath),
        adminClient.get<{ closures: PanelClosure[] }>(closuresPath),
      ]);
      setStatus(statusRes.data);
      setOpenHour(statusRes.data.settings.openHour);
      setCloseHour(statusRes.data.settings.closeHour);
      setClosures(closuresRes.data.closures);
    } catch (err) {
      setLoadError(extractErrorMessage(err, "Failed to load store settings"));
    } finally {
      setIsLoading(false);
    }
  }

  // Re-fetches whenever the paths change — lets a per-brand host page swap brands without
  // remounting this whole component.
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsPath, closuresPath]);

  async function save(update: Partial<{ manuallyOpen: boolean; enforceServiceHours: boolean; openHour: number; closeHour: number }>) {
    setIsSaving(true);
    setSaveError(null);
    try {
      const { data } = await adminClient.put<PanelStatus>(settingsPath, update);
      setStatus(data);
      setOpenHour(data.settings.openHour);
      setCloseHour(data.settings.closeHour);
    } catch (err) {
      setSaveError(extractErrorMessage(err, "Failed to save store settings"));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeclareClosure() {
    const dayCount =
      Math.round((new Date(`${closureEndDate}T00:00:00Z`).getTime() - new Date(`${closureStartDate}T00:00:00Z`).getTime()) / 86400000) + 1;
    if (
      !confirm(
        `Announce ${scopeLabel} closed from ${closureStartDate} to ${closureEndDate} (${dayCount} day${dayCount > 1 ? "s" : ""})?\n\n` +
          `Customers will see this ahead of time, and ordering will be blocked once the dates arrive. ${closuresNote}`
      )
    ) {
      return;
    }
    setIsDeclaringClosure(true);
    setDeclareClosureError(null);
    try {
      await adminClient.post(closuresPath, {
        startDate: closureStartDate,
        endDate: closureEndDate,
        reason: closureReason.trim() || undefined,
      });
      setClosureReason("");
      await load();
    } catch (err) {
      setDeclareClosureError(extractErrorMessage(err, "Failed to declare closure"));
    } finally {
      setIsDeclaringClosure(false);
    }
  }

  return (
    <div>
      <PageHeader title={title} description={description} />

      {loadError ? (
        <p className="text-sm font-medium text-danger">{loadError}</p>
      ) : isLoading || !status ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <div className="flex flex-col gap-5">
          <div
            className={`rounded-2xl border p-5 ${
              status.isOpen ? "border-success/30 bg-success-soft" : "border-danger/30 bg-danger-soft"
            }`}
          >
            <p className={`text-lg font-bold ${status.isOpen ? "text-success" : "text-danger"}`}>
              {status.isOpen ? `${scopeLabel} is OPEN — accepting orders` : `${scopeLabel} is CLOSED`}
            </p>
            {!status.isOpen && (
              <p className="mt-1 text-sm text-text">
                {status.closedByLickyeat
                  ? "Closed because the Lickyeat-wide switch is off — this brand's own settings don't matter until that's back on."
                  : status.reason === "manually-closed"
                    ? "Closed manually — the switch below is off."
                    : status.reason === "planned-closure" && status.activeClosure
                      ? `Planned closure: ${status.activeClosure.startDate} to ${status.activeClosure.endDate}${status.activeClosure.reason ? ` — ${status.activeClosure.reason}` : ""}.`
                      : `Outside service hours — open ${formatHour(status.settings.openHour)} to ${formatHour(status.settings.closeHour)} daily.`}
              </p>
            )}
          </div>

          {status.isOpen && status.upcomingClosures.length > 0 && (
            <div className="rounded-2xl border border-accent/30 bg-accent/10 p-4 text-sm text-text">
              📅 Upcoming: closed {status.upcomingClosures[0].startDate} to {status.upcomingClosures[0].endDate}
              {status.upcomingClosures[0].reason ? ` — ${status.upcomingClosures[0].reason}` : ""}
              {status.upcomingClosures.length > 1 ? ` (+${status.upcomingClosures.length - 1} more below)` : ""}
            </div>
          )}

          {saveError && <p className="text-sm font-medium text-danger">{saveError}</p>}

          <Card
            title="Accepting Orders"
            description={`Turn off if no staff are available to manage ${scopeLabel}'s orders — closes ordering immediately, overriding the schedule below.`}
          >
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={status.settings.manuallyOpen}
                disabled={isSaving}
                onChange={(e) => save({ manuallyOpen: e.target.checked })}
                className="h-5 w-5 accent-primary"
              />
              <span className="text-sm font-semibold text-text">
                {status.settings.manuallyOpen ? "On — orders allowed (subject to hours below)" : "Off — no orders can be placed"}
              </span>
            </label>
          </Card>

          <Card title="Service Hours" description="A daily schedule (India time) applied on top of the switch above.">
            <label className="mb-4 flex items-center gap-3">
              <input
                type="checkbox"
                checked={status.settings.enforceServiceHours}
                disabled={isSaving}
                onChange={(e) => save({ enforceServiceHours: e.target.checked })}
                className="h-5 w-5 accent-primary"
              />
              <span className="text-sm font-semibold text-text">
                {status.settings.enforceServiceHours ? "On — only orderable during the hours below" : "Off — orderable any time (switch above still applies)"}
              </span>
            </label>

            <div className="flex flex-wrap items-end gap-3">
              <div>
                <p className="mb-1 text-xs font-semibold text-muted">Opens at</p>
                <Select value={openHour} disabled={isSaving} onChange={(e) => setOpenHour(Number(e.target.value))}>
                  {HOURS_12H.map((h) => (
                    <option key={h} value={h}>
                      {formatHour(h)}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold text-muted">Closes at</p>
                <Select value={closeHour} disabled={isSaving} onChange={(e) => setCloseHour(Number(e.target.value))}>
                  {CLOSE_HOURS_12H.map((h) => (
                    <option key={h} value={h}>
                      {formatHour(h)}
                    </option>
                  ))}
                </Select>
              </div>
              <Button
                onClick={() => save({ openHour, closeHour })}
                disabled={isSaving || (openHour === status.settings.openHour && closeHour === status.settings.closeHour)}
              >
                {isSaving ? "Saving…" : "Save Hours"}
              </Button>
              <p className="w-full text-xs text-muted">
                A close hour at or before the open hour (e.g. open 6 PM, close 2 AM) is treated as crossing midnight.
              </p>
            </div>
          </Card>

          <Card
            title="Planned Closures"
            description={`Announce known dates ahead of time — a holiday, planned maintenance — so customers see it before ordering is actually blocked. ${closuresNote}`}
          >
            <div className="mb-4 flex flex-wrap items-end gap-3">
              <div>
                <p className="mb-1 text-xs font-semibold text-muted">From</p>
                <Input
                  type="date"
                  value={closureStartDate}
                  disabled={isDeclaringClosure}
                  onChange={(e) => setClosureStartDate(e.target.value)}
                />
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold text-muted">To</p>
                <Input
                  type="date"
                  value={closureEndDate}
                  disabled={isDeclaringClosure}
                  onChange={(e) => setClosureEndDate(e.target.value)}
                />
              </div>
            </div>
            <textarea
              value={closureReason}
              disabled={isDeclaringClosure}
              onChange={(e) => setClosureReason(e.target.value)}
              placeholder="Reason (optional, shown to customers) — e.g. Diwali holiday"
              rows={2}
              className="mb-4 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text placeholder:text-muted focus:border-primary focus:outline-none"
            />
            {declareClosureError && <p className="mb-3 text-sm font-medium text-danger">{declareClosureError}</p>}
            <Button onClick={handleDeclareClosure} disabled={isDeclaringClosure || !closureStartDate || !closureEndDate || closureEndDate < closureStartDate}>
              {isDeclaringClosure ? "Announcing…" : "Announce Closure"}
            </Button>

            {closures.length > 0 && (
              <Table className="mt-5">
                <Thead>
                  <Tr>
                    <Th>From</Th>
                    <Th>To</Th>
                    <Th>Reason</Th>
                    <Th>Announced</Th>
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
            {closures.length === 0 && <EmptyState message="No closures announced yet." />}
          </Card>
        </div>
      )}
    </div>
  );
}
