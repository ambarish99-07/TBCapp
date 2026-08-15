import { round } from "@tbc/pricing";

/** Mirrors the backend's tiffin.service.ts#resolvePlanPrice exactly — a few plans carry a
 * discount, and the charged price is the marked-down one; `price` stays the strikethrough
 * display value. */
export function effectivePlanPrice(plan: { price: number; salePercent?: number }): number {
  if (!plan.salePercent) return plan.price;
  return round(plan.price * (1 - plan.salePercent / 100));
}
