import type { PricingResult } from "@tbc/pricing";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { theme, type ColorPalette } from "../constants/theme";
import { useTheme } from "../state/themeStore";

export const DISCOUNT_LABELS: Record<PricingResult["discountReason"], string> = {
  none: "",
  "quantity-tier": "Multi-item discount",
  premium: "Premium member discount (25%)",
  "first-order-bogo": "🎉 Welcome offer: Buy 1 Get 1 Free",
  "second-order-half-off": "🎉 Welcome offer: 50% off",
};

export const REWARD_LABELS: Record<PricingResult["rewardReason"], string> = {
  none: "",
  "sixth-order-cold-coffee": "6th-order reward: 50% off cold coffee",
  "tenth-order-free-drink": "10th-order reward: free drink",
};

const NEW_CUSTOMER_DISCOUNT_REASONS = new Set<PricingResult["discountReason"]>(["first-order-bogo", "second-order-half-off"]);

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.row}>
      <Text style={[styles.label, muted && styles.muted]}>{label}</Text>
      <Text style={[styles.value, muted && styles.muted]}>{value}</Text>
    </View>
  );
}

/** Renders the exact breakdown returned by @tbc/pricing — used identically in Cart and Checkout. */
export function PriceBreakdown({ result }: { result: PricingResult }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.card}>
      {/* A distinct celebratory banner for the two new-customer offers — the plain muted row below
          still lists the exact amount, but this is the "yes, it's applied" confirmation the offer
          tabs on Home promised. */}
      {result.discountAmount > 0 && NEW_CUSTOMER_DISCOUNT_REASONS.has(result.discountReason) && (
        <View style={styles.newCustomerBanner}>
          <Text style={styles.newCustomerBannerText}>{DISCOUNT_LABELS[result.discountReason]} applied to this order!</Text>
        </View>
      )}
      <Row label="Subtotal" value={`₹${result.subtotal}`} />
      {result.discountAmount > 0 && (
        <Row label={DISCOUNT_LABELS[result.discountReason]} value={`-₹${result.discountAmount}`} muted />
      )}
      {result.rewardAmount > 0 && (
        <Row label={REWARD_LABELS[result.rewardReason]} value={`-₹${result.rewardAmount}`} muted />
      )}
      <Row label="Delivery fee" value={result.deliveryFee === 0 ? "Free" : `₹${result.deliveryFee}`} muted />
      <Row label="Tax (5%)" value={`₹${result.tax}`} muted />
      <View style={styles.divider} />
      <Row label="Total" value={`₹${result.total}`} />
      {result.isPremiumMember && <Text style={styles.premiumNote}>✨ Premium member pricing applied</Text>}
      {result.hasFreeDeliveryMembership && result.deliveryFee === 0 && (
        <Text style={styles.premiumNote}>👑 Free delivery — Premium Membership</Text>
      )}
    </View>
  );
}

const makeStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    card: { backgroundColor: colors.surface, borderRadius: theme.radius, padding: theme.spacing(2) },
    row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
    label: { fontSize: 14, color: colors.text, fontWeight: "600" },
    value: { fontSize: 14, color: colors.text, fontWeight: "600" },
    muted: { fontWeight: "400", color: colors.muted },
    divider: { height: 1, backgroundColor: colors.border, marginVertical: 6 },
    premiumNote: { marginTop: 8, fontSize: 12, color: colors.primary, fontWeight: "700" },
    newCustomerBanner: {
      backgroundColor: colors.accent + "22",
      borderWidth: 1,
      borderColor: colors.accent,
      borderRadius: theme.radius,
      padding: theme.spacing(1),
      marginBottom: theme.spacing(1),
    },
    newCustomerBannerText: { color: colors.primary, fontWeight: "800", fontSize: 13, textAlign: "center" },
  });
