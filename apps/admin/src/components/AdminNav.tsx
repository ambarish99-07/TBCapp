import { Link, useLocation } from "react-router-dom";
import { useAdminAuth } from "../auth/AdminAuthContext.js";
import { Button } from "./ui/Button.js";

const LINKS = [
  { to: "/orders", label: "Orders" },
  { to: "/bulk-orders", label: "Bulk Orders" },
  { to: "/brands", label: "Brands" },
  { to: "/tiffin-plans", label: "Tiffin Plans" },
  { to: "/tiffin-deliveries", label: "Tiffin Deliveries" },
  { to: "/tiffin-meal-prices", label: "Meal Prices" },
];

/** Fixed left sidebar shown on every authenticated page. Replaces the old flat, inline-styled
 * top nav bar (orange/brown, left over from before the mobile app's rebrand). */
export function AdminNav() {
  const location = useLocation();
  const { user, logout } = useAdminAuth();

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-border bg-white">
      <div className="px-5 py-5">
        <span className="text-lg font-extrabold text-primary-dark">Lickyeat</span>
        <span className="ml-1.5 text-xs font-semibold text-muted">Admin</span>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3">
        {LINKS.map((link) => {
          const active = location.pathname.startsWith(link.to);
          return (
            <Link
              key={link.to}
              to={link.to}
              className={`rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
                active ? "bg-primary/10 text-primary-dark" : "text-muted hover:bg-surface hover:text-text"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border px-4 py-4">
        {user && (
          <p className="mb-2 truncate text-xs text-muted" title={user.email}>
            {user.fullName}
          </p>
        )}
        <Button variant="secondary" className="w-full" onClick={logout}>
          Log out
        </Button>
      </div>
    </aside>
  );
}
