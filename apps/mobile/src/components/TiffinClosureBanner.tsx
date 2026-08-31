import type { TiffinClosure } from "@tbc/shared-types";
import { StyleSheet, Text, View } from "react-native";
import { theme, type ColorPalette } from "../constants/theme";

interface Props {
  closures: TiffinClosure[] | undefined;
  colors: ColorPalette;
}

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/** Shown on GG Tiffin's own screens when an admin has declared an emergency closure covering
 * today or an upcoming date — separate from StoreClosedBanner, which only ever covers TBC/TAT/
 * catalog ordering. Subscribers don't need to do anything: their subscription is already extended
 * automatically to make up for it. */
export function TiffinClosureBanner({ closures, colors }: Props) {
  if (!closures || closures.length === 0) return null;
  // Multiple declared closures are rare but possible — show the soonest one; the rest still block
  // ordering even if not named here.
  const next = [...closures].sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
  const range = next.startDate === next.endDate ? formatDate(next.startDate) : `${formatDate(next.startDate)} – ${formatDate(next.endDate)}`;

  return (
    <View style={[styles.banner, { backgroundColor: colors.danger + "1A", borderColor: colors.danger }]}>
      <Text style={[styles.text, { color: colors.danger }]}>
        🚫 GG Tiffin is closed {range}{next.reason ? ` (${next.reason})` : ""}. Any active subscription has already
        been extended to make up for it.
      </Text>
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
