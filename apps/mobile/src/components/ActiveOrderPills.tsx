import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "../constants/theme";
import { RegularOrderActivePill } from "./RegularOrderActivePill";
import { TiffinActiveOrderPill } from "./TiffinActiveOrderPill";

// Below the native header bar (a fixed ~56dp on Android) plus the screen's own safe-area inset,
// so this never covers the header's title/back button — pinned top-right instead of the bottom,
// since nearly every checkout-style screen already has its own fixed-bottom action bar.
const HEADER_HEIGHT = 56;

/**
 * Mounted once at the RootNavigator level (not per-screen) so it floats over every screen in the
 * logged-in app. Stacks a chip per order system that currently has something in flight — a
 * TBC/Alchemy Tails order, a GG Tiffin single-meal order, or both — so the customer is never more
 * than one tap from checking status regardless of which page they wandered off to.
 */
export function ActiveOrderPills() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.stack, { top: insets.top + HEADER_HEIGHT + theme.spacing(1) }]} pointerEvents="box-none">
      <RegularOrderActivePill />
      <TiffinActiveOrderPill />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { position: "absolute", right: theme.spacing(2), alignItems: "flex-end", gap: theme.spacing(1) },
});
