import { describe, expect, it } from "vitest";
import { computeMealsForRange, dishForDay, type TierDishLookup } from "../../src/modules/tiffin/tiffinSchedule.js";

// A fixed Monday, so a 7-day range walks exactly Monday -> Sunday.
const MONDAY = new Date("2026-08-17T00:00:00Z");

// A small fixture standing in for the DB — real Regular-tier dishes (a Mini/Premium subscription
// would build its own lookup the same way, from that tier's own TiffinDish rows), not a
// hardcoded table.
function fixtureLookup(): TierDishLookup {
  return new Map<string, string>([
    ["veg|Monday|breakfast", "Masala Pasta"],
    ["veg|Tuesday|breakfast", "Sandwich"],
    ["veg|Wednesday|breakfast", "Upma"],
    ["veg|Thursday|breakfast", "Aloo Paratha with Curd & Achar"],
    ["veg|Friday|breakfast", "Poha"],
    ["veg|Saturday|breakfast", "Sattu Paratha with Curd & Achar"],
    ["veg|Sunday|breakfast", "Puri with Chole & Achar"],
    ["veg|Monday|lunch", "Aloo Matar"],
    ["veg|Tuesday|lunch", "Aloo Parwal"],
    ["veg|Wednesday|lunch", "Aloo Soyabean"],
    ["veg|Thursday|lunch", "Mushroom Masala"],
    ["veg|Friday|lunch", "Rajma"],
    ["veg|Saturday|lunch", "Aloo Gobhi"],
    ["veg|Sunday|lunch", "Lauki Masala"],
    ["veg|Monday|dinner", "Aloo Gobhi"],
    ["veg|Tuesday|dinner", "Lauki Masala"],
    ["veg|Wednesday|dinner", "Matar Paneer"],
    ["veg|Thursday|dinner", "Dum Aloo"],
    ["veg|Friday|dinner", "Matar Chole"],
    ["veg|Saturday|dinner", "Matar Mushroom"],
    ["veg|Sunday|dinner", "Dum Aloo"],
    ["non-veg|Monday|breakfast", "Masala Pasta"],
    ["non-veg|Tuesday|breakfast", "Sandwich"],
    ["non-veg|Wednesday|breakfast", "Bread Omelette"],
    ["non-veg|Thursday|breakfast", "Aloo Paratha with Curd & Achar"],
    ["non-veg|Friday|breakfast", "Poha"],
    ["non-veg|Saturday|breakfast", "Sattu Paratha with Curd & Achar"],
    ["non-veg|Sunday|breakfast", "Puri with Chole & Achar"],
    ["non-veg|Monday|lunch", "Aloo Matar"],
    ["non-veg|Tuesday|lunch", "Aloo Parwal"],
    ["non-veg|Wednesday|lunch", "Aloo Soyabean"],
    ["non-veg|Thursday|lunch", "Mushroom Masala"],
    ["non-veg|Friday|lunch", "Rajma"],
    ["non-veg|Saturday|lunch", "Aloo Gobhi"],
    ["non-veg|Sunday|lunch", "Lauki Masala"],
    ["non-veg|Monday|dinner", "Fish Curry"],
    ["non-veg|Tuesday|dinner", "Lauki Masala"],
    ["non-veg|Wednesday|dinner", "Egg Curry"],
    ["non-veg|Thursday|dinner", "Dum Aloo"],
    ["non-veg|Friday|dinner", "Chicken Curry"],
    ["non-veg|Saturday|dinner", "Matar Mushroom"],
    ["non-veg|Sunday|dinner", "Dum Aloo"],
  ]);
}

