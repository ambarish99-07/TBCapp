import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMemo } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import { DeliveryDetailsForm } from "../../components/DeliveryDetailsForm";
import { theme, type ColorPalette } from "../../constants/theme";
import { useTheme } from "../../state/themeStore";
import type { RootStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Checkout">;

/**
 * Saves the account's own delivery address (same PATCH /auth/me as EditProfileScreen) —
 * opened from Cart's "Complete your profile" nudge, or to update it later. Once saved,
 * Cart never asks for it again: Proceed to Pay reads straight from the account.
 */
export function CheckoutScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <ScrollView style={styles.screen}>
      <Text style={styles.sectionTitle}>Delivery Details</Text>
      <DeliveryDetailsForm onSaved={() => navigation.goBack()} />
    </ScrollView>
  );
}

const makeStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background, padding: theme.spacing(2) },
    sectionTitle: { fontSize: 14, fontWeight: "700", color: colors.text, marginBottom: 8 },
  });
