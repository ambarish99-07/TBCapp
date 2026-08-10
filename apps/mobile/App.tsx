import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { useAuthStore } from "./src/state/authStore";
import { useThemeStore } from "./src/state/themeStore";

const queryClient = new QueryClient();

export default function App() {
  const hydrateAuth = useAuthStore((state) => state.hydrate);
  const hydrateTheme = useThemeStore((state) => state.hydrate);
  const resolvedScheme = useThemeStore((state) => state.resolvedScheme);

  useEffect(() => {
    hydrateAuth();
    hydrateTheme();
  }, [hydrateAuth, hydrateTheme]);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style={resolvedScheme === "dark" ? "light" : "dark"} />
        <RootNavigator />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
