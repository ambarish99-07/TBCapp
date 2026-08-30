import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { isComboLineId, type Brand, type MenuItem } from "@tbc/shared-types";
import { useQuery } from "@tanstack/react-query";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBrands } from "../../api/brands.api";
import { useAllCombos, useAllMenuItems, useBrowseCategories, useMenuItems } from "../../api/menu.api";
import { fetchMyOrders } from "../../api/orders.api";
import { AddItemModal } from "../../components/AddItemModal";
import { BrandCarousel } from "../../components/BrandCarousel";
import { CartSummaryBar } from "../../components/CartSummaryBar";
import { HomeCollections, RestaurantsRow } from "../../components/HomeCollections";
import { TiffinHomeCollections } from "../../components/TiffinHomeCollections";
import { SUPPORTED_CITY } from "../../constants/deliveryZone";
import { theme, type ColorPalette } from "../../constants/theme";
import { useAddressStore } from "../../state/addressStore";
import { useAuthStore } from "../../state/authStore";
import { useBrandStore } from "../../state/brandStore";
import { useCartStore } from "../../state/cartStore";
import { useTheme } from "../../state/themeStore";
import type { RootStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Menu">;

const SEARCH_PLACEHOLDER_ROTATE_MS = 2200;
// A richer, more saturated gold than the theme's own accent token — reads clearly against the
// light green tab background where the softer accent (#F5A623) felt flat; scoped to just the
// brand tabs rather than changing the global accent token everywhere else it's used.
const GLOSSY_YELLOW = "#FFC107";
// Fixed so the wedge's border-triangle can be sized to exactly match the body's height.
const GG_TIFFIN_TAB_HEIGHT = 60;
// Sapphire-glass blue (trying it in place of the earlier emerald, per the reference cocktail-glass
// photo) — deep navy edge fading up to a brighter cobalt center, like light catching cut glass.
const GG_TIFFIN_GRADIENT = ["#0B1F63", "#1E4FD9", "#3B82F6"] as const;
// Plain dark neutral instead of colorful emoji — matches the reference footer's monochrome icon
// style and the tab labels' own text color.
const TAB_ICON_COLOR = "#3A342C";

export function MenuScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { data: brands } = useBrands();
  const selectedBrandId = useBrandStore((state) => state.selectedBrandId);
  const selectedBrand = useBrandStore((state) => state.selectedBrand);
  const selectBrand = useBrandStore((state) => state.selectBrand);
  const restoreBrand = useBrandStore((state) => state.restoreBrand);
  const { data: items } = useMenuItems();
  // Cross-brand — Recommended/Discounts/Signature/Premium rows still scope to the selected
  // brand, but the Restaurants row needs one representative item photo per brand regardless.
  const { data: allItems } = useAllMenuItems();
  // Also cross-brand, not scoped to the selected brand — the Combos icon should stay visible
  // as long as *any* live brand has combos, since tapping it now opens a cross-brand page.
  const { data: combos } = useAllCombos();
  const cartItemCount = useCartStore((state) => state.lines.reduce((sum, line) => sum + line.quantity, 0));
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const initial = user?.fullName?.trim().charAt(0).toUpperCase() ?? "?";
  const selectedAddress = useAddressStore((state) => state.selectedAddress);
  const showCombosBanner = !!combos && combos.length > 0;
  const listRef = useRef<FlatList>(null);
  const [isBrandPickerOpen, setIsBrandPickerOpen] = useState(false);
  const [addingItem, setAddingItem] = useState<MenuItem | null>(null);

  const ggTiffinBrand = brands?.find((brand) => brand.id === "gg-tiffin");
  // The brand-tabs strip excludes GG Tiffin — it already has its own dedicated clickable card
  // further down the Home screen, so listing it here too would just be a duplicate shortcut.
  const brandTabBrands = brands?.filter((brand) => brand.id !== "gg-tiffin");

  function handleOpenRestaurant(brand: Brand) {
    // GG Tiffin is a subscription plan service, not a menu of individual items — it gets its
    // own dedicated flow instead of the shake/mocktail RestaurantMenu tab+list UI.
    if (brand.id === "gg-tiffin") {
      // restoreBrand, not selectBrand — it doesn't touch the cart. GG Tiffin has no cart of its
      // own (subscriptions/single-meal orders bypass cartStore entirely), so switching to it
      // shouldn't silently empty whatever the customer already has queued up for TBC/Alchemy
      // Tails. This is still what makes Home remember to show GG Tiffin's own rows (Recommended/
      // Premium Picks/Offers) the next time the customer lands back on Home.
      restoreBrand(brand);
      navigation.navigate("TiffinLanding");
      return;
    }
    selectBrand(brand);
    navigation.navigate("RestaurantMenu");
  }

  // Same behavior as picking a restaurant from the Home page's Restaurants row —
  // selecting a brand here goes straight to that brand's own menu page.
  function handlePickBrand(brand: Brand) {
    setIsBrandPickerOpen(false);
    handleOpenRestaurant(brand);
  }

  // Cycles the locked search bar's placeholder through every cross-brand browse category that
  // actually has items today ("Search shakes...", "Search cold coffee...", ...) instead of a
  // single static hint — a lightweight advertisement for the Search page's full category list.
  // Empty categories (e.g. GG Tiffin's veg/non-veg/breads before its menu goes live) stay out
  // of the rotation and start appearing on their own as soon as their itemCount goes above 0,
  // same as the Search page's own tile grid.
  const { data: browseCategories } = useBrowseCategories();
  const availablePlaceholderCategories = useMemo(() => (browseCategories ?? []).filter((cat) => cat.itemCount > 0), [browseCategories]);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  useEffect(() => {
    if (availablePlaceholderCategories.length === 0) return;
    const timer = setInterval(() => {
      setPlaceholderIndex((i) => (i + 1) % availablePlaceholderCategories.length);
    }, SEARCH_PLACEHOLDER_ROTATE_MS);
    return () => clearInterval(timer);
  }, [availablePlaceholderCategories.length]);
  const searchPlaceholder =
    availablePlaceholderCategories.length > 0
      ? `🔍 Search ${availablePlaceholderCategories[placeholderIndex % availablePlaceholderCategories.length].label.toLowerCase()}...`
      : "🔍 Search menu...";

  // Land here with no brand chosen yet (fresh login) — default to the first live brand
  // rather than showing a blank menu; the carousel below lets the customer switch. A
  // *restart* with a brand id already restored from last session isn't a fresh pick
  // though — resolve it to the full Brand object via restoreBrand (not selectBrand), so
  // the cart the customer left behind doesn't get silently wiped on every cold start.
  useEffect(() => {
    if (!brands || brands.length === 0) return;
    if (!selectedBrandId) {
      selectBrand(brands[0]);
      return;
    }
    if (!selectedBrand) {
      const restored = brands.find((brand) => brand.id === selectedBrandId);
      if (restored) restoreBrand(restored);
    }
  }, [selectedBrandId, selectedBrand, brands, selectBrand, restoreBrand]);

  // Scoped to this brand only — the cross-brand combo has its own home on the Combos screen.
  const brandCombos = useMemo(() => (combos ?? []).filter((combo) => combo.brandId === selectedBrandId), [combos, selectedBrandId]);

  // Shares the ["my-orders"] cache key with OrderHistoryScreen — same query, no duplicate fetch.
  const { data: myOrders } = useQuery({
    queryKey: ["my-orders"],
    queryFn: fetchMyOrders,
    enabled: !!user,
  });

  // "Repeatedly orders" means across separate orders, not just a qty>1 line within one order —
  // counts the DISTINCT delivered orders each item appeared in, for this brand, and only
  // surfaces items ordered 2+ times. Hidden entirely (via HomeCollections' Row) until then.
  const mostlyOrdered = useMemo(() => {
    if (!myOrders || !items) return [];
    const orderCountByItemId = new Map<string, number>();
    for (const order of myOrders) {
      if (order.status !== "delivered" || order.brandId !== selectedBrandId) continue;
      const seenInThisOrder = new Set<string>();
      for (const line of order.items) {
        if (isComboLineId(line.menuItemId)) continue;
        seenInThisOrder.add(line.menuItemId);
      }
      for (const id of seenInThisOrder) {
        orderCountByItemId.set(id, (orderCountByItemId.get(id) ?? 0) + 1);
      }
    }
    return items
      .filter((item) => (orderCountByItemId.get(item.id) ?? 0) >= 2)
      .sort((a, b) => (orderCountByItemId.get(b.id) ?? 0) - (orderCountByItemId.get(a.id) ?? 0));
  }, [myOrders, items, selectedBrandId]);

  // Avatar, address, search, and cart all live in one row now (search moved in between address
  // and cart, avatar moved to the far left) — the whole thing stays pinned to the top once
  // scrolled past. FlatList's stickyHeaderIndices only works on its own top-level rows, so this
  // lives as a row in `data` instead of a plain ListHeaderComponent.
  type Row = { kind: "header" } | { kind: "brandTabs" } | { kind: "content" };

  const rows: Row[] = useMemo(
    () => [{ kind: "header" }, ...(brandTabBrands && brandTabBrands.length > 0 ? [{ kind: "brandTabs" as const }] : []), { kind: "content" }],
    [brandTabBrands]
  );
  // Header is always first — sticking it (instead of just the old search row) keeps the search
  // bar, cart, and avatar reachable while scrolling too, now that they all live in this one row.
  const stickyHeaderIndex = 0;

  function renderRow({ item: row }: { item: Row }) {
    switch (row.kind) {
      case "header":
        return (
          <View style={styles.headerRow}>
            <Pressable style={styles.avatarButton} onPress={() => navigation.navigate("Account")}>
              <Text style={styles.avatarButtonText}>{initial}</Text>
            </Pressable>
            <Pressable style={styles.addressBar} onPress={() => navigation.navigate("Addresses")}>
              <Text style={styles.addressIcon}>🏠</Text>
              <Text style={styles.addressValue} numberOfLines={1}>
                {selectedAddress ? selectedAddress.label : SUPPORTED_CITY}
              </Text>
              <Text style={styles.addressChevron}>▾</Text>
            </Pressable>
            <Pressable style={styles.search} onPress={() => navigation.navigate("Search")}>
              <Text style={styles.searchPlaceholder} numberOfLines={1}>
                {searchPlaceholder}
              </Text>
            </Pressable>
            <Pressable style={styles.cartButton} onPress={() => navigation.navigate("Cart")}>
              {/* Vector icon, not the 🛒 emoji — an emoji's color is baked into its own glyph and
                  ignores `color`, so it stayed pale next to the bold, colored "A" beside it no
                  matter what. Same size as before (18) — just darkened, not enlarged. */}
              <MaterialCommunityIcons name="cart-outline" size={18} color={colors.primary} />
              {cartItemCount > 0 && (
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>{cartItemCount > 9 ? "9+" : cartItemCount}</Text>
                </View>
              )}
            </Pressable>
          </View>
        );
      case "brandTabs":
        return (
          <View style={styles.brandTabsRow}>
            {(brandTabBrands ?? []).map((brand, index) => (
              <Pressable
                key={brand.id}
                style={({ pressed }) => [
                  styles.brandTab,
                  index === (brandTabBrands?.length ?? 0) - 1 && styles.brandTabLast,
                  pressed && styles.brandTabPressed,
                ]}
                android_ripple={{ color: colors.primary + "22", borderless: false }}
                onPress={() => handleOpenRestaurant(brand)}
              >
                {brand.logoUrl ? (
                  <Image source={{ uri: brand.logoUrl }} style={styles.brandTabLogo} resizeMode="cover" />
                ) : (
                  <Text style={styles.brandTabIcon}>🍽️</Text>
                )}
                <Text style={styles.brandTabLabel} numberOfLines={1}>
                  {brand.name}
                </Text>
              </Pressable>
            ))}
          </View>
        );
      case "content":
        return (
          <View>
            <BrandCarousel colors={colors} navigation={navigation} onOpenRestaurant={handleOpenRestaurant} paused={isBrandPickerOpen} />

            {selectedBrandId === "gg-tiffin" ? (
              <TiffinHomeCollections
                onOpenSingleMeal={() => navigation.navigate("TiffinSingleMeal")}
                onOpenPlan={(plan) => navigation.navigate("TiffinPlanSelect", { planId: plan.id })}
                onQuickOrderMeal={(item, quantity) =>
                  navigation.navigate("TiffinSingleMealCheckout", {
                    tier: item.tier,
                    mealType: item.mealType,
                    dietType: item.dietType,
                    date: item.date,
                    dishName: item.dishName,
                    price: item.price,
                    quantity,
                    carbChoice: undefined,
                    addOns: [],
                  })
                }
              />
            ) : (
              <>
                {items && items.length > 0 && (
                  <HomeCollections
                    items={items}
                    combos={brandCombos}
                    onItemPress={(item) => setAddingItem(item)}
                    onChooseCombo={(combo) => navigation.navigate("ChooseCombo", { comboId: combo.id })}
                    mostlyOrdered={mostlyOrdered}
                  />
                )}

                {items && items.length === 0 && (
                  <Text style={styles.info}>{`${selectedBrand?.name ?? "This brand"}'s menu is coming soon — check back shortly!`}</Text>
                )}
              </>
            )}

            {/* Cross-brand, independent of whichever brand's rows are showing above — stays
                visible even when GG Tiffin's own rows have replaced the shake-brand ones. */}
            <RestaurantsRow brands={brands ?? []} allItems={allItems ?? []} onOpenRestaurant={handleOpenRestaurant} />
          </View>
        );
    }
  }

  return (
    <View style={[styles.screen, { paddingTop: theme.spacing(2) + insets.top, backgroundColor: colors.background }]}>
      <FlatList
        ref={listRef}
        style={styles.list}
        data={rows}
        keyExtractor={(row) => row.kind}
        stickyHeaderIndices={[stickyHeaderIndex]}
        contentContainerStyle={{ paddingBottom: theme.spacing(2) + 90 + insets.bottom }}
        renderItem={renderRow}
      />

      {/* Floats over the page instead of taking its own fixed row — the home content keeps
          scrolling underneath, visible around the pill, rather than sitting on a solid strip. */}
      <View pointerEvents="box-none" style={[styles.floatingFooter, { paddingBottom: insets.bottom + theme.spacing(1) }]}>
        <CartSummaryBar navigation={navigation} />

        {/* Dark floating tab bar (Menu/Combos/Bulk Deals) plus a separate bright accent chip
            (GG Tiffin) to its right — modeled on the dark-pill-bar + standout-chip pattern from
            the reference screenshot the user provided, rather than the previous light bordered
            buttons. */}
        <View style={styles.bottomRow}>
          <View style={styles.tabBar}>
            <Pressable
              style={({ pressed }) => [styles.tabItem, pressed && styles.tabItemActive]}
              android_ripple={{ color: "rgba(0,0,0,0.08)", borderless: false }}
              onPress={() => setIsBrandPickerOpen(true)}
            >
              {/* Two glyphs instead of one — a shake glass plus a bowl of food, since this tab
                  opens the full menu (drinks and dishes both), not just one or the other. */}
              <View style={styles.tabIconPair}>
                <MaterialCommunityIcons name="glass-mug-variant" size={18} color={TAB_ICON_COLOR} />
                <MaterialCommunityIcons name="bowl-mix-outline" size={18} color={TAB_ICON_COLOR} />
              </View>
              <Text style={styles.tabLabel}>Menu</Text>
            </Pressable>
            {showCombosBanner && (
              <Pressable
                style={({ pressed }) => [styles.tabItem, pressed && styles.tabItemActive]}
                android_ripple={{ color: "rgba(0,0,0,0.08)", borderless: false }}
                onPress={() => navigation.navigate("Combos")}
              >
                <MaterialCommunityIcons name="gift-outline" size={20} color={TAB_ICON_COLOR} />
                <Text style={styles.tabLabel}>Combos</Text>
              </Pressable>
            )}
            <Pressable
              style={({ pressed }) => [styles.tabItem, pressed && styles.tabItemActive]}
              android_ripple={{ color: "rgba(0,0,0,0.08)", borderless: false }}
              onPress={() => navigation.navigate("BulkOrder")}
            >
              <MaterialCommunityIcons name="tag-multiple-outline" size={20} color={TAB_ICON_COLOR} />
              <Text style={styles.tabLabel}>Bulk Deals</Text>
            </Pressable>
          </View>
          {/* Mirrors the GG Tiffin chip's own left wedge (below) — same CSS-triangle trick, pointed
              right instead of left, so the white bar and the green chip read as one continuous
              arrow shape flowing into each other rather than two separate floating pieces. */}
          <View style={styles.tabBarWedge} />

          {/* Left edge is a pointed wedge (two straight lines meeting at a point) instead of a
              rounded corner — a separate CSS-triangle-style View glued to the body's square left
              edge, since RN Views can't clip to a non-rectangular shape on their own. */}
          <Pressable
            style={({ pressed }) => [styles.ggTiffinTab, pressed && styles.ggTiffinTabPressed]}
            android_ripple={{ color: colors.primary, borderless: false }}
            onPress={() => navigation.navigate("TiffinLanding")}
          >
            <View style={styles.ggTiffinWedge} />
            <LinearGradient colors={GG_TIFFIN_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ggTiffinBody}>
              {/* Soft light streak across the top — the "glossy" reflection a flat fill can't give. */}
              <View pointerEvents="none" style={styles.ggTiffinGloss} />
              {ggTiffinBrand?.logoUrl ? (
                <Image source={{ uri: ggTiffinBrand.logoUrl }} style={styles.ggTiffinLogo} resizeMode="cover" />
              ) : (
                <Text style={styles.bottomIconEmoji}>🍱</Text>
              )}
              <Text style={styles.ggTiffinLabelLine} numberOfLines={1}>
                GG Tiffin
              </Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>

      {/* Brand picker popup — tapping a brand switches the whole menu below to that brand's. */}
      <Modal visible={isBrandPickerOpen} animationType="fade" transparent onRequestClose={() => setIsBrandPickerOpen(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setIsBrandPickerOpen(false)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Choose a Brand</Text>
            {(brands ?? []).map((brand) => (
              <Pressable
                key={brand.id}
                style={[styles.brandOption, brand.id === selectedBrandId && styles.brandOptionActive]}
                onPress={() => handlePickBrand(brand)}
              >
                {brand.logoUrl && <Image source={{ uri: brand.logoUrl }} style={styles.brandOptionLogo} resizeMode="contain" />}
                <Text style={[styles.brandOptionText, brand.id === selectedBrandId && styles.brandOptionTextActive]}>{brand.name}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      <AddItemModal item={addingItem} onClose={() => setAddingItem(null)} />
    </View>
  );
}

const makeStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background, paddingHorizontal: theme.spacing(2) },
    list: { flex: 1 },
    // Opaque background — this row is now the one pinned to the top on scroll (search/cart/avatar
    // all live here too), so scrolled content underneath must not show through it.
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.background,
      paddingBottom: theme.spacing(2),
    },
    // No longer flex:1 — the search bar (inserted between address and cart) needs that flexible
    // space instead, so the address block just sizes to its own content, shrinking if too long.
    // Single row (icon, label, chevron all inline) instead of icon-above-text — height matches
    // avatarButton/cartButton so the home icon sits vertically centered with the avatar beside it,
    // not floating above the address text on its own line.
    addressBar: { flexDirection: "row", alignItems: "center", height: 40, flexShrink: 1, maxWidth: 110, marginRight: theme.spacing(1) },
    addressIcon: { fontSize: 22, marginRight: 4 },
    addressValue: { fontSize: 16, fontWeight: "800", color: colors.primary, flexShrink: 1 },
    addressChevron: { fontSize: 14, fontWeight: "800", color: colors.primary, marginLeft: 4 },
    // Outline style matching the cart button beside it, instead of a solid filled circle.
    avatarButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: "transparent",
      borderWidth: 1,
      borderColor: GLOSSY_YELLOW,
      alignItems: "center",
      justifyContent: "center",
      marginRight: theme.spacing(1),
    },
    avatarButtonText: { color: colors.primary, fontWeight: "400", fontSize: 24 },
    cartButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      marginLeft: theme.spacing(1),
    },
    cartBadge: {
      position: "absolute",
      top: -6,
      right: -6,
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      paddingHorizontal: 5,
      backgroundColor: colors.danger,
      alignItems: "center",
      justifyContent: "center",
    },
    // includeFontPadding:false strips Android's default extra glyph padding, which is what
    // was pushing the digit past the badge's tight circular bounds and cutting it off.
    cartBadgeText: { color: "#fff", fontSize: 11, fontWeight: "800", lineHeight: 14, includeFontPadding: false },
    // Simple navigation shortcuts, not a segmented control — each one just opens that brand's own
    // menu (same handleOpenRestaurant every other brand-tap in this screen already uses), so there's
    // no "active" brand to track and nothing here reacts to the hero carousel auto-rotating behind
    // it. One connected strip (a single outer border, thin dividers between tabs) rather than three
    // separate floating pills — transparent fill, no per-tab shadow (elevation on a semi-transparent
    // background was rendering as an unwanted solid white rectangle behind each tab on Android).
    brandTabsRow: {
      flexDirection: "row",
      marginBottom: theme.spacing(1.5),
      borderWidth: 1,
      borderColor: "rgba(64,164,190,0.38)",
      borderRadius: 16,
      overflow: "hidden",
      backgroundColor: "rgba(93,190,207,0.12)",
    },
    brandTab: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: theme.spacing(1.25),
      borderRightWidth: 1,
      borderRightColor: "rgba(64,164,190,0.38)",
    },
    brandTabLast: { borderRightWidth: 0 },
    brandTabPressed: { backgroundColor: "rgba(93,190,207,0.22)" },
    brandTabIcon: { fontSize: 22 },
    brandTabLogo: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: "#164B63" },
    brandTabLabel: { fontSize: 12, fontWeight: "800", color: "#164B63", marginTop: 5 },
    search: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: theme.radius,
      paddingHorizontal: theme.spacing(1.25),
      paddingVertical: theme.spacing(1),
    },
    searchPlaceholder: { color: colors.muted, fontSize: 13 },
    // Absolute positioning is relative to the screen's border box, not its padding box — restate
    // the screen's own horizontal padding here so the floating cart bar isn't flush against the edges.
    floatingFooter: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: theme.spacing(2) },
    // Left group (Menu/Combos/Bulk Deals) and the right GG Tiffin pill, pinned to opposite ends.
    // No gap — the tab bar's wedge and the GG Tiffin chip's own wedge need to sit flush against
    // their neighbors to read as one continuous arrow shape rather than two floating pieces.
    bottomRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: theme.spacing(1) },
    // Light, evenly-spaced bar (icon over label, no dividers) instead of the previous dark pill —
    // matches the reference footer's plain white, square-cornered look. Thin black border, except
    // on the right, which is flush against tabBarWedge instead (no border needed where the two
    // pieces join).
    tabBar: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "#FFFFFF",
      height: GG_TIFFIN_TAB_HEIGHT,
      paddingHorizontal: theme.spacing(0.5),
      borderWidth: 1,
      borderRightWidth: 0,
      borderColor: "#000000",
      flexShrink: 1,
      flexGrow: 1,
    },
    // Mirrors ggTiffinWedge below — same CSS-triangle trick (zero-size box, only border pixels
    // visible), pointed right (colored left border) instead of left, filled with the bar's own
    // white so it reads as the bar's square edge tapering to a point.
    tabBarWedge: {
      width: 0,
      height: 0,
      borderTopWidth: GG_TIFFIN_TAB_HEIGHT / 2,
      borderBottomWidth: GG_TIFFIN_TAB_HEIGHT / 2,
      borderLeftWidth: 18,
      borderTopColor: "transparent",
      borderBottomColor: "transparent",
      borderLeftColor: "#FFFFFF",
    },
    tabItem: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      minWidth: 56,
      paddingVertical: theme.spacing(0.75),
      paddingHorizontal: theme.spacing(0.5),
      borderRadius: 14,
    },
    tabItemActive: { backgroundColor: colors.primary + "14" },
    tabIconPair: { flexDirection: "row", gap: 2 },
    tabLabel: { fontSize: 10, fontWeight: "700", color: colors.text, marginTop: 3 },
    bottomIconEmoji: { fontSize: 20 },
    // Its own distinct pill, larger and warmer than the tab bar's dark neutral tone — logo on the
    // left, "GG" / "Tiffin" stacked in the middle, a small arrow on the right (echoing the
    // reference screenshot's accent chip, which runs flush to the screen's edge rather than
    // floating with a gap on every side). The negative right margin cancels out floatingFooter's
    // own horizontal padding so this pill's square right edge lands exactly on the screen's
    // physical edge.
    ggTiffinTab: {
      flexDirection: "row",
      alignItems: "center",
      marginRight: -theme.spacing(2),
      shadowColor: GG_TIFFIN_GRADIENT[1],
      shadowOpacity: 0.45,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
    },
    ggTiffinTabPressed: { opacity: 0.85 },
    // Classic CSS-triangle trick: a zero-size box whose only visible pixels are its borders —
    // top/bottom borders transparent and full-height (half each), right border colored and as
    // wide as the desired point depth, left/top borders 0 — renders as a solid wedge pointing
    // left, its flat base flush against ggTiffinBody's square left edge. Borders can't render a
    // gradient, so it's filled with the gradient's own top-left stop for a seamless join.
    ggTiffinWedge: {
      width: 0,
      height: 0,
      borderTopWidth: GG_TIFFIN_TAB_HEIGHT / 2,
      borderBottomWidth: GG_TIFFIN_TAB_HEIGHT / 2,
      borderRightWidth: 18,
      borderTopColor: "transparent",
      borderBottomColor: "transparent",
      borderRightColor: GG_TIFFIN_GRADIENT[0],
    },
    ggTiffinBody: {
      flexDirection: "row",
      alignItems: "center",
      height: GG_TIFFIN_TAB_HEIGHT,
      paddingLeft: theme.spacing(1),
      paddingRight: theme.spacing(3),
      gap: theme.spacing(0.75),
      overflow: "hidden",
      position: "relative",
    },
    // The highlight strip that reads as "glossy" — a soft light streak across the top third,
    // fading out rather than a hard-edged band.
    ggTiffinGloss: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: "45%",
      backgroundColor: "rgba(255,255,255,0.12)",
      borderBottomLeftRadius: 30,
      borderBottomRightRadius: 30,
    },
    ggTiffinLogo: { width: 38, height: 38, borderRadius: 19 },
    ggTiffinLabelLine: { fontSize: 15, fontWeight: "800", color: "#fff" },
    info: { textAlign: "center", color: colors.muted, marginBottom: theme.spacing(1) },
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: theme.spacing(3) },
    modalCard: { backgroundColor: colors.background, borderRadius: theme.radius, padding: theme.spacing(2) },
    modalTitle: { fontSize: 16, fontWeight: "800", color: colors.text, marginBottom: theme.spacing(1.5) },
    brandOption: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing(1.5),
      padding: theme.spacing(1.5),
      borderRadius: theme.radius,
      backgroundColor: colors.surface,
      marginBottom: theme.spacing(1),
    },
    brandOptionActive: { borderWidth: 1, borderColor: colors.primary },
    brandOptionLogo: { width: 36, height: 36, borderRadius: 18 },
    brandOptionText: { fontSize: 15, fontWeight: "700", color: colors.text },
    brandOptionTextActive: { color: colors.primary },
  });
