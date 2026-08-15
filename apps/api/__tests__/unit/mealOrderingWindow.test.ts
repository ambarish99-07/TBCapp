import { describe, expect, it } from "vitest";
import { resolveSingleMealTargetDate, todayIsoInIst } from "../../src/modules/tiffin/mealOrderingWindow.js";

// IST is UTC+5:30 — 2026-08-17T00:00:00Z is 05:30am IST on the same calendar day.
const IST_AUG_17_0530 = new Date("2026-08-17T00:00:00Z");
// 12:59pm IST on Aug 17.
const IST_AUG_17_LUNCH_BEFORE_CUTOFF = new Date("2026-08-17T07:29:00Z");
// 1:01pm IST on Aug 17 — one minute past lunch's 1pm cutoff.
const IST_AUG_17_LUNCH_AFTER_CUTOFF = new Date("2026-08-17T07:31:00Z");
// 8:59pm IST on Aug 17.
const IST_AUG_17_DINNER_BEFORE_CUTOFF = new Date("2026-08-17T15:29:00Z");
// 9:01pm IST on Aug 17 — one minute past dinner's 9pm cutoff.
const IST_AUG_17_DINNER_AFTER_CUTOFF = new Date("2026-08-17T15:31:00Z");
// 11:45pm IST on Aug 17 — just before the IST day rolls over to Aug 18.
const IST_AUG_17_LATE_NIGHT = new Date("2026-08-17T18:15:00Z");

describe("resolveSingleMealTargetDate", () => {
  it("breakfast is always the next IST calendar day, regardless of the hour", () => {
    expect(resolveSingleMealTargetDate("breakfast", IST_AUG_17_0530)).toBe("2026-08-18");
    expect(resolveSingleMealTargetDate("breakfast", IST_AUG_17_LATE_NIGHT)).toBe("2026-08-18");
  });

  it("lunch (window closes 2pm IST) stays same-day until 1pm IST, then rolls to tomorrow", () => {
    expect(resolveSingleMealTargetDate("lunch", IST_AUG_17_LUNCH_BEFORE_CUTOFF)).toBe("2026-08-17");
    expect(resolveSingleMealTargetDate("lunch", IST_AUG_17_LUNCH_AFTER_CUTOFF)).toBe("2026-08-18");
  });

  it("dinner (window closes 10pm IST) stays same-day until 9pm IST, then rolls to tomorrow", () => {
    expect(resolveSingleMealTargetDate("dinner", IST_AUG_17_DINNER_BEFORE_CUTOFF)).toBe("2026-08-17");
    expect(resolveSingleMealTargetDate("dinner", IST_AUG_17_DINNER_AFTER_CUTOFF)).toBe("2026-08-18");
  });

  it("late at night, lunch and dinner both roll to the next IST day", () => {
    expect(resolveSingleMealTargetDate("lunch", IST_AUG_17_LATE_NIGHT)).toBe("2026-08-18");
    expect(resolveSingleMealTargetDate("dinner", IST_AUG_17_LATE_NIGHT)).toBe("2026-08-18");
  });
});

describe("todayIsoInIst", () => {
  it("resolves the IST calendar date for a given instant", () => {
    expect(todayIsoInIst(IST_AUG_17_0530)).toBe("2026-08-17");
    expect(todayIsoInIst(IST_AUG_17_LATE_NIGHT)).toBe("2026-08-17");
    // 6:15pm UTC on Aug 17 is 11:45pm IST on Aug 17, but 6:35pm UTC (00:05am IST) has already
    // rolled over to Aug 18 in IST.
    expect(todayIsoInIst(new Date("2026-08-17T18:35:00Z"))).toBe("2026-08-18");
  });
});
