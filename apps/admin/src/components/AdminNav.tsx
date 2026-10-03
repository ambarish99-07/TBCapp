import {
  BarChart3,
  Globe,
  LayoutDashboard,
  LifeBuoy,
  MessageSquareWarning,
  Package,
  RefreshCw,
  Power,
  ShoppingBag,
  Store,
  Ticket,
  Users,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useAdminAuth } from "../auth/AdminAuthContext.js";

// Dev default matches the website's apps/web dev port (3100) and its dedicated bridge route.
const WEBSITE_ADMIN_URL = import.meta.env.VITE_WEBSITE_ADMIN_URL ?? "http://localhost:3100/admin-bridge";

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
  // Multi-kitchen combos (the app's Feast page) belong to no single brand, so they live here.
  { to: "/feast-combos", label: "Feast Combos", icon: UtensilsCrossed },
  { to: "/coupons", label: "Coupons", icon: Ticket },
  // App ↔ website menu sync — status, differences, and the full push.
  { to: "/website-sync", label: "Website Sync", icon: RefreshCw },
  { to: "/bulk-orders", label: "Bulk Orders", icon: Package },
  { to: "/feedback", label: "Reviews & Complaints", icon: MessageSquareWarning },
  // Raised from the app's support assistant (chatbot).
  { to: "/help-requests", label: "Help Requests", icon: LifeBuoy },
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

/** Not a react-router route — the Lickyeat website is a separate origin (D:\Lickyeat website),
 * so this is a real browser navigation carrying the silently-acquired website session token, not
 * an in-app Link. Same shared admin login flow as every other item here, it just hands off to a
 * different, already-authenticated app instead of an internal page. */
function WebsiteNavLink() {
  const { websiteAuthStatus, websiteToken } = useAdminAuth();
  const ok = websiteAuthStatus === "ok" && websiteToken;

  function openWebsiteAdmin() {
    if (!ok) return;
    // Fragment, never a query string — never sent in the HTTP request line, so it never lands in
    // server access logs or Referer headers.
    window.location.href = `${WEBSITE_ADMIN_URL}#token=${encodeURIComponent(websiteToken)}`;
  }

  return (
    <button
      type="button"
      onClick={openWebsiteAdmin}
      disabled={!ok}
      title={
        websiteAuthStatus === "failed"
          ? "Couldn't sign in to the website's admin with this account — the two admin passwords may have drifted out of sync, or the website's API isn't reachable right now."
          : undefined
      }
      className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-muted transition-colors hover:bg-surface hover:text-text disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
    >
      <Globe size={17} />
      Website
    </button>
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
          <WebsiteNavLink />
        </div>
      </div>
    </aside>
  );
}
