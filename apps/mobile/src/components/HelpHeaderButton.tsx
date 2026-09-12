import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { theme, type ColorPalette } from "../constants/theme";
import { useTheme } from "../state/themeStore";
import type { RootStackParamList } from "../navigation/types";

/** Same circular header-icon treatment as CartHeaderButton — a top-right entry point into the
 * Help screen (contact support + FAQ), placed on Account since that's where a customer already
 * goes looking for "how do I manage my account/orders" type things. */
export function HelpHeaderButton() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <Pressable style={styles.button} onPress={() => navigation.navigate("Help")} hitSlop={8}>
      <Text style={styles.icon}>❓</Text>
    </Pressable>
  );
}

const makeStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    button: {
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
    icon: { fontSize: 16 },
  });
