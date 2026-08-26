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

/** Renders the exact breakdown returned by @tbc/pricing — used identically in Cart and Checkout.
 * `couponCode` is purely for the row's label — `computePricing` itself never sees a coupon code,
 * only the pre-resolved rupee amount (see PricingInput.couponDiscountAmount), so the code has to
 * be threaded through separately by whichever screen applied it. */
export function PriceBreakdown({ result, couponCode }: { result: PricingResult; couponCode?: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.card}>
      {/* No separate celebratory banner here anymore — the Cart screen now pops an alert the
          moment a new-customer offer becomes eligible, so repeating "applied!" again in this
          breakdown was redundant. The plain muted row below still lists the exact discount. */}
      <Row label="Subtotal" value={`₹${result.subtotal}`} />
      {result.discountAmount > 0 && (
        <Row label={DISCOUNT_LABELS[result.discountReason]} value={`-₹${result.discountAmount}`} muted />
      )}
      {result.rewardAmount > 0 && (
        <Row label={REWARD_LABELS[result.rewardReason]} value={`-₹${result.rewardAmount}`} muted />
      )}
      {result.couponDiscount > 0 && (
        <Row label={couponCode ? `Coupon (${couponCode})` : "Coupon discount"} value={`-₹${result.couponDiscount}`} muted />
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
  });
