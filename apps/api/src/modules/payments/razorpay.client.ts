import Razorpay from "razorpay";
import type { Env } from "../../config/env.js";

export class RazorpayNotConfiguredError extends Error {}

export function getRazorpayClient(env: Env): Razorpay {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    throw new RazorpayNotConfiguredError("Razorpay credentials are not configured");
  }
  return new Razorpay({ key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_KEY_SECRET });
}

export async function createRazorpayOrder(env: Env, amountInRupees: number, receipt: string) {
  const client = getRazorpayClient(env);
  return client.orders.create({
    amount: Math.round(amountInRupees * 100), // Razorpay expects the smallest currency unit (paise)
    currency: "INR",
    receipt,
  });
}
