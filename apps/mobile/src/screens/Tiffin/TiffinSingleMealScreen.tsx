import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { SingleMealMenuItem, TiffinCarbChoice, TiffinDietType, TiffinMealTier } from "@tbc/shared-types";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSingleMealMenu } from "../../api/tiffin.api";
import { theme, type ColorPalette } from "../../constants/theme";
import { useTheme } from "../../state/themeStore";
import { useTiffinPreferencesStore } from "../../state/tiffinPreferencesStore";
import type { RootStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "TiffinSingleMeal">;

const DIET_TABS: { key: TiffinDietType; label: string }[] = [
  { key: "veg", label: "🟢 Veg" },
  { key: "non-veg", label: "🔴 Non-Veg" },
];

const TIER_TABS: { key: TiffinMealTier; label: string }[] = [
  { key: "regular", label: "Regular" },
  { key: "mini", label: "Mini Meal" },
  { key: "premium", label: "Premium" },
];

const MEAL_TYPE_LABELS: Record<SingleMealMenuItem["mealType"], string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner" };
const MEAL_TYPE_ORDER: SingleMealMenuItem["mealType"][] = ["breakfast", "lunch", "dinner"];

const CARB_CHOICES: TiffinCarbChoice[] = ["rice", "roti"];
const CARB_CHOICE_LABELS: Record<TiffinCarbChoice, string> = { rice: "Rice", roti: "Roti" };

/** Lunch/dinner can land on today or tomorrow depending on the ordering cutoff (see
 * mealOrderingWindow.ts on the API) — breakfast is always tomorrow. Device-local time is fine
 * here since it's just a display label, not the actual cutoff enforcement. */
function deliveryDayLabel(isoDate: string): string {
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const tomorrowIso = new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  if (isoDate === todayIso) return "Today";
  if (isoDate === tomorrowIso) return "Tomorrow";
  return isoDate;
}

/** A one-off "buy tomorrow's tiffin" purchase — no subscription, picked from a Veg/Non-Veg
 * section, each with three curated tiers. Mini additionally needs a rice-or-roti choice before
 * it can be ordered (it serves only one carb, unlike Regular/Premium which include both). */
export function TiffinSingleMealScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { data: menu, isLoading } = useSingleMealMenu();
  const vegOnly = useTiffinPreferencesStore((state) => state.vegOnly);
  const [activeDiet, setActiveDiet] = useState<TiffinDietType>("veg");
  const [activeTier, setActiveTier] = useState<TiffinMealTier>("regular");
  const [selected, setSelected] = useState<SingleMealMenuItem | null>(null);
  const [carbChoice, setCarbChoice] = useState<TiffinCarbChoice | null>(null);
  const visibleDietTabs = vegOnly ? DIET_TABS.filter((tab) => tab.key === "veg") : DIET_TABS;

  // The landing page's "Veg Only" switch hides non-veg here too — force back to veg if it's
  // switched on while Non-Veg happens to be selected.
  useEffect(() => {
    if (vegOnly) setActiveDiet("veg");
  }, [vegOnly]);

  const tierItems = useMemo(
    () =>
      (menu ?? [])
        .filter((item) => item.tier === activeTier && item.dietType === activeDiet)
        .sort((a, b) => MEAL_TYPE_ORDER.indexOf(a.mealType) - MEAL_TYPE_ORDER.indexOf(b.mealType)),
    [menu, activeTier, activeDiet]
  );

  function handleSelectDiet(diet: TiffinDietType) {
    setActiveDiet(diet);
    setSelected(null);
    setCarbChoice(null);
  }

  function handleSelectTier(tier: TiffinMealTier) {
    setActiveTier(tier);
    setSelected(null);
    setCarbChoice(null);
  }

  function handleSelectItem(item: SingleMealMenuItem) {
    setSelected(item);
    setCarbChoice(null);
  }

  const canContinue = !!selected && (!selected.carbChoiceRequired || !!carbChoice);

  function handleContinue() {
    if (!selected || !canContinue) return;
    navigation.navigate("TiffinSingleMealCheckout", {
      tier: selected.tier,
      mealType: selected.mealType,
      dietType: selected.dietType,
      date: selected.date,
      dishName: selected.dishName,
      price: selected.price,
      carbChoice: selected.carbChoiceRequired ? carbChoice ?? undefined : undefined,
    });
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Order a Single Meal</Text>
        <Text style={styles.subtitle}>No subscription needed — pick a meal and pay once.</Text>
        <Text style={styles.freshNote}>
          🍳 Freshly prepared per order — no wastage. Lunch & dinner ordered in time are cooked and delivered the same
          day; order after the cutoff and it moves to the next day.
        </Text>

        <View style={styles.tabs}>
          {visibleDietTabs.map((tab) => (
            <Pressable key={tab.key} onPress={() => handleSelectDiet(tab.key)} style={[styles.tab, activeDiet === tab.key && styles.tabActive]}>
              <Text style={[styles.tabText, activeDiet === tab.key && styles.tabTextActive]}>{tab.label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.tabs}>
          {TIER_TABS.map((tab) => (
            <Pressable key={tab.key} onPress={() => handleSelectTier(tab.key)} style={[styles.tab, activeTier === tab.key && styles.tabActive]}>
              <Text style={[styles.tabText, activeTier === tab.key && styles.tabTextActive]}>{tab.label}</Text>
            </Pressable>
          ))}
        </View>

        {isLoading && <ActivityIndicator color={colors.primary} style={{ marginTop: theme.spacing(2) }} />}
        {!isLoading && tierItems.length === 0 && <Text style={styles.info}>No meals available for this selection right now.</Text>}

        {tierItems.map((item) => {
          const isSelected = selected?.mealType === item.mealType && selected?.tier === item.tier;
          return (
            <Pressable
              key={item.mealType}
              style={[styles.mealCard, isSelected && styles.mealCardActive]}
              onPress={() => handleSelectItem(item)}
            >
              {item.imageUrl && <Image source={{ uri: item.imageUrl }} style={styles.mealImage} resizeMode="cover" />}
              <View style={{ flex: 1 }}>
                <Text style={styles.mealType}>
                  {MEAL_TYPE_LABELS[item.mealType]} · {deliveryDayLabel(item.date)}
                </Text>
                <Text style={styles.mealDish}>{item.dishName}</Text>
              </View>
              <Text style={styles.mealPrice}>₹{item.price}</Text>
            </Pressable>
          );
        })}

        {selected?.carbChoiceRequired && (
          <>
            <Text style={styles.sectionTitle}>Choose Rice or Roti</Text>
            <View style={styles.choiceRow}>
              {CARB_CHOICES.map((choice) => (
                <Pressable
                  key={choice}
                  onPress={() => setCarbChoice(choice)}
                  style={[styles.choiceChip, carbChoice === choice && styles.choiceChipActive]}
                >
                  <Text style={[styles.choiceChipText, carbChoice === choice && styles.choiceChipTextActive]}>
                    {CARB_CHOICE_LABELS[choice]}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      {selected && (
        <View style={styles.footer}>
          <Pressable style={[styles.continueButton, !canContinue && styles.continueButtonDisabled]} onPress={handleContinue} disabled={!canContinue}>
            <Text style={styles.continueButtonText}>Continue</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const makeStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { padding: theme.spacing(2), paddingBottom: theme.spacing(4) },
    title: { fontSize: 20, fontWeight: "800", color: colors.text },
    subtitle: { fontSize: 13, color: colors.muted, marginTop: 4 },
    freshNote: { fontSize: 12, color: colors.muted, marginTop: theme.spacing(1), marginBottom: theme.spacing(2), lineHeight: 17 },
    tabs: { flexDirection: "row", gap: 8, marginBottom: theme.spacing(2) },
    tab: { flex: 1, paddingVertical: 8, borderRadius: 16, backgroundColor: colors.surface, alignItems: "center" },
    tabActive: { backgroundColor: colors.primary },
    tabText: { fontSize: 12, color: colors.text, fontWeight: "600", textAlign: "center" },
    tabTextActive: { color: "#fff", fontWeight: "700" },
    info: { fontSize: 13, color: colors.muted },
    mealCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: theme.radius,
      borderWidth: 1,
      borderColor: colors.border,
      padding: theme.spacing(1.5),
      marginBottom: theme.spacing(1.25),
    },
    mealCardActive: { borderColor: colors.primary },
    mealImage: { width: 56, height: 56, borderRadius: theme.radius - 4, marginRight: theme.spacing(1.25) },
    mealType: { fontSize: 12, fontWeight: "700", color: colors.muted },
    mealDish: { fontSize: 15, fontWeight: "700", color: colors.text, marginTop: 2 },
    mealPrice: { fontSize: 16, fontWeight: "800", color: colors.primary },
    sectionTitle: { fontSize: 14, fontWeight: "700", color: colors.text, marginTop: theme.spacing(1.5), marginBottom: theme.spacing(1) },
    choiceRow: { flexDirection: "row", gap: 8 },
    choiceChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 16, backgroundColor: colors.surface },
    choiceChipActive: { backgroundColor: colors.primary },
    choiceChipText: { fontSize: 13, color: colors.text, fontWeight: "700" },
    choiceChipTextActive: { color: "#fff" },
    footer: {
      padding: theme.spacing(2),
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    continueButton: {
      backgroundColor: colors.primary,
      borderRadius: theme.radius,
      paddingVertical: theme.spacing(1.75),
      alignItems: "center",
    },
    continueButtonDisabled: { opacity: 0.5 },
    continueButtonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  });
