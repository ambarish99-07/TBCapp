import { Pressable, StyleSheet, Text } from "react-native";
import { theme, type ColorPalette } from "../constants/theme";

/** Shared visual for one row of the app-wide order tracker — see ActiveOrderPills.tsx. */
export function ActiveOrderChip({
  label,
  onPress,
  styles,
}: {
  label: string;
  onPress: () => void;
  styles: ReturnType<typeof makePillStyles>;
}) {
  return (
    <Pressable style={styles.pill} onPress={onPress}>
      <Text style={styles.pillText}>{label}</Text>
    </Pressable>
  );
}

export const makePillStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    pill: {
      backgroundColor: colors.primary,
      borderRadius: 20,
      paddingHorizontal: theme.spacing(1.75),
      paddingVertical: theme.spacing(1),
      shadowColor: "#000",
      shadowOpacity: 0.25,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 3 },
      elevation: 6,
    },
    pillText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  });
