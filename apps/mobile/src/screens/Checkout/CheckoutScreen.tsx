import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { PaymentMethod, SavedRecipient } from "@tbc/shared-types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { createOrderRequest } from "../../api/orders.api";
import { createRazorpayOrderRequest, verifyRazorpayPaymentRequest } from "../../api/payments.api";
import { createSavedRecipient, deleteSavedRecipient, fetchSavedRecipients } from "../../api/recipients.api";
import { PriceBreakdown } from "../../components/PriceBreakdown";
import { SavedRecipientPicker } from "../../components/SavedRecipientPicker";
import { theme } from "../../constants/theme";
import { useAuthStore } from "../../state/authStore";
import { useCartStore } from "../../state/cartStore";
import { useAuthContext } from "../../state/useAuthContext";
import type { RootStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Checkout">;
type DeliveryFor = "self" | "recipient";

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

const emptyRecipientFields = {
  fullName: "",
  phone: "",
  houseNumber: "",
  area: "",
  address: "",
  landmark: "",
  city: "Patna",
  pincode: "",
  specialInstructions: "",
};

export function CheckoutScreen({ navigation }: Props) {
  const lines = useCartStore((state) => state.lines);
  const computeTotals = useCartStore((state) => state.computeTotals);
  const clearCart = useCartStore((state) => state.clear);
  const auth = useAuthContext();
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();

  const [deliveryFor, setDeliveryFor] = useState<DeliveryFor>("self");
  const [fields, setFields] = useState(() => ({
    ...emptyRecipientFields,
    fullName: user?.fullName ?? "",
    phone: user?.phone ?? "",
  }));
  const [distanceFromShopKm, setDistanceFromShopKm] = useState("");
  const [selectedRecipientId, setSelectedRecipientId] = useState<string | null>(null);
  const [saveRecipient, setSaveRecipient] = useState(false);
  const [recipientLabel, setRecipientLabel] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cod");
  const [submitting, setSubmitting] = useState(false);

  const { data: savedRecipients } = useQuery({
    queryKey: ["saved-recipients"],
    queryFn: fetchSavedRecipients,
    enabled: deliveryFor === "recipient",
  });

  const parsedDistanceKm = distanceFromShopKm.trim() === "" ? null : Number(distanceFromShopKm);
  const result = computeTotals({ ...auth, distanceFromShopKm: parsedDistanceKm });

  function setField<K extends keyof typeof fields>(key: K, value: (typeof fields)[K]) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  function handleChooseDeliverToMyself() {
    setDeliveryFor("self");
    setSelectedRecipientId(null);
    setFields({ ...emptyRecipientFields, fullName: user?.fullName ?? "", phone: user?.phone ?? "" });
  }

  function handleChooseSomeoneElse() {
    setDeliveryFor("recipient");
    setSelectedRecipientId(null);
    setFields(emptyRecipientFields);
  }

  function handleSelectSavedRecipient(recipient: SavedRecipient) {
    setSelectedRecipientId(recipient.id);
    setFields({
      fullName: recipient.fullName,
      phone: recipient.phone,
      houseNumber: recipient.houseNumber ?? "",
      area: recipient.area ?? "",
      address: recipient.address,
      landmark: recipient.landmark ?? "",
      city: recipient.city,
      pincode: recipient.pincode,
      specialInstructions: recipient.specialInstructions ?? "",
    });
    setSaveRecipient(false);
  }

  async function handleDeleteSavedRecipient(id: string) {
    if (selectedRecipientId === id) {
      setSelectedRecipientId(null);
      setFields(emptyRecipientFields);
    }
    try {
      await deleteSavedRecipient(id);
      queryClient.invalidateQueries({ queryKey: ["saved-recipients"] });
    } catch {
      Alert.alert("Couldn't remove", "Please try again.");
    }
  }

  async function handlePlaceOrder() {
    if (!fields.fullName || !fields.phone || !fields.address || !fields.city || !fields.pincode) {
      Alert.alert("Missing details", "Please fill in all delivery fields.");
      return;
    }

    setSubmitting(true);
    try {
      const delivery = {
        fullName: fields.fullName,
        phone: fields.phone,
        address: fields.address,
        houseNumber: fields.houseNumber || undefined,
        area: fields.area || undefined,
        landmark: fields.landmark || undefined,
        city: fields.city,
        pincode: fields.pincode,
        specialInstructions: fields.specialInstructions || undefined,
        distanceFromShopKm: parsedDistanceKm != null && !Number.isNaN(parsedDistanceKm) ? parsedDistanceKm : undefined,
      };

      const order = await createOrderRequest({
        items: lines.map((line) => ({
          lineId: line.lineId,
          menuItemId: line.menuItemId,
          quantity: line.quantity,
          customization: { sugarLevel: line.sugarLevel, iceLevel: line.iceLevel, addOnIds: line.addOnIds },
        })),
        delivery,
        deliveryFor,
        paymentMethod,
      });

      if (deliveryFor === "recipient" && saveRecipient && recipientLabel.trim()) {
        // Best-effort — a saved-recipient failure shouldn't block an order that already succeeded.
        createSavedRecipient({ ...delivery, label: recipientLabel.trim() }).catch(() => {});
      }

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
      navigation.replace("OrderStatus", { accessToken: order.accessToken });
    } catch (err) {
      Alert.alert("Couldn't place order", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView style={styles.screen}>
      <Text style={styles.sectionTitle}>📍 Deliver To</Text>
      <View style={styles.paymentRow}>
        <Pressable style={[styles.paymentOption, deliveryFor === "self" && styles.paymentOptionActive]} onPress={handleChooseDeliverToMyself}>
          <Text style={[styles.paymentText, deliveryFor === "self" && styles.paymentTextActive]}>My Address</Text>
        </Pressable>
        <Pressable style={[styles.paymentOption, deliveryFor === "recipient" && styles.paymentOptionActive]} onPress={handleChooseSomeoneElse}>
          <Text style={[styles.paymentText, deliveryFor === "recipient" && styles.paymentTextActive]}>Someone Else</Text>
        </Pressable>
      </View>

      {deliveryFor === "recipient" && (
        <>
          <Text style={styles.helperText}>The recipient can be anywhere in {fields.city || "our delivery city"} — it doesn't need to match your own address.</Text>
          {savedRecipients && savedRecipients.length > 0 && (
            <SavedRecipientPicker
              recipients={savedRecipients}
              selectedId={selectedRecipientId}
              onSelect={handleSelectSavedRecipient}
              onAddNew={() => {
                setSelectedRecipientId(null);
                setFields(emptyRecipientFields);
              }}
              onDelete={handleDeleteSavedRecipient}
            />
          )}
        </>
      )}

      <Text style={styles.sectionTitle}>{deliveryFor === "recipient" ? "Recipient Details" : "Delivery Details"}</Text>
      <TextInput style={styles.input} placeholder="Full name" value={fields.fullName} onChangeText={(v) => setField("fullName", v)} />
      <TextInput
        style={styles.input}
        placeholder="Phone number"
        value={fields.phone}
        onChangeText={(v) => setField("phone", v)}
        keyboardType="phone-pad"
      />
      <TextInput
        style={styles.input}
        placeholder="House / Flat / Building number"
        value={fields.houseNumber}
        onChangeText={(v) => setField("houseNumber", v)}
      />
      <TextInput style={styles.input} placeholder="Area / Locality" value={fields.area} onChangeText={(v) => setField("area", v)} />
      <TextInput style={styles.input} placeholder="Address" value={fields.address} onChangeText={(v) => setField("address", v)} multiline />
      <TextInput style={styles.input} placeholder="Landmark" value={fields.landmark} onChangeText={(v) => setField("landmark", v)} />
      <TextInput style={styles.input} placeholder="City" value={fields.city} onChangeText={(v) => setField("city", v)} />
      <TextInput
        style={styles.input}
        placeholder="Pincode"
        value={fields.pincode}
        onChangeText={(v) => setField("pincode", v)}
        keyboardType="number-pad"
      />
      <TextInput
        style={styles.input}
        placeholder="Delivery instructions (optional)"
        value={fields.specialInstructions}
        onChangeText={(v) => setField("specialInstructions", v)}
        multiline
      />
      <TextInput
        style={styles.input}
        placeholder="Distance from shop (km)"
        value={distanceFromShopKm}
        onChangeText={setDistanceFromShopKm}
        keyboardType="decimal-pad"
      />
      <Text style={styles.helperText}>Premium members get free delivery within 4km.</Text>

      {deliveryFor === "recipient" && !selectedRecipientId && (
        <View style={styles.saveRow}>
          <Text style={styles.saveLabel}>Save this recipient for next time</Text>
          <Switch value={saveRecipient} onValueChange={setSaveRecipient} />
        </View>
      )}
      {deliveryFor === "recipient" && !selectedRecipientId && saveRecipient && (
        <TextInput
          style={styles.input}
          placeholder='Label (e.g. "Mom", "Office")'
          value={recipientLabel}
          onChangeText={setRecipientLabel}
        />
      )}

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
        <Text style={styles.submitButtonText}>
          {submitting
            ? "Placing order…"
            : deliveryFor === "recipient" && fields.fullName
              ? `Place Order for ${fields.fullName} · ₹${result.total}`
              : `Place Order · ₹${result.total}`}
        </Text>
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
  saveRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius,
    padding: theme.spacing(1.25),
    marginBottom: theme.spacing(1),
  },
  saveLabel: { fontSize: 13, color: theme.colors.text, fontWeight: "600" },
  submitButton: { backgroundColor: theme.colors.primary, borderRadius: theme.radius, padding: theme.spacing(2), alignItems: "center", marginVertical: theme.spacing(3) },
  submitButtonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
