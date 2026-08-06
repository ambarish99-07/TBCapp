import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { PaymentMethod } from "@tbc/shared-types";
import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { createOrderRequest } from "../../api/orders.api";
import { createRazorpayOrderRequest, verifyRazorpayPaymentRequest } from "../../api/payments.api";
import { PriceBreakdown } from "../../components/PriceBreakdown";
import { theme } from "../../constants/theme";
import { useCartStore } from "../../state/cartStore";
import { useAuthContext } from "../../state/useAuthContext";
import type { RootStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Checkout">;

/**
 * Launching the actual Razorpay Checkout UI requires the react-native-razorpay
 * native SDK (an Expo Dev Client build, not Expo Go) plus real API keys — neither
 * is wired up yet (see project spec: "live Razorpay coded, never tested with real
 * keys"). This stands in as the seam where that native call goes; everything
 * around it (order creation, server-side verification) is fully wired.
 */
async function launchRazorpayCheckoutPlaceholder(_params: {
  razorpayOrderId: string;
  amount: number;
  currency: string;
  keyId?: string;
}): Promise<{ razorpay_payment_id: string; razorpay_signature: string } | null> {
  Alert.alert("Razorpay checkout not wired up", "Real payment keys aren't configured in this environment yet.");
  return null;
}

export function CheckoutScreen({ navigation }: Props) {
  const lines = useCartStore((state) => state.lines);
  const computeTotals = useCartStore((state) => state.computeTotals);
  const clearCart = useCartStore((state) => state.clear);
  const auth = useAuthContext();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("Patna");
  const [pincode, setPincode] = useState("");
  const [distanceFromShopKm, setDistanceFromShopKm] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cod");
  const [submitting, setSubmitting] = useState(false);

  const parsedDistanceKm = distanceFromShopKm.trim() === "" ? null : Number(distanceFromShopKm);
  const result = computeTotals({ ...auth, distanceFromShopKm: parsedDistanceKm });

  async function handlePlaceOrder() {
    if (!fullName || !phone || !address || !city || !pincode) {
      Alert.alert("Missing details", "Please fill in all delivery fields.");
      return;
    }

    setSubmitting(true);
    try {
      const order = await createOrderRequest({
        items: lines.map((line) => ({
          lineId: line.lineId,
          menuItemId: line.menuItemId,
          quantity: line.quantity,
          customization: { sugarLevel: line.sugarLevel, iceLevel: line.iceLevel, addOnIds: line.addOnIds },
        })),
        delivery: {
          fullName,
          phone,
          address,
          city,
          pincode,
          distanceFromShopKm: parsedDistanceKm != null && !Number.isNaN(parsedDistanceKm) ? parsedDistanceKm : undefined,
        },
        paymentMethod,
      });

      if (paymentMethod === "razorpay") {
        const razorpayOrder = await createRazorpayOrderRequest(order.id, order.accessToken);
        const paymentResult = await launchRazorpayCheckoutPlaceholder(razorpayOrder);
        if (paymentResult) {
          await verifyRazorpayPaymentRequest({
            orderId: order.id,
            accessToken: order.accessToken,
            razorpay_order_id: razorpayOrder.razorpayOrderId,
            razorpay_payment_id: paymentResult.razorpay_payment_id,
            razorpay_signature: paymentResult.razorpay_signature,
          });
        }
      }

      clearCart();
      navigation.replace("OrderStatus", { orderId: order.id });
    } catch (err) {
      Alert.alert("Couldn't place order", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView style={styles.screen}>
      <Text style={styles.sectionTitle}>Delivery Details</Text>
      <TextInput style={styles.input} placeholder="Full name" value={fullName} onChangeText={setFullName} />
      <TextInput style={styles.input} placeholder="Phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <TextInput style={styles.input} placeholder="Address" value={address} onChangeText={setAddress} multiline />
      <TextInput style={styles.input} placeholder="City" value={city} onChangeText={setCity} />
      <TextInput style={styles.input} placeholder="Pincode" value={pincode} onChangeText={setPincode} keyboardType="number-pad" />
      <TextInput
        style={styles.input}
        placeholder="Distance from shop (km)"
        value={distanceFromShopKm}
        onChangeText={setDistanceFromShopKm}
        keyboardType="decimal-pad"
      />
      <Text style={styles.helperText}>Premium members get free delivery within 4km.</Text>

      <Text style={styles.sectionTitle}>Payment Method</Text>
      <View style={styles.paymentRow}>
        <Pressable style={[styles.paymentOption, paymentMethod === "cod" && styles.paymentOptionActive]} onPress={() => setPaymentMethod("cod")}>
          <Text style={[styles.paymentText, paymentMethod === "cod" && styles.paymentTextActive]}>Pay on Delivery</Text>
        </Pressable>
        <Pressable style={[styles.paymentOption, paymentMethod === "razorpay" && styles.paymentOptionActive]} onPress={() => setPaymentMethod("razorpay")}>
          <Text style={[styles.paymentText, paymentMethod === "razorpay" && styles.paymentTextActive]}>Pay Online</Text>
        </Pressable>
      </View>

      <PriceBreakdown result={result} />

      <Pressable style={styles.submitButton} onPress={handlePlaceOrder} disabled={submitting}>
        <Text style={styles.submitButtonText}>{submitting ? "Placing order…" : `Place Order · ₹${result.total}`}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background, padding: theme.spacing(2) },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: theme.colors.text, marginTop: theme.spacing(2), marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius,
    padding: theme.spacing(1.25),
    marginBottom: theme.spacing(1),
  },
  helperText: { fontSize: 11, color: theme.colors.muted, marginBottom: theme.spacing(1) },
  paymentRow: { flexDirection: "row", gap: 8, marginBottom: theme.spacing(2) },
  paymentOption: { flex: 1, padding: theme.spacing(1.5), borderRadius: theme.radius, backgroundColor: theme.colors.surface, alignItems: "center" },
  paymentOptionActive: { backgroundColor: theme.colors.primary },
  paymentText: { color: theme.colors.text, fontWeight: "600" },
  paymentTextActive: { color: "#fff" },
  submitButton: { backgroundColor: theme.colors.primary, borderRadius: theme.radius, padding: theme.spacing(2), alignItems: "center", marginVertical: theme.spacing(3) },
  submitButtonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
