import { describe, expect, it } from "vitest";
import { computeMilestoneReward } from "../src/milestoneReward.js";
import type { CartLineInput } from "../src/types.js";

const shakeLine = (unitPrice: number): CartLineInput => ({
  unitPrice,
  addOnPrices: [],
  quantity: 1,
  isCombo: false,
  category: "signature-shakes",
});

const coldCoffeeLine = (unitPrice: number): CartLineInput => ({
  unitPrice,
  addOnPrices: [],
  quantity: 1,
  isCombo: false,
  category: "cold-coffee",
});

describe("computeMilestoneReward", () => {
  it("guests never get a reward, even on a qualifying order number", () => {
    const result = computeMilestoneReward([coldCoffeeLine(200)], false, 5); // this would be order #6
    expect(result).toEqual({ amount: 0, reason: "none" });
  });

  it("order #6 gives 50% off the cheapest cold coffee, if one is in the cart", () => {
    const result = computeMilestoneReward([shakeLine(300), coldCoffeeLine(180), coldCoffeeLine(220)], true, 5);
    expect(result).toEqual({ amount: 90, reason: "sixth-order-cold-coffee" }); // round(0.5 * 180)
  });

  it("order #6 gives nothing if there's no cold coffee in the cart", () => {
    const result = computeMilestoneReward([shakeLine(300)], true, 5);
    expect(result).toEqual({ amount: 0, reason: "none" });
  });

  it("order #10 gives the cheapest eligible drink entirely free", () => {
    const result = computeMilestoneReward([shakeLine(300), shakeLine(150), coldCoffeeLine(180)], true, 9);
    expect(result).toEqual({ amount: 150, reason: "tenth-order-free-drink" });
  });

  it("combo lines never qualify for either reward", () => {
    const sixth = computeMilestoneReward(
      [{ unitPrice: 100, addOnPrices: [], quantity: 1, isCombo: true, category: "cold-coffee" }],
      true,
      5
    );
    expect(sixth).toEqual({ amount: 0, reason: "none" });

    const tenth = computeMilestoneReward(
      [{ unitPrice: 100, addOnPrices: [], quantity: 1, isCombo: true }],
      true,
      9
    );
    expect(tenth).toEqual({ amount: 0, reason: "none" });
  });

  it("repeats on subsequent cycles: order #16 and #26 also qualify for the sixth-position reward", () => {
    expect(computeMilestoneReward([coldCoffeeLine(200)], true, 15).reason).toBe("sixth-order-cold-coffee");
    expect(computeMilestoneReward([coldCoffeeLine(200)], true, 25).reason).toBe("sixth-order-cold-coffee");
  });

  it("repeats on subsequent cycles: order #20 and #30 also qualify for the tenth-position reward", () => {
    expect(computeMilestoneReward([shakeLine(200)], true, 19).reason).toBe("tenth-order-free-drink");
    expect(computeMilestoneReward([shakeLine(200)], true, 29).reason).toBe("tenth-order-free-drink");
  });

  it("non-milestone order numbers get no reward", () => {
    expect(computeMilestoneReward([shakeLine(200), coldCoffeeLine(200)], true, 3).reason).toBe("none");
  });
});
