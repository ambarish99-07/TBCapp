import { DarkTheme, DefaultTheme, NavigationContainer, useNavigationContainerRef } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useMemo, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { AccountScreen } from "../screens/Account/AccountScreen";
import { LoginScreen } from "../screens/Auth/LoginScreen";
import { BulkOrderScreen } from "../screens/BulkOrder/BulkOrderScreen";
import { CartScreen } from "../screens/Cart/CartScreen";
import { CheckoutScreen } from "../screens/Checkout/CheckoutScreen";
import { ChooseComboScreen } from "../screens/Combos/ChooseComboScreen";
import { CombosScreen } from "../screens/Combos/CombosScreen";
import { OrderNowButton } from "../components/OrderNowButton";
import { GuestLookupScreen } from "../screens/OrderLookup/GuestLookupScreen";
import { ItemDetailScreen } from "../screens/ItemDetail/ItemDetailScreen";
import { MenuScreen } from "../screens/Menu/MenuScreen";
import { OrderStatusScreen } from "../screens/OrderStatus/OrderStatusScreen";
import { useAuthStore } from "../state/authStore";
import { useTheme } from "../state/themeStore";
import type { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const navigationRef = useNavigationContainerRef<RootStackParamList>();
  const [currentRouteName, setCurrentRouteName] = useState<string | undefined>();
  const user = useAuthStore((state) => state.user);
  const isHydrating = useAuthStore((state) => state.isHydrating);
  const { colors, resolvedScheme } = useTheme();

  // React Navigation's native header/back-button chrome has its own theme
  // system, separate from the app's own StyleSheet colors — without this the
  // header bar would stay light even in dark mode.
  const navigationTheme = useMemo(() => {
    const base = resolvedScheme === "dark" ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: { ...base.colors, primary: colors.primary, background: colors.background, card: colors.surface, text: colors.text, border: colors.border },
    };
  }, [colors, resolvedScheme]);

  if (isHydrating) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={navigationTheme}
      onReady={() => setCurrentRouteName(navigationRef.getCurrentRoute()?.name)}
      onStateChange={() => setCurrentRouteName(navigationRef.getCurrentRoute()?.name)}
    >
      <View style={{ flex: 1 }}>
        {user ? (
          <Stack.Navigator initialRouteName="Menu">
            <Stack.Screen name="Menu" component={MenuScreen} options={{ headerShown: false }} />
            <Stack.Screen name="ItemDetail" component={ItemDetailScreen} options={{ title: "Customize" }} />
            <Stack.Screen name="Combos" component={CombosScreen} options={{ title: "Combos" }} />
            <Stack.Screen name="ChooseCombo" component={ChooseComboScreen} options={{ title: "Build Your Combo" }} />
            <Stack.Screen name="BulkOrder" component={BulkOrderScreen} options={{ title: "Bulk Orders" }} />
            <Stack.Screen name="Cart" component={CartScreen} options={{ title: "Your Cart" }} />
            <Stack.Screen name="Checkout" component={CheckoutScreen} options={{ title: "Checkout" }} />
            <Stack.Screen name="OrderStatus" component={OrderStatusScreen} options={{ title: "Order Status" }} />
            <Stack.Screen name="GuestLookup" component={GuestLookupScreen} options={{ title: "Track Order" }} />
            <Stack.Screen name="Account" component={AccountScreen} options={{ title: "Account" }} />
          </Stack.Navigator>
        ) : (
          // Logging in/out swaps this whole group for the one above (and back) —
          // an account is required before any part of the menu/ordering flow is reachable.
          <Stack.Navigator initialRouteName="Login">
            <Stack.Screen name="Login" component={LoginScreen} options={{ title: "Log In" }} />
          </Stack.Navigator>
        )}
        {/* Persistent shortcut back to ordering — hidden on Menu (already the ordering entry point) and on Cart/Checkout (already mid-order there). */}
        {user && !["Menu", "Cart", "Checkout"].includes(currentRouteName ?? "") && <OrderNowButton />}
      </View>
    </NavigationContainer>
  );
}
