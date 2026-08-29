import type { Feedback } from "@tbc/shared-types";
import { Bell } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { adminClient } from "../api/adminClient.js";
import { useAdminAuth } from "../auth/AdminAuthContext.js";

/** Full-width bar above the sidebar+content split — wordmark on the left, a notification bell
 * (open complaints) and an avatar/name dropdown (holding Log out) on the right. Replaces the
 * sidebar's old bottom-anchored name + Log out button, freeing the sidebar for pure navigation. */
export function TopBar() {
  const { user, logout } = useAdminAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [openComplaintCount, setOpenComplaintCount] = useState(0);
  const initial = user?.fullName?.trim().charAt(0).toUpperCase() ?? "?";

  useEffect(() => {
    adminClient
      .get<{ feedback: Feedback[] }>("/admin/feedback", { params: { type: "complaint", status: "open" } })
      .then((res) => setOpenComplaintCount(res.data.feedback.length))
      .catch(() => {});
  }, []);

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-white px-6">
      <div>
        <span className="text-lg font-extrabold text-primary-dark">Lickyeat</span>
        <span className="ml-1.5 text-xs font-semibold text-muted">Admin</span>
      </div>

      <div className="flex items-center gap-2">
        <Link to="/feedback" className="relative rounded-full p-2.5 hover:bg-surface" title="Open complaints">
          <Bell size={19} className="text-muted" />
          {openComplaintCount > 0 && (
            <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
              {openComplaintCount > 9 ? "9+" : openComplaintCount}
            </span>
          )}
        </Link>

        <div className="relative">
          <button
            onClick={() => setIsMenuOpen((open) => !open)}
            className="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-3 hover:bg-surface"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
              {initial}
            </span>
            <span className="text-sm font-semibold text-text">{user?.fullName}</span>
            <span className="text-xs text-muted">⌄</span>
          </button>

          {isMenuOpen && (
            <>
              {/* Click-outside catcher — sits behind the menu card, covers the whole viewport. */}
              <div className="fixed inset-0 z-10" onClick={() => setIsMenuOpen(false)} />
              <div className="absolute right-0 z-20 mt-2 w-48 rounded-xl border border-border bg-white p-1.5 shadow-lg">
                {user?.email && <p className="truncate px-2.5 py-2 text-xs text-muted">{user.email}</p>}
                <button
                  onClick={logout}
                  className="w-full rounded-lg px-2.5 py-2 text-left text-sm font-semibold text-danger hover:bg-danger-soft"
                >
                  Log out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
