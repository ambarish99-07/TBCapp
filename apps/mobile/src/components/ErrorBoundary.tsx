import { Component, type ErrorInfo, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../state/themeStore";

/**
 * The one thing standing between an unexpected render crash and a blank/native-red crash screen
 * with no recovery — React error boundaries only exist as class components (there's no hook
 * equivalent), so this stays a class purely to satisfy that API; the actual fallback UI is the
 * function component below it, which can use useTheme like anywhere else in the app.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // No crash-reporting service wired up yet — this at least survives in Metro/device logs
    // instead of vanishing the moment the fallback UI takes over.
    console.error("[ErrorBoundary] caught a render error:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return <ErrorFallback onRetry={() => this.setState({ error: null })} />;
    }
    return this.props.children;
  }
}

function ErrorFallback({ onRetry }: { onRetry: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Text style={[styles.emoji]}>😕</Text>
      <Text style={[styles.title, { color: colors.text }]}>Something went wrong</Text>
      <Text style={[styles.message, { color: colors.muted }]}>
        This screen ran into a problem. Your cart and account are safe — try again, and if it keeps happening, restart the app.
      </Text>
      <Pressable style={[styles.button, { backgroundColor: colors.primary }]} onPress={onRetry}>
        <Text style={styles.buttonText}>Try Again</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  emoji: { fontSize: 48, marginBottom: 16 },
  title: { fontSize: 18, fontWeight: "800", marginBottom: 8 },
  message: { fontSize: 14, textAlign: "center", lineHeight: 20, marginBottom: 24 },
  button: { paddingHorizontal: 28, paddingVertical: 12, borderRadius: 14 },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
