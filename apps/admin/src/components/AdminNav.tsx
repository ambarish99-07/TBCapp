import {
  BarChart3,
  LayoutDashboard,
  MessageSquareWarning,
  Package,
  Power,
  ShoppingBag,
  Store,
  Ticket,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";

/** Everything company-wide — spans every brand rather than belonging to one. Reaching a specific
 * brand's own tabbed page (Menu Items/Combos/Store Status, or GG Tiffin's own tab set — see
 * BrandTabs) goes through the Brands page's own "Manage ›" button below, not a per-brand sidebar
 * entry — one path in, and the sidebar stays a fixed size no matter how many brands exist. */
const LICKYEAT_LINKS: { to: string; label: string; icon: LucideIcon; exact?: boolean }[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/store-status", label: "Store Status", icon: Power },
  // Exact — otherwise this lit up as "active" on every /brands/:id/... sub-page too.
  { to: "/brands", label: "Brands", icon: Store, exact: true },
  { to: "/orders", label: "Orders", icon: ShoppingBag },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/coupons", label: "Coupons", icon: Ticket },
  { to: "/bulk-orders", label: "Bulk Orders", icon: Package },
  { to: "/feedback", label: "Reviews & Complaints", icon: MessageSquareWarning },
];

function NavLink({ to, label, icon: Icon, exact }: { to: string; label: string; icon: LucideIcon; exact?: boolean }) {
  const location = useLocation();
  const active = exact ? location.pathname === to : location.pathname.startsWith(to);
  return (
    <Link
      to={to}
      className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
        active ? "bg-primary/10 text-primary-dark" : "text-muted hover:bg-surface hover:text-text"
      }`}
    >
      <Icon size={17} />
      {label}
    </Link>
  );
}

/** Fixed left sidebar shown on every authenticated page — just the Lickyeat-wide, company-wide
 * pages. Every brand's own management page (Menu Items, Combos, Store Status, or GG Tiffin's own
 * tab set) is reached from the Brands page's "Manage ›" button instead of a sidebar entry per
 * brand, so the sidebar never grows as brands are added. */
export function AdminNav() {
  return (
    <aside className="flex h-full w-60 shrink-0 flex-col overflow-y-auto border-r border-border bg-white px-3 py-5">
      <div className="mb-4">
        <p className="mb-1 px-3 text-[11px] font-bold uppercase tracking-wide text-muted">Lickyeat</p>
        <div className="flex flex-col gap-1">
          {LICKYEAT_LINKS.map((link) => (
            <NavLink key={link.to} {...link} />
          ))}
        </div>
      </div>
    </aside>
  );
}
