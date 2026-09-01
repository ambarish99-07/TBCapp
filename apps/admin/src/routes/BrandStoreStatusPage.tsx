import type { Brand } from "@tbc/shared-types";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { adminClient } from "../api/adminClient.js";
import { StoreStatusPanel } from "../components/StoreStatusPanel.js";

/**
 * One brand's own ordering availability — same switch/hours/planned-closures system as the
 * Lickyeat-wide Store Status page, just scoped to this brand alone (e.g. The Blenders Club can
 * close early on Sundays while The Alchemy Tails stays open). The Lickyeat-wide switch still
 * overrides this brand regardless of what's set here — see StoreStatusPanel's closedByLickyeat
 * handling. Reused for every catalog brand, including ones added after this was built — nothing
 * here is specific to any one brandId.
 */
export function BrandStoreStatusPage() {
  const { brandId } = useParams<{ brandId: string }>();
  const [brandName, setBrandName] = useState<string | null>(null);

  useEffect(() => {
    adminClient
      .get<{ brands: Brand[] }>("/admin/brands")
      .then((res) => setBrandName(res.data.brands.find((b) => b.id === brandId)?.name ?? null))
      .catch(() => {});
  }, [brandId]);

  if (!brandId) return null;
  const label = brandName ?? brandId;

  return (
    <StoreStatusPanel
      settingsPath={`/admin/brands/${brandId}/store-settings`}
      closuresPath={`/admin/brands/${brandId}/store-closures`}
      title={`${label} — Store Status`}
      description={`Controls whether ${label} can be ordered right now. The Lickyeat-wide Store Status switch overrides this if it's off, regardless of what's set here.`}
      closuresNote={`Doesn't affect any other brand, the Lickyeat-wide switch, or GG Tiffin.`}
      scopeLabel={label}
    />
  );
}
