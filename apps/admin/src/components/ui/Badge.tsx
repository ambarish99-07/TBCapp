import type { HTMLAttributes } from "react";

type Tone = "neutral" | "primary" | "success" | "danger" | "accent";

interface Props extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-surface text-muted",
  primary: "bg-primary/10 text-primary-dark",
  success: "bg-success-soft text-success",
  danger: "bg-danger-soft text-danger",
  accent: "bg-accent/15 text-accent",
};

/** Small rounded pill for a status word or count — used wherever a page needs a colored label
 * that isn't the domain-specific StatusBadge (order status keeps its own color map). */
export function Badge({ tone = "neutral", className = "", ...props }: Props) {
  return (
    <span
      {...props}
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${TONE_CLASSES[tone]} ${className}`}
    />
  );
}
