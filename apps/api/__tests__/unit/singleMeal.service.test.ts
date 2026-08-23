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

  it("uses Upma's own dedicated photo, not the generic breakfast fallback", () => {
    expect(resolveDishImageSlug("regular", "breakfast", "Upma")).toBe("upma");
  });

  it("gives a genuinely unphotographed breakfast dish the generic breakfast fallback", () => {
    // Every real dish on the schedule is photographed now — a made-up name stands in so this
    // still exercises the fallback path without depending on which real dish is unphotographed
    // today (that list only shrinks as more photos come in).
    expect(resolveDishImageSlug("regular", "breakfast", "Not A Real Dish")).toBe("breakfast-tiffin");
  });

  it("gives Mini its own smaller generic box instead of the big Regular/Premium thali photo", () => {
    // A made-up dish name for the same reason as above — every real Mini dish is photographed
    // (either its own Mini-box photo or the shared Regular/Premium one) at this point.
    expect(resolveDishImageSlug("mini", "lunch", "Not A Real Dish")).toBe("mini-tiffin");
  });

  it("prefers Mini's own dedicated photo for Aloo Parwal/Lauki Masala/Matar Chole over the generic box", () => {
    expect(resolveDishImageSlug("mini", "lunch", "Aloo Parwal")).toBe("aloo-parwal-mini");
    expect(resolveDishImageSlug("mini", "dinner", "Lauki Masala")).toBe("lauki-masala-mini");
    expect(resolveDishImageSlug("mini", "dinner", "Matar Chole")).toBe("matar-chole-mini");
  });

  it("uses Aloo Parwal/Lauki Masala/Matar Chole's own Regular/Premium-size photo, not the generic thali", () => {
    expect(resolveDishImageSlug("regular", "lunch", "Aloo Parwal")).toBe("aloo-parwal");
    expect(resolveDishImageSlug("premium", "dinner", "Lauki Masala")).toBe("lauki-masala");
    expect(resolveDishImageSlug("regular", "dinner", "Matar Chole")).toBe("matar-chole");
  });

  /**
   * The bug this locks in: getSingleMealMenu resolves a "non-veg" row to that day's plain VEG
   * dish whenever no non-veg override applies (see getSingleMealDish) — e.g. a veg curry with no
   * non-veg variant that day. The generic fallback must reflect what the resolved dish actually
   * is, not which diet tab happened to ask for it — this function doesn't even take a dietType
   * parameter, so there's no way for a tab to leak into the image choice. Every real dish is
   * photographed now, so a made-up name stands in to still exercise this path.
   */
  it("chooses the veg generic for an unphotographed veg dish, never the non-veg one, regardless of diet tab", () => {
    expect(resolveDishImageSlug("regular", "dinner", "Not A Real Dish")).toBe("veg-tiffin");
    expect(resolveDishImageSlug("premium", "lunch", "Not A Real Dish")).toBe("veg-tiffin");
  });
});
