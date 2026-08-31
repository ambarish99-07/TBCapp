import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CROSS_BRAND_ID, type Coupon } from "@tbc/shared-types";
import { useMemo, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useActiveCoupons, validateCouponRequest } from "../../api/coupons.api";
import { theme, type ColorPalette } from "../../constants/theme";
import { useCartStore } from "../../state/cartStore";
import { useTheme } from "../../state/themeStore";
import type { RootStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Coupons">;

/** Ticket-style card with a scratch-card reveal — the code stays hidden behind a "tap to
 * scratch" panel until tapped, echoing the old prepaid-recharge voucher cards this was modeled
 * on, rather than showing every code in plain sight up front. */
function CouponVoucherCard({ coupon, onApply, applying }: { coupon: Coupon; onApply: (coupon: Coupon) => void; applying: boolean }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeCardStyles(colors), [colors]);
  const [revealed, setRevealed] = useState(false);

  const headline =
    coupon.type === "percent"
      ? `${coupon.value}% OFF${coupon.maxDiscountAmount ? ` up to ₹${coupon.maxDiscountAmount}` : ""}`
      : coupon.type === "bogo"
        ? "BUY 1 GET 1 FREE"
        : `₹${coupon.value} OFF`;
  const condition = coupon.minOrderAmount > 0 ? `On orders above ₹${coupon.minOrderAmount}` : "No minimum order";

  return (
    <View style={styles.card}>
      <View style={styles.topSection}>
        <Text style={styles.headline}>{headline}</Text>
        <Text style={styles.condition}>{condition}</Text>
      </View>

      <View style={styles.perforationWrap}>
        <View style={styles.dashedLine} />
        <View style={[styles.notch, styles.notchLeft]} />
        <View style={[styles.notch, styles.notchRight]} />
      </View>

      <Pressable style={styles.scratchArea} onPress={() => setRevealed(true)} disabled={revealed}>
        {revealed ? (
          <View style={styles.revealedRow}>
            <Text style={styles.code} numberOfLines={1}>
              {coupon.code}
            </Text>
            <Pressable style={styles.applyButton} onPress={() => onApply(coupon)} disabled={applying}>
              <Text style={styles.applyButtonText}>{applying ? "…" : "Apply"}</Text>
            </Pressable>
          </View>
        ) : (
          <Text style={styles.scratchText}>🪙 Tap to scratch &amp; reveal code</Text>
        )}
      </Pressable>
    </View>
  );
}

export function CouponsScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const lines = useCartStore((state) => state.lines);
  const setAppliedCoupon = useCartStore((state) => state.setAppliedCoupon);
  // Same "which brand does this cart actually belong to" resolution the Cart screen itself uses.
  const ownedLine = lines.find((line) => line.brandId && line.brandId !== CROSS_BRAND_ID);
  const { data: coupons, isLoading } = useActiveCoupons(ownedLine?.brandId);
  const [applyingCode, setApplyingCode] = useState<string | null>(null);

  async function handleApply(coupon: Coupon) {
    if (!ownedLine?.brandId) return;
    setApplyingCode(coupon.code);
    try {
      // The server re-derives its own subtotal from these lines (and, for a "bogo" coupon,
      // works out which unit is the free one from their individual prices) — never trusts a
      // client-sent discount amount, same principle as order creation.
      const response = await validateCouponRequest({
        code: coupon.code,
        brandId: ownedLine.brandId,
        lines: lines.map((line) => ({
          unitPrice: line.unitPrice,
          addOnPrices: line.addOnPrices,
          quantity: line.quantity,
          isCombo: line.isCombo,
        })),
      });
      setAppliedCoupon(response);
      navigation.goBack();
    } catch (err) {
      Alert.alert("Couldn't apply coupon", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setApplyingCode(null);
    }
  }

  return (
    <View style={styles.screen}>
      {isLoading && <Text style={styles.info}>Loading coupons…</Text>}
      {!isLoading && (coupons ?? []).length === 0 && <Text style={styles.info}>No coupons available right now.</Text>}
      <FlatList
        data={coupons ?? []}
        keyExtractor={(coupon) => coupon.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <CouponVoucherCard coupon={item} onApply={handleApply} applying={applyingCode === item.code} />
        )}
      />
    </View>
  );
}

const makeStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    info: { textAlign: "center", color: colors.muted, marginTop: theme.spacing(3) },
    listContent: { padding: theme.spacing(2), gap: theme.spacing(2) },
  });

const makeCardStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    card: { backgroundColor: colors.surface, borderRadius: theme.radius, overflow: "hidden" },
    topSection: { padding: theme.spacing(2) },
    headline: { fontSize: 20, fontWeight: "800", color: colors.primary },
    condition: { fontSize: 12, color: colors.muted, marginTop: 4 },
    // The perforated-ticket look: a dashed divider with a small circular "notch" cut from each
    // edge — the notch color matches the screen background (not the card), so it reads as a
    // punched-through hole rather than a colored dot.
    perforationWrap: { height: 1, position: "relative" },
    dashedLine: { borderTopWidth: 1, borderColor: colors.border, borderStyle: "dashed" },
    notch: { position: "absolute", top: -8, width: 16, height: 16, borderRadius: 8, backgroundColor: colors.background },
    notchLeft: { left: -8 },
    notchRight: { right: -8 },
    scratchArea: { minHeight: 56, alignItems: "center", justifyContent: "center", paddingHorizontal: theme.spacing(2) },
    scratchText: { fontSize: 13, fontWeight: "700", color: colors.muted, textAlign: "center" },
    revealedRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%" },
    code: { fontSize: 18, fontWeight: "800", color: colors.text, letterSpacing: 1 },
    applyButton: { backgroundColor: colors.primary, borderRadius: theme.radius, paddingHorizontal: theme.spacing(2), paddingVertical: theme.spacing(1) },
    applyButtonText: { color: "#fff", fontWeight: "700" },
  });
