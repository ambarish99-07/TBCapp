import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { TiffinDietType, TiffinMealTier, TiffinMealType } from "@tbc/shared-types";
import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { theme, type ColorPalette } from "../../constants/theme";
import { useTheme } from "../../state/themeStore";
import { useTiffinPreferencesStore } from "../../state/tiffinPreferencesStore";
import { singleMealDishForDay, WEEK_DAYS } from "../../utils/tiffinDishForDay";
import type { RootStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "TiffinWeeklyMenu">;

const TIER_TABS: { key: TiffinMealTier; label: string }[] = [
  { key: "regular", label: "Regular" },
  { key: "mini", label: "Mini Meal" },
  { key: "premium", label: "Premium" },
];

const DIET_TABS: { key: TiffinDietType; label: string }[] = [
  { key: "veg", label: "🟢 Veg" },
  { key: "non-veg", label: "🔴 Non-Veg" },
];

const MEAL_TYPES: TiffinMealType[] = ["breakfast", "lunch", "dinner"];
const MEAL_TYPE_LABELS: Record<TiffinMealType, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner" };

const JS_DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const todayName = JS_DAY_NAMES[new Date().getDay()];

/** A standalone browsable version of the real curated menu, across all three single-meal tiers —
 * pick Regular/Mini Meal/Premium, veg or non-veg, and a day, and see that combination's
 * breakfast/lunch/dinner. Not tied to any specific plan or order; reached from GG Tiffin's "View
 * Menu" link next to Available Plans. */
export function TiffinWeeklyMenuScreen(_props: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const vegOnly = useTiffinPreferencesStore((state) => state.vegOnly);
  const [tier, setTier] = useState<TiffinMealTier>("regular");
  const [dietType, setDietType] = useState<TiffinDietType>("veg");
  const [selectedDay, setSelectedDay] = useState(todayName);
  const [dayPickerOpen, setDayPickerOpen] = useState(false);
  const visibleDietTabs = vegOnly ? DIET_TABS.filter((tab) => tab.key === "veg") : DIET_TABS;

  // The landing page's "Veg Only" switch hides non-veg here too — force back to veg if it's
  // switched on while Non-Veg happens to be selected.
  useEffect(() => {
    if (vegOnly) setDietType("veg");
  }, [vegOnly]);

  function handlePickDay(day: string) {
    setSelectedDay(day);
    setDayPickerOpen(false);
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Weekly Menu</Text>
        <Text style={styles.subtitle}>The real curated dishes we serve, tier by tier, day by day.</Text>

        <View style={styles.tabs}>
          {TIER_TABS.map((tab) => (
            <Pressable key={tab.key} onPress={() => setTier(tab.key)} style={[styles.tab, tier === tab.key && styles.tabActive]}>
              <Text style={[styles.tabText, tier === tab.key && styles.tabTextActive]}>{tab.label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.tabs}>
          {visibleDietTabs.map((tab) => (
            <Pressable key={tab.key} onPress={() => setDietType(tab.key)} style={[styles.tab, dietType === tab.key && styles.tabActive]}>
              <Text style={[styles.tabText, dietType === tab.key && styles.tabTextActive]}>{tab.label}</Text>
            </Pressable>
          ))}
        </View>

        <Pressable style={styles.daySelector} onPress={() => setDayPickerOpen(true)}>
          <Text style={styles.daySelectorLabel}>{selectedDay}</Text>
          <Text style={styles.daySelectorChevron}>▾</Text>
        </Pressable>

        {MEAL_TYPES.map((mealType) => {
          const dish = singleMealDishForDay(tier, dietType, selectedDay, mealType);
          return (
            <View key={mealType} style={styles.mealRow}>
              <Text style={styles.mealType}>{MEAL_TYPE_LABELS[mealType]}</Text>
              {dish ? (
                <Text style={styles.mealDish}>{dish}</Text>
              ) : (
                <Text style={styles.mealUnavailable}>Not available for Mini Meal</Text>
              )}
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={dayPickerOpen} animationType="fade" transparent onRequestClose={() => setDayPickerOpen(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setDayPickerOpen(false)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Choose a Day</Text>
            {WEEK_DAYS.map((day) => (
              <Pressable key={day} style={[styles.dayOption, day === selectedDay && styles.dayOptionActive]} onPress={() => handlePickDay(day)}>
                <Text style={[styles.dayOptionText, day === selectedDay && styles.dayOptionTextActive]}>{day}</Text>
                {day === selectedDay && <Text style={styles.dayOptionCheck}>✓</Text>}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const makeStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { padding: theme.spacing(2), paddingBottom: theme.spacing(4) },
    title: { fontSize: 20, fontWeight: "800", color: colors.text },
    subtitle: { fontSize: 13, color: colors.muted, marginTop: 4, marginBottom: theme.spacing(2) },
    tabs: { flexDirection: "row", gap: 8, marginBottom: theme.spacing(1.5) },
    tab: { flex: 1, paddingVertical: 8, borderRadius: 16, backgroundColor: colors.surface, alignItems: "center" },
    tabActive: { backgroundColor: colors.primary },
    tabText: { fontSize: 12, color: colors.text, fontWeight: "600", textAlign: "center" },
    tabTextActive: { color: "#fff", fontWeight: "700" },
    daySelector: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: theme.radius,
      paddingVertical: theme.spacing(1.5),
      paddingHorizontal: theme.spacing(2),
      marginBottom: theme.spacing(2),
    },
    daySelectorLabel: { fontSize: 16, fontWeight: "800", color: colors.text },
    daySelectorChevron: { fontSize: 16, fontWeight: "800", color: colors.primary },
    mealRow: {
      backgroundColor: colors.surface,
      borderRadius: theme.radius,
      padding: theme.spacing(1.5),
      marginBottom: theme.spacing(1.25),
    },
    mealType: { fontSize: 12, fontWeight: "700", color: colors.muted },
    mealDish: { fontSize: 16, fontWeight: "700", color: colors.text, marginTop: 4 },
    mealUnavailable: { fontSize: 14, fontStyle: "italic", color: colors.muted, marginTop: 4 },
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: theme.spacing(3) },
    modalCard: { backgroundColor: colors.background, borderRadius: theme.radius, padding: theme.spacing(2) },
    modalTitle: { fontSize: 16, fontWeight: "800", color: colors.text, marginBottom: theme.spacing(1.5) },
    dayOption: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: theme.spacing(1.5),
      borderRadius: theme.radius,
      backgroundColor: colors.surface,
      marginBottom: theme.spacing(1),
    },
    dayOptionActive: { borderWidth: 1, borderColor: colors.primary },
    dayOptionText: { fontSize: 15, fontWeight: "700", color: colors.text },
    dayOptionTextActive: { color: colors.primary },
    dayOptionCheck: { color: colors.primary, fontWeight: "800", fontSize: 16 },
  });
