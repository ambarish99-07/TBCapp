import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { useAuthStore } from "./src/state/authStore";
import { useBrandStore } from "./src/state/brandStore";
import { useCartStore } from "./src/state/cartStore";
import { usePaymentMethodStore } from "./src/state/paymentMethodStore";
import { useThemeStore } from "./src/state/themeStore";

const queryClient = new QueryClient();

export default function App() {
  const hydrateAuth = useAuthStore((state) => state.hydrate);
  const hydrateTheme = useThemeStore((state) => state.hydrate);
  const hydratePaymentMethod = usePaymentMethodStore((state) => state.hydrate);
  const hydrateCart = useCartStore((state) => state.hydrate);
  const hydrateBrand = useBrandStore((state) => state.hydrate);
  const resolvedScheme = useThemeStore((state) => state.resolvedScheme);

  useEffect(() => {
    hydrateAuth();
    hydrateTheme();
    hydratePaymentMethod();
    hydrateCart();
    hydrateBrand();
  }, [hydrateAuth, hydrateTheme, hydratePaymentMethod, hydrateCart, hydrateBrand]);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style={resolvedScheme === "dark" ? "light" : "dark"} />
        <RootNavigator />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
