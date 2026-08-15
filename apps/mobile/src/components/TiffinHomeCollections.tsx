import type { SingleMealMenuItem, TiffinPlan } from "@tbc/shared-types";
import { useMemo } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useSingleMealMenu, useTiffinPlans } from "../api/tiffin.api";
import { theme, type ColorPalette } from "../constants/theme";
import { useTheme } from "../state/themeStore";
import { useTiffinPreferencesStore } from "../state/tiffinPreferencesStore";
import { effectivePlanPrice } from "../utils/tiffinPlanPrice";
import { Row } from "./HomeCollections";

const MEAL_TYPE_LABELS: Record<SingleMealMenuItem["mealType"], string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner" };

function TiffinMealMiniCard({ item, onPress }: { item: SingleMealMenuItem; onPress: () => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeCardStyles(colors), [colors]);
  return (
    <Pressable style={styles.card} onPress={onPress}>
      {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.image} /> : <View style={[styles.image, styles.imagePlaceholder]} />}
      <Text style={styles.label} numberOfLines={1}>
        {MEAL_TYPE_LABELS[item.mealType]}
      </Text>
      <Text style={styles.dishName} numberOfLines={1}>
        {item.dishName}
      </Text>
      <Text style={styles.price}>₹{item.price}</Text>
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
}

/**
 * GG Tiffin's own version of the shake-brand Home rows — it has no MenuItem catalog to draw
 * from, so these are sourced from the single-meal menu and the subscription plan catalog
 * instead: Recommended For You (Mini tier), Premium Picks (Premium tier), and Offers (plans
 * currently carrying a real discount). Respects the "Veg Only" switch like the rest of the
 * GG Tiffin flow.
 */
export function TiffinHomeCollections({ onOpenSingleMeal, onOpenPlan }: Props) {
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
        renderItem={(item) => <TiffinMealMiniCard item={item} onPress={onOpenSingleMeal} />}
      />
      <Row
        title="Premium Picks"
        data={premiumItems}
        keyExtractor={(item) => `${item.tier}-${item.dietType}-${item.mealType}`}
        renderItem={(item) => <TiffinMealMiniCard item={item} onPress={onOpenSingleMeal} />}
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
    priceRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
    priceStrikethrough: { fontSize: 11, color: colors.muted, textDecorationLine: "line-through" },
    saleHint: { fontSize: 10, fontWeight: "800", color: colors.danger, marginTop: 2 },
  });
