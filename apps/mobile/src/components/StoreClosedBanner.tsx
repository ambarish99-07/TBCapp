import type { StoreStatus } from "@tbc/shared-types";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import { theme, type ColorPalette } from "../constants/theme";

function formatHour(h: number): string {
  const hourOfDay = h % 24;
  const hour12 = hourOfDay % 12 === 0 ? 12 : hourOfDay % 12;
  const suffix = hourOfDay < 12 ? "AM" : "PM";
  return `${hour12} ${suffix}`;
}

interface Props {
  status: StoreStatus | undefined;
  colors: ColorPalette;
  style?: ViewStyle;
}

/** Shown on Home and at Cart checkout when catalog ordering (TBC, TAT, any other brand ordered
 * through the cart) is closed — either the admin's manual switch or outside the configured
 * service hours. Never rendered for GG Tiffin, which has its own separate ordering cutoffs, so
 * callers should skip mounting this while a GG Tiffin context is active. */
export function StoreClosedBanner({ status, colors, style }: Props) {
  if (!status || status.isOpen) return null;
  const message =
    status.reason === "manually-closed"
      ? "We're not accepting orders right now — please check back shortly."
      : `We're closed right now — open ${formatHour(status.settings.openHour)} to ${formatHour(status.settings.closeHour)} daily.`;

  return (
    <View style={[styles.banner, { backgroundColor: colors.danger + "1A", borderColor: colors.danger }, style]}>
      <Text style={[styles.text, { color: colors.danger }]}>🚫 {message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderWidth: 1,
    borderRadius: theme.radius,
    padding: theme.spacing(1.25),
    marginBottom: theme.spacing(1.5),
  },
  text: { fontSize: 13, fontWeight: "700", textAlign: "center" },
});
