import type { HTMLAttributes, ReactNode } from "react";

interface Props extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  title?: ReactNode;
  /** Small subtitle under the title — one line of context for what the card shows. */
  description?: ReactNode;
  /** Right-aligned, next to `title` — e.g. a small action button scoped to this card. */
  action?: ReactNode;
}

/** The one card shape every section of every page uses — a create-form, a table, a summary
 * block. Replaces the bare `<section>`/`<div>` wrappers that had no visual separation before. */
export function Card({ title, description, action, children, className = "", ...props }: Props) {
  return (
    <div {...props} className={`rounded-2xl border border-border bg-white p-5 shadow-sm ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-sm font-bold text-muted uppercase tracking-wide">{title}</h2>}
            {description && <p className="mt-1 text-xs text-muted">{description}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}
