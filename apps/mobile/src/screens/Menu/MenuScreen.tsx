import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { isComboLineId, isQuickDeliveryBrandId, type Brand, type MenuItem } from "@tbc/shared-types";
import { useQuery } from "@tanstack/react-query";
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
import { useAuthContext } from "../../state/useAuthContext";
import { useAuthStore } from "../../state/authStore";
import { useBrandStore } from "../../state/brandStore";
import { useCartStore } from "../../state/cartStore";
import { useTheme } from "../../state/themeStore";
import type { RootStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Menu">;

const SEARCH_PLACEHOLDER_ROTATE_MS = 2200;
// Fixed so the wedge's border-triangle can be sized to exactly match the body's height.
const GG_TIFFIN_TAB_HEIGHT = 60;
// A glossy emerald gradient instead of the flat theme accent orange — reads more clearly against
// both the dark tab bar and the photo content behind it, and a distinct hue from every other
// footer/promo color already in play (dark tab bar, purple offer tabs, gold Premium banner).
const GG_TIFFIN_GRADIENT = ["#22D3A6", "#0EA679", "#066B4E"] as const;

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

  // New-customer offer promo tabs (see packages/pricing/src/newCustomerOffer.ts) — quick-delivery
  // brands only (never GG Tiffin), and only while the signed-in customer's next order is still
  // #1 or #2. Gated on isLoggedIn too so guests aren't shown an offer they won't actually get
  // at checkout (the backend requires login the same way).
  const { isLoggedIn, loyalty } = useAuthContext();
  const isQuickDeliveryBrandSelected = !!selectedBrandId && isQuickDeliveryBrandId(selectedBrandId);
  const nextOrderNumber = loyalty.completedOrderCount + 1;
  const showNewCustomerOfferTabs = isLoggedIn && isQuickDeliveryBrandSelected && nextOrderNumber <= 2;

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

  // The address/cart/avatar row and the search bar visually stack in that order at rest,
  // exactly as before — but only the search row is sticky (stays pinned once scrolled past)
  // while the address row scrolls away above it. FlatList's stickyHeaderIndices only works on
  // its own top-level rows, so both live as rows in `data` instead of a single ListHeaderComponent.
  type Row = { kind: "header" } | { kind: "offerTabs" } | { kind: "search" } | { kind: "content" };

  const rows: Row[] = useMemo(
    () => [{ kind: "header" }, ...(showNewCustomerOfferTabs ? [{ kind: "offerTabs" as const }] : []), { kind: "search" }, { kind: "content" }],
    [showNewCustomerOfferTabs]
  );
  const stickySearchIndex = rows.findIndex((row) => row.kind === "search");

  function renderRow({ item: row }: { item: Row }) {
    switch (row.kind) {
      case "header":
        return (
          <View style={styles.headerRow}>
            <Pressable style={styles.addressBar} onPress={() => navigation.navigate("Addresses")}>
              <Text style={styles.addressLabel}>🏠 Home</Text>
              <View style={styles.addressValueRow}>
                <Text style={styles.addressValue} numberOfLines={1}>
                  {selectedAddress ? `${selectedAddress.label} · ${selectedAddress.city}` : SUPPORTED_CITY}
                </Text>
                <Text style={styles.addressChevron}>▾</Text>
              </View>
            </Pressable>
            <Pressable style={styles.cartButton} onPress={() => navigation.navigate("Cart")}>
              <Text style={styles.cartButtonText}>🛒</Text>
              {cartItemCount > 0 && (
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>{cartItemCount > 9 ? "9+" : cartItemCount}</Text>
                </View>
              )}
            </Pressable>
            <Pressable style={styles.avatarButton} onPress={() => navigation.navigate("Account")}>
              <Text style={styles.avatarButtonText}>{initial}</Text>
            </Pressable>
          </View>
        );
      case "offerTabs":
        return (
          <View style={styles.offerTabsBar}>
            <LinearGradient colors={["#4A1D7A", "#8E2DE2"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.offerTabsGradient}>
              <Pressable
                style={[styles.offerTab, nextOrderNumber === 1 && styles.offerTabActive]}
                android_ripple={{ color: "rgba(0,0,0,0.15)" }}
                onPress={() => navigation.navigate("RestaurantMenu")}
              >
                <Text style={styles.offerTabBadge}>Order 1</Text>
                <Text style={styles.offerTabIcon}>🎁</Text>
                <Text style={[styles.offerTabLabel, nextOrderNumber === 1 && styles.offerTabLabelActive]}>BOGO Free</Text>
              </Pressable>
              <Pressable
                style={[styles.offerTab, nextOrderNumber === 2 && styles.offerTabActive]}
                android_ripple={{ color: "rgba(0,0,0,0.15)" }}
                onPress={() => navigation.navigate("RestaurantMenu")}
              >
                <Text style={styles.offerTabBadge}>Order 2</Text>
                <Text style={styles.offerTabIcon}>🔥</Text>
                <Text style={[styles.offerTabLabel, nextOrderNumber === 2 && styles.offerTabLabelActive]}>50% Off</Text>
              </Pressable>
            </LinearGradient>
          </View>
        );
      case "search":
        return (
          <View style={styles.stickySearchWrap}>
            <Pressable style={styles.search} onPress={() => navigation.navigate("Search")}>
              <Text style={styles.searchPlaceholder}>{searchPlaceholder}</Text>
            </Pressable>
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
        stickyHeaderIndices={[stickySearchIndex]}
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
              android_ripple={{ color: "#3a332c", borderless: false }}
              onPress={() => setIsBrandPickerOpen(true)}
            >
              {({ pressed }) => (
                <>
                  <Text style={styles.tabIcon}>📋</Text>
                  <Text style={[styles.tabLabel, pressed && styles.tabLabelActive]}>Menu</Text>
                  <View style={[styles.tabUnderline, pressed && styles.tabUnderlineActive]} />
                </>
              )}
            </Pressable>
            {showCombosBanner && (
              <Pressable
                style={({ pressed }) => [styles.tabItem, pressed && styles.tabItemActive]}
                android_ripple={{ color: "#3a332c", borderless: false }}
                onPress={() => navigation.navigate("Combos")}
              >
                {({ pressed }) => (
                  <>
                    <Text style={styles.tabIcon}>🎁</Text>
                    <Text style={[styles.tabLabel, pressed && styles.tabLabelActive]}>Combos</Text>
                    <View style={[styles.tabUnderline, pressed && styles.tabUnderlineActive]} />
                  </>
                )}
              </Pressable>
            )}
            <Pressable
              style={({ pressed }) => [styles.tabItem, pressed && styles.tabItemActive]}
              android_ripple={{ color: "#3a332c", borderless: false }}
              onPress={() => navigation.navigate("BulkOrder")}
            >
              {({ pressed }) => (
                <>
                  <Text style={styles.tabIcon}>🎉</Text>
                  <Text style={[styles.tabLabel, pressed && styles.tabLabelActive]}>Bulk Deals</Text>
                  <View style={[styles.tabUnderline, pressed && styles.tabUnderlineActive]} />
                </>
              )}
            </Pressable>
          </View>

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
              <View>
                <Text style={styles.ggTiffinLabelLine}>GG</Text>
                <Text style={styles.ggTiffinLabelLine}>Tiffin</Text>
              </View>
              <Text style={styles.ggTiffinArrow}>↗</Text>
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
    headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: theme.spacing(2) },
    addressBar: { flex: 1 },
    addressLabel: { fontSize: 14, color: colors.muted, fontWeight: "600" },
    addressValueRow: { flexDirection: "row", alignItems: "center", marginTop: 2 },
    addressValue: { fontSize: 16, fontWeight: "800", color: colors.primary, flexShrink: 1 },
    addressChevron: { fontSize: 14, fontWeight: "800", color: colors.primary, marginLeft: 4 },
    avatarButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      marginLeft: theme.spacing(1),
    },
    avatarButtonText: { color: "#fff", fontWeight: "800", fontSize: 24 },
    cartButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      marginLeft: theme.spacing(1),
    },
    cartButtonText: { fontSize: 18 },
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
    // New-customer offer promo tabs — modeled on a food-delivery app's Food/Instamart/Dineout
    // tab-shaped switcher bar (purple gradient strip, rounded tab cards, a small floating badge
    // above each), but purely informational here since there's nothing to switch between.
    offerTabsBar: {
      borderRadius: 20,
      overflow: "hidden",
      marginBottom: theme.spacing(1.5),
      shadowColor: "#4A1D7A",
      shadowOpacity: 0.3,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 5,
    },
    offerTabsGradient: { flexDirection: "row", padding: theme.spacing(0.75), gap: theme.spacing(0.75) },
    offerTab: {
      flex: 1,
      position: "relative",
      alignItems: "center",
      justifyContent: "center",
      paddingTop: theme.spacing(1.75),
      paddingBottom: theme.spacing(1),
      borderRadius: 16,
      backgroundColor: "rgba(255,255,255,0.16)",
    },
    // The offer whose turn it actually is on this customer's next order gets the raised white
    // "active" treatment; the other stays dim — same active/inactive contrast as the reference
    // tab bar, just driven by order-number eligibility instead of which category is selected.
    offerTabActive: { backgroundColor: "#fff" },
    offerTabBadge: {
      position: "absolute",
      top: -8,
      alignSelf: "center",
      fontSize: 9,
      fontWeight: "800",
      color: "#3D1465",
      backgroundColor: "#FFD54A",
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 8,
      overflow: "hidden",
    },
    offerTabIcon: { fontSize: 22 },
    offerTabLabel: { fontSize: 12, fontWeight: "800", color: "#fff", marginTop: 2 },
    offerTabLabelActive: { color: "#3D1465" },
    // Opaque so the carousel/items scrolling underneath don't show through the pinned strip
    // once this row becomes sticky.
    stickySearchWrap: { backgroundColor: colors.background, paddingBottom: theme.spacing(1.5) },
    search: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: theme.radius,
      padding: theme.spacing(1.25),
    },
    searchPlaceholder: { color: colors.muted },
    // Absolute positioning is relative to the screen's border box, not its padding box — restate
    // the screen's own horizontal padding here so the floating cart bar isn't flush against the edges.
    floatingFooter: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: theme.spacing(2) },
    // Left group (Menu/Combos/Bulk Deals) and the right GG Tiffin pill, pinned to opposite ends.
    bottomRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: theme.spacing(1), gap: theme.spacing(1) },
    // Single dark rounded pill housing all three tabs — mirrors the reference screenshot's
    // dark bottom bar rather than separate light bordered buttons.
    tabBar: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "#221B17",
      borderRadius: 30,
      paddingVertical: theme.spacing(0.75),
      paddingHorizontal: theme.spacing(0.75),
      gap: theme.spacing(0.25),
      shadowColor: "#000",
      shadowOpacity: 0.3,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 5 },
      elevation: 8,
      flexShrink: 1,
    },
    tabItem: {
      alignItems: "center",
      justifyContent: "center",
      minWidth: 56,
      paddingVertical: theme.spacing(0.75),
      paddingHorizontal: theme.spacing(1),
      borderRadius: 22,
    },
    // Pressed state doubles as this bar's only "active" cue — a soft highlight chip behind the icon,
    // since none of these three destinations reflect a persistent "current tab".
    tabItemActive: { backgroundColor: "rgba(255,255,255,0.1)" },
    tabIcon: { fontSize: 18, opacity: 0.9 },
    tabLabel: { fontSize: 10, fontWeight: "700", color: "#9A9088", marginTop: 3 },
    tabLabelActive: { color: "#fff" },
    tabUnderline: { marginTop: 3, width: 14, height: 3, borderRadius: 2, backgroundColor: "transparent" },
    tabUnderlineActive: { backgroundColor: colors.accent },
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
      backgroundColor: "rgba(255,255,255,0.3)",
      borderBottomLeftRadius: 30,
      borderBottomRightRadius: 30,
    },
    ggTiffinLogo: { width: 38, height: 38, borderRadius: 19 },
    ggTiffinLabelLine: { fontSize: 14, fontWeight: "800", color: "#fff", lineHeight: 16 },
    ggTiffinArrow: { fontSize: 14, fontWeight: "800", color: "#fff", marginLeft: 2 },
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
