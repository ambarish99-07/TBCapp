import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { TIFFIN_PLAN_DURATIONS, type TiffinMealType, type TiffinPlanStyle } from "@tbc/shared-types";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Animated, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  createTiffinRazorpayOrderRequest,
  createTiffinSubscriptionRequest,
  useTiffinPlans,
  verifyTiffinRazorpayPaymentRequest,
} from "../../api/tiffin.api";
import { DeliveryDetailsForm } from "../../components/DeliveryDetailsForm";
import { DraggableSheet } from "../../components/DraggableSheet";
import { theme, type ColorPalette } from "../../constants/theme";
import { useAuthStore } from "../../state/authStore";
import { usePaymentMethodStore } from "../../state/paymentMethodStore";
import { useTheme } from "../../state/themeStore";
import { hasCompleteAddress } from "../../utils/profile";
import { launchRazorpayCheckout } from "../../utils/razorpayCheckout";
import { effectivePlanPrice } from "../../utils/tiffinPlanPrice";
import type { RootStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "TiffinCheckout">;

const BELL_RING_DURATION_MS = 1000;

const MEAL_TYPE_LABELS: Record<TiffinMealType, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner" };

function styleMetaLabel(style: TiffinPlanStyle, mealType: TiffinMealType | undefined): string {
  if (style === "twice-daily") return "Lunch & Dinner";
  if (style === "thrice-daily") return "Breakfast, Lunch & Dinner";
  return MEAL_TYPE_LABELS[mealType ?? "lunch"];
}

/** Payment method is picked on the shared PaymentMethodScreen (same picker CartScreen uses) and
 * persisted in usePaymentMethodStore, so it carries over untouched to the next order. A first-time
 * subscriber (no saved address) sees a "Complete your profile" tab above the footer — tapping it
 * opens the popup; repeat customers already have an address and never see the tab. */
export function TiffinCheckoutScreen({ route, navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { data: plans } = useTiffinPlans();
  const plan = plans?.find((p) => p.id === route.params.planId);
  const user = useAuthStore((state) => state.user);
  const selectedPaymentOption = usePaymentMethodStore((state) => state.selected);
  const [submitting, setSubmitting] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showProfileNudge, setShowProfileNudge] = useState(false);
  const nudgeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // "Tiffin Subscribed" + ringing bell shows first, on its own, for a second — the "View My
  // Tiffin" tab only fades in below it once that beat has played out, same idea as the Cart
  // screen's full-screen "Order Placed" confirmation but not auto-navigating away.
  const [confirmed, setConfirmed] = useState(false);
  const [showViewTiffin, setShowViewTiffin] = useState(false);
  const bellRotate = useRef(new Animated.Value(0)).current;
  const viewTiffinTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const profileComplete = hasCompleteAddress(user);
  const isMonthly = plan?.durationDays === TIFFIN_PLAN_DURATIONS.monthly;
  const codBlocked = isMonthly && selectedPaymentOption?.apiMethod === "cod";
  const canProceed = profileComplete && !!selectedPaymentOption && !codBlocked;

  useEffect(() => () => {
    if (nudgeTimeoutRef.current) clearTimeout(nudgeTimeoutRef.current);
    if (viewTiffinTimeoutRef.current) clearTimeout(viewTiffinTimeoutRef.current);
  }, []);

  async function handleSubscribe() {
    if (!plan || !user) return;
    // Tapping while the profile is incomplete doesn't fail silently — it briefly points the
    // customer at the "Complete your profile" tab above, which opens the popup.
    if (!profileComplete) {
      setShowProfileNudge(true);
      if (nudgeTimeoutRef.current) clearTimeout(nudgeTimeoutRef.current);
      nudgeTimeoutRef.current = setTimeout(() => setShowProfileNudge(false), 2000);
      return;
    }
    if (!canProceed || !selectedPaymentOption) return;
    setSubmitting(true);
    try {
      const subscription = await createTiffinSubscriptionRequest({
        planId: plan.id,
        mealType: route.params.mealType,
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
        const razorpayOrder = await createTiffinRazorpayOrderRequest(subscription.id);
        const paymentResult = await launchRazorpayCheckout({
          ...razorpayOrder,
          description: `Tiffin plan #${subscription.subscriptionNumber}`,
          prefill: { email: user.email, phone: user.phone, fullName: user.fullName },
        });
        await verifyTiffinRazorpayPaymentRequest(subscription.id, {
          razorpay_order_id: razorpayOrder.razorpayOrderId,
          razorpay_payment_id: paymentResult.razorpay_payment_id,
          razorpay_signature: paymentResult.razorpay_signature,
        });
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
      viewTiffinTimeoutRef.current = setTimeout(() => setShowViewTiffin(true), BELL_RING_DURATION_MS);
    } catch (err) {
      Alert.alert("Couldn't subscribe", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!plan) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.summaryCard}>
          <Text style={styles.planName}>{plan.name}</Text>
          <Text style={styles.planMeta}>
            {plan.dietType === "veg" ? "Veg" : "Non-Veg"} · {plan.durationDays} days · {styleMetaLabel(plan.style, route.params.mealType)}
          </Text>
          {plan.salePercent ? (
            <View style={styles.priceRowWithSale}>
              <Text style={styles.priceStrikethrough}>₹{plan.price}</Text>
              <Text style={styles.priceRow}>Total: ₹{effectivePlanPrice(plan)}</Text>
              <View style={styles.saleBadge}>
                <Text style={styles.saleBadgeText}>{plan.salePercent}% OFF</Text>
              </View>
            </View>
          ) : (
            <Text style={styles.priceRow}>Total: ₹{plan.price}</Text>
          )}
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
          <Text style={styles.completeProfileText}>Complete your profile to subscribe</Text>
          <Text style={styles.completeProfileArrow}>→</Text>
        </Pressable>
      )}

      {codBlocked && (
        <Text style={styles.codBlockedNotice}>Cash on Delivery isn't available for monthly plans — please choose another payment method.</Text>
      )}

      <View style={styles.actionRow}>
        <Pressable style={styles.payUsingBox} onPress={() => navigation.navigate("PaymentMethod", { hideCod: isMonthly })}>
          <Text style={styles.payUsingLabel}>Pay via</Text>
          <View style={styles.payUsingValueRow}>
            <Text style={styles.payUsingValue} numberOfLines={1}>
              {selectedPaymentOption?.label ?? "Select"}
            </Text>
            <Text style={styles.payUsingTriangle}>▾</Text>
          </View>
        </Pressable>

        <Pressable
          style={[styles.subscribeButton, !canProceed && styles.subscribeButtonDisabled]}
          onPress={handleSubscribe}
          disabled={submitting || (profileComplete && !canProceed)}
        >
          <Text style={styles.subscribeButtonText}>{submitting ? "Subscribing…" : `Subscribe & Pay ₹${effectivePlanPrice(plan)}`}</Text>
        </Pressable>
      </View>

      {showProfileNudge && (
        <View style={styles.profileNudgeOverlay} pointerEvents="none">
          <View style={styles.profileNudgeBubble}>
            <Text style={styles.profileNudgeText}>Complete your profile to subscribe</Text>
          </View>
        </View>
      )}

      {confirmed && (
        <View style={[styles.confirmedOverlay, { backgroundColor: colors.background }]}>
          <Animated.View
            style={{
              transform: [
                {
                  rotate: bellRotate.interpolate({ inputRange: [-1, 1], outputRange: ["-18deg", "18deg"] }),
                },
              ],
            }}
          >
            <Text style={styles.confirmedEmoji}>🔔</Text>
          </Animated.View>
          <Text style={styles.confirmedText}>Tiffin Subscribed</Text>

          {showViewTiffin && (
            <Pressable style={styles.viewTiffinTab} onPress={() => navigation.replace("MyTiffin")}>
              <Text style={styles.viewTiffinText}>View My Tiffin</Text>
              <Text style={styles.viewTiffinArrow}>→</Text>
            </Pressable>
          )}
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
    centered: { alignItems: "center", justifyContent: "center" },
    content: { padding: theme.spacing(2), paddingBottom: theme.spacing(4) },
    summaryCard: { backgroundColor: colors.surface, borderRadius: theme.radius, padding: theme.spacing(2) },
    planName: { fontSize: 17, fontWeight: "800", color: colors.text },
    planMeta: { fontSize: 12, color: colors.muted, marginTop: 4 },
    priceRow: { fontSize: 16, fontWeight: "800", color: colors.primary, marginTop: theme.spacing(1) },
    priceRowWithSale: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: theme.spacing(1) },
    priceStrikethrough: { fontSize: 14, color: colors.muted, textDecorationLine: "line-through" },
    saleBadge: { backgroundColor: colors.danger, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
    saleBadgeText: { fontSize: 11, fontWeight: "800", color: "#fff" },
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
    codBlockedNotice: {
      fontSize: 12,
      color: colors.danger,
      fontWeight: "600",
      paddingHorizontal: theme.spacing(2),
      paddingTop: theme.spacing(1),
    },
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
    subscribeButton: {
      flex: 1,
      backgroundColor: colors.primary,
      borderRadius: theme.radius,
      alignItems: "center",
      justifyContent: "center",
    },
    subscribeButtonDisabled: { opacity: 0.5 },
    subscribeButtonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
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
    viewTiffinTab: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.primary,
      borderRadius: theme.radius,
      paddingVertical: theme.spacing(1.5),
      paddingHorizontal: theme.spacing(3),
      marginTop: theme.spacing(3),
    },
    viewTiffinText: { color: "#fff", fontWeight: "700", fontSize: 15 },
    viewTiffinArrow: { color: "#fff", fontWeight: "800", fontSize: 16 },
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
