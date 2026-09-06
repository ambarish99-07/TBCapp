import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { Coupon } from "@tbc/shared-types";
import { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useAllActiveCoupons } from "../../api/coupons.api";
import { theme, type ColorPalette } from "../../constants/theme";
import { useTheme } from "../../state/themeStore";
import type { RootStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "AllCoupons">;

/** Same perforated-ticket look as the Cart screen's CouponVoucherCard, but read-only — there's
 * no cart here to apply a coupon against, so revealing the code is the only action, with a plain
 * "Use at checkout" hint instead of an Apply button. */
function CouponInfoCard({ coupon }: { coupon: Coupon }) {
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
  const scope = coupon.brandId ? undefined : "Valid across every brand";

  return (
    <View style={styles.card}>
      <View style={styles.topSection}>
        <Text style={styles.headline}>{headline}</Text>
        <Text style={styles.condition}>{condition}</Text>
        {scope && <Text style={styles.condition}>{scope}</Text>}
        {coupon.oncePerCustomer && <Text style={styles.condition}>One-time welcome offer per account</Text>}
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
            <Text style={styles.useHint}>Use at checkout</Text>
          </View>
        ) : (
          <Text style={styles.scratchText}>🪙 Tap to scratch &amp; reveal code</Text>
        )}
      </Pressable>
    </View>
  );
}

export function AllCouponsScreen(_props: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { data: coupons, isLoading } = useAllActiveCoupons();

  return (
    <View style={styles.screen}>
      {isLoading && <Text style={styles.info}>Loading coupons…</Text>}
      {!isLoading && (coupons ?? []).length === 0 && <Text style={styles.info}>No coupons available right now.</Text>}
      <FlatList
        data={coupons ?? []}
        keyExtractor={(coupon) => coupon.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => <CouponInfoCard coupon={item} />}
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
    perforationWrap: { height: 1, position: "relative" },
    dashedLine: { borderTopWidth: 1, borderColor: colors.border, borderStyle: "dashed" },
    notch: { position: "absolute", top: -8, width: 16, height: 16, borderRadius: 8, backgroundColor: colors.background },
    notchLeft: { left: -8 },
    notchRight: { right: -8 },
    scratchArea: { minHeight: 56, alignItems: "center", justifyContent: "center", paddingHorizontal: theme.spacing(2) },
    scratchText: { fontSize: 13, fontWeight: "700", color: colors.muted, textAlign: "center" },
    revealedRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%" },
    code: { fontSize: 18, fontWeight: "800", color: colors.text, letterSpacing: 1 },
    useHint: { fontSize: 12, fontWeight: "700", color: colors.muted },
  });
