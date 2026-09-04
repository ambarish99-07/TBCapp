/** react-native-razorpay ships no type declarations of its own (see its package.json — no
 * "types" field) — this covers only the surface this app actually calls. */
declare module "react-native-razorpay" {
  export interface RazorpayCheckoutOptions {
    key: string;
    order_id: string;
    amount: number;
    currency: string;
    name: string;
    description?: string;
    image?: string;
    theme?: { color?: string };
    prefill?: { email?: string; contact?: string; name?: string };
  }

  export interface RazorpaySuccessResult {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }

  /** Rejects with this shape on cancellation or failure — `code` is a Razorpay-defined string
   * (e.g. "0" for user-cancelled on Android), `description` a human-readable reason. */
  export interface RazorpayErrorResult {
    code?: string | number;
    description?: string;
    error?: { code?: string | number; description?: string; reason?: string };
  }

  const RazorpayCheckout: {
    open(options: RazorpayCheckoutOptions): Promise<RazorpaySuccessResult>;
  };
  export default RazorpayCheckout;
}
