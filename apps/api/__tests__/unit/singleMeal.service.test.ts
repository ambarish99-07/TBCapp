import { describe, expect, it } from "vitest";
import { resolveDishImageSlug } from "../../src/modules/tiffin/singleMeal.service.js";

describe("resolveDishImageSlug", () => {
  it("uses a dish's own dedicated photo when one exists", () => {
    expect(resolveDishImageSlug("regular", "lunch", "Aloo Matar")).toBe("aloo-matar");
    expect(resolveDishImageSlug("premium", "breakfast", "Bread Omelette")).toBe("bread-omelete");
  });

  it("prefers Mini's own dedicated photo over the shared Regular/Premium one", () => {
    expect(resolveDishImageSlug("mini", "lunch", "Aloo Matar")).toBe("aloo-matar-mini");
  });

  it("falls back to the shared photo for a Mini dish with no Mini-specific photo of its own", () => {
    expect(resolveDishImageSlug("mini", "dinner", "Matar Mushroom")).toBe("matar-mushroom");
  });

  it("gives an unphotographed breakfast dish the generic breakfast fallback", () => {
    expect(resolveDishImageSlug("regular", "breakfast", "Upma")).toBe("breakfast-tiffin");
  });

  it("gives Mini its own smaller generic box instead of the big Regular/Premium thali photo", () => {
    // Aloo Parwal has no dedicated photo at any tier — Mini shouldn't show the same
    // multi-compartment rice+roti+daal+sabzi thali Regular/Premium fall back to, since Mini's
    // real box is just roti + one sabzi.
    expect(resolveDishImageSlug("mini", "lunch", "Aloo Parwal")).toBe("mini-tiffin");
  });

  /**
   * The bug this locks in: getSingleMealMenu resolves a "non-veg" row to that day's plain VEG
   * dish whenever no non-veg override applies (see getSingleMealDish) — e.g. "Lauki Masala" is
   * a vegetable curry with no non-veg variant most days. The generic fallback must reflect what
   * the resolved dish actually is, not which diet tab happened to ask for it — this function
   * doesn't even take a dietType parameter, so there's no way for a tab to leak into the image
   * choice. Showing the chicken-curry stock photo next to "Lauki Masala" would misrepresent
   * what's actually in the box.
   */
  it("chooses the veg/non-veg generic from what the dish actually is, never from a diet tab", () => {
    expect(resolveDishImageSlug("regular", "dinner", "Lauki Masala")).toBe("veg-tiffin");
    expect(resolveDishImageSlug("premium", "lunch", "Aloo Parwal")).toBe("veg-tiffin");
    // Chicken Curry has a Mini-specific photo but no shared Regular/Premium one — genuinely
    // falls through to the non-veg generic, since it really is a meat dish.
    expect(resolveDishImageSlug("regular", "dinner", "Chicken Curry")).toBe("non-veg-tiffin");
  });
});
