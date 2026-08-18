import { describe, expect, it } from "vitest";
import { dayNameForDate, getSingleMealDish, resolveAddOns } from "../../src/modules/tiffin/singleMealMenu.js";

// 2026-08-17 is a Monday, 2026-08-19 is Wednesday, 2026-08-21 is Friday, 2026-08-23 is the
// following Sunday (same fixed week tiffinSchedule.test.ts uses).
const MONDAY = "2026-08-17";
const WEDNESDAY = "2026-08-19";
const FRIDAY = "2026-08-21";
const SUNDAY = "2026-08-23";

describe("dayNameForDate", () => {
  it("resolves an ISO date to its weekday name", () => {
    expect(dayNameForDate(MONDAY)).toBe("Monday");
    expect(dayNameForDate(SUNDAY)).toBe("Sunday");
  });
});

describe("getSingleMealDish — veg", () => {
  it("resolves Regular's breakfast/lunch/dinner from the curated real menu", () => {
    expect(getSingleMealDish("regular", "veg", "breakfast", MONDAY)).toBe("Masala Pasta");
    expect(getSingleMealDish("regular", "veg", "lunch", MONDAY)).toBe("Aloo Matar");
    expect(getSingleMealDish("regular", "veg", "dinner", MONDAY)).toBe("Aloo Gobhi");
  });

  it("resolves Premium's upgraded Sunday menu", () => {
    expect(getSingleMealDish("premium", "veg", "breakfast", SUNDAY)).toBe("Idli / Dosa with Sambar & Chutney");
    expect(getSingleMealDish("premium", "veg", "lunch", SUNDAY)).toBe("Paneer Butter Masala");
    expect(getSingleMealDish("premium", "veg", "dinner", SUNDAY)).toBe("Puri with Chole");
  });

  it("Premium matches Regular Monday-Saturday — only Sunday is upgraded", () => {
    expect(getSingleMealDish("premium", "veg", "lunch", MONDAY)).toBe(getSingleMealDish("regular", "veg", "lunch", MONDAY));
    expect(getSingleMealDish("premium", "veg", "breakfast", FRIDAY)).toBe("Poha");
    expect(getSingleMealDish("regular", "veg", "breakfast", FRIDAY)).toBe("Poha");
  });

  it("Mini reuses Regular's lunch/dinner dish and offers no breakfast", () => {
    expect(getSingleMealDish("mini", "veg", "lunch", MONDAY)).toBe(getSingleMealDish("regular", "veg", "lunch", MONDAY));
    expect(getSingleMealDish("mini", "veg", "dinner", MONDAY)).toBe(getSingleMealDish("regular", "veg", "dinner", MONDAY));
    expect(getSingleMealDish("mini", "veg", "breakfast", MONDAY)).toBeNull();
  });
});

describe("getSingleMealDish — non-veg", () => {
  it("Regular swaps in a meat curry at dinner on Mon/Wed/Fri only", () => {
    expect(getSingleMealDish("regular", "non-veg", "dinner", MONDAY)).toBe("Fish Curry");
    expect(getSingleMealDish("regular", "non-veg", "dinner", WEDNESDAY)).toBe("Egg Curry");
    expect(getSingleMealDish("regular", "non-veg", "dinner", FRIDAY)).toBe("Chicken Curry");
    // Lunch isn't overridden — falls back to the veg dish, same as any other non-curry day.
    expect(getSingleMealDish("regular", "non-veg", "lunch", MONDAY)).toBe(getSingleMealDish("regular", "veg", "lunch", MONDAY));
  });

  it("Regular falls back to the veg dish on days with no non-veg override", () => {
    expect(getSingleMealDish("regular", "non-veg", "dinner", SUNDAY)).toBe(getSingleMealDish("regular", "veg", "dinner", SUNDAY));
  });

  it("keeps the old Bread Omelette for non-veg's Wednesday breakfast, while veg gets Upma", () => {
    expect(getSingleMealDish("regular", "non-veg", "breakfast", WEDNESDAY)).toBe("Bread Omelette");
    expect(getSingleMealDish("regular", "veg", "breakfast", WEDNESDAY)).toBe("Upma");
    expect(getSingleMealDish("premium", "non-veg", "breakfast", WEDNESDAY)).toBe("Bread Omelette");
  });

  it("Premium shares Regular's Mon/Wed/Fri dinner swaps, plus Mutton at Sunday lunch", () => {
    expect(getSingleMealDish("premium", "non-veg", "dinner", MONDAY)).toBe("Fish Curry");
    expect(getSingleMealDish("premium", "non-veg", "dinner", WEDNESDAY)).toBe("Egg Curry");
    expect(getSingleMealDish("premium", "non-veg", "dinner", FRIDAY)).toBe("Chicken Curry");
    expect(getSingleMealDish("premium", "non-veg", "lunch", SUNDAY)).toBe("Mutton Curry");
    // Sunday dinner isn't overridden for non-veg — falls back to Premium's veg Sunday dinner.
    expect(getSingleMealDish("premium", "non-veg", "dinner", SUNDAY)).toBe(getSingleMealDish("premium", "veg", "dinner", SUNDAY));
  });

  it("Mini has only two non-veg days (Friday and Sunday dinner) — Monday/Wednesday stay veg", () => {
    expect(getSingleMealDish("mini", "non-veg", "dinner", FRIDAY)).toBe("Egg Curry");
    expect(getSingleMealDish("mini", "non-veg", "dinner", SUNDAY)).toBe("Chicken Curry");
    expect(getSingleMealDish("mini", "non-veg", "dinner", MONDAY)).toBe(getSingleMealDish("regular", "veg", "dinner", MONDAY));
    expect(getSingleMealDish("mini", "non-veg", "breakfast", FRIDAY)).toBeNull();
  });
});

