import { describe, expect, it } from "vitest";
import { computePricing } from "../src/computePricing.js";
import type { PricingInput } from "../src/types.js";

const baseLoyalty = { completedOrderCount: 0, isPremiumMemberOverride: false };

describe("computePricing — quantity-tier discount", () => {
  it("a single item gets no discount", () => {
    const input: PricingInput = {
      lines: [{ unitPrice: 300, addOnPrices: [30], quantity: 1, isCombo: false, category: "signature-shakes" }],
      isLoggedIn: false,
      loyalty: baseLoyalty,
    };
    const result = computePricing(input);

    expect(result.subtotal).toBe(330);
    expect(result.discountAmount).toBe(0);
    expect(result.discountReason).toBe("none");
    expect(result.deliveryFee).toBe(39);
    expect(result.tax).toBe(17); // round(330 * 0.05)
    expect(result.total).toBe(386);
  });

  it("two items get a 10% discount on the non-combo subtotal", () => {
    const input: PricingInput = {
      lines: [
        { unitPrice: 200, addOnPrices: [], quantity: 1, isCombo: false, category: "signature-shakes" },
        { unitPrice: 200, addOnPrices: [], quantity: 1, isCombo: false, category: "cold-coffee" },
      ],
      isLoggedIn: true,
      loyalty: baseLoyalty,
    };
    const result = computePricing(input);

    expect(result.subtotal).toBe(400);
    expect(result.discountAmount).toBe(40);
    expect(result.discountReason).toBe("quantity-tier");
    expect(result.total).toBe(417); // (400-40)*1.05 + 39 delivery
  });

  it("three items get a 15% discount, four or more get 20%", () => {
    const threeItems = computePricing({
      lines: [
        { unitPrice: 100, addOnPrices: [], quantity: 3, isCombo: false, category: "signature-shakes" },
      ],
      isLoggedIn: false,
      loyalty: baseLoyalty,
    });
    expect(threeItems.discountAmount).toBe(45); // round(300 * 0.15)

    const fourItems = computePricing({
      lines: [{ unitPrice: 100, addOnPrices: [], quantity: 4, isCombo: false, category: "signature-shakes" }],
      isLoggedIn: false,
      loyalty: baseLoyalty,
    });
    expect(fourItems.discountAmount).toBe(80); // round(400 * 0.20)
  });

  it("shakes and cold coffee quantities combine toward the same tier", () => {
    const result = computePricing({
      lines: [
        { unitPrice: 100, addOnPrices: [], quantity: 2, isCombo: false, category: "signature-shakes" },
        { unitPrice: 100, addOnPrices: [], quantity: 1, isCombo: false, category: "cold-coffee" },
      ],
      isLoggedIn: false,
      loyalty: baseLoyalty,
    });
    // total qty = 3 -> 15%, not evaluated separately per category
    expect(result.discountAmount).toBe(45);
  });
});

describe("computePricing — combo lines are excluded from the quantity tier", () => {
  it("a combo line doesn't count toward quantity, doesn't get the % discount, and isn't discounted further", () => {
    const result = computePricing({
      lines: [
        { unitPrice: 379, addOnPrices: [], quantity: 1, isCombo: true },
        { unitPrice: 220, addOnPrices: [], quantity: 1, isCombo: false, category: "signature-shakes" },
      ],
      isLoggedIn: false,
      loyalty: baseLoyalty,
    });

    expect(result.subtotal).toBe(599);
    expect(result.discountAmount).toBe(0); // only 1 non-combo item -> 0% tier
    expect(result.deliveryFee).toBe(0); // subtotal >= 499
  });
});

