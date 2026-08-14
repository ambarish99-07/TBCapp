const BASE_MINUTES = 35;
/** Total item quantity (not line count) included in the base estimate before it starts growing. */
const ITEM_THRESHOLD = 3;
const MINUTES_PER_EXTRA_ITEM = 3;
/** Distance covered by the base estimate before it starts growing — matches the free-delivery
 * radius customers already see reflected in pricing, so "close by" doesn't add time on top. */
const DISTANCE_THRESHOLD_KM = 3;
const MINUTES_PER_EXTRA_KM = 2;
const MAX_MINUTES = 75;

/**
 * Larger orders and farther addresses both take longer — the estimate grows with total item
 * quantity and with distance past their respective small thresholds, capped so a genuinely
 * large-and-far order still shows a believable number rather than something absurd.
 */
export function estimateDeliveryMinutes(totalQuantity: number, distanceFromShopKm: number | null = null): number {
  const extraItems = Math.max(0, totalQuantity - ITEM_THRESHOLD);
  const extraKm = Math.max(0, (distanceFromShopKm ?? 0) - DISTANCE_THRESHOLD_KM);
  return Math.min(MAX_MINUTES, BASE_MINUTES + extraItems * MINUTES_PER_EXTRA_ITEM + extraKm * MINUTES_PER_EXTRA_KM);
}
