import { describe, expect, it } from "vitest";
import { dayNameForDate, resolveAddOns, resolveDishSlot, type DishSlot, type SingleMealDishLookup } from "../../src/modules/tiffin/singleMealMenu.js";

// 2026-08-17 is a Monday, 2026-08-19 is Wednesday, 2026-08-21 is Friday, 2026-08-23 is the
// following Sunday (same fixed week tiffinSchedule.test.ts uses).
const MONDAY = "2026-08-17";
const WEDNESDAY = "2026-08-19";
const SUNDAY = "2026-08-23";

function slot(overrides: Partial<DishSlot> & Pick<DishSlot, "dishName">): DishSlot {
  return { hasAddOns: true, riceSubstitute: "rice", ...overrides };
}

// A small fixture standing in for the DB — real behavior now lives in seeded `TiffinDish` rows
// (see tiffinDishSeedData.ts), not hardcoded tables, so these tests build just enough of a
// lookup to exercise resolveDishSlot/resolveAddOns' own logic.
function fixtureLookup(): SingleMealDishLookup {
  return new Map<string, DishSlot>([
    ["regular|veg|breakfast|Monday", slot({ dishName: "Masala Pasta", hasAddOns: false })],
    ["regular|veg|lunch|Monday", slot({ dishName: "Aloo Matar" })],
    ["regular|veg|dinner|Monday", slot({ dishName: "Aloo Gobhi" })],
    ["regular|veg|breakfast|Wednesday", slot({ dishName: "Upma", hasAddOns: false })],
    ["regular|non-veg|breakfast|Wednesday", slot({ dishName: "Bread Omelette", hasAddOns: false })],
    ["regular|non-veg|dinner|Monday", slot({ dishName: "Fish Curry", extraAddOnName: "Fish piece" })],
    ["regular|non-veg|dinner|Wednesday", slot({ dishName: "Egg Curry", extraAddOnName: "Egg piece" })],
    ["regular|non-veg|lunch|Monday", slot({ dishName: "Aloo Matar" })],
    ["regular|veg|breakfast|Sunday", slot({ dishName: "Puri with Chole & Achar", hasAddOns: false })],
    ["premium|veg|breakfast|Sunday", slot({ dishName: "Idli / Dosa with Sambar & Chutney", hasAddOns: false })],
    ["premium|veg|lunch|Sunday", slot({ dishName: "Paneer Butter Masala", riceSubstitute: "pulao" })],
    ["premium|veg|dinner|Sunday", slot({ dishName: "Puri with Chole", hasAddOns: false })],
    ["premium|non-veg|lunch|Sunday", slot({ dishName: "Mutton Curry", riceSubstitute: "pulao", extraAddOnName: "Mutton piece" })],
    ["premium|non-veg|dinner|Sunday", slot({ dishName: "Puri with Chole", hasAddOns: false })],
    ["mini|veg|lunch|Monday", slot({ dishName: "Aloo Matar" })],
    ["mini|veg|dinner|Monday", slot({ dishName: "Aloo Gobhi" })],
    ["mini|non-veg|dinner|Wednesday", slot({ dishName: "Egg Curry", extraAddOnName: "Egg piece" })],
  ]);
}

const addOnPrices = new Map([
  ["Rice", 20],
  ["Roti", 10],
  ["Daal", 20],
  ["Paratha", 15],
  ["Pulao", 25],
  ["Fish piece", 45],
  ["Egg piece", 15],
  ["Chicken piece", 40],
  ["Mutton piece", 60],
  ["Extra Portion", 30],
]);

describe("dayNameForDate", () => {
  it("resolves an ISO date to its weekday name", () => {
    expect(dayNameForDate(MONDAY)).toBe("Monday");
    expect(dayNameForDate(SUNDAY)).toBe("Sunday");
  });
});

