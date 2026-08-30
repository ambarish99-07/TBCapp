import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  MAX_SINGLE_MEAL_QUANTITY,
  type SingleMealAddOn,
  type SingleMealMenuItem,
  type TiffinCarbChoice,
  type TiffinDietType,
  type TiffinMealTier,
} from "@tbc/shared-types";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSingleMealMenu } from "../../api/tiffin.api";
import { DraggableSheet } from "../../components/DraggableSheet";
import { theme, type ColorPalette } from "../../constants/theme";
import { useTheme } from "../../state/themeStore";
import { useTiffinPreferencesStore } from "../../state/tiffinPreferencesStore";
import { composeFullDishName } from "../../utils/tiffinDishForDay";
import type { RootStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "TiffinSingleMeal">;

const DIET_TABS: { key: TiffinDietType; label: string }[] = [
  { key: "veg", label: "🟢 Veg" },
  { key: "non-veg", label: "🔴 Non-Veg" },
];

/** composeFullDishName needs a dish's hasAddOns/riceSubstitute flags — a purchasable
 * SingleMealMenuItem doesn't carry those fields directly, but its own already-resolved `addOns`
 * array implies them: empty means hasAddOns is false, and the first staple (when present) is
 * "Pulao" only when riceSubstitute is "pulao" (see singleMealMenu.ts#resolveAddOns' ordering). */
function dishDisplayShape(item: SingleMealMenuItem): { dishName: string; hasAddOns: boolean; riceSubstitute: "rice" | "pulao" } {
  return {
    dishName: item.dishName,
    hasAddOns: item.addOns.length > 0,
    riceSubstitute: item.addOns[0]?.name === "Pulao" ? "pulao" : "rice",
  };
}

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
 * section, each with three curated tiers. Tapping a meal opens a customize pop-up: rice/roti
 * choice for Mini, a catalog of real optional add-ons (rice/roti/daal/extra protein — each
 * individually priced, none included by default), and quantity, before continuing to checkout. */
export function TiffinSingleMealScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { data: menu, isLoading } = useSingleMealMenu();
  const vegOnly = useTiffinPreferencesStore((state) => state.vegOnly);
  const [activeDiet, setActiveDiet] = useState<TiffinDietType>("veg");
  const [activeTier, setActiveTier] = useState<TiffinMealTier>("regular");
  const [customizeItem, setCustomizeItem] = useState<SingleMealMenuItem | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [carbChoice, setCarbChoice] = useState<TiffinCarbChoice | null>(null);
  const [selectedAddOnNames, setSelectedAddOnNames] = useState<string[]>([]);
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
  }

  function handleSelectTier(tier: TiffinMealTier) {
    setActiveTier(tier);
  }

  function handleOpenCustomize(item: SingleMealMenuItem) {
    setCustomizeItem(item);
    setQuantity(1);
    setCarbChoice(null);
    setSelectedAddOnNames([]);
  }

  function closeCustomize() {
    setCustomizeItem(null);
  }

  function toggleAddOn(name: string) {
    setSelectedAddOnNames((current) => (current.includes(name) ? current.filter((n) => n !== name) : [...current, name]));
  }

  const selectedAddOns: SingleMealAddOn[] = customizeItem
    ? customizeItem.addOns.filter((addOn) => selectedAddOnNames.includes(addOn.name))
    : [];
  const addOnsTotal = selectedAddOns.reduce((sum, addOn) => sum + addOn.price, 0);
  const totalPrice = customizeItem ? (customizeItem.price + addOnsTotal) * quantity : 0;
  const canAdd = !!customizeItem && (!customizeItem.carbChoiceRequired || !!carbChoice);

  function handleAdd() {
    if (!customizeItem || !canAdd) return;
    navigation.navigate("TiffinSingleMealCheckout", {
      tier: customizeItem.tier,
      mealType: customizeItem.mealType,
      dietType: customizeItem.dietType,
      date: customizeItem.date,
      dishName: customizeItem.dishName,
      price: customizeItem.price,
      quantity,
      carbChoice: customizeItem.carbChoiceRequired ? carbChoice ?? undefined : undefined,
      addOns: selectedAddOns,
    });
    setCustomizeItem(null);
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

        {tierItems.map((item) => (
          <Pressable key={item.mealType} style={styles.mealCard} onPress={() => handleOpenCustomize(item)}>
            {item.imageUrl && <Image source={{ uri: item.imageUrl }} style={styles.mealImage} resizeMode="cover" />}
            <View style={{ flex: 1 }}>
              <Text style={styles.mealType}>
                {MEAL_TYPE_LABELS[item.mealType]} · {deliveryDayLabel(item.date)}
              </Text>
              <Text style={styles.mealDish}>{composeFullDishName(item.tier, item.mealType, dishDisplayShape(item))}</Text>
              {item.addOns.length > 0 && <Text style={styles.addOnsHint}>Add-ons available</Text>}
            </View>
            <Text style={styles.mealPrice}>₹{item.price}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <Modal visible={!!customizeItem} animationType="slide" transparent onRequestClose={closeCustomize}>
        <Pressable style={styles.overlay} onPress={closeCustomize}>
          <DraggableSheet onDismiss={closeCustomize} sheetStyle={styles.sheet}>
            {customizeItem && (
              <ScrollView showsVerticalScrollIndicator={false}>
                {customizeItem.imageUrl && (
                  <Image source={{ uri: customizeItem.imageUrl }} style={styles.sheetImage} resizeMode="cover" />
                )}
                <Text style={styles.sheetMealType}>
                  {MEAL_TYPE_LABELS[customizeItem.mealType]} · {deliveryDayLabel(customizeItem.date)}
                </Text>
                <Text style={styles.sheetDishName}>
                  {composeFullDishName(customizeItem.tier, customizeItem.mealType, dishDisplayShape(customizeItem))}
                </Text>

                {customizeItem.carbChoiceRequired && (
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

                {customizeItem.addOns.length > 0 && (
                  <>
                    <Text style={styles.sectionTitle}>Add-ons</Text>
                    <View style={styles.addOnsGrid}>
                      {customizeItem.addOns.map((addOn) => {
                        const isSelected = selectedAddOnNames.includes(addOn.name);
                        return (
                          <Pressable
                            key={addOn.name}
                            onPress={() => toggleAddOn(addOn.name)}
                            style={[styles.addOnOption, isSelected && styles.addOnOptionSelected]}
                          >
                            <Text style={[styles.addOnOptionText, isSelected && styles.addOnOptionTextSelected]}>{addOn.name}</Text>
                            <Text style={[styles.addOnOptionPrice, isSelected && styles.addOnOptionTextSelected]}>+₹{addOn.price}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </>
                )}

                <Text style={styles.sectionTitle}>Quantity</Text>
                <View style={styles.quantityRow}>
                  <Pressable
                    style={[styles.quantityButton, quantity <= 1 && styles.quantityButtonDisabled]}
                    onPress={() => setQuantity((q) => Math.max(1, q - 1))}
                    disabled={quantity <= 1}
                  >
                    <Text style={styles.quantityButtonText}>−</Text>
                  </Pressable>
                  <Text style={styles.quantityValue}>{quantity}</Text>
                  <Pressable
                    style={[styles.quantityButton, quantity >= MAX_SINGLE_MEAL_QUANTITY && styles.quantityButtonDisabled]}
                    onPress={() => setQuantity((q) => Math.min(MAX_SINGLE_MEAL_QUANTITY, q + 1))}
                    disabled={quantity >= MAX_SINGLE_MEAL_QUANTITY}
                  >
                    <Text style={styles.quantityButtonText}>+</Text>
                  </Pressable>
                </View>

                <Pressable style={[styles.addButton, !canAdd && styles.addButtonDisabled]} onPress={handleAdd} disabled={!canAdd}>
                  <Text style={styles.addButtonText}>Add · ₹{totalPrice}</Text>
                </Pressable>
              </ScrollView>
            )}
          </DraggableSheet>
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
    mealImage: { width: 56, height: 56, borderRadius: theme.radius - 4, marginRight: theme.spacing(1.25) },
    mealType: { fontSize: 12, fontWeight: "700", color: colors.muted },
    mealDish: { fontSize: 15, fontWeight: "700", color: colors.text, marginTop: 2 },
    addOnsHint: { fontSize: 11, fontWeight: "600", color: colors.primary, marginTop: 4 },
    mealPrice: { fontSize: 16, fontWeight: "800", color: colors.primary },
    sectionTitle: { fontSize: 14, fontWeight: "700", color: colors.text, marginTop: theme.spacing(1.5), marginBottom: theme.spacing(1) },
    choiceRow: { flexDirection: "row", gap: 8 },
    choiceChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 16, backgroundColor: colors.surface },
    choiceChipActive: { backgroundColor: colors.primary },
    choiceChipText: { fontSize: 13, color: colors.text, fontWeight: "700" },
    choiceChipTextActive: { color: "#fff" },
    addOnsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    addOnOption: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    addOnOptionSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
    addOnOptionText: { fontSize: 13, fontWeight: "700", color: colors.text },
    addOnOptionPrice: { fontSize: 12, fontWeight: "700", color: colors.primary },
    addOnOptionTextSelected: { color: "#fff" },
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    sheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: theme.radius,
      borderTopRightRadius: theme.radius,
      padding: theme.spacing(2),
      maxHeight: "85%",
    },
    sheetImage: { width: "100%", height: 160, borderRadius: theme.radius, marginBottom: theme.spacing(1.5) },
    sheetMealType: { fontSize: 12, fontWeight: "700", color: colors.muted },
    sheetDishName: { fontSize: 18, fontWeight: "800", color: colors.text, marginTop: 2 },
    quantityRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing(2) },
    quantityButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    quantityButtonDisabled: { opacity: 0.4 },
    quantityButtonText: { fontSize: 20, fontWeight: "800", color: colors.text },
    quantityValue: { fontSize: 17, fontWeight: "800", color: colors.text, minWidth: 24, textAlign: "center" },
    addButton: {
      backgroundColor: colors.primary,
      borderRadius: theme.radius,
      paddingVertical: theme.spacing(1.75),
      alignItems: "center",
      marginTop: theme.spacing(2.5),
      marginBottom: theme.spacing(1),
    },
    addButtonDisabled: { opacity: 0.5 },
    addButtonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  });
