import { describe, expect, it } from "vitest";
import { computeMealsForRange, dishForDay } from "../../src/modules/tiffin/tiffinSchedule.js";

// A fixed Monday, so a 7-day range walks exactly Monday -> Sunday.
const MONDAY = new Date("2026-08-17T00:00:00Z");

describe("dishForDay", () => {
  it("follows the fixed weekly veg rotation Monday-Saturday", () => {
    expect(dishForDay("veg", "Monday")).toBe("Aloo Gobhi");
    expect(dishForDay("veg", "Tuesday")).toBe("Aloo Matar");
    expect(dishForDay("veg", "Wednesday")).toBe("Aloo Parwal");
    expect(dishForDay("veg", "Thursday")).toBe("Aloo Soyabean");
    expect(dishForDay("veg", "Friday")).toBe("Dum Aloo");
    expect(dishForDay("veg", "Saturday")).toBe("Lauki");
  });

  it("gives the veg plan's Sunday special based on the customer's paneer/chole choice", () => {
    expect(dishForDay("veg", "Sunday", "paneer")).toBe("Paneer Sabzi (Sunday Special)");
    expect(dishForDay("veg", "Sunday", "chole")).toBe("Chole (Sunday Special)");
  });

  it("defaults the veg Sunday special to paneer when no choice is given", () => {
    expect(dishForDay("veg", "Sunday")).toBe("Paneer Sabzi (Sunday Special)");
  });

  it("gives the non-veg plan a meat curry on Monday/Wednesday/Friday", () => {
    expect(dishForDay("non-veg", "Monday")).toBe("Chicken Curry");
    expect(dishForDay("non-veg", "Wednesday")).toBe("Fish Curry");
    expect(dishForDay("non-veg", "Friday")).toBe("Egg Curry");
  });

  it("falls back to that day's veg sabzi for the non-veg plan on Tuesday/Thursday/Saturday", () => {
    expect(dishForDay("non-veg", "Tuesday")).toBe("Aloo Matar");
    expect(dishForDay("non-veg", "Thursday")).toBe("Aloo Soyabean");
    expect(dishForDay("non-veg", "Saturday")).toBe("Lauki");
  });

  it("always gives the non-veg plan Mutton on Sunday, regardless of any choice passed", () => {
    expect(dishForDay("non-veg", "Sunday")).toBe("Mutton Curry");
    expect(dishForDay("non-veg", "Sunday", "chole")).toBe("Mutton Curry");
  });
});

describe("computeMealsForRange", () => {
  it("generates a full Monday-Sunday week for a veg plan", () => {
    const meals = computeMealsForRange("veg", "lunch", MONDAY, 7, "chole");
    expect(meals).toHaveLength(7);
    expect(meals.map((meal) => meal.dishName)).toEqual([
      "Aloo Gobhi",
      "Aloo Matar",
      "Aloo Parwal",
      "Aloo Soyabean",
      "Dum Aloo",
      "Lauki",
      "Chole (Sunday Special)",
    ]);
    expect(meals[0].date).toBe("2026-08-17");
    expect(meals[6].date).toBe("2026-08-23");
    expect(meals.every((meal) => meal.mealType === "lunch")).toBe(true);
  });

  it("generates a full Monday-Sunday week for a non-veg plan", () => {
    const meals = computeMealsForRange("non-veg", "lunch", MONDAY, 7);
    expect(meals.map((meal) => meal.dishName)).toEqual([
      "Chicken Curry",
      "Aloo Matar",
      "Fish Curry",
      "Aloo Soyabean",
      "Egg Curry",
      "Lauki",
      "Mutton Curry",
    ]);
  });

  it("supports a 30-day monthly range starting mid-week", () => {
    const meals = computeMealsForRange("veg", "lunch", new Date("2026-08-20T00:00:00Z"), 30, "paneer");
    expect(meals).toHaveLength(30);
    expect(meals[0].date).toBe("2026-08-20");
    expect(meals[29].date).toBe("2026-09-18");
  });
});
