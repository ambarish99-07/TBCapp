import { describe, expect, it } from "vitest";
import { CreateOrderRequestSchema, isComboLineId, makeComboLineId, MenuItemSchema } from "../src/index.js";

describe("MenuItemSchema", () => {
  it("accepts a valid menu item", () => {
    const result = MenuItemSchema.safeParse({
      id: "choco-crush",
      brandId: "tbc",
      signatureName: "Choco Crush",
      commonName: "Rich Chocolate Shake",
      description: "A rich, indulgent chocolate shake.",
      price: 220,
      category: "signature-shakes",
      image: "https://example.com/choco-crush.jpg",
      flavorBadges: ["Chocolate Lover"],
      pairsWith: ["oreo-blast"],
    });
    expect(result.success).toBe(true);
  });
});

describe("combo line id helpers", () => {
  it("round-trips through makeComboLineId/isComboLineId", () => {
    const id = makeComboLineId("choose-2-for-379", "abc123");
    expect(isComboLineId(id)).toBe(true);
    expect(isComboLineId("choco-crush")).toBe(false);
  });
});

describe("CreateOrderRequestSchema", () => {
  it("rejects a cart line carrying a client-submitted price field", () => {
    const result = CreateOrderRequestSchema.safeParse({
      items: [
        {
          lineId: "l1",
          menuItemId: "choco-crush",
          unitPrice: 1, // tampered — not part of the schema, must be stripped/rejected
          quantity: 1,
          customization: { sugarLevel: "regular", iceLevel: "regular", addOnIds: [] },
        },
      ],
      brandId: "tbc",
      delivery: {
        fullName: "Test User",
        phone: "9999999999",
        address: "123 Test St",
        city: "Patna",
        pincode: "800001",
      },
      deliveryFor: "self",
      paymentMethod: "cod",
    });

    expect(result.success).toBe(true);
    // The parsed/stripped output must not carry the tampered price through.
    expect((result.data?.items[0] as Record<string, unknown>).unitPrice).toBeUndefined();
  });

  it("rejects more than the max line-item cap", () => {
    const line = {
      lineId: "l1",
      menuItemId: "choco-crush",
      quantity: 1,
      customization: { sugarLevel: "regular", iceLevel: "regular", addOnIds: [] },
    };
    const result = CreateOrderRequestSchema.safeParse({
      items: Array.from({ length: 51 }, (_, i) => ({ ...line, lineId: `l${i}` })),
      delivery: {
        fullName: "Test User",
        phone: "9999999999",
        address: "123 Test St",
        city: "Patna",
        pincode: "800001",
      },
      paymentMethod: "cod",
    });
    expect(result.success).toBe(false);
  });
});
