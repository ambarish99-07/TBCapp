import type { ReactNode } from "react";

interface Props {
  message: ReactNode;
}

/** Dropped into a table body (or in place of one) when a list has nothing to show — replaces
 * the plain "No orders yet" / "No brands yet" text nodes scattered across the route pages. */
export function EmptyState({ message }: Props) {
  return <p className="py-8 text-center text-sm text-muted">{message}</p>;
}
