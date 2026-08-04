import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { AccountScreen } from "../screens/Account/AccountScreen";
import { LoginScreen } from "../screens/Auth/LoginScreen";
import { SignupScreen } from "../screens/Auth/SignupScreen";
import { CartScreen } from "../screens/Cart/CartScreen";
import { CheckoutScreen } from "../screens/Checkout/CheckoutScreen";
import { GuestLookupScreen } from "../screens/OrderLookup/GuestLookupScreen";
import { ItemDetailScreen } from "../screens/ItemDetail/ItemDetailScreen";
import { MenuScreen } from "../screens/Menu/MenuScreen";
import { OrderStatusScreen } from "../screens/OrderStatus/OrderStatusScreen";
import type { RootStackParamList } from "./types";

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
