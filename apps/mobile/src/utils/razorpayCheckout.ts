import type { RazorpayErrorResult, RazorpaySuccessResult } from "react-native-razorpay";

/**
 * Thrown when the customer backs out of the Razorpay sheet themselves (vs. a real failure) —
 * callers can catch this specifically to show a softer "payment cancelled" message, or just let
 * it fall through to the same generic catch every checkout screen already has.
 */
export class RazorpayCancelledError extends Error {
  constructor() {
    super("Payment was cancelled");
    this.name = "RazorpayCancelledError";
  }
}

/**
 * Opens the real Razorpay Checkout sheet (react-native-razorpay's native SDK) and resolves with
 * the payment fields the server's /razorpay/*-verify endpoints need, or throws — never returns
 * null.
 *
 * The `require` below is deliberately deferred to call time, not a static top-level import.
 * react-native-razorpay constructs a NativeEventEmitter at module-load time, which throws
 * immediately if the native module isn't linked — true the moment this runs under Expo Go
 * (no third-party native modules are ever linked there; only a Dev Client build has this one).
 * A static import would make that crash happen on *app launch*, for every screen, before anyone
 * even touches a payment method. Deferring it here means the rest of the app keeps working
 * normally under Expo Go during the switch-over, and only an actual Razorpay attempt hits this
 * (with a caught, friendly error) until a Dev Client build is running.
 */
export async function launchRazorpayCheckout(params: {
  razorpayOrderId: string;
  amount: number;
  currency: string;
  keyId?: string;
  /** Shown as the payee name in the checkout sheet — defaults to the Lickyeat brand name. */
  name?: string;
  /** e.g. "TBC order #1234" — shown under the amount in the checkout sheet. */
  description?: string;
  prefill?: { email?: string; phone?: string; fullName?: string };
}): Promise<RazorpaySuccessResult> {
  if (!params.keyId) {
    // Mirrors the server's own RazorpayNotConfiguredError — this is the expected state until
    // real keys are set in apps/api/.env, not a bug.
    throw new Error("Online payments aren't set up yet — try Cash on Delivery instead.");
  }

  let RazorpayCheckout: typeof import("react-native-razorpay").default;
  try {
    // Throws synchronously right here (not later, inside .open()) when the native module isn't
    // linked — react-native-razorpay constructs a NativeEventEmitter at its own module's top
    // level, and RN's NativeEventEmitter throws immediately if given a null native module.
    // eslint-disable-next-line @typescript-eslint/no-var-requires -- see the doc comment above.
    RazorpayCheckout = require("react-native-razorpay").default;
  } catch {
    throw new Error("Online payments need the full app build (not the preview app) — try Cash on Delivery for now.");
  }

  try {
    return await RazorpayCheckout.open({
      key: params.keyId,
      order_id: params.razorpayOrderId,
      amount: params.amount,
      currency: params.currency,
      name: params.name ?? "Lickyeat",
      description: params.description,
      theme: { color: "#2E9BFF" },
      prefill: {
        email: params.prefill?.email,
        contact: params.prefill?.phone,
        name: params.prefill?.fullName,
      },
    });
  } catch (err) {
    const result = err as RazorpayErrorResult;
    const description = result.description ?? result.error?.description ?? result.error?.reason ?? "";
    const code = result.code ?? result.error?.code;
    // Android's SDK rejects with code "0" (sometimes numeric 0) when the customer dismisses the
    // sheet themselves — everything else is a genuine failure (declined card, network drop, ...).
    if (String(code) === "0" || /cancel/i.test(description)) {
      throw new RazorpayCancelledError();
    }
    throw new Error(description || "Payment failed — please try again.");
  }
}
