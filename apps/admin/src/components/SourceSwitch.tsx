import type { AnalyticsSource } from "@tbc/shared-types";
import { useState } from "react";
import { Segmented } from "./ui/Segmented.js";

const STORAGE_KEY = "lickyeat_admin_source";
const OPTIONS = [
  { key: "app", label: "App" },
  { key: "website", label: "Website" },
  { key: "both", label: "Both" },
] as const;

/** Which storefront's data a combined page shows — remembered across pages and visits, so picking
 * "Both" on Analytics also opens Reviews & Complaints on "Both". `allowBoth: false` for pages
 * that list one side at a time (e.g. Customers, whose two sides are separate accounts). */
export function useSource(allowBoth = true): [AnalyticsSource, (s: AnalyticsSource) => void] {
  const [source, setSource] = useState<AnalyticsSource>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as AnalyticsSource | null;
      if (saved === "app" || saved === "website" || (saved === "both" && allowBoth)) return saved;
    } catch {
      // Storage blocked — fall back to the app.
    }
    return "app";
  });
  function update(next: AnalyticsSource) {
    setSource(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not remembered — fine.
    }
  }
  return [source, update];
}

export function SourceSwitch({ value, onChange, allowBoth = true }: { value: AnalyticsSource; onChange: (s: AnalyticsSource) => void; allowBoth?: boolean }) {
  return <Segmented options={allowBoth ? OPTIONS : OPTIONS.filter((o) => o.key !== "both")} value={value} onChange={onChange} />;
}

export const SOURCE_LABEL: Record<AnalyticsSource, string> = { app: "the app", website: "the website", both: "the app and the website" };