describe("computePricing — premium membership", () => {
  it("premium members get a flat 25% instead of the quantity tier, even on a single item", () => {
    const result = computePricing({
      lines: [{ unitPrice: 1000, addOnPrices: [], quantity: 1, isCombo: false, category: "signature-shakes" }],
      isLoggedIn: true,
      loyalty: { completedOrderCount: 15, isPremiumMemberOverride: false },
    });

    expect(result.isPremiumMember).toBe(true);
    expect(result.discountReason).toBe("premium");
    expect(result.discountAmount).toBe(250);
  });

  it("an admin override grants premium regardless of completedOrderCount", () => {
    const result = computePricing({
      lines: [{ unitPrice: 100, addOnPrices: [], quantity: 1, isCombo: false, category: "signature-shakes" }],
      isLoggedIn: true,
      loyalty: { completedOrderCount: 0, isPremiumMemberOverride: true },
    });
    expect(result.isPremiumMember).toBe(true);
  });

  it("guests are never premium even with a high completedOrderCount value passed in by mistake", () => {
    const result = computePricing({
      lines: [{ unitPrice: 100, addOnPrices: [], quantity: 1, isCombo: false, category: "signature-shakes" }],
      isLoggedIn: false,
      loyalty: { completedOrderCount: 999, isPremiumMemberOverride: false },
    });
    expect(result.isPremiumMember).toBe(false);
    expect(result.discountReason).toBe("none");
  });

  it("premium members within the free-delivery radius pay no delivery fee even below the ₹499 threshold", () => {
    const withinRadius = computePricing({
      lines: [{ unitPrice: 100, addOnPrices: [], quantity: 1, isCombo: false, category: "signature-shakes" }],
      isLoggedIn: true,
      loyalty: { completedOrderCount: 15, isPremiumMemberOverride: false },
      distanceFromShopKm: 3,
    });
    expect(withinRadius.deliveryFee).toBe(0);

    const outsideRadius = computePricing({
      lines: [{ unitPrice: 100, addOnPrices: [], quantity: 1, isCombo: false, category: "signature-shakes" }],
      isLoggedIn: true,
      loyalty: { completedOrderCount: 15, isPremiumMemberOverride: false },
      distanceFromShopKm: 10,
    });
    expect(outsideRadius.deliveryFee).toBe(39);
  });

  it("non-premium customers get no radius-based free delivery even if a distance happens to be provided", () => {
    const result = computePricing({
      lines: [{ unitPrice: 100, addOnPrices: [], quantity: 1, isCombo: false, category: "signature-shakes" }],
      isLoggedIn: true,
      loyalty: { completedOrderCount: 0, isPremiumMemberOverride: false },
      distanceFromShopKm: 1,
    });
    expect(result.deliveryFee).toBe(39);
  });
});

describe("computePricing — paid Premium Membership (independent of the loyalty premium tier)", () => {
  it("waives the delivery fee regardless of distance or subtotal, for a non-loyalty-premium customer", () => {
    const result = computePricing({
      lines: [{ unitPrice: 100, addOnPrices: [], quantity: 1, isCombo: false, category: "signature-shakes" }],
      isLoggedIn: true,
      loyalty: baseLoyalty,
      distanceFromShopKm: 50,
      hasFreeDeliveryMembership: true,
    });
    expect(result.deliveryFee).toBe(0);
    expect(result.hasFreeDeliveryMembership).toBe(true);
  });

  it("does not grant the loyalty-tier 25% discount — only the delivery fee is affected", () => {
    const result = computePricing({
      lines: [{ unitPrice: 1000, addOnPrices: [], quantity: 1, isCombo: false, category: "signature-shakes" }],
      isLoggedIn: true,
      loyalty: baseLoyalty,
      hasFreeDeliveryMembership: true,
    });
    expect(result.isPremiumMember).toBe(false);
    expect(result.discountReason).toBe("none");
    expect(result.discountAmount).toBe(0);
    expect(result.deliveryFee).toBe(0);
  });

  it("defaults to false and charges the normal delivery fee when omitted", () => {
    const result = computePricing({
      lines: [{ unitPrice: 100, addOnPrices: [], quantity: 1, isCombo: false, category: "signature-shakes" }],
      isLoggedIn: true,
      loyalty: baseLoyalty,
    });
    expect(result.hasFreeDeliveryMembership).toBe(false);
    expect(result.deliveryFee).toBe(39);
  });
});

