import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBrands } from "../../api/brands.api";
import { useCombos, useMenuItems } from "../../api/menu.api";
import { BrandCarousel } from "../../components/BrandCarousel";
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
  const { data: combos } = useCombos();
  const [category, setCategory] = useState<string>("all");
  const cartLineCount = useCartStore((state) => state.lines.length);
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const initial = user?.fullName?.trim().charAt(0).toUpperCase() ?? "?";
  const selectedAddress = useAddressStore((state) => state.selectedAddress);
  // Data-driven, not hardcoded to TBC's combos — a brand without any combos just doesn't get the banner.
  const showCombosBanner = !!combos && combos.length > 0;

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

  const listHeader = (
    <View>
      <BrandCarousel colors={colors} />

      <Text style={styles.brandSectionLabel}>Menu</Text>

      {/* Not a live filter — opens the dedicated cross-brand Search page instead, since
          this bar searches every Devour brand, not just the one currently open. */}
      <Pressable style={styles.search} onPress={() => navigation.navigate("Search")}>
        <Text style={styles.searchPlaceholder}>🔍 Search shakes, mocktails, paneer, and more...</Text>
      </Pressable>

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

  return (
    <View style={[styles.screen, { paddingTop: theme.spacing(2) + insets.top, backgroundColor: colors.background }]}>
      {/* Fixed above the list, not part of ListHeaderComponent — stays put while browsing
          instead of scrolling away, all the way through to checkout. */}
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

      <FlatList
        style={styles.list}
        data={filtered}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={listHeader}
        contentContainerStyle={{ paddingBottom: theme.spacing(2) }}
        renderItem={({ item }) => (
          <MenuItemCard item={item} onPress={() => navigation.navigate("ItemDetail", { menuItemId: item.id })} />
        )}
      />

      {/* Fixed strip, not part of the scrolling list — icons pack from the left rather than
          spreading across the width, matching how the address/cart/avatar row above reads. */}
      <View style={[styles.bottomBar, { paddingBottom: theme.spacing(1) + insets.bottom }]}>
        {showCombosBanner && (
          <Pressable style={styles.bottomIcon} onPress={() => navigation.navigate("Combos")}>
            <View style={styles.bottomIconCircle}>
              <Text style={styles.bottomIconEmoji}>🎁</Text>
            </View>
            <Text style={styles.bottomIconLabel}>Combos</Text>
          </Pressable>
        )}
        <Pressable style={styles.bottomIcon} onPress={() => navigation.navigate("BulkOrder")}>
          <View style={styles.bottomIconCircle}>
            <Text style={styles.bottomIconEmoji}>🎉</Text>
          </View>
          <Text style={styles.bottomIconLabel}>Bulk Deals</Text>
        </Pressable>
      </View>
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
    brandSectionLabel: { fontSize: 16, fontWeight: "800", color: colors.text, marginBottom: theme.spacing(1) },
    search: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: theme.radius,
      padding: theme.spacing(1.25),
      marginBottom: theme.spacing(1.5),
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
      gap: theme.spacing(3),
      paddingTop: theme.spacing(1.25),
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    bottomIcon: { alignItems: "center" },
    bottomIconCircle: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    bottomIconEmoji: { fontSize: 20 },
    bottomIconLabel: { fontSize: 11, fontWeight: "700", color: colors.text, marginTop: 4 },
    info: { textAlign: "center", color: colors.muted, marginBottom: theme.spacing(1) },
  });