describe("resolveDishSlot", () => {
  const lookup = fixtureLookup();

  it("resolves a dish from the lookup for a given tier/diet/mealType/date", () => {
    expect(resolveDishSlot(lookup, "regular", "veg", "lunch", MONDAY)?.dishName).toBe("Aloo Matar");
    expect(resolveDishSlot(lookup, "regular", "non-veg", "dinner", MONDAY)?.dishName).toBe("Fish Curry");
    expect(resolveDishSlot(lookup, "premium", "veg", "lunch", SUNDAY)?.dishName).toBe("Paneer Butter Masala");
  });

  it("returns null when no row exists for the combination (e.g. Mini + breakfast)", () => {
    expect(resolveDishSlot(lookup, "mini", "veg", "breakfast", MONDAY)).toBeNull();
  });

  it("keeps the old Bread Omelette for non-veg's Wednesday breakfast, distinct from veg's Upma", () => {
    expect(resolveDishSlot(lookup, "regular", "non-veg", "breakfast", WEDNESDAY)?.dishName).toBe("Bread Omelette");
    expect(resolveDishSlot(lookup, "regular", "veg", "breakfast", WEDNESDAY)?.dishName).toBe("Upma");
  });
});

describe("resolveAddOns", () => {
  it("gives Regular rice, roti, daal, and an extra portion of the sabzi itself — each individually priced", () => {
    expect(resolveAddOns(addOnPrices, "regular", "lunch", slot({ dishName: "Dum Aloo" }))).toEqual([
      { name: "Rice", price: 20 },
      { name: "Roti", price: 10 },
      { name: "Daal", price: 20 },
      { name: "Extra Dum Aloo", price: 30 },
    ]);
  });

  it("gives Premium pulao instead of rice when riceSubstitute is 'pulao', and uses the dish's own extraAddOnName for a protein curry", () => {
    expect(resolveAddOns(addOnPrices, "premium", "lunch", slot({ dishName: "Mutton Curry", riceSubstitute: "pulao", extraAddOnName: "Mutton piece" }))).toEqual([
      { name: "Pulao", price: 25 },
      { name: "Paratha", price: 15 },
      { name: "Daal", price: 20 },
      { name: "Mutton piece", price: 60 },
    ]);
    expect(resolveAddOns(addOnPrices, "premium", "lunch", slot({ dishName: "Paneer Butter Masala", riceSubstitute: "pulao" }))).toEqual([
      { name: "Pulao", price: 25 },
      { name: "Paratha", price: 15 },
      { name: "Daal", price: 20 },
      { name: "Extra Paneer Butter Masala", price: 30 },
    ]);
    expect(resolveAddOns(addOnPrices, "premium", "dinner", slot({ dishName: "Chicken Curry", extraAddOnName: "Chicken piece" }))).toEqual([
      { name: "Rice", price: 20 },
      { name: "Paratha", price: 15 },
      { name: "Daal", price: 20 },
      { name: "Chicken piece", price: 40 },
    ]);
  });

  it("offers Mini the same rice/roti/daal staples as Regular, even though its base meal is just roti + sabzi", () => {
    expect(resolveAddOns(addOnPrices, "mini", "lunch", slot({ dishName: "Aloo Matar" }))).toEqual([
      { name: "Rice", price: 20 },
      { name: "Roti", price: 10 },
      { name: "Daal", price: 20 },
      { name: "Extra Aloo Matar", price: 30 },
    ]);
    expect(resolveAddOns(addOnPrices, "mini", "dinner", slot({ dishName: "Chicken Curry", extraAddOnName: "Chicken piece" }))).toEqual([
      { name: "Rice", price: 20 },
      { name: "Roti", price: 10 },
      { name: "Daal", price: 20 },
      { name: "Chicken piece", price: 40 },
    ]);
  });

  it("returns no add-ons for breakfast or a dish flagged hasAddOns: false", () => {
    expect(resolveAddOns(addOnPrices, "regular", "breakfast", slot({ dishName: "Masala Pasta", hasAddOns: false }))).toEqual([]);
    expect(resolveAddOns(addOnPrices, "premium", "dinner", slot({ dishName: "Puri with Chole", hasAddOns: false }))).toEqual([]);
  });
});
