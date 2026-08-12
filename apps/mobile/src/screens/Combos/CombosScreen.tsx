import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { computeComboPrice } from "@tbc/pricing";
import { CROSS_BRAND_ID, type Combo } from "@tbc/shared-types";
import { useMemo, useState } from "react";
import { FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useAllCombos, useAllMenuItems } from "../../api/menu.api";
import { theme, type ColorPalette } from "../../constants/theme";
import { useCartStore } from "../../state/cartStore";
import { useTheme } from "../../state/themeStore";
import { makeComboCartLine } from "../../utils/comboCartLine";
import type { RootStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Combos">;

// Fixed, ordered tabs: Club Combos (TBC) on the left, Alchemy Combos in the middle, Cross
// Build (cross-brand) on the right — not derived from brand names, since these are their own
// category labels rather than "The Blenders Club" / "The Alchemy Tails" repeated verbatim.
const TABS = [
  { key: "tbc", label: "Club Combos" },
  { key: "alchemy-tails", label: "Alchemy Combos" },
  { key: CROSS_BRAND_ID, label: "Cross Build" },
] as const;

export function CombosScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { data: allCombos, isLoading } = useAllCombos();
  const { data: menuItems } = useAllMenuItems();
  const addLine = useCartStore((state) => state.addLine);
  const [activeTab, setActiveTab] = useState<string>(TABS[0].key);

  function itemName(id: string): string {
    return menuItems?.find((item) => item.id === id)?.signatureName ?? id;
  }

  function itemPrice(id: string): number {
    return menuItems?.find((item) => item.id === id)?.price ?? 0;
  }

  function itemImage(id: string): string | undefined {
    return menuItems?.find((item) => item.id === id)?.image;
  }

  const combos = useMemo(() => allCombos?.filter((combo) => combo.brandId === activeTab) ?? [], [allCombos, activeTab]);
  const crossBrandCombo = combos.find((combo) => combo.brandId === CROSS_BRAND_ID);

  function handleAddCurated(combo: Extract<Combo, { type: "curated" }>) {
    // Stay on this list rather than jumping to Cart — lets the customer add another
    // combo (or several) in one go; the cart icon's badge count confirms it landed.
    addLine(
      makeComboCartLine({
        comboId: combo.id,
        name: combo.name,
        description: combo.description,
        image: combo.image ?? itemImage(combo.itemIds[0]),
        constituentBasePrices: combo.itemIds.map(itemPrice),
        payload: "fixed",
      })
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>Combos</Text>
        <Image source={require("../../../assets/combo-discount-sticker.png")} style={styles.discountSticker} resizeMode="contain" />
      </View>
      <Text style={styles.subtitle}>Two items, bundled at 15% off.</Text>

      <View style={styles.tabs}>
        {TABS.map((tab) => (
          <Pressable
            key={tab.key}
            onPress={() => setActiveTab(tab.key)}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
          </Pressable>
        ))}
      </View>

      {isLoading && <Text style={styles.info}>Loading combos…</Text>}

      {activeTab === CROSS_BRAND_ID ? (
        crossBrandCombo && (
          <View style={styles.mixMatchCard}>
            <Text style={styles.mixMatchEmoji}>🔀</Text>
            <Text style={styles.name}>{crossBrandCombo.name}</Text>
            <Text style={styles.description}>Pick any 2 items from every item in the menu — both brands, mixed however you like.</Text>
            <Pressable style={styles.footerButton} onPress={() => navigation.navigate("ChooseCombo", { comboId: crossBrandCombo.id })}>
              <Text style={styles.footerButtonText}>Build Your Combo</Text>
            </Pressable>
          </View>
        )
      ) : (
        <FlatList
          data={combos}
          keyExtractor={(combo) => combo.id}
          contentContainerStyle={{ paddingBottom: 24 }}
          renderItem={({ item: combo }) => {
            if (combo.type === "choose-n") {
              const image = combo.image ?? itemImage(combo.eligibleItemIds[0]);
              return (
                <Pressable style={styles.card} onPress={() => navigation.navigate("ChooseCombo", { comboId: combo.id })}>
                  {image ? (
                    <Image source={{ uri: image }} style={styles.image} />
                  ) : (
                    <View style={styles.imagePlaceholder}>
                      <Text style={styles.imagePlaceholderText}>🧩</Text>
                    </View>
                  )}
                  <View style={styles.body}>
                    <Text style={styles.name}>{combo.name}</Text>
                    <Text style={styles.description}>Pick any {combo.chooseCount} eligible items · 15% off their combined price</Text>
                    <View style={styles.buildButton}>
                      <Text style={styles.buildButtonText}>Build Your Combo</Text>
                    </View>
                  </View>
                </Pressable>
              );
            }

            const fullPriceSum = combo.itemIds.reduce((sum, id) => sum + itemPrice(id), 0);
            const comboPrice = computeComboPrice(combo.itemIds.map(itemPrice));
            const savings = Math.max(0, fullPriceSum - comboPrice);
            const image = combo.image ?? itemImage(combo.itemIds[0]);

            return (
              <Pressable style={styles.card} onPress={() => handleAddCurated(combo)}>
                {image ? <Image source={{ uri: image }} style={styles.image} /> : <View style={styles.imagePlaceholder} />}
                <View style={styles.body}>
                  <Text style={styles.name}>{combo.name}</Text>
                  <Text style={styles.description}>{combo.itemIds.map(itemName).join(" + ")}</Text>
                  <View style={styles.priceRow}>
                    <Text style={styles.priceStrikethrough}>₹{fullPriceSum}</Text>
                    <Text style={styles.price}>₹{comboPrice}</Text>
                    {savings > 0 && <Text style={styles.savingsBadge}>Save ₹{savings}</Text>}
                  </View>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const makeStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background, padding: theme.spacing(2) },
    titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    title: { fontSize: 22, fontWeight: "800", color: colors.primary },
    subtitle: { fontSize: 12, color: colors.muted, marginBottom: theme.spacing(1.5) },
    tabs: { flexDirection: "row", gap: 8, marginBottom: theme.spacing(2) },
    tab: { flex: 1, paddingVertical: 8, borderRadius: 16, backgroundColor: colors.surface, alignItems: "center" },
    tabActive: { backgroundColor: colors.primary },
    tabText: { fontSize: 12, color: colors.text, fontWeight: "600", textAlign: "center" },
    tabTextActive: { color: "#fff", fontWeight: "700" },
    discountSticker: { width: 64, height: 50, transform: [{ rotate: "-6deg" }] },
    info: { textAlign: "center", color: colors.muted, marginVertical: theme.spacing(2) },
    // Same row shape as MenuItemCard/the cross-brand search results — small image left,
    // details right — instead of the old full-width top-image product card.
    card: {
      flexDirection: "row",
      backgroundColor: colors.surface,
      borderRadius: theme.radius,
      marginBottom: theme.spacing(2),
      overflow: "hidden",
    },
    image: { width: 96, height: 96 },
    imagePlaceholder: { width: 96, height: 96, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
    imagePlaceholderText: { fontSize: 28 },
    body: { flex: 1, padding: theme.spacing(1.5) },
    name: { fontSize: 16, fontWeight: "700", color: colors.text },
    description: { fontSize: 12, color: colors.muted, marginTop: 2 },
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
    buildButton: { backgroundColor: colors.primary, borderRadius: theme.radius, paddingVertical: 6, alignItems: "center", marginTop: 6 },
    buildButtonText: { color: "#fff", fontWeight: "700", fontSize: 12 },
    mixMatchCard: { backgroundColor: colors.surface, borderRadius: theme.radius, padding: theme.spacing(2) },
    mixMatchEmoji: { fontSize: 28, marginBottom: 4 },
    footerButton: { backgroundColor: colors.primary, borderRadius: theme.radius, padding: theme.spacing(1.75), alignItems: "center", marginTop: theme.spacing(1) },
    footerButtonText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  });
