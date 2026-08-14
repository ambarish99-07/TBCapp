import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  SUNDAY_VEG_CHOICES,
  TIFFIN_NONVEG_CURRY_DAYS,
  TIFFIN_NONVEG_SUNDAY_DISH,
  TIFFIN_WEEKLY_VEG_ROTATION,
  type SundayVegChoice,
} from "@tbc/shared-types";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTiffinPlans } from "../../api/tiffin.api";
import { theme, type ColorPalette } from "../../constants/theme";
import { useTheme } from "../../state/themeStore";
import type { RootStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "TiffinPlanSelect">;

const WEEK_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const SUNDAY_VEG_LABELS: Record<SundayVegChoice, string> = { paneer: "Paneer Sabzi", chole: "Chole" };

function dishForPreview(dietType: "veg" | "non-veg", day: string, sundayVegChoice: SundayVegChoice): string {
  if (day === "Sunday") {
    return dietType === "non-veg" ? TIFFIN_NONVEG_SUNDAY_DISH : `${SUNDAY_VEG_LABELS[sundayVegChoice]} (Sunday Special)`;
  }
  if (dietType === "non-veg" && TIFFIN_NONVEG_CURRY_DAYS[day]) return TIFFIN_NONVEG_CURRY_DAYS[day];
  return TIFFIN_WEEKLY_VEG_ROTATION[day];
}

/** Pick the Sunday special (veg only) and preview the fixed weekly schedule before subscribing. */
export function TiffinPlanSelectScreen({ route, navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { data: plans, isLoading } = useTiffinPlans();
  const plan = plans?.find((p) => p.id === route.params.planId);
  const [sundayVegChoice, setSundayVegChoice] = useState<SundayVegChoice>("paneer");

  if (isLoading) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!plan) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Text style={styles.info}>This plan is no longer available.</Text>
      </View>
    );
  }

  function handleContinue() {
    navigation.navigate("TiffinCheckout", {
      planId: route.params.planId,
      sundayVegChoice: plan!.dietType === "veg" ? sundayVegChoice : undefined,
    });
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{plan.name}</Text>
      <Text style={styles.meta}>
        {plan.dietType === "veg" ? "Veg" : "Non-Veg"} · {plan.durationDays} days · Lunch
      </Text>
      <Text style={styles.price}>₹{plan.price}</Text>

      {plan.dietType === "veg" && (
        <>
          <Text style={styles.sectionTitle}>Sunday Special — choose one</Text>
          <View style={styles.choiceRow}>
            {SUNDAY_VEG_CHOICES.map((choice) => (
              <Pressable
                key={choice}
                onPress={() => setSundayVegChoice(choice)}
                style={[styles.choiceChip, sundayVegChoice === choice && styles.choiceChipActive]}
              >
                <Text style={[styles.choiceChipText, sundayVegChoice === choice && styles.choiceChipTextActive]}>
                  {SUNDAY_VEG_LABELS[choice]}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      <Text style={styles.sectionTitle}>This Week's Schedule</Text>
      {WEEK_DAYS.map((day) => (
        <View key={day} style={styles.scheduleRow}>
          <Text style={styles.scheduleDay}>{day}</Text>
          <Text style={styles.scheduleDish}>{dishForPreview(plan.dietType, day, sundayVegChoice)}</Text>
        </View>
      ))}

      <Pressable style={styles.continueButton} onPress={handleContinue}>
        <Text style={styles.continueButtonText}>Continue</Text>
      </Pressable>
    </ScrollView>
  );
}

const makeStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    centered: { alignItems: "center", justifyContent: "center" },
    content: { padding: theme.spacing(2), paddingBottom: theme.spacing(4) },
    info: { fontSize: 14, color: colors.muted },
    title: { fontSize: 20, fontWeight: "800", color: colors.text },
    meta: { fontSize: 13, color: colors.muted, marginTop: 4 },
    price: { fontSize: 20, fontWeight: "800", color: colors.primary, marginTop: 8 },
    sectionTitle: { fontSize: 14, fontWeight: "700", color: colors.text, marginTop: theme.spacing(2.5), marginBottom: theme.spacing(1) },
    choiceRow: { flexDirection: "row", gap: 8 },
    choiceChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 16, backgroundColor: colors.surface },
    choiceChipActive: { backgroundColor: colors.primary },
    choiceChipText: { fontSize: 13, color: colors.text, fontWeight: "700" },
    choiceChipTextActive: { color: "#fff" },
    scheduleRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    scheduleDay: { fontSize: 13, fontWeight: "700", color: colors.text },
    scheduleDish: { fontSize: 13, color: colors.muted },
    continueButton: {
      backgroundColor: colors.primary,
      borderRadius: theme.radius,
      paddingVertical: theme.spacing(1.75),
      alignItems: "center",
      marginTop: theme.spacing(3),
    },
    continueButtonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  });
