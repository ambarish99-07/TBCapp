import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * The ONE place in the codebase allowed to determine whether a Razorpay payment
 * is genuinely verified. Recomputes the expected signature independently — never
 * trusts the client's own "it succeeded" callback — and uses a constant-time
 * comparison so a mismatch can't be timed to leak information about the correct
 * signature.
 */
export function verifyRazorpaySignature(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  signature: string,
  secret: string
): boolean {
  const expected = createHmac("sha256", secret).update(`${razorpayOrderId}|${razorpayPaymentId}`).digest("hex");

  const expectedBuffer = Buffer.from(expected, "utf8");
  const providedBuffer = Buffer.from(signature, "utf8");

  if (expectedBuffer.length !== providedBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, providedBuffer);
}
