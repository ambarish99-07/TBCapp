import type { PricingResult } from "@tbc/pricing";
import { StyleSheet, Text, View } from "react-native";
import { theme } from "../constants/theme";

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.label, muted && styles.muted]}>{label}</Text>
      <Text style={[styles.value, muted && styles.muted]}>{value}</Text>
    </View>
  );
}

/** Renders the exact breakdown returned by @tbc/pricing — used identically in Cart and Checkout. */
export function PriceBreakdown({ result }: { result: PricingResult }) {
  return (
    <View style={styles.card}>
      <Row label="Subtotal" value={`₹${result.subtotal}`} />
      {result.bestPercentDiscount > 0 && (
        <Row
          label={result.loyaltyDiscountAmount >= result.websiteDiscountAmount ? "Loyalty discount" : "Direct-order discount"}
          value={`-₹${result.bestPercentDiscount}`}
          muted
        />
      )}
      {result.punchCardDiscount > 0 && <Row label="Punch card reward" value={`-₹${result.punchCardDiscount}`} muted />}
      <Row label="Delivery fee" value={result.deliveryFee === 0 ? "Free" : `₹${result.deliveryFee}`} muted />
      <Row label="Tax (5%)" value={`₹${result.tax}`} muted />
      <View style={styles.divider} />
      <Row label="Total" value={`₹${result.total}`} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: theme.colors.surface, borderRadius: theme.radius, padding: theme.spacing(2) },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  label: { fontSize: 14, color: theme.colors.text, fontWeight: "600" },
  value: { fontSize: 14, color: theme.colors.text, fontWeight: "600" },
  muted: { fontWeight: "400", color: theme.colors.muted },
  divider: { height: 1, backgroundColor: theme.colors.border, marginVertical: 6 },
});
