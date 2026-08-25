import type { SingleMealMenuItem, TiffinPlan } from "@tbc/shared-types";
import { useMemo, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useSingleMealMenu, useTiffinPlans } from "../api/tiffin.api";
import { theme, type ColorPalette } from "../constants/theme";
import { useTheme } from "../state/themeStore";
import { useTiffinPreferencesStore } from "../state/tiffinPreferencesStore";
import { effectivePlanPrice } from "../utils/tiffinPlanPrice";
import { Row } from "./HomeCollections";

const MEAL_TYPE_LABELS: Record<SingleMealMenuItem["mealType"], string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner" };

function TiffinMealMiniCard({
  item,
  onPress,
  onQuickOrder,
}: {
  item: SingleMealMenuItem;
  onPress: () => void;
  /** Called once the customer commits a quantity via the stepper — never for a dish whose
   * carb choice (rice/roti) is required, since there's no safe default to skip that pick with. */
  onQuickOrder: (item: SingleMealMenuItem, quantity: number) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeCardStyles(colors), [colors]);
  // Purely local — GG Tiffin has no persistent cart to add into (see AGENT.md: single-meal orders
  // check out immediately, they don't accumulate in a cart the way TBC/Alchemy Tails items do), so
  // this just tracks "how many the customer has dialed in" until they tap Order to commit it.
  const [quantity, setQuantity] = useState(0);

  return (
    <Pressable style={styles.card} onPress={onPress}>
      {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.image} /> : <View style={[styles.image, styles.imagePlaceholder]} />}
      <Text style={styles.label} numberOfLines={1}>
        {MEAL_TYPE_LABELS[item.mealType]}
      </Text>
      <Text style={styles.dishName} numberOfLines={1}>
        {item.dishName}
      </Text>
      <View style={styles.priceAddRow}>
        <Text style={styles.price}>₹{item.price}</Text>
        {item.carbChoiceRequired ? (
          // Rice vs roti has no safe default to guess — quick-add would risk placing the wrong
          // order, so this still opens the full customize popup instead, same as tapping the card.
          <Pressable style={styles.quickAddButton} onPress={onPress}>
            <Text style={styles.quickAddButtonText}>ADD</Text>
          </Pressable>
        ) : quantity === 0 ? (
          <Pressable style={styles.quickAddButton} onPress={() => setQuantity(1)}>
            <Text style={styles.quickAddButtonText}>ADD</Text>
          </Pressable>
        ) : (
          <View style={styles.quickAddStepper}>
            <Pressable style={styles.quickAddStepperButton} onPress={() => setQuantity((q) => Math.max(0, q - 1))} hitSlop={8}>
              <Text style={styles.quickAddStepperButtonText}>−</Text>
            </Pressable>
            <Text style={styles.quickAddStepperValue}>{quantity}</Text>
            <Pressable style={styles.quickAddStepperButton} onPress={() => setQuantity((q) => q + 1)} hitSlop={8}>
              <Text style={styles.quickAddStepperButtonText}>+</Text>
            </Pressable>
          </View>
        )}
      </View>
      {quantity > 0 && !item.carbChoiceRequired && (
        <Pressable style={styles.quickOrderButton} onPress={() => onQuickOrder(item, quantity)}>
          <Text style={styles.quickOrderButtonText}>Order →</Text>
        </Pressable>
      )}
    </Pressable>
  );
}

function TiffinOfferMiniCard({ plan, onPress }: { plan: TiffinPlan; onPress: () => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeCardStyles(colors), [colors]);
  return (
    <Pressable style={styles.card} onPress={onPress}>
      {plan.imageUrl ? <Image source={{ uri: plan.imageUrl }} style={styles.image} /> : <View style={[styles.image, styles.imagePlaceholder]} />}
      <Text style={styles.label} numberOfLines={2}>
        {plan.name}
      </Text>
      <View style={styles.priceRow}>
        <Text style={styles.priceStrikethrough}>₹{plan.price}</Text>
        <Text style={styles.price}>₹{effectivePlanPrice(plan)}</Text>
      </View>
      <Text style={styles.saleHint}>{plan.salePercent}% OFF</Text>
    </Pressable>
  );
}

