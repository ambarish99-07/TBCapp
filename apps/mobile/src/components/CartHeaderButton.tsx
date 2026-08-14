import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { theme, type ColorPalette } from "../constants/theme";
import { useCartStore } from "../state/cartStore";
import { useTheme } from "../state/themeStore";
import type { RootStackParamList } from "../navigation/types";

/** Same circular cart icon + count badge as the Menu screen's header — reused anywhere a quick jump into Cart/Checkout is useful. */
export function CartHeaderButton() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const cartItemCount = useCartStore((state) => state.lines.reduce((sum, line) => sum + line.quantity, 0));

  return (
    <Pressable style={styles.cartButton} onPress={() => navigation.navigate("Cart")}>
      <Text style={styles.cartButtonText}>🛒</Text>
      {cartItemCount > 0 && (
        <View style={styles.cartBadge}>
          <Text style={styles.cartBadgeText}>{cartItemCount > 9 ? "9+" : cartItemCount}</Text>
        </View>
      )}
    </Pressable>
  );
}

const makeStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    cartButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      marginRight: theme.spacing(1),
    },
    cartButtonText: { fontSize: 16 },
    cartBadge: {
      position: "absolute",
      top: -6,
      right: -6,
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      paddingHorizontal: 5,
      backgroundColor: colors.danger,
      alignItems: "center",
      justifyContent: "center",
    },
    // includeFontPadding:false strips Android's default extra glyph padding, which is what
    // was pushing the digit past the badge's tight circular bounds and cutting it off.
    cartBadgeText: { color: "#fff", fontSize: 11, fontWeight: "800", lineHeight: 14, includeFontPadding: false },
  });