describe("dishForDay", () => {
  const lookup = fixtureLookup();

  it("breakfast is the same real curated dish regardless of diet type, except Wednesday", () => {
    expect(dishForDay(lookup, "regular", "veg", "Monday", "breakfast")).toBe("Masala Pasta");
    expect(dishForDay(lookup, "regular", "non-veg", "Monday", "breakfast")).toBe("Masala Pasta");
    expect(dishForDay(lookup, "regular", "veg", "Sunday", "breakfast")).toBe("Puri with Chole & Achar");
  });

  it("keeps the old Bread Omelette for non-veg's Wednesday breakfast, while veg gets Upma", () => {
    expect(dishForDay(lookup, "regular", "veg", "Wednesday", "breakfast")).toBe("Upma");
    expect(dishForDay(lookup, "regular", "non-veg", "Wednesday", "breakfast")).toBe("Bread Omelette");
  });

  it("veg lunch/dinner follows the real curated Regular Tiffin menu, every day including Sunday", () => {
    expect(dishForDay(lookup, "regular", "veg", "Monday", "lunch")).toBe("Aloo Matar");
    expect(dishForDay(lookup, "regular", "veg", "Monday", "dinner")).toBe("Aloo Gobhi");
    expect(dishForDay(lookup, "regular", "veg", "Sunday", "lunch")).toBe("Lauki Masala");
    expect(dishForDay(lookup, "regular", "veg", "Sunday", "dinner")).toBe("Dum Aloo");
  });

  it("gives the non-veg plan a meat curry at DINNER ONLY on Monday/Wednesday/Friday — never both meals the same day", () => {
    expect(dishForDay(lookup, "regular", "non-veg", "Monday", "dinner")).toBe("Fish Curry");
    expect(dishForDay(lookup, "regular", "non-veg", "Wednesday", "dinner")).toBe("Egg Curry");
    expect(dishForDay(lookup, "regular", "non-veg", "Friday", "dinner")).toBe("Chicken Curry");
    // Lunch on those same days falls back to the veg dish — the real menu never has a non-veg
    // item at both lunch and dinner on the same day.
    expect(dishForDay(lookup, "regular", "non-veg", "Monday", "lunch")).toBe(dishForDay(lookup, "regular", "veg", "Monday", "lunch"));
    expect(dishForDay(lookup, "regular", "non-veg", "Wednesday", "lunch")).toBe(dishForDay(lookup, "regular", "veg", "Wednesday", "lunch"));
    expect(dishForDay(lookup, "regular", "non-veg", "Friday", "lunch")).toBe(dishForDay(lookup, "regular", "veg", "Friday", "lunch"));
  });

  it("falls back to that day's real veg dish for the non-veg plan on Tuesday/Thursday/Saturday", () => {
    expect(dishForDay(lookup, "regular", "non-veg", "Tuesday", "lunch")).toBe("Aloo Parwal");
    expect(dishForDay(lookup, "regular", "non-veg", "Tuesday", "dinner")).toBe("Lauki Masala");
    expect(dishForDay(lookup, "regular", "non-veg", "Saturday", "lunch")).toBe("Aloo Gobhi");
  });

  it("has no special Sunday non-veg dish for Regular tier — Mutton is a Premium-only, single-meal-only upgrade", () => {
    expect(dishForDay(lookup, "regular", "non-veg", "Sunday", "lunch")).toBe(dishForDay(lookup, "regular", "veg", "Sunday", "lunch"));
    expect(dishForDay(lookup, "regular", "non-veg", "Sunday", "dinner")).toBe(dishForDay(lookup, "regular", "veg", "Sunday", "dinner"));
  });

  it("throws for a combination with no configured dish, rather than silently returning something wrong", () => {
    expect(() => dishForDay(new Map(), "regular", "veg", "Monday", "lunch")).toThrow();
  });
});

describe("computeMealsForRange", () => {
  const lookup = fixtureLookup();

  it("generates a full Monday-Sunday week for a single-meal (lunch) veg plan", () => {
    const meals = computeMealsForRange(lookup, "regular", "veg", ["lunch"], MONDAY, 7);
    expect(meals).toHaveLength(7);
    expect(meals.map((meal) => meal.dishName)).toEqual([
      "Aloo Matar",
      "Aloo Parwal",
      "Aloo Soyabean",
      "Mushroom Masala",
      "Rajma",
      "Aloo Gobhi",
      "Lauki Masala",
    ]);
    expect(meals[0].date).toBe("2026-08-17");
    expect(meals[6].date).toBe("2026-08-23");
    expect(meals.every((meal) => meal.mealType === "lunch")).toBe(true);
  });

  it("generates a full Monday-Sunday week for a single-meal (dinner) non-veg plan", () => {
    const meals = computeMealsForRange(lookup, "regular", "non-veg", ["dinner"], MONDAY, 7);
    expect(meals.map((meal) => meal.dishName)).toEqual([
      "Fish Curry",
      "Lauki Masala",
      "Egg Curry",
      "Dum Aloo",
      "Chicken Curry",
      "Matar Mushroom",
      // Sunday — no special non-veg dish for Regular tier, falls back to the veg dinner dish.
      "Dum Aloo",
    ]);
    expect(meals.every((meal) => meal.mealType === "dinner")).toBe(true);
  });

  it("supports a 30-day monthly range starting mid-week", () => {
    const meals = computeMealsForRange(lookup, "regular", "veg", ["lunch"], new Date("2026-08-20T00:00:00Z"), 30);
    expect(meals).toHaveLength(30);
    expect(meals[0].date).toBe("2026-08-20");
    expect(meals[29].date).toBe("2026-09-18");
  });

  it("generates two rows per day (lunch + dinner) for a twice-daily plan, each with its own real dish", () => {
    const meals = computeMealsForRange(lookup, "regular", "veg", ["lunch", "dinner"], MONDAY, 7);
    expect(meals).toHaveLength(14);
    // Monday's pair — lunch and dinner genuinely differ, matching the real curated menu.
    expect(meals[0]).toMatchObject({ date: "2026-08-17", mealType: "lunch", dishName: "Aloo Matar" });
    expect(meals[1]).toMatchObject({ date: "2026-08-17", mealType: "dinner", dishName: "Aloo Gobhi" });
    // Sunday's pair, at the end — fixed, no customer choice.
    expect(meals[12]).toMatchObject({ date: "2026-08-23", mealType: "lunch", dishName: "Lauki Masala" });
    expect(meals[13]).toMatchObject({ date: "2026-08-23", mealType: "dinner", dishName: "Dum Aloo" });
  });

  it("generates three rows per day (breakfast + lunch + dinner) for a thrice-daily plan", () => {
    const meals = computeMealsForRange(lookup, "regular", "veg", ["breakfast", "lunch", "dinner"], MONDAY, 7);
    expect(meals).toHaveLength(21);
    expect(meals[0]).toMatchObject({ date: "2026-08-17", mealType: "breakfast", dishName: "Masala Pasta" });
    expect(meals[1]).toMatchObject({ date: "2026-08-17", mealType: "lunch", dishName: "Aloo Matar" });
    expect(meals[2]).toMatchObject({ date: "2026-08-17", mealType: "dinner", dishName: "Aloo Gobhi" });
  });
});