describe("resolveAddOns", () => {
  it("gives Regular rice, roti, daal, and an extra portion of the sabzi itself — each individually priced", () => {
    expect(resolveAddOns("regular", "lunch", "Dum Aloo")).toEqual([
      { name: "Rice", price: 20 },
      { name: "Roti", price: 10 },
      { name: "Daal", price: 20 },
      { name: "Extra Dum Aloo", price: 30 },
    ]);
  });

  it("gives Premium pulao instead of rice for Mutton Curry and Paneer Butter Masala, and maps protein curries to a priced '{Protein} piece' add-on", () => {
    expect(resolveAddOns("premium", "lunch", "Mutton Curry")).toEqual([
      { name: "Pulao", price: 25 },
      { name: "Paratha", price: 15 },
      { name: "Daal", price: 20 },
      { name: "Mutton piece", price: 60 },
    ]);
    expect(resolveAddOns("premium", "lunch", "Paneer Butter Masala")).toEqual([
      { name: "Pulao", price: 25 },
      { name: "Paratha", price: 15 },
      { name: "Daal", price: 20 },
      { name: "Extra Paneer Butter Masala", price: 30 },
    ]);
    expect(resolveAddOns("premium", "dinner", "Chicken Curry")).toEqual([
      { name: "Rice", price: 20 },
      { name: "Paratha", price: 15 },
      { name: "Daal", price: 20 },
      { name: "Chicken piece", price: 40 },
    ]);
    expect(resolveAddOns("regular", "dinner", "Egg Curry")).toEqual([
      { name: "Rice", price: 20 },
      { name: "Roti", price: 10 },
      { name: "Daal", price: 20 },
      { name: "Egg piece", price: 15 },
    ]);
    expect(resolveAddOns("regular", "dinner", "Fish Curry")).toEqual([
      { name: "Rice", price: 20 },
      { name: "Roti", price: 10 },
      { name: "Daal", price: 20 },
      { name: "Fish piece", price: 45 },
    ]);
  });

  it("offers Mini the same rice/roti/daal staples as Regular, even though its base meal is just roti + sabzi", () => {
    expect(resolveAddOns("mini", "lunch", "Aloo Matar")).toEqual([
      { name: "Rice", price: 20 },
      { name: "Roti", price: 10 },
      { name: "Daal", price: 20 },
      { name: "Extra Aloo Matar", price: 30 },
    ]);
    expect(resolveAddOns("mini", "dinner", "Chicken Curry")).toEqual([
      { name: "Rice", price: 20 },
      { name: "Roti", price: 10 },
      { name: "Daal", price: 20 },
      { name: "Chicken piece", price: 40 },
    ]);
  });

  it("returns no add-ons for breakfast or Premium's already-complete Sunday dinner", () => {
    expect(resolveAddOns("regular", "breakfast", "Masala Pasta")).toEqual([]);
    expect(resolveAddOns("premium", "breakfast", "Bread Omelette")).toEqual([]);
    expect(resolveAddOns("premium", "dinner", "Puri with Chole")).toEqual([]);
  });
});
