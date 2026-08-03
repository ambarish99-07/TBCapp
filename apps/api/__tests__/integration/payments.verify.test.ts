import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyRazorpaySignature } from "../../src/modules/payments/verifySignature.js";

describe("verifyRazorpaySignature", () => {
  const secret = "test_secret_key";
  const orderId = "order_ABC123";
  const paymentId = "pay_XYZ789";

  it("accepts a correctly computed signature (known vector)", () => {
    const validSignature = createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
    expect(verifyRazorpaySignature(orderId, paymentId, validSignature, secret)).toBe(true);
  });

  it("rejects a signature computed with the wrong secret", () => {
    const wrongSecretSignature = createHmac("sha256", "wrong_secret").update(`${orderId}|${paymentId}`).digest("hex");
    expect(verifyRazorpaySignature(orderId, paymentId, wrongSecretSignature, secret)).toBe(false);
  });

  it("rejects a signature for a tampered payment id — never trusts the client's own success callback", () => {
    const signatureForDifferentPayment = createHmac("sha256", secret)
      .update(`${orderId}|pay_DIFFERENT`)
      .digest("hex");
    expect(verifyRazorpaySignature(orderId, paymentId, signatureForDifferentPayment, secret)).toBe(false);
  });

  it("rejects a malformed/short signature without throwing", () => {
    expect(verifyRazorpaySignature(orderId, paymentId, "not-a-real-signature", secret)).toBe(false);
  });
});
