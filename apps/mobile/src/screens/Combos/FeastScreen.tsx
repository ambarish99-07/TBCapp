import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { computeComboPrice } from "@tbc/pricing";
import { FEAST_COMBO_BRAND_ID, FEAST_SIZES, type Combo, type MenuItem } from "@tbc/shared-types";
import { useMemo, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useAllCombos, useAllMenuItems } from "../../api/menu.api";
import { useKitchensOpen } from "../../api/storeStatus.api";
import { CartSummaryBar } from "../../components/CartSummaryBar";
import { theme, type ColorPalette } from "../../constants/theme";
import { useTheme } from "../../state/themeStore";
import { addLineToCart } from "../../utils/addToCart";
import { makeComboCartLine } from "../../utils/comboCartLine";
import type { RootStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Feast">;

/**
 * Feast — combos owned by no single kitchen (brandId FEAST_COMBO_BRAND_ID): a whole meal across
 * kitchens (biryani + shake + mocktail...) in one order, one delivery, one payment. Every kitchen
 * shares one location, so this is just a normal mixed cart. A curated Feast whose kitchen is closed
 * (or whose item is out of stock) stays visible but can't be added; the build-your-own only offers
 * items from kitchens that are open right now. Tabbed by size — For One / For Two / For Four /
 * Party — each with its own build-your-own (more picks for bigger groups, repeats allowed) and its
 * ready-made Feasts. A Feast with no size set lands in a "More" tab rather than disappearing.
 */
export function FeastScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { data: allCombos, isLoading } = useAllCombos();
  const { data: menuItems } = useAllMenuItems();
  const kitchens = useKitchensOpen();

  const allFeasts = useMemo(() => (allCombos ?? []).filter((combo) => combo.brandId === FEAST_COMBO_BRAND_ID), [allCombos]);
  // Only sizes that actually have a Feast get a tab.
  const tabs = useMemo(() => {
    const sized = FEAST_SIZES.filter((size) => allFeasts.some((combo) => combo.feastSize === size.id)).map((size) => ({
      key: size.id as string,
      label: size.label as string,
    }));
    return allFeasts.some((combo) => !combo.feastSize) ? [...sized, { key: "more", label: "More" }] : sized;
  }, [allFeasts]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const effectiveTab = activeTab ?? tabs[0]?.key ?? null;
  const feastCombos = allFeasts.filter((combo) => (combo.feastSize ?? "more") === effectiveTab);
  const buildYourOwn = feastCombos.filter((combo): combo is Extract<Combo, { type: "choose-n" }> => combo.type === "choose-n");
  const curated = feastCombos.filter((combo): combo is Extract<Combo, { type: "curated" }> => combo.type === "curated");
  const openKitchens = kitchens.filter((kitchen) => kitchen.isOpen);
  const closedKitchens = kitchens.filter((kitchen) => !kitchen.isOpen);

  function findItem(id: string): MenuItem | undefined {
    return menuItems?.find((item) => item.id === id);
  }

  /** Why this curated Feast can't be ordered right now, or null when it can. */
  function unavailableReason(combo: Extract<Combo, { type: "curated" }>): string | null {
    for (const id of combo.itemIds) {
      const item = findItem(id);
      if (!item) return "Not available right now";
      const kitchen = kitchens.find((candidate) => candidate.brand.id === item.brandId);
      if (kitchen && !kitchen.isOpen) return `${kitchen.brand.name} is closed right now`;
      if (item.isAvailable === false) return `${item.signatureName} is out of stock`;
    }
    return null;
  }

  function handleAdd(combo: Extract<Combo, { type: "curated" }>) {
    const items = combo.itemIds.map(findItem);
    if (items.some((item) => !item)) return;
    addLineToCart(
      makeComboCartLine({
        comboId: combo.id,
        brandId: combo.brandId,
        name: combo.name,
        description: combo.description,
        image: combo.image ?? items[0]!.image,
        constituentBasePrices: items.map((item) => item!.price),
        payload: "fixed",
        discountPercent: combo.discountPercent,
        constituentBrandIds: items.map((item) => item!.brandId),
      })
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Feast</Text>
        <Text style={styles.subtitle}>A full meal from all our kitchens — one order, one delivery, one payment.</Text>

        {kitchens.length > 0 && (
          <View style={styles.kitchenRow}>
            {openKitchens.map(({ brand }) => (
              <Text key={brand.id} style={[styles.kitchenChip, styles.kitchenChipOpen]}>
                ● {brand.name}
              </Text>
            ))}
            {closedKitchens.map(({ brand }) => (
              <Text key={brand.id} style={[styles.kitchenChip, styles.kitchenChipClosed]}>
                {brand.name} · closed
              </Text>
            ))}
          </View>
        )}

        {tabs.length > 1 && (
          <View style={styles.tabs}>
            {tabs.map((tab) => (
              <Pressable
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={[styles.tab, effectiveTab === tab.key && styles.tabActive]}
              >
                <Text style={[styles.tabText, effectiveTab === tab.key && styles.tabTextActive]} numberOfLines={1}>
                  {tab.label}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {isLoading && <Text style={styles.info}>Loading feasts…</Text>}

        {buildYourOwn.map((combo) => (
          <Pressable
            key={combo.id}
            style={[styles.buildCard, openKitchens.length === 0 && styles.disabled]}
            disabled={openKitchens.length === 0}
            onPress={() => navigation.navigate("ChooseCombo", { comboId: combo.id })}
          >
            <Text style={styles.buildEmoji}>🍛🥤🍹</Text>
            <Text style={styles.buildTitle}>{combo.name}</Text>
            <Text style={styles.buildDescription}>{combo.description}</Text>
            <View style={styles.buildButton}>
              <Text style={styles.buildButtonText}>
                {openKitchens.length === 0 ? "All kitchens are closed" : `Pick any ${combo.chooseCount} — repeats welcome`}
              </Text>
            </View>
          </Pressable>
        ))}

        {curated.length > 0 && <Text style={styles.sectionTitle}>Ready-made Feasts</Text>}
        {curated.map((combo) => {
          const prices = combo.itemIds.map((id) => findItem(id)?.price ?? 0);
          const fullPriceSum = prices.reduce((sum, price) => sum + price, 0);
          const comboPrice = computeComboPrice(prices, combo.discountPercent);
          const savings = Math.max(0, fullPriceSum - comboPrice);
          const reason = unavailableReason(combo);
          const image = combo.image ?? findItem(combo.itemIds[0])?.image;
          return (
            <View key={combo.id} style={[styles.card, reason && styles.disabled]}>
              {image ? <Image source={{ uri: image }} style={styles.image} /> : <View style={styles.image} />}
              <View style={styles.body}>
                <Text style={styles.name}>{combo.name}</Text>
                <Text style={styles.items}>{combo.itemIds.map((id) => findItem(id)?.signatureName ?? id).join(" + ")}</Text>
                <View style={styles.priceRow}>
                  <Text style={styles.priceStrikethrough}>₹{fullPriceSum}</Text>
                  <Text style={styles.price}>₹{comboPrice}</Text>
                  {savings > 0 && <Text style={styles.savingsBadge}>Save ₹{savings}</Text>}
                </View>
                {reason ? (
                  <Text style={styles.unavailable}>{reason}</Text>
                ) : (
                  <View style={styles.addRow}>
                    <Pressable style={styles.addButton} onPress={() => handleAdd(combo)}>
                      <Text style={styles.addButtonText}>Add</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            </View>
          );
        })}

        {!isLoading && allFeasts.length === 0 && <Text style={styles.info}>No feasts on the menu right now.</Text>}
      </ScrollView>

      <View style={styles.footer}>
        <CartSummaryBar navigation={navigation} />
      </View>
    </View>
  );
}

const makeStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    scrollContent: { padding: theme.spacing(2), paddingBottom: theme.spacing(4) },
    footer: { paddingHorizontal: theme.spacing(2) },
    title: { fontSize: 22, fontWeight: "800", color: colors.primary },
    subtitle: { fontSize: 13, color: colors.muted, marginTop: 2, marginBottom: theme.spacing(1.5) },
    info: { textAlign: "center", color: colors.muted, marginVertical: theme.spacing(2) },
    tabs: { flexDirection: "row", gap: 8, marginBottom: theme.spacing(2) },
    tab: { flex: 1, paddingVertical: 8, borderRadius: 16, backgroundColor: colors.surface, alignItems: "center" },
    tabActive: { backgroundColor: colors.primary },
    tabText: { fontSize: 12, color: colors.text, fontWeight: "600" },
    tabTextActive: { color: "#fff", fontWeight: "700" },
    kitchenRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: theme.spacing(2) },
    kitchenChip: { fontSize: 11, fontWeight: "700", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, overflow: "hidden" },
    kitchenChipOpen: { color: colors.primary, backgroundColor: colors.primary + "1A" },
    kitchenChipClosed: { color: colors.muted, backgroundColor: colors.surface, textDecorationLine: "line-through" },
    buildCard: {
      backgroundColor: colors.surface,
      borderRadius: theme.radius,
      borderWidth: 1.5,
      borderColor: colors.primary,
      padding: theme.spacing(2),
      marginBottom: theme.spacing(2.5),
      alignItems: "center",
    },
    buildEmoji: { fontSize: 28, marginBottom: 4 },
    buildTitle: { fontSize: 18, fontWeight: "800", color: colors.text },
    buildDescription: { fontSize: 12, color: colors.muted, textAlign: "center", marginTop: 4 },
    buildButton: {
      backgroundColor: colors.primary,
      borderRadius: theme.radius,
      paddingVertical: theme.spacing(1.25),
      paddingHorizontal: theme.spacing(3),
      marginTop: theme.spacing(1.5),
    },
    buildButtonText: { color: "#fff", fontWeight: "700", fontSize: 14 },
    sectionTitle: { fontSize: 16, fontWeight: "800", color: colors.text, marginBottom: theme.spacing(1) },
    card: {
      flexDirection: "row",
      backgroundColor: colors.surface,
      borderRadius: theme.radius,
      marginBottom: theme.spacing(2),
      overflow: "hidden",
    },
    disabled: { opacity: 0.5 },
    image: { width: 96, minHeight: 96, backgroundColor: colors.background },
    body: { flex: 1, padding: theme.spacing(1.5) },
    name: { fontSize: 16, fontWeight: "700", color: colors.text },
    items: { fontSize: 12, color: colors.muted, marginTop: 2 },
    priceRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
    priceStrikethrough: { fontSize: 13, color: colors.muted, textDecorationLine: "line-through" },
    price: { fontSize: 16, fontWeight: "700", color: colors.primary },
    savingsBadge: {
      fontSize: 10,
      fontWeight: "700",
      color: "#fff",
      backgroundColor: colors.danger,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
    },
    unavailable: { fontSize: 12, fontWeight: "700", color: colors.danger, marginTop: 8 },
    addRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 8 },
    addButton: { backgroundColor: colors.primary, borderRadius: theme.radius, paddingVertical: 6, paddingHorizontal: 18 },
    addButtonText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  });
