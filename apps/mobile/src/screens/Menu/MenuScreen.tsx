import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { BROWSE_CATEGORIES, type Brand, type MenuItem } from "@tbc/shared-types";
import { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBrands } from "../../api/brands.api";
import { useAllCombos, useMenuItems } from "../../api/menu.api";
import { AddItemModal } from "../../components/AddItemModal";
import { BrandCarousel } from "../../components/BrandCarousel";
import { CartSummaryBar } from "../../components/CartSummaryBar";
import { MenuItemCard } from "../../components/MenuItemCard";
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

/** "signature-shakes" -> "Signature Shakes" — no brand-specific category list hardcoded here, since every brand has its own menu directory. */
function formatCategoryLabel(category: string): string {
  return category
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function MenuScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { data: brands } = useBrands();
  const selectedBrandId = useBrandStore((state) => state.selectedBrandId);
  const selectedBrand = useBrandStore((state) => state.selectedBrand);
  const selectBrand = useBrandStore((state) => state.selectBrand);
  const { data: items, isLoading, error } = useMenuItems();
  // Cross-brand, not scoped to the selected brand — the Combos icon should stay visible as
  // long as *any* live brand has combos, since tapping it now opens a cross-brand page.
  const { data: combos } = useAllCombos();
  const [category, setCategory] = useState<string>("all");
  const cartLineCount = useCartStore((state) => state.lines.length);
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const initial = user?.fullName?.trim().charAt(0).toUpperCase() ?? "?";
  const selectedAddress = useAddressStore((state) => state.selectedAddress);
  const showCombosBanner = !!combos && combos.length > 0;
  const listRef = useRef<FlatList>(null);
  const [isBrandPickerOpen, setIsBrandPickerOpen] = useState(false);
  const [addingItem, setAddingItem] = useState<MenuItem | null>(null);

  function handlePickBrand(brand: Brand) {
    selectBrand(brand);
    setIsBrandPickerOpen(false);
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }

  // Cycles the locked search bar's placeholder through every cross-brand browse category
  // ("Search shakes...", "Search cold coffee...", "Search mocktails...", ...) instead of a
  // single static hint — a lightweight advertisement for the Search page's full category list.
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setPlaceholderIndex((i) => (i + 1) % BROWSE_CATEGORIES.length);
    }, SEARCH_PLACEHOLDER_ROTATE_MS);
    return () => clearInterval(timer);
  }, []);
  const searchPlaceholder = `🔍 Search ${BROWSE_CATEGORIES[placeholderIndex].label.toLowerCase()}...`;

  // Every brand has its own category taxonomy (a cocktail bar's categories are nothing
  // like a shake shop's) — derive tabs from whatever categories this brand's own items
  // actually use, instead of a hardcoded TBC-specific list.
  const categories = useMemo(() => {
    if (!items || items.length === 0) return [];
    return Array.from(new Set(items.map((item) => item.category)));
  }, [items]);

  // Land here with no brand chosen yet (fresh login) — default to the first live brand
  // rather than showing a blank menu; the carousel below lets the customer switch.
  useEffect(() => {
    if (!selectedBrandId && brands && brands.length > 0) {
      selectBrand(brands[0]);
    }
  }, [selectedBrandId, brands, selectBrand]);

  // A category filter chosen for one brand (e.g. "cold-coffee") won't exist on another —
  // reset to "All" whenever the active brand changes so switching brands never silently
  // hides every item behind a stale, brand-specific filter.
  useEffect(() => {
    setCategory("all");
  }, [selectedBrandId]);

  const filtered = useMemo(() => {
    if (!items) return [];
    if (category === "all") return items;
    return items.filter((item) => item.category === category);
  }, [items, category]);

  // The address/cart/avatar row and the search bar visually stack in that order at rest,
  // exactly as before — but only the search row is sticky (stays pinned once scrolled past)
  // while the address row scrolls away above it. FlatList's stickyHeaderIndices only works on
  // its own top-level rows, so both live as rows in `data` instead of a single ListHeaderComponent.
  type Row = { kind: "header" } | { kind: "search" } | { kind: "content" } | { kind: "item"; item: MenuItem };

  const rows: Row[] = useMemo(
    () => [{ kind: "header" }, { kind: "search" }, { kind: "content" }, ...filtered.map((item) => ({ kind: "item" as const, item }))],
    [filtered]
  );

  function renderRow({ item: row }: { item: Row }) {
    switch (row.kind) {
      case "header":
        return (
          <View style={styles.headerRow}>
            <Pressable style={styles.addressBar} onPress={() => navigation.navigate("Addresses")}>
              <Text style={styles.addressLabel}>📍 Delivering to</Text>
              <View style={styles.addressValueRow}>
                <Text style={styles.addressValue} numberOfLines={1}>
                  {selectedAddress ? `${selectedAddress.label} · ${selectedAddress.city}` : SUPPORTED_CITY}
                </Text>
                <Text style={styles.addressChevron}>▾</Text>
              </View>
            </Pressable>
            <Pressable style={styles.cartButton} onPress={() => navigation.navigate("Cart")}>
              <Text style={styles.cartButtonText}>🛒</Text>
              {cartLineCount > 0 && (
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>{cartLineCount > 9 ? "9+" : cartLineCount}</Text>
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
            <BrandCarousel colors={colors} />

            {categories.length > 1 && (
              <View style={styles.tabs}>
                <Pressable onPress={() => setCategory("all")} style={[styles.tab, category === "all" && styles.tabActive]}>
                  <Text style={[styles.tabText, category === "all" && styles.tabTextActive]}>All</Text>
                </Pressable>
                {categories.map((cat) => (
                  <Pressable key={cat} onPress={() => setCategory(cat)} style={[styles.tab, category === cat && styles.tabActive]}>
                    <Text style={[styles.tabText, category === cat && styles.tabTextActive]}>{formatCategoryLabel(cat)}</Text>
                  </Pressable>
                ))}
              </View>
            )}

            {isLoading && <Text style={styles.info}>Loading menu…</Text>}
            {error && <Text style={styles.info}>Couldn't load the menu. Pull to retry.</Text>}
            {!isLoading && !error && filtered.length === 0 && (
              <Text style={styles.info}>{`${selectedBrand?.name ?? "This brand"}'s menu is coming soon — check back shortly!`}</Text>
            )}
          </View>
        );
      case "item":
        return <MenuItemCard item={row.item} onAddPress={() => setAddingItem(row.item)} />;
    }
  }

  return (
    <View style={[styles.screen, { paddingTop: theme.spacing(2) + insets.top, backgroundColor: colors.background }]}>
      <FlatList
        ref={listRef}
        style={styles.list}
        data={rows}
        keyExtractor={(row) => (row.kind === "item" ? row.item.id : row.kind)}
        stickyHeaderIndices={[1]}
        contentContainerStyle={{ paddingBottom: theme.spacing(2) }}
        renderItem={renderRow}
      />

      <CartSummaryBar navigation={navigation} />

      {/* Fixed strip, not part of the scrolling list — a single top border spans the whole
          row, and thin vertical dividers separate each icon+label instead of a box/circle
          around every individual emoji. */}
      <View style={[styles.bottomBar, { paddingBottom: theme.spacing(1) + insets.bottom }]}>
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
    addressLabel: { fontSize: 11, color: colors.muted, fontWeight: "600" },
    addressValueRow: { flexDirection: "row", alignItems: "center", marginTop: 2 },
    addressValue: { fontSize: 18, fontWeight: "800", color: colors.primary, flexShrink: 1 },
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
    avatarButtonText: { color: "#fff", fontWeight: "800", fontSize: 16 },
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
      top: -4,
      right: -4,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      paddingHorizontal: 4,
      backgroundColor: colors.danger,
      alignItems: "center",
      justifyContent: "center",
    },
    cartBadgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
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
    tabs: { flexDirection: "row", gap: 8, marginBottom: theme.spacing(2) },
    tab: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: colors.surface },
    tabActive: { backgroundColor: colors.primary },
    tabText: { fontSize: 12, color: colors.text },
    tabTextActive: { color: "#fff", fontWeight: "700" },
    bottomBar: {
      flexDirection: "row",
      justifyContent: "flex-start",
      paddingTop: theme.spacing(1.25),
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    bottomIcon: { alignItems: "center", paddingHorizontal: theme.spacing(2.5) },
    // Thin vertical rule between icons — stretches to match the tallest sibling's height
    // (default cross-axis alignItems: "stretch") instead of a fixed px guess.
    bottomDivider: { width: 1, backgroundColor: colors.border },
    bottomIconEmoji: { fontSize: 26 },
    bottomIconLabel: { fontSize: 11, fontWeight: "700", color: colors.text, marginTop: 4 },
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
