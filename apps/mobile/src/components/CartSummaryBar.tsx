import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { theme, type ColorPalette } from "../constants/theme";
import { useCartStore } from "../state/cartStore";
import { useTheme } from "../state/themeStore";

interface Props {
  // Deliberately just the one method this component calls — react-navigation's full
  // NativeStackNavigationProp type is invariant per-screen-name and won't unify across
  // the different callers (Menu's vs Combos') without this narrowing.
  navigation: { navigate: (screen: "Cart") => void };
}

/** Floating bar that appears once the cart has anything in it — a shortcut straight to the cart from wherever quick-adding happens. */
export function CartSummaryBar({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const itemCount = useCartStore((state) => state.lines.reduce((sum, line) => sum + line.quantity, 0));
  const clearCart = useCartStore((state) => state.clear);

  if (itemCount === 0) return null;

  return (
    <View style={styles.wrap}>
      <Pressable style={styles.bar} onPress={() => navigation.navigate("Cart")}>
        <Text style={styles.countText}>
          {itemCount} item{itemCount === 1 ? "" : "s"} added
        </Text>
        <View style={styles.proceedRow}>
          <Text style={styles.proceedText}>Proceed</Text>
          <Text style={styles.arrow}>→</Text>
        </View>
      </Pressable>
      {/* Clears everything just added, in case the customer changes their mind before checking out. */}
      <Pressable style={styles.closeButton} onPress={clearCart} hitSlop={8}>
        <Text style={styles.closeButtonText}>✕</Text>
      </Pressable>
    </View>
  );
}

const makeStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    // Extra top/right space so the close badge below can overlap the bar's corner
    // without getting clipped or covering the text underneath it.
    wrap: { marginTop: theme.spacing(1) + 10, paddingTop: 10, paddingRight: 10 },
    bar: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: colors.primary,
      borderRadius: theme.radius,
      paddingVertical: theme.spacing(1.5),
      paddingHorizontal: theme.spacing(2),
    },
    countText: { color: "#fff", fontWeight: "700", fontSize: 13 },
    proceedRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    proceedText: { color: "#fff", fontWeight: "800", fontSize: 14 },
    arrow: { color: "#fff", fontWeight: "800", fontSize: 16 },
    closeButton: {
      position: "absolute",
      top: 0,
      right: 0,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: colors.danger,
      alignItems: "center",
      justifyContent: "center",
    },
    closeButtonText: { color: "#fff", fontWeight: "800", fontSize: 11 },
  });
