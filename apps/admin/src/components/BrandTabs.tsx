import { Link, useLocation } from "react-router-dom";

interface Tab {
  label: string;
  to: string;
}

/** GG Tiffin's own page set — a differently-shaped set of features (no MenuItem/Combo catalog of
 * its own), reusing its existing dedicated pages/routes rather than the generic Menu
 * Items/Combos/Store Status shape every other brand gets. */
const GG_TIFFIN_TABS: Tab[] = [
  { label: "Menu", to: "/tiffin-menu" },
  { label: "Festival Specials", to: "/tiffin-festival-specials" },
  { label: "Plans", to: "/tiffin-plans" },
  { label: "Deliveries", to: "/tiffin-deliveries" },
  { label: "Meal Prices", to: "/tiffin-meal-prices" },
  { label: "Emergency Closure", to: "/tiffin-closures" },
];

function catalogTabs(brandId: string): Tab[] {
  return [
    { label: "Menu Items", to: `/brands/${brandId}/menu-items` },
    { label: "Combos", to: `/brands/${brandId}/combos` },
    { label: "Store Status", to: `/brands/${brandId}/store-status` },
  ];
}

/**
 * One consistent tab bar for every brand's own admin section — Menu Items/Combos/Store Status
 * for a regular catalog brand, GG Tiffin's own page set for that one. Reused unchanged for any
 * brand added in the future: a brand-new brandId just gets the same three generic tabs, no new
 * code needed. Rendered by BrandTabsLayout above whichever page a tab links to, so it stays
 * visible even while that page's own content is loading.
 */
export function BrandTabs({ brandId }: { brandId: string }) {
  const location = useLocation();
  const tabs = brandId === "gg-tiffin" ? GG_TIFFIN_TABS : catalogTabs(brandId);

  return (
    <div className="mb-6 flex gap-1 border-b border-border">
      {tabs.map((tab) => {
        const active = location.pathname === tab.to;
        return (
          <Link
            key={tab.to}
            to={tab.to}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
              active ? "border-primary text-primary-dark" : "border-transparent text-muted hover:text-text"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
