import { describe, expect, it } from "vitest";
import { getRecommendations, scorePairings } from "../src/recommendation.js";
import type { PairableItem } from "../src/types.js";

const items: PairableItem[] = [
  { id: "choco-crush", pairsWith: ["oreo-blast", "kitkat-krunch"] },
  { id: "mango-tango", pairsWith: ["oreo-blast"] },
  { id: "oreo-blast", pairsWith: ["choco-crush"] },
  { id: "kitkat-krunch", pairsWith: [] },
  { id: "cold-brew-classic", pairsWith: [] },
];

describe("scorePairings", () => {
  it("scores un-ordered items by how often they appear in ordered items' pairsWith", () => {
    const scores = scorePairings(["choco-crush", "mango-tango"], items);
    const byId = Object.fromEntries(scores.map((s) => [s.menuItemId, s.score]));

    expect(byId["oreo-blast"]).toBe(2); // appears in both choco-crush's and mango-tango's pairsWith
    expect(byId["kitkat-krunch"]).toBe(1);
    expect(byId["choco-crush"]).toBeUndefined(); // already ordered, never scored
  });
});

describe("getRecommendations", () => {
  it("prefers pairing-scored items over popularity fallback", () => {
    const recs = getRecommendations(["choco-crush", "mango-tango"], items, ["cold-brew-classic"], 3);
    expect(recs[0]).toBe("oreo-blast");
    expect(recs).toContain("kitkat-krunch");
  });

  it("falls back to popularity when there is not enough order history to score anything", () => {
    const recs = getRecommendations([], items, ["cold-brew-classic", "mango-tango"], 2);
    expect(recs).toEqual(["cold-brew-classic", "mango-tango"]);
  });

  it("never recommends more than the limit and never recommends an already-ordered item", () => {
    const recs = getRecommendations(
      ["choco-crush", "mango-tango"],
      items,
      ["choco-crush", "cold-brew-classic"],
      3
    );
    expect(recs.length).toBeLessThanOrEqual(3);
    expect(recs).not.toContain("choco-crush");
  });
});
