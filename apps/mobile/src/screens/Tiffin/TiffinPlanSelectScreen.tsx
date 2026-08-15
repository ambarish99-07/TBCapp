import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { type TiffinMealType, type TiffinPlanStyle } from "@tbc/shared-types";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTiffinPlans } from "../../api/tiffin.api";
import { theme, type ColorPalette } from "../../constants/theme";
import { useTheme } from "../../state/themeStore";
import { dishForDay, WEEK_DAYS } from "../../utils/tiffinDishForDay";
import { effectivePlanPrice } from "../../utils/tiffinPlanPrice";
import type { RootStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "TiffinPlanSelect">;

const MEAL_TYPE_CHOICES: TiffinMealType[] = ["breakfast", "lunch", "dinner"];
const MEAL_TYPE_LABELS: Record<TiffinMealType, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner" };

function styleMetaLabel(style: TiffinPlanStyle): string {
  if (style === "twice-daily") return "Lunch & Dinner";
  if (style === "thrice-daily") return "Breakfast, Lunch & Dinner";
  return "Breakfast, Lunch, or Dinner";
}

/** What meal types this plan actually schedules, given the customer's "single" choice (if any) —
 * mirrors the backend's resolveMealTypes exactly, so the preview below never lies. */
function resolveMealTypesForPreview(style: TiffinPlanStyle, mealType: TiffinMealType): TiffinMealType[] {
  if (style === "twice-daily") return ["lunch", "dinner"];
  if (style === "thrice-daily") return ["breakfast", "lunch", "dinner"];
  return [mealType];
}

/** Choose a meal type for "single" style plans, then preview the fixed weekly schedule before subscribing. */
export function TiffinPlanSelectScreen({ route, navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { data: plans, isLoading } = useTiffinPlans();
  const plan = plans?.find((p) => p.id === route.params.planId);
  const [mealType, setMealType] = useState<TiffinMealType>("lunch");

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

  const scheduledMealTypes = resolveMealTypesForPreview(plan.style, mealType);

  function handleContinue() {
    navigation.navigate("TiffinCheckout", {
      planId: route.params.planId,
      mealType: plan!.style === "single" ? mealType : undefined,
    });
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{plan.name}</Text>
      <Text style={styles.meta}>
        {plan.dietType === "veg" ? "Veg" : "Non-Veg"} · {plan.durationDays} days · {styleMetaLabel(plan.style)}
      </Text>
      {plan.salePercent ? (
        <View style={styles.priceRow}>
          <Text style={styles.priceStrikethrough}>₹{plan.price}</Text>
          <Text style={styles.price}>₹{effectivePlanPrice(plan)}</Text>
          <View style={styles.saleBadge}>
            <Text style={styles.saleBadgeText}>{plan.salePercent}% OFF</Text>
          </View>
        </View>
      ) : (
        <Text style={styles.price}>₹{plan.price}</Text>
      )}

      {plan.style === "single" && (
        <>
          <Text style={styles.sectionTitle}>Choose Breakfast, Lunch, or Dinner</Text>
          <View style={styles.choiceRow}>
            {MEAL_TYPE_CHOICES.map((choice) => (
              <Pressable
                key={choice}
                onPress={() => setMealType(choice)}
                style={[styles.choiceChip, mealType === choice && styles.choiceChipActive]}
              >
                <Text style={[styles.choiceChipText, mealType === choice && styles.choiceChipTextActive]}>
                  {MEAL_TYPE_LABELS[choice]}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      <Text style={styles.sectionTitle}>This Week's Schedule</Text>
      {WEEK_DAYS.map((day) => (
        <View key={day} style={styles.scheduleDayGroup}>
          <Text style={styles.scheduleDay}>{day}</Text>
          {scheduledMealTypes.map((type) => (
            <View key={type} style={styles.scheduleRow}>
              <Text style={styles.scheduleMealType}>{scheduledMealTypes.length > 1 ? MEAL_TYPE_LABELS[type] : ""}</Text>
              <Text style={styles.scheduleDish}>{dishForDay(plan.dietType, day, type)}</Text>
            </View>
          ))}
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
    priceRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
    priceStrikethrough: { fontSize: 15, color: colors.muted, textDecorationLine: "line-through" },
    saleBadge: { backgroundColor: colors.danger, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
    saleBadgeText: { fontSize: 11, fontWeight: "800", color: "#fff" },
    sectionTitle: { fontSize: 14, fontWeight: "700", color: colors.text, marginTop: theme.spacing(2.5), marginBottom: theme.spacing(1) },
    choiceRow: { flexDirection: "row", gap: 8 },
    choiceChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 16, backgroundColor: colors.surface },
    choiceChipActive: { backgroundColor: colors.primary },
    choiceChipText: { fontSize: 13, color: colors.text, fontWeight: "700" },
    choiceChipTextActive: { color: "#fff" },
    scheduleDayGroup: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
    scheduleDay: { fontSize: 13, fontWeight: "700", color: colors.text },
    scheduleRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
    scheduleMealType: { fontSize: 12, color: colors.muted, width: 80 },
    scheduleDish: { fontSize: 13, color: colors.muted, flex: 1, textAlign: "right" },
    continueButton: {
      backgroundColor: colors.primary,
      borderRadius: theme.radius,
      paddingVertical: theme.spacing(1.75),
      alignItems: "center",
      marginTop: theme.spacing(3),
    },
    continueButtonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  });
