import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { PREMIUM_MEMBERSHIP_DURATION_DAYS, PREMIUM_MEMBERSHIP_PRICE } from "@tbc/shared-types";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Animated, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  createMembershipRazorpayOrderRequest,
  purchasePremiumMembershipRequest,
  usePremiumMembershipStatus,
  verifyMembershipRazorpayPaymentRequest,
} from "../../api/premiumMembership.api";
import { theme, type ColorPalette } from "../../constants/theme";
import { useAuthStore } from "../../state/authStore";
import { usePaymentMethodStore } from "../../state/paymentMethodStore";
import { useTheme } from "../../state/themeStore";
import { launchRazorpayCheckout } from "../../utils/razorpayCheckout";
import type { RootStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "PremiumMembership">;

const BELL_RING_DURATION_MS = 1000;

/** ₹21/60-day free-delivery membership — no delivery address needed (nothing is delivered),
 * so this is a slimmer checkout than Tiffin/Cart's: just pick a payment method and pay. Same
 * footer/confirmation treatment as the rest of the app's checkout screens. */
export function PremiumMembershipScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);
  const { data: status } = usePremiumMembershipStatus();
  const selectedPaymentOption = usePaymentMethodStore((state) => state.selected);
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [showContinue, setShowContinue] = useState(false);
  const bellRotate = useRef(new Animated.Value(0)).current;
  const continueTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canProceed = !!selectedPaymentOption;

  useEffect(() => () => {
    if (continueTimeoutRef.current) clearTimeout(continueTimeoutRef.current);
  }, []);

  async function handlePurchase() {
    if (!canProceed || !selectedPaymentOption) return;
    setSubmitting(true);
    try {
      const { purchase, user } = await purchasePremiumMembershipRequest(selectedPaymentOption.apiMethod);
      let finalUser = user;

      if (selectedPaymentOption.apiMethod === "razorpay") {
        const razorpayOrder = await createMembershipRazorpayOrderRequest(purchase.id);
        const paymentResult = await launchRazorpayCheckout({
          ...razorpayOrder,
          description: "Premium Membership",
          prefill: { email: user?.email, phone: user?.phone, fullName: user?.fullName },
        });
        const verified = await verifyMembershipRazorpayPaymentRequest(purchase.id, {
          razorpay_order_id: razorpayOrder.razorpayOrderId,
          razorpay_payment_id: paymentResult.razorpay_payment_id,
          razorpay_signature: paymentResult.razorpay_signature,
        });
        finalUser = verified.user;
      }

      updateUser(finalUser);
      queryClient.invalidateQueries({ queryKey: ["premium-membership-status"] });

      setConfirmed(true);
      bellRotate.setValue(0);
      Animated.sequence([
        Animated.timing(bellRotate, { toValue: 1, duration: 100, useNativeDriver: true }),
        Animated.timing(bellRotate, { toValue: -1, duration: 100, useNativeDriver: true }),
        Animated.timing(bellRotate, { toValue: 1, duration: 100, useNativeDriver: true }),
        Animated.timing(bellRotate, { toValue: -1, duration: 100, useNativeDriver: true }),
        Animated.timing(bellRotate, { toValue: 0, duration: 100, useNativeDriver: true }),
      ]).start();
      continueTimeoutRef.current = setTimeout(() => setShowContinue(true), BELL_RING_DURATION_MS);
    } catch (err) {
      Alert.alert("Couldn't complete purchase", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.summaryCard}>
          <Text style={styles.crown}>👑</Text>
          <Text style={styles.title}>Premium Membership</Text>
          <Text style={styles.subtitle}>Free delivery on every order, no distance limit.</Text>
          <Text style={styles.priceRow}>
            ₹{PREMIUM_MEMBERSHIP_PRICE} <Text style={styles.priceSuffix}>/ {PREMIUM_MEMBERSHIP_DURATION_DAYS} days</Text>
          </Text>
          {status?.active && (
            <Text style={styles.activeNote}>
              You're already active until {status.expiresAt?.slice(0, 10)} — purchasing now adds {PREMIUM_MEMBERSHIP_DURATION_DAYS} more days on
              top.
            </Text>
          )}
          {status && !status.active && status.expiresAt && (
            <Text style={styles.activeNote}>Your membership expired on {status.expiresAt.slice(0, 10)} — renew to restore free delivery.</Text>
          )}
        </View>
      </ScrollView>

      <View style={styles.actionRow}>
        <Pressable style={styles.payUsingBox} onPress={() => navigation.navigate("PaymentMethod", { hideCod: true })}>
          <Text style={styles.payUsingLabel}>Pay via</Text>
          <View style={styles.payUsingValueRow}>
            <Text style={styles.payUsingValue} numberOfLines={1}>
              {selectedPaymentOption?.label ?? "Select"}
            </Text>
            <Text style={styles.payUsingTriangle}>▾</Text>
          </View>
        </Pressable>

        <Pressable
          style={[styles.purchaseButton, !canProceed && styles.purchaseButtonDisabled]}
          onPress={handlePurchase}
          disabled={submitting || !canProceed}
        >
          <Text style={styles.purchaseButtonText}>{submitting ? "Processing…" : `Upgrade to Premium & Pay ₹${PREMIUM_MEMBERSHIP_PRICE}`}</Text>
        </Pressable>
      </View>

      {confirmed && (
        <View style={[styles.confirmedOverlay, { backgroundColor: colors.background }]}>
          <Animated.View
            style={{
              transform: [{ rotate: bellRotate.interpolate({ inputRange: [-1, 1], outputRange: ["-18deg", "18deg"] }) }],
            }}
          >
            <Text style={styles.confirmedEmoji}>🔔</Text>
          </Animated.View>
          <Text style={styles.confirmedText}>You're Premium!</Text>

          {showContinue && (
            <Pressable style={styles.continueTab} onPress={() => navigation.goBack()}>
              <Text style={styles.continueText}>Back to Home</Text>
              <Text style={styles.continueArrow}>→</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const makeStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { padding: theme.spacing(2), paddingBottom: theme.spacing(4) },
    summaryCard: { backgroundColor: colors.surface, borderRadius: theme.radius, padding: theme.spacing(2.5), alignItems: "center" },
    crown: { fontSize: 40, marginBottom: theme.spacing(0.5) },
    title: { fontSize: 19, fontWeight: "800", color: colors.text },
    subtitle: { fontSize: 13, color: colors.muted, marginTop: 4, textAlign: "center" },
    priceRow: { fontSize: 24, fontWeight: "800", color: colors.primary, marginTop: theme.spacing(1.5) },
    priceSuffix: { fontSize: 13, fontWeight: "700", color: colors.muted },
    activeNote: { fontSize: 12, color: colors.primary, fontWeight: "600", marginTop: theme.spacing(1.5), textAlign: "center" },
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
    purchaseButton: {
      flex: 1,
      backgroundColor: colors.primary,
      borderRadius: theme.radius,
      alignItems: "center",
      justifyContent: "center",
    },
    purchaseButtonDisabled: { opacity: 0.5 },
    purchaseButtonText: { color: "#fff", fontWeight: "700", fontSize: 14, paddingHorizontal: theme.spacing(1) },
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
    continueTab: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.primary,
      borderRadius: theme.radius,
      paddingVertical: theme.spacing(1.5),
      paddingHorizontal: theme.spacing(3),
      marginTop: theme.spacing(3),
    },
    continueText: { color: "#fff", fontWeight: "700", fontSize: 15 },
    continueArrow: { color: "#fff", fontWeight: "800", fontSize: 16 },
  });
