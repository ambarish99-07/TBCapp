import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Pressable, StyleSheet, Text } from "react-native";
import { theme } from "../constants/theme";
import type { RootStackParamList } from "../navigation/types";

/**
 * Persistent shortcut back to the ordering flow (the Menu screen), shown on
 * every screen except Menu itself — Menu already is the ordering entry point,
 * so putting it there too would be redundant.
 */
export function OrderNowButton() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <Pressable style={styles.button} onPress={() => navigation.navigate("Menu")}>
      <Text style={styles.text}>Order Now</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: "absolute",
    // Sits above each screen's own bottom CTA (checkout/submit buttons), rather
    // than overlapping it, since most screens place their primary action flush
    // against the bottom edge.
    bottom: 88,
    right: 16,
    backgroundColor: theme.colors.accent,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 12,
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  text: { color: "#fff", fontWeight: "700", fontSize: 13 },
});
