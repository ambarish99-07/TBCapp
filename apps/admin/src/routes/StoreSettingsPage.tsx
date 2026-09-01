import { StoreStatusPanel } from "../components/StoreStatusPanel.js";

/**
 * Store-wide ordering availability for catalog brands (TBC, TAT, any future brand) — a manual
 * kill switch for when no staff can manage orders, plus an optional daily service-hours schedule
 * and planned closures. This is the Lickyeat-wide, parent-level version: an absolute override
 * that closes every catalog brand at once, regardless of any one brand's own settings (see each
 * brand's own Store Status tab for that). Does NOT affect GG Tiffin, which has its own separate
 * per-meal cutoff/closure system.
 */
export function StoreSettingsPage() {
  return (
    <StoreStatusPanel
      settingsPath="/admin/store-settings"
      closuresPath="/admin/store-closures"
      title="Store Status"
      description="The Lickyeat-wide switch — controls whether TBC, TAT, and every other catalog brand can be ordered right now, all at once. Each brand also has its own Store Status tab for finer control; this one overrides all of them. GG Tiffin has its own separate ordering cutoffs and isn't affected by this page."
      closuresNote="Doesn't affect any one brand's own settings, or GG Tiffin — use their own Store Status/Emergency Closure pages for that."
      scopeLabel="Lickyeat"
    />
  );
}
