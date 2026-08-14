import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { computeComboPrice } from "@tbc/pricing";
import type { Combo, MenuItem } from "@tbc/shared-types";
import { Fragment, useEffect, useMemo, useState } from "react";
import { FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useCombos, useMenuItems } from "../../api/menu.api";
import { AddItemModal } from "../../components/AddItemModal";
import { CartSummaryBar } from "../../components/CartSummaryBar";
import { MenuItemCard } from "../../components/MenuItemCard";
import { theme, type ColorPalette } from "../../constants/theme";
import { useBrandStore } from "../../state/brandStore";
import { useCartStore } from "../../state/cartStore";
import { useTheme } from "../../state/themeStore";
import { makeComboCartLine } from "../../utils/comboCartLine";
import type { RootStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "RestaurantMenu">;

const COMBOS_TAB = "combos";
const PREMIUM_TAB = "premium";

/** A friendlier storefront name than the raw category value for tabs that need one. */
const CATEGORY_LABEL_OVERRIDES: Record<string, string> = { mocktails: "Signature" };

/** "signature-shakes" -> "Signature Shakes" — no brand-specific category list hardcoded here, since every brand has its own menu directory. */
function formatCategoryLabel(category: string): string {
  if (CATEGORY_LABEL_OVERRIDES[category]) return CATEGORY_LABEL_OVERRIDES[category];
  return category
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** Curated combos have no customizable fields — tapping just adds one straight to the cart. */
function CuratedComboRow({ combo, itemPrice, styles }: { combo: Extract<Combo, { type: "curated" }>; itemPrice: (id: string) => number; styles: ReturnType<typeof makeStyles> }) {
  const addLine = useCartStore((state) => state.addLine);
  const fullPriceSum = combo.itemIds.reduce((sum, id) => sum + itemPrice(id), 0);
  const comboPrice = computeComboPrice(combo.itemIds.map(itemPrice));
  const savings = Math.max(0, fullPriceSum - comboPrice);

  function handleAdd() {
    addLine(
      makeComboCartLine({
        comboId: combo.id,
        name: combo.name,
        description: combo.description,
        image: combo.image,
        constituentBasePrices: combo.itemIds.map(itemPrice),
        payload: "fixed",
      })
    );
  }

  return (
    <View style={styles.comboCard}>
      {combo.image ? <Image source={{ uri: combo.image }} style={styles.comboImage} /> : <View style={styles.comboImagePlaceholder} />}
      <View style={styles.comboBody}>
        <Text style={styles.comboName}>{combo.name}</Text>
        <View style={styles.comboPriceRow}>
          <Text style={styles.comboPriceStrikethrough}>₹{fullPriceSum}</Text>
          <Text style={styles.comboPrice}>₹{comboPrice}</Text>
          {savings > 0 && <Text style={styles.comboSavingsBadge}>Save ₹{savings}</Text>}
        </View>
        <Pressable style={styles.comboAddButton} onPress={handleAdd}>
          <Text style={styles.comboAddButtonText}>Add</Text>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * A single restaurant's full menu — category tabs + item list, the same UI the Home page
 * used to show inline before it moved here to make room for the discovery rows. Reads
 * brandStore's already-selected brand rather than taking a route param: the Home page's
 * Restaurants row calls selectBrand() right before navigating here. "Combos" sits as one
 * more tab alongside the real categories — selecting it swaps the list below for this
 * brand's curated combos + "Build Your Combo", rather than showing a separate always-on row.
 */
export function RestaurantMenuScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const selectedBrand = useBrandStore((state) => state.selectedBrand);
  const { data: items, isLoading, error } = useMenuItems();
  // Brand-scoped already (unlike Home's cross-brand useAllCombos) — exactly this restaurant's
  // own curated combos and "Build Your Combo" choose-n combos, nothing else mixed in.
  const { data: combos } = useCombos();
  const [category, setCategory] = useState<string>("all");
  const [addingItem, setAddingItem] = useState<MenuItem | null>(null);

  function itemPrice(id: string): number {
    return items?.find((item) => item.id === id)?.price ?? 0;
  }

  useEffect(() => {
    navigation.setOptions({ title: selectedBrand?.name ?? "Menu" });
  }, [navigation, selectedBrand]);

  const categories = useMemo(() => {
    if (!items || items.length === 0) return [];
    return Array.from(new Set(items.map((item) => item.category)));
  }, [items]);

  const premiumItems = useMemo(() => (items ?? []).filter((item) => item.isStaffPick), [items]);
  // Wherever the premium items actually live (e.g. "mocktails" for Alchemy Tails, "cold-coffee"
  // for TBC) — not hardcoded to one brand's category, so the tab still appears (and the items
  // aren't silently dropped from their old tab) for any brand's staff picks.
  const premiumTabCategory = premiumItems[0]?.category;

  const filtered = useMemo(() => {
    if (!items) return [];
    if (category === "all") return items;
    if (category === PREMIUM_TAB) return premiumItems;
    // Only the (relabeled) "Signature" tab de-dupes against Premium — every other category
    // tab (Cold Coffee, Signature Shakes, ...) keeps showing its premium items too, so e.g.
    // Caramel Brew appears under both Premium and Cold Coffee.
    if (category === "mocktails") return items.filter((item) => item.category === category && !item.isStaffPick);
    return items.filter((item) => item.category === category);
  }, [items, category, premiumItems]);

  const showingCombos = category === COMBOS_TAB;

  return (
    <View style={styles.screen}>
      {(categories.length > 1 || (combos && combos.length > 0)) && (
        <View style={styles.tabs}>
          <Pressable onPress={() => setCategory("all")} style={[styles.tab, category === "all" && styles.tabActive]}>
            <Text style={[styles.tabText, category === "all" && styles.tabTextActive]}>All</Text>
          </Pressable>
          {categories.map((cat) => (
            <Fragment key={cat}>
              <Pressable onPress={() => setCategory(cat)} style={[styles.tab, category === cat && styles.tabActive]}>
                <Text style={[styles.tabText, category === cat && styles.tabTextActive]}>{formatCategoryLabel(cat)}</Text>
              </Pressable>
              {/* "Premium" sits right beside whichever category its items actually belong to, rather than at the row's end. */}
              {cat === premiumTabCategory && (
                <Pressable onPress={() => setCategory(PREMIUM_TAB)} style={[styles.tab, category === PREMIUM_TAB && styles.tabActive]}>
                  <Text style={[styles.tabText, category === PREMIUM_TAB && styles.tabTextActive]}>Premium</Text>
                </Pressable>
              )}
            </Fragment>
          ))}
          {combos && combos.length > 0 && (
            <Pressable onPress={() => setCategory(COMBOS_TAB)} style={[styles.tab, showingCombos && styles.tabActive]}>
              <Text style={[styles.tabText, showingCombos && styles.tabTextActive]}>Combos</Text>
            </Pressable>
          )}
        </View>
      )}

      {showingCombos ? (
        <FlatList
          data={combos ?? []}
          keyExtractor={(combo) => combo.id}
          contentContainerStyle={{ paddingBottom: theme.spacing(2) }}
          renderItem={({ item: combo }) => {
            if (combo.type === "choose-n") {
              return (
                <Pressable style={styles.comboCard} onPress={() => navigation.navigate("ChooseCombo", { comboId: combo.id })}>
                  {combo.image ? <Image source={{ uri: combo.image }} style={styles.comboImage} /> : <View style={styles.comboImagePlaceholder} />}
                  <View style={styles.comboBody}>
                    <Text style={styles.comboName}>{combo.name}</Text>
                    <Text style={styles.comboDescription}>Pick any {combo.chooseCount} eligible items · 15% off their combined price</Text>
                    <View style={styles.comboBuildButton}>
                      <Text style={styles.comboBuildButtonText}>Build Your Combo</Text>
                    </View>
                  </View>
                </Pressable>
              );
            }
            return <CuratedComboRow combo={combo} itemPrice={itemPrice} styles={styles} />;
          }}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: theme.spacing(2) }}
          ListHeaderComponent={
            <View>
              {isLoading && <Text style={styles.info}>Loading menu…</Text>}
              {error && <Text style={styles.info}>Couldn't load the menu. Pull to retry.</Text>}
              {!isLoading && !error && filtered.length === 0 && (
                <Text style={styles.info}>{`${selectedBrand?.name ?? "This brand"}'s menu is coming soon — check back shortly!`}</Text>
              )}
            </View>
          }
          renderItem={({ item }) => <MenuItemCard item={item} onAddPress={() => setAddingItem(item)} />}
        />
      )}

      <CartSummaryBar navigation={navigation} />

      <AddItemModal item={addingItem} onClose={() => setAddingItem(null)} />
    </View>
  );
}

const makeStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background, paddingHorizontal: theme.spacing(2), paddingTop: theme.spacing(2) },
    tabs: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: theme.spacing(2) },
    tab: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: colors.surface },
    tabActive: { backgroundColor: colors.primary },
    tabText: { fontSize: 12, color: colors.text },
    tabTextActive: { color: "#fff", fontWeight: "700" },
    info: { textAlign: "center", color: colors.muted, marginBottom: theme.spacing(1) },
    comboCard: {
      flexDirection: "row",
      backgroundColor: colors.surface,
      borderRadius: theme.radius,
      marginBottom: theme.spacing(2),
      overflow: "hidden",
    },
    comboImage: { width: 96, height: 96 },
    comboImagePlaceholder: { width: 96, height: 96, backgroundColor: colors.background },
    comboBody: { flex: 1, padding: theme.spacing(1.5) },
    comboName: { fontSize: 16, fontWeight: "700", color: colors.text },
    comboDescription: { fontSize: 12, color: colors.muted, marginTop: 2 },
    comboPriceRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
    comboPriceStrikethrough: { fontSize: 13, color: colors.muted, textDecorationLine: "line-through" },
    comboPrice: { fontSize: 16, fontWeight: "700", color: colors.primary },
    comboSavingsBadge: {
      fontSize: 10,
      fontWeight: "700",
      color: "#fff",
      backgroundColor: colors.danger,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
    },
    comboAddButton: { alignSelf: "flex-end", backgroundColor: colors.primary, borderRadius: theme.radius, paddingVertical: 6, paddingHorizontal: 18, marginTop: 8 },
    comboAddButtonText: { color: "#fff", fontWeight: "700", fontSize: 12 },
    comboBuildButton: { backgroundColor: colors.primary, borderRadius: theme.radius, paddingVertical: 6, alignItems: "center", marginTop: 6 },
    comboBuildButtonText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  });
