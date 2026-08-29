import type { ReactNode } from "react";
import { AdminNav } from "./AdminNav.js";
import { TopBar } from "./TopBar.js";

/** Wraps every authenticated page: a thin brand-gradient strip, a full-width top bar (wordmark +
 * admin avatar/logout), then a fixed sidebar beside a scrollable padded content area. */
export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen flex-col bg-surface/40">
      <div className="h-1 shrink-0 bg-gradient-to-r from-primary via-primary-dark to-accent" />
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <AdminNav />
        <main className="flex-1 overflow-y-auto p-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
