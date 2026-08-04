import { StyleSheet, Text, View } from "react-native";
import { theme } from "../constants/theme";

/**
 * Flags sample/stock content so it's never mistaken for real product photography
 * or copy — swap out once real menu photos/text are supplied (see project spec §8).
 */
export function PlaceholderBadge() {
  return (
    <View style={styles.badge}>
      <Text style={styles.text}>Sample photo</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: "absolute",
    top: theme.spacing(1),
    right: theme.spacing(1),
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  text: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "600",
  },
});
