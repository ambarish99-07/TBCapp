import type { ReactNode } from "react";

interface Props {
  title: ReactNode;
  description?: ReactNode;
  /** Right-aligned slot — a primary action button, a filter, etc. */
  action?: ReactNode;
}

/** Sits at the top of every route page: a title, an optional one-line description, and an
 * optional right-aligned action. Replaces the bare `<h1>`/`<h2>` each page used to open with. */
export function PageHeader({ title, description, action }: Props) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold text-text">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
