import type { BrandStoreStatus } from "@tbc/shared-types";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import { theme, type ColorPalette } from "../constants/theme";

function formatHour(h: number): string {
  const hourOfDay = h % 24;
  const hour12 = hourOfDay % 12 === 0 ? 12 : hourOfDay % 12;
  const suffix = hourOfDay < 12 ? "AM" : "PM";
  return `${hour12} ${suffix}`;
}

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function formatRange(closure: { startDate: string; endDate: string; reason?: string }): string {
  const range = closure.startDate === closure.endDate ? formatDate(closure.startDate) : `${formatDate(closure.startDate)} – ${formatDate(closure.endDate)}`;
  return closure.reason ? `${range} (${closure.reason})` : range;
}

interface Props {
  status: BrandStoreStatus | undefined;
  colors: ColorPalette;
  style?: ViewStyle;
}

/**
 * Shown on Home and at Cart checkout for catalog ordering (TBC, TAT, any other brand ordered
 * through the cart). Two states: an urgent red banner when ordering is actually blocked right
 * now (manual switch, outside service hours, or a planned closure currently in effect), or a
 * milder heads-up when the store is open but a planned closure is coming up — announced ahead of
 * time rather than only once it actually takes effect. Never rendered for GG Tiffin, which has
 * its own separate ordering cutoffs and closures, so callers should skip mounting this while a
 * GG Tiffin context is active.
 */
export function StoreClosedBanner({ status, colors, style }: Props) {
  if (!status) return null;

  if (!status.isOpen) {
    const message =
      status.reason === "manually-closed"
        ? "We're not accepting orders right now — please check back shortly."
        : status.reason === "planned-closure" && status.activeClosure
          ? `We're closed ${formatRange(status.activeClosure)}.`
          : `We're closed right now — open ${formatHour(status.settings.openHour)} to ${formatHour(status.settings.closeHour)} daily.`;

    return (
      <View style={[styles.banner, { backgroundColor: colors.danger + "1A", borderColor: colors.danger }, style]}>
        <Text style={[styles.text, { color: colors.danger }]}>🚫 {message}</Text>
      </View>
    );
  }

  if (status.upcomingClosures.length > 0) {
    const next = status.upcomingClosures[0];
    return (
      <View style={[styles.banner, { backgroundColor: colors.accent + "1A", borderColor: colors.accent }, style]}>
        <Text style={[styles.text, { color: colors.text }]}>📅 Heads up — we'll be closed {formatRange(next)}.</Text>
      </View>
    );
  }

  return null;
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
