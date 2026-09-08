import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { computeComboPrice } from "@tbc/pricing";
import type { Combo, MenuItem } from "@tbc/shared-types";
import { Fragment, useEffect, useMemo, useState } from "react";
import { FlatList, Image, Pressable, RefreshControl, StyleSheet, Switch, Text, View } from "react-native";
import { useCombos, useMenuItems } from "../../api/menu.api";
import { AddItemModal } from "../../components/AddItemModal";
import { CartSummaryBar } from "../../components/CartSummaryBar";
import { DietMark } from "../../components/DietMark";
import { MenuItemCard } from "../../components/MenuItemCard";
import { theme, type ColorPalette } from "../../constants/theme";
import { useBrandStore } from "../../state/brandStore";
import { useTheme } from "../../state/themeStore";
import { addLineWithBrandGuard } from "../../utils/addToCartWithBrandGuard";
import { makeComboCartLine } from "../../utils/comboCartLine";
import type { RootStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "RestaurantMenu">;

const COMBOS_TAB = "combos";
const PREMIUM_TAB = "premium";

/** A friendlier storefront name than the raw category value for tabs that need one. */
const CATEGORY_LABEL_OVERRIDES: Record<string, string> = { mocktails: "Signature", "signature-shakes": "Signature" };

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
  const fullPriceSum = combo.itemIds.reduce((sum, id) => sum + itemPrice(id), 0);
  const comboPrice = computeComboPrice(combo.itemIds.map(itemPrice), combo.discountPercent);
  const savings = Math.max(0, fullPriceSum - comboPrice);

  function handleAdd() {
    addLineWithBrandGuard(
      makeComboCartLine({
        comboId: combo.id,
        brandId: combo.brandId,
        name: combo.name,
        description: combo.description,
        image: combo.image,
        constituentBasePrices: combo.itemIds.map(itemPrice),
        payload: "fixed",
        discountPercent: combo.discountPercent,
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
  const { data: items, isLoading, isFetching, error, refetch } = useMenuItems();
  // Brand-scoped already (unlike Home's cross-brand useAllCombos) — exactly this restaurant's
  // own curated combos and "Build Your Combo" choose-n combos, nothing else mixed in.
  const { data: combos, refetch: refetchCombos } = useCombos();
  // Only true for a genuine pull-to-refresh, not the very first load — the "Loading menu…" text
  // above already covers that, so RefreshControl's own spinner staying hidden then avoids a
  // confusing double-loading-indicator moment.
  const isRefreshing = isFetching && !isLoading;
  function handleRefresh() {
    refetch();
    refetchCombos();
  }
  const [category, setCategory] = useState<string>("all");
  const [addingItem, setAddingItem] = useState<MenuItem | null>(null);
  // Local to this screen, not the shared GG Tiffin preference — a customer's diet choice for a
  // shake/mocktail brand has nothing to do with their Tiffin one, and most brands (TBC, Alchemy
  // Tails) have no non-veg items to filter in the first place, so the switch only shows at all
  // when this brand's menu actually has some (see hasNonVegItems below).
  const [vegOnly, setVegOnly] = useState(false);

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

  // Only shown at all when the brand actually has a non-veg item to hide — TBC/Alchemy Tails'
  // menus are entirely vegetarian, so the switch would be dead weight there.
  const hasNonVegItems = useMemo(() => (items ?? []).some((item) => item.dietType === "non-veg"), [items]);

  // Replaces the header's old cart button — a purely informational FSSAI-style diet mark for
  // *this brand's menu as a whole* (green square+dot if every item is veg, red square+triangle
  // the moment any item isn't), not a per-item indicator. Cart is still reachable from here via
  // CartSummaryBar once something's actually in it, and from Home's own cart icon otherwise.
  useEffect(() => {
    navigation.setOptions({ headerRight: () => <DietMark isNonVeg={hasNonVegItems} /> });
  }, [navigation, hasNonVegItems]);

  const filtered = useMemo(() => {
    if (!items) return [];
    const byCategory =
      category === "all"
        ? items
        : category === PREMIUM_TAB
          ? premiumItems
          : // Only the (relabeled) "Signature" tab and TBL's "Biryani" tab de-dupe against
            // Premium — every other category tab (Cold Coffee, Signature Shakes, ...) keeps
            // showing its premium items too, so e.g. Caramel Brew appears under both Premium
            // and Cold Coffee. "Biryani" dedupes instead (6 + 4 Premium = All's 10), per request.
            category === "mocktails" || category === "Biryani"
            ? items.filter((item) => item.category === category && !item.isStaffPick)
            : items.filter((item) => item.category === category);
    return vegOnly ? byCategory.filter((item) => item.dietType !== "non-veg") : byCategory;
  }, [items, category, premiumItems, vegOnly]);

  const showingCombos = category === COMBOS_TAB;

  return (
    <View style={styles.screen}>
      {/* A brand with only one real category (e.g. TBL: everything is "Biryani") still needs the
          "All"/Premium tabs shown once there's a genuine second view to switch to — either
          Combos or the injected Premium tab (driven by isStaffPick, not a real category value,
          so categories.length alone can't see it coming). */}
      {(categories.length > 1 || (combos && combos.length > 0) || !!premiumTabCategory || hasNonVegItems) && (
        <View style={styles.tabsRow}>
          {(categories.length > 1 || (combos && combos.length > 0) || !!premiumTabCategory) && (
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
          {hasNonVegItems && (
            <View style={styles.vegSwitchGroup}>
              <Text style={styles.vegSwitchLabel}>Veg Only</Text>
              <Switch
                value={vegOnly}
                onValueChange={setVegOnly}
                // Universal veg-indicator green (the dot on veg packaging), not the brand's own
                // primary color — matches GG Tiffin's same switch elsewhere in the app.
                trackColor={{ true: "#2E7D32" }}
                thumbColor="#fff"
              />
            </View>
          )}
        </View>
      )}

      {showingCombos ? (
        <FlatList
          data={combos ?? []}
          keyExtractor={(combo) => combo.id}
          contentContainerStyle={{ paddingBottom: theme.spacing(2) }}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
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
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
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
    // Tabs (left, wraps onto more lines if there are many) and the Veg Only switch (right, fixed
    // width) share this one row instead of stacking as two — the tabs' own flexWrap only wraps
    // within their own flex-basis, so the switch stays put on the right even if they do.
    tabsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: theme.spacing(1), marginBottom: theme.spacing(2) },
    vegSwitchGroup: { flexDirection: "row", alignItems: "center", gap: 6 },
    vegSwitchLabel: { fontSize: 12, fontWeight: "700", color: colors.muted },
    tabs: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 8 },
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
