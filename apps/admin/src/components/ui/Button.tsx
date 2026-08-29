import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-primary text-white hover:bg-primary-dark disabled:bg-primary/50",
  secondary: "bg-surface text-text border border-border hover:bg-border/60 disabled:opacity-50",
  danger: "bg-danger-soft text-danger border border-danger/30 hover:bg-danger hover:text-white disabled:opacity-50",
  ghost: "text-primary hover:bg-primary/10 disabled:opacity-50",
};

/** The one button every page uses — variant covers every case seen across the admin app so far
 * (submit a form, a quiet secondary action, a destructive cancel/delete, a plain text-like link
 * action). Native `<button>` underneath, so all existing `onClick`/`disabled`/`type` props just
 * keep working unchanged at every call site this replaces. */
export function Button({ variant = "primary", className = "", ...props }: Props) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${className}`}
    />
  );
}
