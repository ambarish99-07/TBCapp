import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "../constants/theme";
import { navigationRef } from "../navigation/navigationRef";
import { RegularOrderActivePill } from "./RegularOrderActivePill";
import { TiffinActiveOrderPill } from "./TiffinActiveOrderPill";

/** Screens whose whole purpose is showing order status — the pills would just be pointing at the
 * page the customer is already looking at, so they're hidden entirely here rather than on every
 * other screen in the app. */
const ORDER_STATUS_ROUTES = new Set(["OrderStatus", "TiffinSingleMealOrderTracking"]);

/**
 * Mounted once at the RootNavigator level (not per-screen) so it floats over every screen in the
 * logged-in app except the order-status screens themselves (see ORDER_STATUS_ROUTES). Docked to
 * the footer, above whatever content is there — most screens have none of their own down there;
 * the few that do (Checkout-style fixed action bars) still leave the corner clear. Stacks a chip
 * per order system that currently has something in flight — a TBC/Alchemy Tails order, a GG
 * Tiffin single-meal order, or both — so the customer is never more than one tap from checking
 * status regardless of which page they wandered off to.
 */
export function ActiveOrderPills() {
  const insets = useSafeAreaInsets();
  // ActiveOrderPills is a sibling of the Stack.Navigator, not a descendant of it, so the usual
  // useNavigationState hook can't be used here (it throws "Couldn't get the navigation state" —
  // it needs to be inside the navigator's own screen tree). navigationRef works from anywhere,
  // navigator or not, so it's used directly instead, kept in sync via its own "state" listener.
  const [currentRouteName, setCurrentRouteName] = useState<string | undefined>(() =>
    navigationRef.isReady() ? navigationRef.getCurrentRoute()?.name : undefined
  );

  useEffect(() => {
    return navigationRef.addListener("state", () => {
      setCurrentRouteName(navigationRef.getCurrentRoute()?.name);
    });
  }, []);

  if (currentRouteName && ORDER_STATUS_ROUTES.has(currentRouteName)) return null;

  return (
    <View style={[styles.stack, { bottom: insets.bottom + theme.spacing(2) }]} pointerEvents="box-none">
      <RegularOrderActivePill />
      <TiffinActiveOrderPill />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { position: "absolute", right: theme.spacing(2), alignItems: "flex-end", gap: theme.spacing(1) },
});