interface Props {
  onOpenSingleMeal: () => void;
  onOpenPlan: (plan: TiffinPlan) => void;
  /** Straight to checkout with sensible defaults (no carb choice, no add-ons) — only ever called
   * for a dish that doesn't require a carb choice; see TiffinMealMiniCard's onQuickOrder. */
  onQuickOrderMeal: (item: SingleMealMenuItem, quantity: number) => void;
}

/**
 * GG Tiffin's own version of the shake-brand Home rows — it has no MenuItem catalog to draw
 * from, so these are sourced from the single-meal menu and the subscription plan catalog
 * instead: Recommended For You (Mini tier), Premium Picks (Premium tier), and Offers (plans
 * currently carrying a real discount). Respects the "Veg Only" switch like the rest of the
 * GG Tiffin flow.
 */
export function TiffinHomeCollections({ onOpenSingleMeal, onOpenPlan, onQuickOrderMeal }: Props) {
  const { data: menu } = useSingleMealMenu();
  const { data: plans } = useTiffinPlans();
  const vegOnly = useTiffinPreferencesStore((state) => state.vegOnly);

  const miniItems = useMemo(
    () => (menu ?? []).filter((item) => item.tier === "mini" && (!vegOnly || item.dietType === "veg")),
    [menu, vegOnly]
  );
  const premiumItems = useMemo(
    () => (menu ?? []).filter((item) => item.tier === "premium" && (!vegOnly || item.dietType === "veg")),
    [menu, vegOnly]
  );
  const offerPlans = useMemo(
    () => (plans ?? []).filter((plan) => plan.salePercent && (!vegOnly || plan.dietType === "veg")),
    [plans, vegOnly]
  );

  return (
    <View>
      <Row
        title="Recommended For You"
        data={miniItems}
        keyExtractor={(item) => `${item.tier}-${item.dietType}-${item.mealType}`}
        renderItem={(item) => <TiffinMealMiniCard item={item} onPress={onOpenSingleMeal} onQuickOrder={onQuickOrderMeal} />}
      />
      <Row
        title="Premium Picks"
        data={premiumItems}
        keyExtractor={(item) => `${item.tier}-${item.dietType}-${item.mealType}`}
        renderItem={(item) => <TiffinMealMiniCard item={item} onPress={onOpenSingleMeal} onQuickOrder={onQuickOrderMeal} />}
      />
      <Row title="Offers" data={offerPlans} keyExtractor={(plan) => plan.id} renderItem={(plan) => <TiffinOfferMiniCard plan={plan} onPress={() => onOpenPlan(plan)} />} />
    </View>
  );
}

const CARD_WIDTH = 128;

const makeCardStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    card: { width: CARD_WIDTH },
    image: { width: CARD_WIDTH, height: CARD_WIDTH, borderRadius: theme.radius, backgroundColor: colors.surface },
    imagePlaceholder: { alignItems: "center", justifyContent: "center" },
    label: { fontSize: 11, fontWeight: "700", color: colors.muted, marginTop: 6 },
    dishName: { fontSize: 13, fontWeight: "700", color: colors.text, marginTop: 2 },
    price: { fontSize: 13, fontWeight: "700", color: colors.primary },
    // Price and the Add button/stepper share one row instead of the button sitting below it.
    priceAddRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", marginTop: 2, gap: 4 },
    priceRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
    priceStrikethrough: { fontSize: 11, color: colors.muted, textDecorationLine: "line-through" },
    saleHint: { fontSize: 10, fontWeight: "800", color: colors.danger, marginTop: 2 },
    quickAddButton: {
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 3,
      alignItems: "center",
    },
    quickAddButtonText: { fontSize: 11, fontWeight: "800", color: colors.primary },
    quickAddStepper: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.primary,
      borderRadius: 8,
      paddingHorizontal: 6,
      paddingVertical: 3,
    },
    quickAddStepperButton: { paddingHorizontal: 4 },
    quickAddStepperButtonText: { fontSize: 15, fontWeight: "800", color: "#fff", lineHeight: 17 },
    quickAddStepperValue: { fontSize: 12, fontWeight: "800", color: "#fff", marginHorizontal: 2 },
    quickOrderButton: {
      marginTop: 4,
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: 8,
      paddingVertical: 4,
      alignItems: "center",
    },
    quickOrderButtonText: { fontSize: 11, fontWeight: "800", color: colors.primary },
  });
