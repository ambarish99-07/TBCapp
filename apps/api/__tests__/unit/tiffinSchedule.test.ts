import { describe, expect, it } from "vitest";
import { computeMealsForRange, dishForDay } from "../../src/modules/tiffin/tiffinSchedule.js";

// A fixed Monday, so a 7-day range walks exactly Monday -> Sunday.
const MONDAY = new Date("2026-08-17T00:00:00Z");

describe("dishForDay", () => {
  it("breakfast is the same real curated dish regardless of diet type, except Wednesday", () => {
    expect(dishForDay("veg", "Monday", "breakfast")).toBe("Masala Pasta");
    expect(dishForDay("non-veg", "Monday", "breakfast")).toBe("Masala Pasta");
    expect(dishForDay("veg", "Sunday", "breakfast")).toBe("Puri with Chole & Achar");
  });

  it("keeps the old Bread Omelette for non-veg's Wednesday breakfast, while veg gets Upma", () => {
    expect(dishForDay("veg", "Wednesday", "breakfast")).toBe("Upma");
    expect(dishForDay("non-veg", "Wednesday", "breakfast")).toBe("Bread Omelette");
  });

  it("veg lunch/dinner follows the real curated Regular Tiffin menu, every day including Sunday", () => {
    expect(dishForDay("veg", "Monday", "lunch")).toBe("Aloo Matar");
    expect(dishForDay("veg", "Monday", "dinner")).toBe("Aloo Gobhi");
    expect(dishForDay("veg", "Sunday", "lunch")).toBe("Lauki Masala");
    expect(dishForDay("veg", "Sunday", "dinner")).toBe("Dum Aloo");
  });

  it("gives the non-veg plan a meat curry at DINNER ONLY on Monday/Wednesday/Friday — never both meals the same day", () => {
    expect(dishForDay("non-veg", "Monday", "dinner")).toBe("Fish Curry");
    expect(dishForDay("non-veg", "Wednesday", "dinner")).toBe("Egg Curry");
    expect(dishForDay("non-veg", "Friday", "dinner")).toBe("Chicken Curry");
    // Lunch on those same days falls back to the veg dish — the real menu never has a non-veg
    // item at both lunch and dinner on the same day.
    expect(dishForDay("non-veg", "Monday", "lunch")).toBe(dishForDay("veg", "Monday", "lunch"));
    expect(dishForDay("non-veg", "Wednesday", "lunch")).toBe(dishForDay("veg", "Wednesday", "lunch"));
    expect(dishForDay("non-veg", "Friday", "lunch")).toBe(dishForDay("veg", "Friday", "lunch"));
  });

  it("falls back to that day's real veg dish for the non-veg plan on Tuesday/Thursday/Saturday", () => {
    expect(dishForDay("non-veg", "Tuesday", "lunch")).toBe("Aloo Parwal");
    expect(dishForDay("non-veg", "Tuesday", "dinner")).toBe("Lauki Masala");
    expect(dishForDay("non-veg", "Saturday", "lunch")).toBe("Aloo Gobhi");
  });

  it("has no special Sunday non-veg dish for Regular tier — Mutton is a Premium-only, single-meal-only upgrade", () => {
    expect(dishForDay("non-veg", "Sunday", "lunch")).toBe(dishForDay("veg", "Sunday", "lunch"));
    expect(dishForDay("non-veg", "Sunday", "dinner")).toBe(dishForDay("veg", "Sunday", "dinner"));
  });
});

describe("computeMealsForRange", () => {
  it("generates a full Monday-Sunday week for a single-meal (lunch) veg plan", () => {
    const meals = computeMealsForRange("veg", ["lunch"], MONDAY, 7);
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
    const meals = computeMealsForRange("non-veg", ["dinner"], MONDAY, 7);
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
    const meals = computeMealsForRange("veg", ["lunch"], new Date("2026-08-20T00:00:00Z"), 30);
    expect(meals).toHaveLength(30);
    expect(meals[0].date).toBe("2026-08-20");
    expect(meals[29].date).toBe("2026-09-18");
  });

  it("generates two rows per day (lunch + dinner) for a twice-daily plan, each with its own real dish", () => {
    const meals = computeMealsForRange("veg", ["lunch", "dinner"], MONDAY, 7);
    expect(meals).toHaveLength(14);
    // Monday's pair — lunch and dinner genuinely differ, matching the real curated menu.
    expect(meals[0]).toMatchObject({ date: "2026-08-17", mealType: "lunch", dishName: "Aloo Matar" });
    expect(meals[1]).toMatchObject({ date: "2026-08-17", mealType: "dinner", dishName: "Aloo Gobhi" });
    // Sunday's pair, at the end — fixed, no customer choice.
    expect(meals[12]).toMatchObject({ date: "2026-08-23", mealType: "lunch", dishName: "Lauki Masala" });
    expect(meals[13]).toMatchObject({ date: "2026-08-23", mealType: "dinner", dishName: "Dum Aloo" });
  });

  it("generates three rows per day (breakfast + lunch + dinner) for a thrice-daily plan", () => {
    const meals = computeMealsForRange("veg", ["breakfast", "lunch", "dinner"], MONDAY, 7);
    expect(meals).toHaveLength(21);
    expect(meals[0]).toMatchObject({ date: "2026-08-17", mealType: "breakfast", dishName: "Masala Pasta" });
    expect(meals[1]).toMatchObject({ date: "2026-08-17", mealType: "lunch", dishName: "Aloo Matar" });
    expect(meals[2]).toMatchObject({ date: "2026-08-17", mealType: "dinner", dishName: "Aloo Gobhi" });
  });
});