describe("computePricing — new-customer offer (order #1 BOGO / order #2 50% off)", () => {
  it("order #1 gets the cheapest unit free instead of the quantity-tier discount", () => {
    const result = computePricing({
      lines: [
        { unitPrice: 300, addOnPrices: [], quantity: 1, isCombo: false, category: "signature-shakes" },
        { unitPrice: 200, addOnPrices: [], quantity: 1, isCombo: false, category: "cold-coffee" },
      ],
      isLoggedIn: true,
      loyalty: baseLoyalty, // completedOrderCount: 0 -> this is order #1
      isQuickDeliveryBrand: true,
    });
    // Without the offer, 2 items would only get the 10% quantity-tier discount (50) — the
    // new-customer offer takes precedence and gives the cheaper 200 unit free instead.
    expect(result.discountReason).toBe("first-order-bogo");
    expect(result.discountAmount).toBe(200);
  });

  it("order #2 gets a flat 50% off instead of the quantity-tier discount", () => {
    const result = computePricing({
      lines: [{ unitPrice: 300, addOnPrices: [], quantity: 1, isCombo: false, category: "signature-shakes" }],
      isLoggedIn: true,
      loyalty: { completedOrderCount: 1, isPremiumMemberOverride: false }, // this is order #2
      isQuickDeliveryBrand: true,
    });
    expect(result.discountReason).toBe("second-order-half-off");
    expect(result.discountAmount).toBe(150);
  });

  it("order #3 gets ordinary quantity-tier pricing again — the offer is one-time only", () => {
    const result = computePricing({
      lines: [
        { unitPrice: 300, addOnPrices: [], quantity: 1, isCombo: false, category: "signature-shakes" },
        { unitPrice: 200, addOnPrices: [], quantity: 1, isCombo: false, category: "cold-coffee" },
      ],
      isLoggedIn: true,
      loyalty: { completedOrderCount: 2, isPremiumMemberOverride: false }, // this is order #3
      isQuickDeliveryBrand: true,
    });
    expect(result.discountReason).toBe("quantity-tier");
    expect(result.discountAmount).toBe(50);
  });

  it("never applies outside the quick-delivery brands (e.g. GG Tiffin), even on order #1", () => {
    const result = computePricing({
      lines: [
        { unitPrice: 300, addOnPrices: [], quantity: 1, isCombo: false, category: "signature-shakes" },
        { unitPrice: 200, addOnPrices: [], quantity: 1, isCombo: false, category: "cold-coffee" },
      ],
      isLoggedIn: true,
      loyalty: baseLoyalty,
      isQuickDeliveryBrand: false,
    });
    expect(result.discountReason).toBe("quantity-tier");
  });

  it("defaults to not applying when isQuickDeliveryBrand is omitted entirely", () => {
    const result = computePricing({
      lines: [
        { unitPrice: 300, addOnPrices: [], quantity: 1, isCombo: false, category: "signature-shakes" },
        { unitPrice: 200, addOnPrices: [], quantity: 1, isCombo: false, category: "cold-coffee" },
      ],
      isLoggedIn: true,
      loyalty: baseLoyalty,
    });
    expect(result.discountReason).toBe("quantity-tier");
  });

  it("a premium member (15+ orders) is unaffected — premium always wins and the two can never actually collide", () => {
    const result = computePricing({
      lines: [{ unitPrice: 1000, addOnPrices: [], quantity: 1, isCombo: false, category: "signature-shakes" }],
      isLoggedIn: true,
      loyalty: { completedOrderCount: 15, isPremiumMemberOverride: false },
      isQuickDeliveryBrand: true,
    });
    expect(result.discountReason).toBe("premium");
  });
});

