import { Alert } from "react-native";

/**
 * Launching the actual Razorpay Checkout UI requires the react-native-razorpay
 * native SDK (an Expo Dev Client build, not Expo Go) plus real API keys — neither
 * is wired up yet (see project spec: "live Razorpay coded, never tested with real
 * keys"). This stands in as the seam where that native call goes; everything
 * around it (order creation, server-side verification) is fully wired.
 */
export async function launchRazorpayCheckoutPlaceholder(_params: {
  razorpayOrderId: string;
  amount: number;
  currency: string;
  keyId?: string;
}): Promise<{ razorpay_payment_id: string; razorpay_signature: string } | null> {
  Alert.alert("Razorpay checkout not wired up", "Real payment keys aren't configured in this environment yet.");
  return null;
}
