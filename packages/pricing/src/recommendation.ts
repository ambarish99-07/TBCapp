import { RECOMMENDATION_LIMIT } from "./constants.js";
import type { PairableItem, ScoredItem } from "./types.js";

/**
 * Scores every menu item the customer hasn't ordered by how often it appears in
 * the `pairsWith` list of items they *have* ordered. Pure/no I/O so it can be
 * reused unchanged by a manual admin trigger now and a scheduled job later.
 */
export function scorePairings(orderedMenuItemIds: string[], allMenuItems: PairableItem[]): ScoredItem[] {
  const orderedSet = new Set(orderedMenuItemIds);
  const orderedItems = allMenuItems.filter((item) => orderedSet.has(item.id));

  const scores = new Map<string, number>();
  for (const orderedItem of orderedItems) {
    for (const pairedId of orderedItem.pairsWith ?? []) {
      if (orderedSet.has(pairedId)) continue;
      scores.set(pairedId, (scores.get(pairedId) ?? 0) + 1);
    }
  }

  return Array.from(scores.entries())
    .map(([menuItemId, score]) => ({ menuItemId, score }))
    .sort((a, b) => b.score - a.score);
}

/**
 * Up to `limit` recommendations: pairing-scored items first, then generally
 * popular items as a fallback when there isn't enough order history to score
 * anything meaningfully. `popularityFallbackIds` is supplied by the caller
 * (e.g. from an `isPopular` flag or an aggregate query) — this function does
 * not compute popularity itself, only merges it in.
 */
export function getRecommendations(
  orderedMenuItemIds: string[],
  allMenuItems: PairableItem[],
  popularityFallbackIds: string[],
  limit: number = RECOMMENDATION_LIMIT
): string[] {
  const orderedSet = new Set(orderedMenuItemIds);
  const result: string[] = [];

  for (const scored of scorePairings(orderedMenuItemIds, allMenuItems)) {
    if (result.length >= limit) break;
    if (scored.score <= 0) continue;
    result.push(scored.menuItemId);
  }

  for (const fallbackId of popularityFallbackIds) {
    if (result.length >= limit) break;
    if (orderedSet.has(fallbackId) || result.includes(fallbackId)) continue;
    result.push(fallbackId);
  }

  return result;
}
