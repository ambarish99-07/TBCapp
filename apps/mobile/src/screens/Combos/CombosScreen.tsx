import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { computeComboPrice } from "@tbc/pricing";
import { FEAST_COMBO_BRAND_ID, type Combo } from "@tbc/shared-types";
import { useMemo, useState } from "react";
import { FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useBrands } from "../../api/brands.api";
import { useAllCombos, useAllMenuItems } from "../../api/menu.api";
import { CartSummaryBar } from "../../components/CartSummaryBar";
import { theme, type ColorPalette } from "../../constants/theme";
import { useTheme } from "../../state/themeStore";
import { addLineToCart } from "../../utils/addToCart";
import { makeComboCartLine } from "../../utils/comboCartLine";
import type { RootStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Combos">;

/** Curated combos have no sugar/ice/add-on fields to customize (and no Edit affordance in
 * Checkout, unlike menu items) — so tapping Add just adds one straight to the cart, with no
 * popup and no visible quantity stepper on the card. */
function CuratedComboCard({
  combo,
  itemName,
  itemPrice,
  itemImage,
  styles,
}: {
  combo: Extract<Combo, { type: "curated" }>;
  itemName: (id: string) => string;
  itemPrice: (id: string) => number;
  itemImage: (id: string) => string | undefined;
  styles: ReturnType<typeof makeStyles>;
}) {
  const fullPriceSum = combo.itemIds.reduce((sum, id) => sum + itemPrice(id), 0);
  const comboPrice = computeComboPrice(combo.itemIds.map(itemPrice), combo.discountPercent);
  const savings = Math.max(0, fullPriceSum - comboPrice);
  const image = combo.image ?? itemImage(combo.itemIds[0]);

  function handleAdd() {
    // Stays on this list rather than jumping to Cart — lets the customer add another
    // combo (or several) in one go; the floating summary bar confirms it landed.
    addLineToCart(
      makeComboCartLine({
        comboId: combo.id,
        brandId: combo.brandId,
        name: combo.name,
        description: combo.description,
        image,
        constituentBasePrices: combo.itemIds.map(itemPrice),
        payload: "fixed",
        discountPercent: combo.discountPercent,
      })
    );
  }

  return (
    <View style={styles.card}>
      {image ? <Image source={{ uri: image }} style={styles.image} /> : <View style={styles.imagePlaceholder} />}
      <View style={styles.body}>
        <Text style={styles.name}>{combo.name}</Text>
        <Text style={styles.description}>{combo.itemIds.map(itemName).join(" + ")}</Text>
        <View style={styles.priceRow}>
          <Text style={styles.priceStrikethrough}>₹{fullPriceSum}</Text>
          <Text style={styles.price}>₹{comboPrice}</Text>
          {savings > 0 && <Text style={styles.savingsBadge}>Save ₹{savings}</Text>}
        </View>
        <View style={styles.addRow}>
          <Pressable style={styles.addButton} onPress={handleAdd}>
            <Text style={styles.addButtonText}>Add</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export function CombosScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { data: allCombos, isLoading } = useAllCombos();
  const { data: menuItems } = useAllMenuItems();
  const { data: brands } = useBrands();
  // One tab per live catalog brand that has combos of its own (GG Tiffin has no MenuItem/Combo
  // catalog, so it never appears) — derived from whichever brands actually exist rather than a
  // hardcoded list, so a newly added brand's combos get a tab automatically with no code change.
  // Multi-kitchen combos live on their own Feast page instead (linked at the bottom).
  const tabs = useMemo(
    () =>
      (brands ?? [])
        .filter((brand) => brand.id !== "gg-tiffin" && (allCombos ?? []).some((combo) => combo.brandId === brand.id))
        .map((brand) => ({ key: brand.id, label: `${brand.name} Combos` })),
    [brands, allCombos]
  );
  const hasFeast = (allCombos ?? []).some((combo) => combo.brandId === FEAST_COMBO_BRAND_ID);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  // Defaults to the first brand tab once brands have loaded — can't pick that at useState-init
  // time since brands arrive asynchronously.
  const effectiveActiveTab = activeTab ?? tabs[0]?.key ?? null;

  function itemName(id: string): string {
    return menuItems?.find((item) => item.id === id)?.signatureName ?? id;
  }

  function itemPrice(id: string): number {
    return menuItems?.find((item) => item.id === id)?.price ?? 0;
  }

  function itemImage(id: string): string | undefined {
    return menuItems?.find((item) => item.id === id)?.image;
  }

  const combos = useMemo(() => allCombos?.filter((combo) => combo.brandId === effectiveActiveTab) ?? [], [allCombos, effectiveActiveTab]);

  return (
    <View style={styles.screen}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>Combos</Text>
        <Image source={require("../../../assets/combo-discount-sticker.png")} style={styles.discountSticker} resizeMode="contain" />
      </View>
      <Text style={styles.subtitle}>Two items, bundled at 15% off.</Text>

      <View style={styles.tabs}>
        {tabs.map((tab) => (
          <Pressable
            key={tab.key}
            onPress={() => setActiveTab(tab.key)}
            style={[styles.tab, effectiveActiveTab === tab.key && styles.tabActive]}
          >
            <Text style={[styles.tabText, effectiveActiveTab === tab.key && styles.tabTextActive]} numberOfLines={1}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {isLoading && <Text style={styles.info}>Loading combos…</Text>}

      {/* flex: 1 so this fills the remaining space regardless of content height, pushing
          the summary bar below down to the true bottom of the screen instead of trailing
          right after a short card. */}
      <View style={styles.content}>
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

            return <CuratedComboCard combo={combo} itemName={itemName} itemPrice={itemPrice} itemImage={itemImage} styles={styles} />;
          }}
        />
      </View>

      {hasFeast && (
        <Pressable style={styles.feastLink} onPress={() => navigation.navigate("Feast")}>
          <Text style={styles.feastLinkText}>🍽️ Biryani + shake + mocktail in one order? Try a Feast ›</Text>
        </Pressable>
      )}

      <CartSummaryBar navigation={navigation} />
    </View>
  );
}

const makeStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background, padding: theme.spacing(2) },
    content: { flex: 1 },
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
    addRow: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", marginTop: 8 },
    addButton: { backgroundColor: colors.primary, borderRadius: theme.radius, paddingVertical: 6, paddingHorizontal: 18 },
    addButtonText: { color: "#fff", fontWeight: "700", fontSize: 12 },
    feastLink: {
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: theme.radius,
      padding: theme.spacing(1.25),
      alignItems: "center",
      marginBottom: theme.spacing(1),
    },
    feastLinkText: { color: colors.primary, fontWeight: "700", fontSize: 13 },
  });
