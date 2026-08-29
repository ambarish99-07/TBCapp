import type { InputHTMLAttributes, SelectHTMLAttributes } from "react";

const FIELD_CLASSES =
  "rounded-lg border border-border bg-white px-3 py-2 text-sm text-text placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-surface disabled:opacity-60";

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${FIELD_CLASSES} ${className}`} />;
}

export function Select({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${FIELD_CLASSES} ${className}`} />;
}