describe("computePricing — milestone rewards stack on top of the discount", () => {
  it("order #6 stacks the cold-coffee reward with whatever quantity discount applies", () => {
    const result = computePricing({
      lines: [
        { unitPrice: 300, addOnPrices: [], quantity: 1, isCombo: false, category: "signature-shakes" },
        { unitPrice: 200, addOnPrices: [], quantity: 1, isCombo: false, category: "cold-coffee" },
      ],
      isLoggedIn: true,
      loyalty: { completedOrderCount: 5, isPremiumMemberOverride: false }, // this order is #6
    });

    expect(result.discountAmount).toBe(50); // 10% of 500
    expect(result.rewardAmount).toBe(100); // 50% of the 200 cold coffee
    expect(result.rewardReason).toBe("sixth-order-cold-coffee");
    expect(result.total).toBe(368); // (500-50-100)*1.05 + 0 delivery (subtotal >= 499? no, 500 >= 499 -> free)
  });

  it("order #10 gives a free drink stacked with the quantity discount", () => {
    const result = computePricing({
      lines: [
        { unitPrice: 300, addOnPrices: [], quantity: 1, isCombo: false, category: "signature-shakes" },
        { unitPrice: 150, addOnPrices: [], quantity: 1, isCombo: false, category: "cold-coffee" },
      ],
      isLoggedIn: true,
      loyalty: { completedOrderCount: 9, isPremiumMemberOverride: false }, // this order is #10
    });

    expect(result.rewardAmount).toBe(150);
    expect(result.rewardReason).toBe("tenth-order-free-drink");
  });

  it("bestPercentDiscount and rewardAmount are never conflated — total reflects both subtracted independently", () => {
    const result = computePricing({
      lines: [{ unitPrice: 1000, addOnPrices: [], quantity: 1, isCombo: false, category: "cold-coffee" }],
      isLoggedIn: true,
      loyalty: { completedOrderCount: 5, isPremiumMemberOverride: false },
    });
    // qty=1 -> 0% tier discount, but order #6 reward still applies to the cold coffee
    expect(result.discountAmount).toBe(0);
    expect(result.rewardAmount).toBe(500);
  });
});

describe("computePricing — coupon", () => {
  it("subtracts a pre-resolved coupon discount from the taxable amount", () => {
    const result = computePricing({
      lines: [{ unitPrice: 100, addOnPrices: [], quantity: 1, isCombo: false, category: "signature-shakes" }],
      isLoggedIn: false,
      loyalty: baseLoyalty,
      couponDiscountAmount: 30,
    });
    expect(result.subtotal).toBe(100);
    expect(result.couponDiscount).toBe(30);
    expect(result.tax).toBe(4); // round((100-30) * 0.05)
    expect(result.total).toBe(113); // 70 + 4 tax + 39 delivery
  });

  it("clamps the coupon so it never pushes the taxable amount below zero", () => {
    const result = computePricing({
      lines: [{ unitPrice: 50, addOnPrices: [], quantity: 1, isCombo: false, category: "signature-shakes" }],
      isLoggedIn: false,
      loyalty: baseLoyalty,
      couponDiscountAmount: 500,
    });
    expect(result.couponDiscount).toBe(50);
    expect(result.tax).toBe(0);
  });

  it("applies after the quantity-tier discount, not stacked independently of it", () => {
    const withoutCoupon = computePricing({
      lines: [{ unitPrice: 100, addOnPrices: [], quantity: 4, isCombo: false, category: "signature-shakes" }],
      isLoggedIn: false,
      loyalty: baseLoyalty,
    });
    const withCoupon = computePricing({
      lines: [{ unitPrice: 100, addOnPrices: [], quantity: 4, isCombo: false, category: "signature-shakes" }],
      isLoggedIn: false,
      loyalty: baseLoyalty,
      couponDiscountAmount: 30,
    });
    // 400 subtotal - 80 (20% tier) - 30 coupon = 290 taxable, vs 320 without the coupon
    expect(withoutCoupon.discountAmount).toBe(80);
    expect(withCoupon.discountAmount).toBe(80);
    expect(withCoupon.couponDiscount).toBe(30);
    expect(withCoupon.total).toBeLessThan(withoutCoupon.total);
  });
});
