import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { AccountScreen } from "../screens/Account/AccountScreen.js";
import { LoginScreen } from "../screens/Auth/LoginScreen.js";
import { SignupScreen } from "../screens/Auth/SignupScreen.js";
import { CartScreen } from "../screens/Cart/CartScreen.js";
import { CheckoutScreen } from "../screens/Checkout/CheckoutScreen.js";
import { GuestLookupScreen } from "../screens/OrderLookup/GuestLookupScreen.js";
import { ItemDetailScreen } from "../screens/ItemDetail/ItemDetailScreen.js";
import { MenuScreen } from "../screens/Menu/MenuScreen.js";
import { OrderStatusScreen } from "../screens/OrderStatus/OrderStatusScreen.js";
import type { RootStackParamList } from "./types.js";

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Menu">
        <Stack.Screen name="Menu" component={MenuScreen} options={{ headerShown: false }} />
        <Stack.Screen name="ItemDetail" component={ItemDetailScreen} options={{ title: "Customize" }} />
        <Stack.Screen name="Cart" component={CartScreen} options={{ title: "Your Cart" }} />
        <Stack.Screen name="Checkout" component={CheckoutScreen} options={{ title: "Checkout" }} />
        <Stack.Screen name="OrderStatus" component={OrderStatusScreen} options={{ title: "Order Status" }} />
        <Stack.Screen name="GuestLookup" component={GuestLookupScreen} options={{ title: "Track Order" }} />
        <Stack.Screen name="Login" component={LoginScreen} options={{ title: "Log In" }} />
        <Stack.Screen name="Signup" component={SignupScreen} options={{ title: "Sign Up" }} />
        <Stack.Screen name="Account" component={AccountScreen} options={{ title: "Account" }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
