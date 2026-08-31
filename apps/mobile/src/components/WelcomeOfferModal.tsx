import { useEffect, useMemo, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useActiveCoupons } from "../api/coupons.api";
import { theme, type ColorPalette } from "../constants/theme";
import { useTheme } from "../state/themeStore";

const WELCOME_COUPON_CODE = "WELCOME50";

interface Props {
  brandId: string | undefined;
  /** Only ever true for a logged-in customer who hasn't completed an order yet — see MenuScreen,
   * which derives this from loyalty.completedOrderCount === 0. */
  eligible: boolean;
}

/**
 * A one-time-per-app-open nudge advertising the welcome coupon — shown on Home for as long as
 * the customer hasn't completed their first order. Once that first order genuinely confirms
 * (COD immediately, Razorpay after verification), `advanceLoyaltyOrderCount` bumps
 * completedOrderCount off zero AND `markCouponUsed` retires WELCOME50 for this account server-
 * side, so this stops appearing on its own — no local "seen it" flag to manage or reset.
 *
 * Reads the live coupon (value/cap) via the same /coupons/active the Cart's "Apply Coupon" page
 * uses, rather than hardcoding "50% off up to ₹100" — an admin edit to WELCOME50 stays accurate
 * here with no code change. Renders nothing if the coupon's missing, deactivated, expired, or
 * (once redeemed) already filtered out of the active list server-side.
 */
export function WelcomeOfferModal({ brandId, eligible }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { data: coupons } = useActiveCoupons(brandId);
  const welcomeCoupon = coupons?.find((c) => c.code === WELCOME_COUPON_CODE);

  const [visible, setVisible] = useState(false);
  // Once per mount (i.e. once per login/app-open of the Home screen) — not on every re-render
  // triggered by the coupon query refetching or the brand switching underneath it.
  const hasShownRef = useRef(false);

  useEffect(() => {
    if (eligible && welcomeCoupon && !hasShownRef.current) {
      hasShownRef.current = true;
      setVisible(true);
    }
  }, [eligible, welcomeCoupon]);

  if (!welcomeCoupon) return null;

  const capLine = welcomeCoupon.maxDiscountAmount ? ` (up to ₹${welcomeCoupon.maxDiscountAmount})` : "";
  const discountLine = welcomeCoupon.type === "percent" ? `${welcomeCoupon.value}% off${capLine}` : `₹${welcomeCoupon.value} off`;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={() => setVisible(false)}>
      <Pressable style={styles.overlay} onPress={() => setVisible(false)}>
        <View style={styles.card}>
          <Text style={styles.emoji}>🎉</Text>
          <Text style={styles.title}>Welcome to Lickyeat!</Text>
          <Text style={styles.body}>
            Get <Text style={styles.highlight}>{discountLine}</Text> on your first order with code
          </Text>
          <View style={styles.codeBox}>
            <Text style={styles.codeText}>{welcomeCoupon.code}</Text>
          </View>
          <Text style={styles.hint}>Apply it in your cart at checkout — good for one order only.</Text>
          <Pressable style={styles.cta} onPress={() => setVisible(false)}>
            <Text style={styles.ctaText}>Start Ordering</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", padding: theme.spacing(3) },
    card: {
      backgroundColor: colors.background,
      borderRadius: theme.radius + 4,
      padding: theme.spacing(3),
      alignItems: "center",
    },
    emoji: { fontSize: 40, marginBottom: theme.spacing(1) },
    title: { fontSize: 20, fontWeight: "800", color: colors.text, marginBottom: theme.spacing(1) },
    body: { fontSize: 14, color: colors.text, textAlign: "center", marginBottom: theme.spacing(1.5) },
    highlight: { fontWeight: "800", color: colors.primary },
    codeBox: {
      borderWidth: 1.5,
      borderStyle: "dashed",
      borderColor: colors.primary,
      borderRadius: theme.radius,
      paddingVertical: theme.spacing(1),
      paddingHorizontal: theme.spacing(3),
      marginBottom: theme.spacing(1.5),
    },
    codeText: { fontSize: 18, fontWeight: "800", letterSpacing: 2, color: colors.primary },
    hint: { fontSize: 12, color: colors.muted, textAlign: "center", marginBottom: theme.spacing(2) },
    cta: { backgroundColor: colors.primary, borderRadius: theme.radius, paddingVertical: theme.spacing(1.5), paddingHorizontal: theme.spacing(4) },
    ctaText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  });
