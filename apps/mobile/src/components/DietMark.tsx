import { StyleSheet, View } from "react-native";
import { theme } from "../constants/theme";

/** The standard Indian FSSAI-style diet mark (a green square + dot for veg, a red/maroon square
 * + triangle for non-veg) — fixed colors regardless of light/dark theme, same as the real
 * packaging symbol always looks the same no matter where it's printed. Purely informational,
 * not interactive. Used as a header-right badge on any brand/service's menu screen: green when
 * everything on offer is vegetarian, red the moment anything isn't. */
export function DietMark({ isNonVeg }: { isNonVeg: boolean }) {
  const color = isNonVeg ? "#B3261E" : "#2E7D32";
  return (
    <View style={[styles.square, { borderColor: color }]}>
      {isNonVeg ? <View style={[styles.triangle, { borderBottomColor: color }]} /> : <View style={[styles.dot, { backgroundColor: color }]} />}
    </View>
  );
}

const styles = StyleSheet.create({
  square: {
    width: 20,
    height: 20,
    borderWidth: 1.5,
    borderRadius: 3,
    alignItems: "center",
    justifyContent: "center",
    marginRight: theme.spacing(1.5),
  },
  dot: { width: 9, height: 9, borderRadius: 5 },
  triangle: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderBottomWidth: 8,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
  },
});
