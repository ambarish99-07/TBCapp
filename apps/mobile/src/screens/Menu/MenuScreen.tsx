import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { isComboLineId, type Brand, type MenuItem } from "@tbc/shared-types";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBrands } from "../../api/brands.api";
import { useAllCombos, useAllMenuItems, useBrowseCategories, useMenuItems } from "../../api/menu.api";
import { fetchMyOrders } from "../../api/orders.api";
import { AddItemModal } from "../../components/AddItemModal";
import { BrandCarousel } from "../../components/BrandCarousel";
import { CartSummaryBar } from "../../components/CartSummaryBar";
import { HomeCollections } from "../../components/HomeCollections";
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

  function handleOpenRestaurant(brand: Brand) {
    // GG Tiffin is a subscription plan service, not a menu of individual items — it gets its
    // own dedicated flow instead of the shake/mocktail RestaurantMenu tab+list UI.
    if (brand.id === "gg-tiffin") {
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
  type Row = { kind: "header" } | { kind: "search" } | { kind: "content" };

  const rows: Row[] = useMemo(() => [{ kind: "header" }, { kind: "search" }, { kind: "content" }], []);

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
            <BrandCarousel colors={colors} paused={isBrandPickerOpen} />

            {items && items.length > 0 && (
              <HomeCollections
                items={items}
                combos={brandCombos}
                onItemPress={(item) => setAddingItem(item)}
                onChooseCombo={(combo) => navigation.navigate("ChooseCombo", { comboId: combo.id })}
                brands={brands ?? []}
                allItems={allItems ?? []}
                onOpenRestaurant={handleOpenRestaurant}
                mostlyOrdered={mostlyOrdered}
              />
            )}

            {items && items.length === 0 && (
              <Text style={styles.info}>{`${selectedBrand?.name ?? "This brand"}'s menu is coming soon — check back shortly!`}</Text>
            )}
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
        stickyHeaderIndices={[1]}
        contentContainerStyle={{ paddingBottom: theme.spacing(2) + 90 + insets.bottom }}
        renderItem={renderRow}
      />

      {/* Floats over the page instead of taking its own fixed row — the home content keeps
          scrolling underneath, visible around the pill, rather than sitting on a solid strip. */}
      <View pointerEvents="box-none" style={[styles.floatingFooter, { paddingBottom: insets.bottom + theme.spacing(1) }]}>
        <CartSummaryBar navigation={navigation} />

        {/* Two separate pills, pinned to opposite corners — Menu/Combos/Bulk Deals on the left
            (a shared top-to-bottom border wraps that group, with thin vertical dividers between
            each icon+label), GG Tiffin on the right with its own boundary. */}
        <View style={styles.bottomRow}>
          <View style={styles.bottomBar}>
            <Pressable style={styles.bottomIcon} onPress={() => setIsBrandPickerOpen(true)}>
              <Text style={styles.bottomIconEmoji}>📋</Text>
              <Text style={styles.bottomIconLabel}>Menu</Text>
            </Pressable>
            <View style={styles.bottomDivider} />
            {showCombosBanner && (
              <>
                <Pressable style={styles.bottomIcon} onPress={() => navigation.navigate("Combos")}>
                  <Text style={styles.bottomIconEmoji}>🎁</Text>
                  <Text style={styles.bottomIconLabel}>Combos</Text>
                </Pressable>
                <View style={styles.bottomDivider} />
              </>
            )}
            <Pressable style={styles.bottomIcon} onPress={() => navigation.navigate("BulkOrder")}>
              <Text style={styles.bottomIconEmoji}>🎉</Text>
              <Text style={styles.bottomIconLabel}>Bulk Deals</Text>
            </Pressable>
          </View>

          <Pressable style={styles.ggTiffinTab} onPress={() => navigation.navigate("TiffinLanding")}>
            <Text style={styles.bottomIconEmoji}>🍱</Text>
            <Text style={styles.bottomIconLabel}>GG Tiffin</Text>
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
    // Left pill (Menu/Combos/Bulk Deals) and the right GG Tiffin pill, pinned to opposite ends.
    bottomRow: { flexDirection: "row", justifyContent: "space-between", marginTop: theme.spacing(1) },
    bottomBar: {
      flexDirection: "row",
      paddingVertical: theme.spacing(1),
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: theme.radius,
      backgroundColor: colors.surface,
      overflow: "hidden",
    },
    bottomIcon: { alignItems: "center", paddingHorizontal: theme.spacing(2.5) },
    // Thin vertical rule between icons — stretches to match the tallest sibling's height
    // (default cross-axis alignItems: "stretch") instead of a fixed px guess.
    bottomDivider: { width: 1, backgroundColor: colors.border },
    bottomIconEmoji: { fontSize: 20 },
    bottomIconLabel: { fontSize: 11, fontWeight: "700", color: colors.text, marginTop: 4 },
    // Its own separate boundary, distinct from the left pill's shared border.
    ggTiffinTab: {
      alignItems: "center",
      paddingVertical: theme.spacing(1),
      paddingHorizontal: theme.spacing(2),
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: theme.radius,
      backgroundColor: colors.surface,
    },
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
