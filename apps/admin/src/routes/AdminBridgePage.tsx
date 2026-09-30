import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAdminAuth } from "../auth/AdminAuthContext.js";

/**
 * One-time SSO handoff from the separate website admin (D:\Lickyeat website — its "App" nav item)
 * — mirrors that project's own apps/web/src/app/admin-bridge/page.tsx exactly, in reverse.
 *
 * The token arrives in the URL *fragment* (#token=...), never a query string — fragments are never
 * sent in the actual HTTP request line, so they never land in server access logs or Referer headers.
 */
export function AdminBridgePage() {
  const navigate = useNavigate();
  const { loginWithToken } = useAdminAuth();
  const [error, setError] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    const token = hash.startsWith("#token=") ? decodeURIComponent(hash.slice("#token=".length)) : null;

    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    loginWithToken(token).then((ok) => {
      if (ok) {
        navigate("/dashboard", { replace: true });
        return;
      }
      setError(true);
      setTimeout(() => navigate("/login", { replace: true }), 1500);
    });
  }, [navigate, loginWithToken]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface/40">
      <p className="text-sm text-muted">{error ? "Sign-in failed, redirecting…" : "Signing you in…"}</p>
    </div>
  );
}
