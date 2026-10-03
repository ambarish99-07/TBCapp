import { useEffect, useState } from "react";
import { adminClient } from "../api/adminClient.js";
import { Button } from "../components/ui/Button.js";
import { Card } from "../components/ui/Card.js";
import { PageHeader } from "../components/ui/PageHeader.js";

interface SideLists {
  brandIds: string[];
  menuItemIds: string[];
  comboIds: string[];
  addOnNames: string[];
}

type SyncStatus =
  | { configured: false }
  | { configured: true; reachable: false; error: string }
  | { configured: true; reachable: true; diff: { websiteOnly: SideLists; appOnly: SideLists } };

interface PushResult {
  sent: { brands: number; addOns: number; menuItems: number; combos: number; storeSwitches: number };
  removed: { menuItemIds: string[]; comboIds: string[]; addOnNames: string[] };
}

function IdList({ label, ids }: { label: string; ids: string[] }) {
  if (ids.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-muted">
        {label} ({ids.length})
      </p>
      <p className="mt-1 text-sm">{ids.join(", ")}</p>
    </div>
  );
}

function total(lists: SideLists) {
  return lists.brandIds.length + lists.menuItemIds.length + lists.comboIds.length + lists.addOnNames.length;
}

/**
 * The app and the website keep separate databases; every menu/brand/combo/add-on change and every
 * open/closed switch made in either admin is sent to the other automatically (modules/catalogSync
 * on both APIs). This page shows whether that link is working, what currently differs, and offers
 * a full "push everything" catch-up — for first-time setup or after the website was unreachable.
 */
export function WebsiteSyncPage() {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [removeWebsiteOnly, setRemoveWebsiteOnly] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [result, setResult] = useState<PushResult | null>(null);
  const [pushError, setPushError] = useState<string | null>(null);

  async function reload() {
    setLoadError(null);
    try {
      const { data } = await adminClient.get<SyncStatus>("/admin/catalog-sync");
      setStatus(data);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Couldn't load sync status");
    }
  }

  useEffect(() => {
    reload();
  }, []);

  async function push() {
    const warning = removeWebsiteOnly
      ? "Send the whole app catalog to the website AND delete the menu items, combos and add-ons that exist only on the website?"
      : "Send the whole app catalog to the website now?";
    if (!confirm(warning)) return;
    setPushing(true);
    setPushError(null);
    setResult(null);
    try {
      const { data } = await adminClient.post<PushResult>("/admin/catalog-sync/push", { removeWebsiteOnly });
      setResult(data);
      await reload();
    } catch (err) {
      setPushError(err instanceof Error ? err.message : "Push failed");
    } finally {
      setPushing(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Website Sync"
        description="The app and the website share one menu. Brands, menu items, add-ons, combos (incl. Feasts) and open/closed switches changed in either admin are copied to the other automatically."
      />

      <div className="flex flex-col gap-4">
        <Card title="Status">
          {loadError && <p className="text-sm font-medium text-danger">{loadError}</p>}
          {!status && !loadError && <p className="text-sm text-muted">Checking…</p>}
          {status && !status.configured && (
            <p className="text-sm">
              Sync isn&rsquo;t switched on for this server yet — it needs <code>CATALOG_SYNC_PEER_URL</code> and{" "}
              <code>CATALOG_SYNC_SECRET</code> set on both the app and the website API.
            </p>
          )}
          {status?.configured && !status.reachable && (
            <p className="text-sm font-medium text-danger">Can&rsquo;t reach the website right now: {status.error}</p>
          )}
          {status?.configured && status.reachable && (
            <p className="text-sm font-medium">
              {total(status.diff.websiteOnly) + total(status.diff.appOnly) === 0
                ? "✅ Connected — the app and the website have the same menu."
                : "⚠️ Connected, but some things exist on only one side (listed below). Push everything to bring the website in line."}
            </p>
          )}
        </Card>

        {status?.configured && status.reachable && total(status.diff.appOnly) > 0 && (
          <Card title="In the app but not yet on the website">
            <div className="flex flex-col gap-3">
              <IdList label="Brands" ids={status.diff.appOnly.brandIds} />
              <IdList label="Menu items" ids={status.diff.appOnly.menuItemIds} />
              <IdList label="Combos" ids={status.diff.appOnly.comboIds} />
              <IdList label="Add-ons" ids={status.diff.appOnly.addOnNames} />
            </div>
          </Card>
        )}

        {status?.configured && status.reachable && total(status.diff.websiteOnly) > 0 && (
          <Card title="On the website but not in the app">
            <div className="flex flex-col gap-3">
              <IdList label="Brands (never removed automatically)" ids={status.diff.websiteOnly.brandIds} />
              <IdList label="Menu items" ids={status.diff.websiteOnly.menuItemIds} />
              <IdList label="Combos" ids={status.diff.websiteOnly.comboIds} />
              <IdList label="Add-ons" ids={status.diff.websiteOnly.addOnNames} />
            </div>
          </Card>
        )}

        {status?.configured && (
          <Card title="Push everything to the website">
            <p className="text-sm text-muted">
              Use this once when setting sync up, or if the website was down while you made changes. Everything in the app
              overwrites the website&rsquo;s copy.
            </p>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={removeWebsiteOnly} onChange={(e) => setRemoveWebsiteOnly(e.target.checked)} />
              Also delete menu items, combos and add-ons that exist only on the website
            </label>
            <div className="mt-3">
              <Button onClick={push} disabled={pushing || (status.configured && !status.reachable)}>
                {pushing ? "Pushing…" : "Push everything to website"}
              </Button>
            </div>
            {pushError && <p className="mt-3 text-sm font-medium text-danger">{pushError}</p>}
            {result && (
              <p className="mt-3 text-sm">
                ✅ Sent {result.sent.brands} brands, {result.sent.menuItems} menu items, {result.sent.combos} combos,{" "}
                {result.sent.addOns} add-ons and {result.sent.storeSwitches} open/closed switches.
                {result.removed.menuItemIds.length + result.removed.comboIds.length + result.removed.addOnNames.length > 0 &&
                  ` Removed from the website: ${[...result.removed.menuItemIds, ...result.removed.comboIds, ...result.removed.addOnNames].join(", ")}.`}
              </p>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
