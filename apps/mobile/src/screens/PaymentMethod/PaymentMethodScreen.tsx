import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMemo } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { PAYMENT_OPTION_GROUPS, type PaymentOption } from "../../constants/paymentOptions";
import { theme, type ColorPalette } from "../../constants/theme";
import { usePaymentMethodStore } from "../../state/paymentMethodStore";
import { useTheme } from "../../state/themeStore";
import type { RootStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "PaymentMethod">;

/** Opened from the Cart's "Pay using" row — picking an option here saves it to
 * paymentMethodStore and returns straight to Cart. */
export function PaymentMethodScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const selected = usePaymentMethodStore((state) => state.selected);
  const select = usePaymentMethodStore((state) => state.select);

  function handleSelect(option: PaymentOption) {
    select(option);
    navigation.goBack();
  }

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={{ padding: theme.spacing(2) }}
      data={PAYMENT_OPTION_GROUPS}
      keyExtractor={(group) => group.title}
      renderItem={({ item: group }) => (
        <View style={styles.group}>
          <Text style={styles.groupTitle}>{group.title}</Text>
          {group.options.map((option) => {
            const isSelected = selected?.id === option.id;
            return (
              <Pressable key={option.id} style={[styles.option, isSelected && styles.optionActive]} onPress={() => handleSelect(option)}>
                <Text style={[styles.optionText, isSelected && styles.optionTextActive]}>{option.label}</Text>
                {isSelected && <Text style={styles.check}>✓</Text>}
              </Pressable>
            );
          })}
        </View>
      )}
    />
  );
}

const makeStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    group: { marginBottom: theme.spacing(2) },
    groupTitle: { fontSize: 12, fontWeight: "700", color: colors.muted, marginBottom: theme.spacing(1), textTransform: "uppercase" },
    option: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.surface,
      borderRadius: theme.radius,
      padding: theme.spacing(1.5),
      marginBottom: theme.spacing(1),
      borderWidth: 1,
      borderColor: colors.border,
    },
    optionActive: { borderColor: colors.primary },
    optionText: { fontSize: 15, color: colors.text, fontWeight: "600" },
    optionTextActive: { color: colors.primary, fontWeight: "700" },
    check: { color: colors.primary, fontWeight: "800", fontSize: 16 },
  });
