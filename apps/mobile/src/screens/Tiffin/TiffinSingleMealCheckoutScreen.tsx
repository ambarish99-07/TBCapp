import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Animated, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  createSingleMealOrderRequest,
  createSingleMealRazorpayOrderRequest,
  verifySingleMealRazorpayPaymentRequest,
} from "../../api/tiffin.api";
import { DeliveryDetailsForm } from "../../components/DeliveryDetailsForm";
import { DraggableSheet } from "../../components/DraggableSheet";
import { theme, type ColorPalette } from "../../constants/theme";
import { useAuthStore } from "../../state/authStore";
import { usePaymentMethodStore } from "../../state/paymentMethodStore";
import { useTheme } from "../../state/themeStore";
import { hasCompleteAddress } from "../../utils/profile";
import { launchRazorpayCheckoutPlaceholder } from "../../utils/razorpayPlaceholder";
import type { RootStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "TiffinSingleMealCheckout">;

const TIER_LABELS: Record<Props["route"]["params"]["tier"], string> = { regular: "Regular", mini: "Mini Meal", premium: "Premium" };
const MEAL_TYPE_LABELS: Record<Props["route"]["params"]["mealType"], string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner" };
const DIET_LABELS: Record<Props["route"]["params"]["dietType"], string> = { veg: "Veg", "non-veg": "Non-Veg" };
const CARB_CHOICE_LABELS: Record<"rice" | "roti", string> = { rice: "Rice", roti: "Roti" };

/** Checkout for the one-off single-meal purchase — same footer/payment/profile-popup/confirmation
 * treatment as TiffinCheckoutScreen (that screen isn't factored into shared components, so this
 * mirrors its structure rather than importing it), adapted for a single meal instead of a plan. */
export function TiffinSingleMealCheckoutScreen({ route, navigation }: Props) {
  const { tier, mealType, dietType, date, dishName, price, quantity, carbChoice, addOns } = route.params;
  const addOnsTotal = addOns.reduce((sum, addOn) => sum + addOn.price, 0);
  const totalPrice = (price + addOnsTotal) * quantity;
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const user = useAuthStore((state) => state.user);
  const selectedPaymentOption = usePaymentMethodStore((state) => state.selected);
  const [submitting, setSubmitting] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showProfileNudge, setShowProfileNudge] = useState(false);
  const nudgeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const bellRotate = useRef(new Animated.Value(0)).current;
  const profileComplete = hasCompleteAddress(user);
  const canProceed = profileComplete && !!selectedPaymentOption;

  useEffect(() => () => {
    if (nudgeTimeoutRef.current) clearTimeout(nudgeTimeoutRef.current);
  }, []);

  async function handleOrder() {
    if (!user) return;
    if (!profileComplete) {
      setShowProfileNudge(true);
      if (nudgeTimeoutRef.current) clearTimeout(nudgeTimeoutRef.current);
      nudgeTimeoutRef.current = setTimeout(() => setShowProfileNudge(false), 2000);
      return;
    }
    if (!canProceed || !selectedPaymentOption) return;
    setSubmitting(true);
    try {
      const order = await createSingleMealOrderRequest({
        tier,
        mealType,
        dietType,
        carbChoice,
        quantity,
        selectedAddOns: addOns.map((addOn) => addOn.name),
        delivery: {
          fullName: user.fullName,
          phone: user.phone!,
          address: user.address!,
          houseNumber: user.houseNumber,
          area: user.area,
          landmark: user.landmark,
          city: user.city!,
          pincode: user.pincode!,
        },
        paymentMethod: selectedPaymentOption.apiMethod,
      });

      if (selectedPaymentOption.apiMethod === "razorpay") {
        const razorpayOrder = await createSingleMealRazorpayOrderRequest(order.id);
        const paymentResult = await launchRazorpayCheckoutPlaceholder(razorpayOrder);
        if (paymentResult) {
          await verifySingleMealRazorpayPaymentRequest(order.id, {
            razorpay_order_id: razorpayOrder.razorpayOrderId,
            razorpay_payment_id: paymentResult.razorpay_payment_id,
            razorpay_signature: paymentResult.razorpay_signature,
          });
        }
      }

      setConfirmed(true);
      bellRotate.setValue(0);
      Animated.sequence([
        Animated.timing(bellRotate, { toValue: 1, duration: 100, useNativeDriver: true }),
        Animated.timing(bellRotate, { toValue: -1, duration: 100, useNativeDriver: true }),
        Animated.timing(bellRotate, { toValue: 1, duration: 100, useNativeDriver: true }),
        Animated.timing(bellRotate, { toValue: -1, duration: 100, useNativeDriver: true }),
        Animated.timing(bellRotate, { toValue: 0, duration: 100, useNativeDriver: true }),
      ]).start();
    } catch (err) {
      Alert.alert("Couldn't place order", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.summaryCard}>
          <Text style={styles.dishName}>{dishName}</Text>
          <Text style={styles.planMeta}>
            {DIET_LABELS[dietType]} · {TIER_LABELS[tier]} · {MEAL_TYPE_LABELS[mealType]} · {date}
            {carbChoice ? ` · ${CARB_CHOICE_LABELS[carbChoice]}` : ""}
          </Text>
          {addOns.length > 0 && (
            <View style={styles.addOnsRow}>
              {addOns.map((addOn) => (
                <View key={addOn.name} style={styles.addOnChip}>
                  <Text style={styles.addOnChipText}>
                    {addOn.name} +₹{addOn.price}
                  </Text>
                </View>
              ))}
            </View>
          )}
          {quantity > 1 && (
            <Text style={styles.quantityLine}>
              Qty: {quantity} × ₹{price + addOnsTotal}
            </Text>
          )}
          <Text style={styles.priceRow}>Total: ₹{totalPrice}</Text>
        </View>

        <Text style={styles.sectionTitle}>Delivery Address</Text>
        {profileComplete ? (
          <View style={styles.addressCard}>
            <Text style={styles.addressText}>{user!.fullName}</Text>
            <Text style={styles.addressText}>{user!.address}</Text>
            <Text style={styles.addressText}>
              {user!.city}, {user!.pincode}
            </Text>
            <Text style={styles.addressText}>{user!.phone}</Text>
          </View>
        ) : null}
      </ScrollView>

      {!profileComplete && (
        <Pressable style={styles.completeProfileTab} onPress={() => setShowProfileModal(true)}>
          <Text style={styles.completeProfileText}>Complete your profile to order</Text>
          <Text style={styles.completeProfileArrow}>→</Text>
        </Pressable>
      )}

      <View style={styles.actionRow}>
        <Pressable style={styles.payUsingBox} onPress={() => navigation.navigate("PaymentMethod")}>
          <Text style={styles.payUsingLabel}>Pay via</Text>
          <View style={styles.payUsingValueRow}>
            <Text style={styles.payUsingValue} numberOfLines={1}>
              {selectedPaymentOption?.label ?? "Select"}
            </Text>
            <Text style={styles.payUsingTriangle}>▾</Text>
          </View>
        </Pressable>

        <Pressable
          style={[styles.orderButton, !canProceed && styles.orderButtonDisabled]}
          onPress={handleOrder}
          disabled={submitting || (profileComplete && !canProceed)}
        >
          <Text style={styles.orderButtonText}>{submitting ? "Placing order…" : `Order Now & Pay ₹${totalPrice}`}</Text>
        </Pressable>
      </View>

      {showProfileNudge && (
        <View style={styles.profileNudgeOverlay} pointerEvents="none">
          <View style={styles.profileNudgeBubble}>
            <Text style={styles.profileNudgeText}>Complete your profile to order</Text>
          </View>
        </View>
      )}

      {confirmed && (
        <View style={[styles.confirmedOverlay, { backgroundColor: colors.background }]}>
          <Animated.View
            style={{
              transform: [{ rotate: bellRotate.interpolate({ inputRange: [-1, 1], outputRange: ["-18deg", "18deg"] }) }],
            }}
          >
            <Text style={styles.confirmedEmoji}>🔔</Text>
          </Animated.View>
          <Text style={styles.confirmedText}>Meal Ordered</Text>
        </View>
      )}

      <Modal visible={showProfileModal} animationType="slide" transparent onRequestClose={() => setShowProfileModal(false)}>
        <Pressable style={styles.overlay} onPress={() => setShowProfileModal(false)}>
          <DraggableSheet onDismiss={() => setShowProfileModal(false)} sheetStyle={styles.sheet}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.sheetTitle}>Complete your profile</Text>
              <Text style={styles.sheetSubtitle}>Add a delivery address once — repeat orders skip straight to payment.</Text>
              <DeliveryDetailsForm onSaved={() => setShowProfileModal(false)} submitLabel="Save & Continue" />
            </ScrollView>
          </DraggableSheet>
        </Pressable>
      </Modal>
    </View>
  );
}

const makeStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { padding: theme.spacing(2), paddingBottom: theme.spacing(4) },
    summaryCard: { backgroundColor: colors.surface, borderRadius: theme.radius, padding: theme.spacing(2) },
    dishName: { fontSize: 17, fontWeight: "800", color: colors.text },
    planMeta: { fontSize: 12, color: colors.muted, marginTop: 4 },
    addOnsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: theme.spacing(1) },
    addOnChip: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
    addOnChipText: { fontSize: 12, fontWeight: "700", color: colors.text },
    quantityLine: { fontSize: 13, color: colors.muted, marginTop: theme.spacing(1) },
    priceRow: { fontSize: 16, fontWeight: "800", color: colors.primary, marginTop: 4 },
    sectionTitle: { fontSize: 14, fontWeight: "700", color: colors.text, marginTop: theme.spacing(2.5), marginBottom: theme.spacing(1) },
    addressCard: { backgroundColor: colors.surface, borderRadius: theme.radius, padding: theme.spacing(1.5) },
    addressText: { fontSize: 13, color: colors.text, marginTop: 2 },
    completeProfileTab: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: theme.radius,
      padding: theme.spacing(1.5),
      marginHorizontal: theme.spacing(2),
      marginTop: theme.spacing(1),
    },
    completeProfileText: { flex: 1, fontSize: 12, fontWeight: "700", color: colors.primary },
    completeProfileArrow: { fontSize: 16, fontWeight: "800", color: colors.primary, marginLeft: 8 },
    actionRow: {
      flexDirection: "row",
      gap: theme.spacing(1),
      padding: theme.spacing(2),
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    payUsingBox: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: theme.radius,
      paddingHorizontal: theme.spacing(1.5),
      paddingVertical: theme.spacing(1),
      justifyContent: "center",
    },
    payUsingLabel: { fontSize: 12, fontWeight: "700", color: colors.text },
    payUsingValueRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
    payUsingValue: { flexShrink: 1, fontSize: 13, color: colors.muted },
    payUsingTriangle: { fontSize: 12, color: colors.muted },
    orderButton: {
      flex: 1,
      backgroundColor: colors.primary,
      borderRadius: theme.radius,
      alignItems: "center",
      justifyContent: "center",
    },
    orderButtonDisabled: { opacity: 0.5 },
    orderButtonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
    profileNudgeOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: "center",
      justifyContent: "center",
    },
    profileNudgeBubble: {
      backgroundColor: "rgba(0,0,0,0.85)",
      borderRadius: theme.radius,
      paddingHorizontal: theme.spacing(2),
      paddingVertical: theme.spacing(1.5),
      maxWidth: "80%",
    },
    profileNudgeText: { color: "#fff", fontSize: 14, fontWeight: "700", textAlign: "center" },
    confirmedOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: "center",
      justifyContent: "center",
    },
    confirmedEmoji: { fontSize: 72, marginBottom: theme.spacing(1.5) },
    confirmedText: { fontSize: 24, fontWeight: "800", color: colors.primary },
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    sheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: theme.radius,
      borderTopRightRadius: theme.radius,
      padding: theme.spacing(2),
      maxHeight: "85%",
    },
    sheetTitle: { fontSize: 17, fontWeight: "800", color: colors.text },
    sheetSubtitle: { fontSize: 12, color: colors.muted, marginTop: 4, marginBottom: theme.spacing(1.5) },
  });
