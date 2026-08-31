import type { StoreStatus } from "@tbc/shared-types";
import axios from "axios";
import { useEffect, useState } from "react";
import { adminClient } from "../api/adminClient.js";
import { Button } from "../components/ui/Button.js";
import { Card } from "../components/ui/Card.js";
import { Select } from "../components/ui/Input.js";
import { PageHeader } from "../components/ui/PageHeader.js";

const HOURS_12H = Array.from({ length: 24 }, (_, h) => h);
// closeHour also allows 24 (midnight, as the end of the day) — openHour never needs it.
const CLOSE_HOURS_12H = [...HOURS_12H, 24];

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

/**
 * Store-wide ordering availability for catalog brands (TBC, TAT, any future brand) — a manual
 * kill switch for when no staff can manage orders, plus an optional daily service-hours schedule.
 * Does NOT affect GG Tiffin, which has its own separate per-meal cutoff system.
 */
export function StoreSettingsPage() {
  const [status, setStatus] = useState<StoreStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Local draft for the hours form — separate from `status.settings` so editing openHour/closeHour
  // doesn't fight with the periodic reload below before Save is pressed.
  const [openHour, setOpenHour] = useState(12);
  const [closeHour, setCloseHour] = useState(24);

  async function load() {
    setIsLoading(true);
    setLoadError(null);
    try {
      const { data } = await adminClient.get<StoreStatus>("/admin/store-settings");
      setStatus(data);
      setOpenHour(data.settings.openHour);
      setCloseHour(data.settings.closeHour);
    } catch (err) {
      setLoadError(extractErrorMessage(err, "Failed to load store settings"));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function save(update: Partial<{ manuallyOpen: boolean; enforceServiceHours: boolean; openHour: number; closeHour: number }>) {
    setIsSaving(true);
    setSaveError(null);
    try {
      const { data } = await adminClient.put<StoreStatus>("/admin/store-settings", update);
      setStatus(data);
      setOpenHour(data.settings.openHour);
      setCloseHour(data.settings.closeHour);
    } catch (err) {
      setSaveError(extractErrorMessage(err, "Failed to save store settings"));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Store Status"
        description="Controls whether TBC, TAT, and any other catalog brand can be ordered right now. GG Tiffin has its own separate ordering cutoffs and isn't affected by this page."
      />

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
              {status.isOpen ? "Store is OPEN — accepting orders" : "Store is CLOSED"}
            </p>
            {!status.isOpen && (
              <p className="mt-1 text-sm text-text">
                {status.reason === "manually-closed"
                  ? "Closed manually — the switch below is off."
                  : `Outside service hours — open ${formatHour(status.settings.openHour)} to ${formatHour(status.settings.closeHour)} daily.`}
              </p>
            )}
          </div>

          {saveError && <p className="text-sm font-medium text-danger">{saveError}</p>}

          <Card
            title="Accepting Orders"
            description="Turn off if no staff are available to manage orders — closes ordering immediately, overriding the schedule below."
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
        </div>
      )}
    </div>
  );
}
