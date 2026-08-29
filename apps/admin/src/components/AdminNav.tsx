import {
  BarChart3,
  LayoutDashboard,
  MessageSquareWarning,
  Package,
  ShoppingBag,
  Store,
  Tag,
  Truck,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";

// Sit above the grouped sections, same as Dashboard/Analytics do in most admin templates —
// they're overview pages, not part of any one operational area.
const TOP_LINKS: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
];

// Grouped with small-caps section labels — reads more like a real product's nav than one flat
// list of links, and leaves room to grow each section independently later.
const LINK_GROUPS: { label: string; links: { to: string; label: string; icon: LucideIcon }[] }[] = [
  {
    label: "Operations",
    links: [
      { to: "/orders", label: "Orders", icon: ShoppingBag },
      { to: "/bulk-orders", label: "Bulk Orders", icon: Package },
      { to: "/feedback", label: "Reviews & Complaints", icon: MessageSquareWarning },
    ],
  },
  {
    label: "Catalog",
    links: [{ to: "/brands", label: "Brands", icon: Store }],
  },
  {
    label: "GG Tiffin",
    links: [
      { to: "/tiffin-plans", label: "Plans", icon: Tag },
      { to: "/tiffin-deliveries", label: "Deliveries", icon: Truck },
      { to: "/tiffin-meal-prices", label: "Meal Prices", icon: Utensils },
    ],
  },
];

/** Fixed left sidebar shown on every authenticated page — nav only now; the wordmark and the
 * admin's own name/logout live in TopBar above instead. */
export function AdminNav() {
  const location = useLocation();

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col overflow-y-auto border-r border-border bg-white px-3 py-5">
      <div className="mb-4 flex flex-col gap-1">
        {TOP_LINKS.map((link) => {
          const active = location.pathname.startsWith(link.to);
          const Icon = link.icon;
          return (
            <Link
              key={link.to}
              to={link.to}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
                active ? "bg-primary/10 text-primary-dark" : "text-muted hover:bg-surface hover:text-text"
              }`}
            >
              <Icon size={17} />
              {link.label}
            </Link>
          );
        })}
      </div>

      {LINK_GROUPS.map((group) => (
        <div key={group.label} className="mb-4">
          <p className="mb-1 px-3 text-[11px] font-bold uppercase tracking-wide text-muted">{group.label}</p>
          <div className="flex flex-col gap-1">
            {group.links.map((link) => {
              const active = location.pathname.startsWith(link.to);
              const Icon = link.icon;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
                    active ? "bg-primary/10 text-primary-dark" : "text-muted hover:bg-surface hover:text-text"
                  }`}
                >
                  <Icon size={17} />
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </aside>
  );
}
