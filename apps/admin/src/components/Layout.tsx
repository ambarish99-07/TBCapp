import type { ReactNode } from "react";
import { AdminNav } from "./AdminNav.js";

/** Wraps every authenticated page: fixed sidebar on the left, scrollable padded content area on
 * the right. Replaces `RequireAdmin` rendering `<AdminNav />` + children with no container. */
export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen bg-surface/40">
      <AdminNav />
      <main className="flex-1 overflow-y-auto p-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
