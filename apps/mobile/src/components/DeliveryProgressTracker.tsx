import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { theme, type ColorPalette } from "../constants/theme";
import { useTheme } from "../state/themeStore";

const TICK_MS = 15000;
// Capped short of "arrived" — the tracker's job is to show progress toward delivery, not to
// declare it delivered on its own. Only the order's real status (set by the admin/rider action)
// gets to say that; this just stops just short so it never visually contradicts a still-"out for
// delivery" status by looking finished before it is.
const MAX_PROGRESS = 0.95;

interface Props {
  /** ISO timestamp of the "out-for-delivery" status-history entry. */
  outForDeliveryAt: string;
  /** Omitted for GG Tiffin single-meal orders, which have no per-order ETA estimate (they're
   * scheduled to a delivery window, not an ASAP countdown) — the tracker still shows movement,
   * just without a specific "arriving in N min" claim it has no real basis for. */
  estimatedMinutes?: number;
  deliveryPartnerName?: string;
}

/**
 * A time-based, simulated "where's my order" visualization — not real rider GPS (see mapEmbed.ts;
 * there's no rider app/location feed in this system to draw real coordinates from). It animates a
 * rider icon along a shop→home track based on elapsed time vs. the order's own estimated delivery
 * window, and (when that estimate exists) a live-ticking "arriving in" countdown. Honest about
 * what it is: a progress estimate derived from real order timestamps, not a live GPS feed.
 */
export function DeliveryProgressTracker({ outForDeliveryAt, estimatedMinutes, deliveryPartnerName }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [now, setNow] = useState(() => Date.now());
  const riderLeft = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const startedAtMs = new Date(outForDeliveryAt).getTime();
  const totalMs = estimatedMinutes ? estimatedMinutes * 60000 : undefined;
  const elapsedMs = Math.max(0, now - startedAtMs);
  const progress = totalMs ? Math.min(MAX_PROGRESS, elapsedMs / totalMs) : undefined;
  const remainingMinutes = totalMs ? Math.max(0, Math.ceil((totalMs - elapsedMs) / 60000)) : undefined;

  useEffect(() => {
    // Undefined progress (tiffin, no ETA basis) drifts slowly toward the cap instead of sitting
    // still — a static icon on an "on the way" screen reads as frozen/broken, not "in progress".
    const target = progress ?? MAX_PROGRESS;
    Animated.timing(riderLeft, { toValue: target, duration: TICK_MS, useNativeDriver: false }).start();
  }, [progress, riderLeft]);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{deliveryPartnerName ? `${deliveryPartnerName} is on the way 🛵` : "Your order is on the way 🛵"}</Text>
      <Text style={styles.eta}>
        {remainingMinutes !== undefined
          ? remainingMinutes > 0
            ? `Arriving in ~${remainingMinutes} min`
            : "Arriving any moment now"
          : "On the way — arriving soon"}
      </Text>
      <View style={styles.track}>
        <View style={styles.trackLine} />
        <Text style={[styles.endIcon, styles.endIconLeft]}>🏪</Text>
        <Animated.Text
          style={[
            styles.riderIcon,
            { left: riderLeft.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) },
          ]}
        >
          🛵
        </Animated.Text>
        <Text style={[styles.endIcon, styles.endIconRight]}>🏠</Text>
      </View>
      {/* Said plainly rather than left implied — this is a time-based estimate, not a live GPS
          pin, since there's no real rider location feed behind it. */}
      <Text style={styles.disclaimer}>Estimated progress based on delivery time, not live GPS.</Text>
    </View>
  );
}

const TRACK_HEIGHT = 40;

const makeStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    card: { backgroundColor: colors.surface, borderRadius: theme.radius, padding: theme.spacing(2), marginTop: theme.spacing(2) },
    title: { fontSize: 15, fontWeight: "800", color: colors.text },
    eta: { fontSize: 13, color: colors.primary, fontWeight: "700", marginTop: 2 },
    track: { height: TRACK_HEIGHT, marginTop: theme.spacing(1.5), justifyContent: "center", position: "relative" },
    trackLine: { height: 3, borderRadius: 2, backgroundColor: colors.border, marginHorizontal: 14 },
    endIcon: { position: "absolute", fontSize: 18, top: (TRACK_HEIGHT - 22) / 2 },
    endIconLeft: { left: -2 },
    endIconRight: { right: -2 },
    riderIcon: {
      position: "absolute",
      fontSize: 22,
      top: (TRACK_HEIGHT - 26) / 2,
      marginLeft: -11, // centers the glyph on its interpolated left%, clamped visually by the icons at each end
    },
    disclaimer: { fontSize: 10, color: colors.muted, marginTop: theme.spacing(1), textAlign: "center" },
  });
