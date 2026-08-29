import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";

/** Thin wrapper set around native table elements — every list page (Orders, Brands, Tiffin
 * Plans, Meal Prices, Bulk Orders) used a raw `<table>` with per-row inline `borderTop` styling
 * before this; these just carry consistent Tailwind classes so pages stop repeating them. */
export function Table({ className = "", ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto">
      <table {...props} className={`w-full border-collapse text-sm ${className}`} />
    </div>
  );
}

export function Thead({ className = "", ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead {...props} className={`border-b border-border ${className}`} />;
}

export function Th({ className = "", ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      {...props}
      className={`px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-muted ${className}`}
    />
  );
}

export function Td({ className = "", ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td {...props} className={`px-3 py-2.5 ${className}`} />;
}

export function Tr({ className = "", ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr {...props} className={`border-b border-border last:border-0 hover:bg-surface/60 ${className}`} />;
}
