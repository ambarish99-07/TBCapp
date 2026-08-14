import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMemo } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { PAYMENT_OPTION_GROUPS, type PaymentOption } from "../../constants/paymentOptions";
import { theme, type ColorPalette } from "../../constants/theme";
import { usePaymentMethodStore } from "../../state/paymentMethodStore";
import { useTheme } from "../../state/themeStore";
import type { RootStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "PaymentMethod">;

/** Opened from the Cart's "Pay using" row (and GG Tiffin's "Pay via" row) — picking an option
 * here saves it to paymentMethodStore and returns to the caller. `hideCod` drops the Cash on
 * Delivery option (and its now-empty group) — used by monthly tiffin subscriptions, which can't
 * be paid COD; Cart's call passes no params, so it still shows every option. */
export function PaymentMethodScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const selected = usePaymentMethodStore((state) => state.selected);
  const select = usePaymentMethodStore((state) => state.select);
  const hideCod = route.params?.hideCod ?? false;
  const groups = hideCod
    ? PAYMENT_OPTION_GROUPS.map((group) => ({ ...group, options: group.options.filter((option) => option.apiMethod !== "cod") })).filter(
        (group) => group.options.length > 0
      )
    : PAYMENT_OPTION_GROUPS;

  function handleSelect(option: PaymentOption) {
    select(option);
    navigation.goBack();
  }

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={{ padding: theme.spacing(2) }}
      data={groups}
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
