import { NavigationContainer, useNavigationContainerRef } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { AccountScreen } from "../screens/Account/AccountScreen";
import { LoginScreen } from "../screens/Auth/LoginScreen";
import { SignupScreen } from "../screens/Auth/SignupScreen";
import { CartScreen } from "../screens/Cart/CartScreen";
import { CheckoutScreen } from "../screens/Checkout/CheckoutScreen";
import { ChooseComboScreen } from "../screens/Combos/ChooseComboScreen";
import { CombosScreen } from "../screens/Combos/CombosScreen";
import { OrderNowButton } from "../components/OrderNowButton";
import { GuestLookupScreen } from "../screens/OrderLookup/GuestLookupScreen";
import { ItemDetailScreen } from "../screens/ItemDetail/ItemDetailScreen";
import { MenuScreen } from "../screens/Menu/MenuScreen";
import { OrderStatusScreen } from "../screens/OrderStatus/OrderStatusScreen";
import { theme } from "../constants/theme";
import { useAuthStore } from "../state/authStore";
import type { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const navigationRef = useNavigationContainerRef<RootStackParamList>();
  const [currentRouteName, setCurrentRouteName] = useState<string | undefined>();
  const user = useAuthStore((state) => state.user);
  const isHydrating = useAuthStore((state) => state.isHydrating);

  if (isHydrating) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.background }}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer
      ref={navigationRef}
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
            <Stack.Screen name="Signup" component={SignupScreen} options={{ title: "Sign Up" }} />
          </Stack.Navigator>
        )}
        {/* Persistent shortcut back to ordering, on every screen except Menu (which already is the ordering entry point). */}
        {user && currentRouteName !== "Menu" && <OrderNowButton />}
      </View>
    </NavigationContainer>
  );
}
