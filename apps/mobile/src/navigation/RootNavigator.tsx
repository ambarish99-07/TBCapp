import { DarkTheme, DefaultTheme, NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useMemo } from "react";
import { ActivityIndicator, View } from "react-native";
import { AccountScreen } from "../screens/Account/AccountScreen";
import { EditProfileScreen } from "../screens/Account/EditProfileScreen";
import { OrderHistoryScreen } from "../screens/Account/OrderHistoryScreen";
import { AddAddressScreen } from "../screens/Address/AddAddressScreen";
import { AddressScreen } from "../screens/Address/AddressScreen";
import { LoginScreen } from "../screens/Auth/LoginScreen";
import { BulkOrderScreen } from "../screens/BulkOrder/BulkOrderScreen";
import { CartScreen } from "../screens/Cart/CartScreen";
import { CheckoutScreen } from "../screens/Checkout/CheckoutScreen";
import { ChooseComboScreen } from "../screens/Combos/ChooseComboScreen";
import { CombosScreen } from "../screens/Combos/CombosScreen";
import { CartHeaderButton } from "../components/CartHeaderButton";
import { GuestLookupScreen } from "../screens/OrderLookup/GuestLookupScreen";
import { MenuScreen } from "../screens/Menu/MenuScreen";
import { OrderStatusScreen } from "../screens/OrderStatus/OrderStatusScreen";
import { PaymentMethodScreen } from "../screens/PaymentMethod/PaymentMethodScreen";
import { RestaurantMenuScreen } from "../screens/RestaurantMenu/RestaurantMenuScreen";
import { CategoryResultsScreen } from "../screens/Search/CategoryResultsScreen";
import { SearchScreen } from "../screens/Search/SearchScreen";
import { useAuthStore } from "../state/authStore";
import { useTheme } from "../state/themeStore";
import type { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
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
    <NavigationContainer theme={navigationTheme}>
      <View style={{ flex: 1 }}>
        {user ? (
          <Stack.Navigator initialRouteName="Menu">
            <Stack.Screen name="Menu" component={MenuScreen} options={{ headerShown: false }} />
            <Stack.Screen
              name="RestaurantMenu"
              component={RestaurantMenuScreen}
              options={{ title: "Menu", headerRight: () => <CartHeaderButton /> }}
            />
            <Stack.Screen name="Addresses" component={AddressScreen} options={{ title: "Delivery Address" }} />
            <Stack.Screen name="AddAddress" component={AddAddressScreen} options={{ title: "Add Address" }} />
            <Stack.Screen name="Search" component={SearchScreen} options={{ title: "Search" }} />
            <Stack.Screen
              name="CategoryResults"
              component={CategoryResultsScreen}
              options={{ title: "Search Results", headerRight: () => <CartHeaderButton /> }}
            />
            <Stack.Screen
              name="Combos"
              component={CombosScreen}
              options={{ title: "Combos", headerRight: () => <CartHeaderButton /> }}
            />
            <Stack.Screen
              name="ChooseCombo"
              component={ChooseComboScreen}
              options={{ title: "Build Your Combo", headerRight: () => <CartHeaderButton /> }}
            />
            <Stack.Screen name="BulkOrder" component={BulkOrderScreen} options={{ title: "Bulk Deals" }} />
            <Stack.Screen name="Cart" component={CartScreen} options={{ title: "Your Cart" }} />
            <Stack.Screen name="Checkout" component={CheckoutScreen} options={{ title: "Update Address" }} />
            <Stack.Screen name="PaymentMethod" component={PaymentMethodScreen} options={{ title: "Pay Using" }} />
            <Stack.Screen name="OrderStatus" component={OrderStatusScreen} options={{ title: "Order Status" }} />
            <Stack.Screen name="GuestLookup" component={GuestLookupScreen} options={{ title: "Track Order" }} />
            <Stack.Screen name="Account" component={AccountScreen} options={{ title: "Account" }} />
            <Stack.Screen name="OrderHistory" component={OrderHistoryScreen} options={{ title: "Order History" }} />
            <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ title: "Edit Profile" }} />
          </Stack.Navigator>
        ) : (
          // Logging in/out swaps this whole group for the one above (and back) —
          // an account is required before any part of the menu/ordering flow is reachable.
          <Stack.Navigator initialRouteName="Login">
            <Stack.Screen name="Login" component={LoginScreen} options={{ title: "Log In" }} />
          </Stack.Navigator>
        )}
      </View>
    </NavigationContainer>
  );
}
