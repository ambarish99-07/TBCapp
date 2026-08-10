import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { MenuCategory } from "@tbc/shared-types";
import { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBrands } from "../../api/brands.api";
import { useMenuItems } from "../../api/menu.api";
import { BrandCarousel } from "../../components/BrandCarousel";
import { MenuItemCard } from "../../components/MenuItemCard";
import { SUPPORTED_CITY } from "../../constants/deliveryZone";
import { theme, type ColorPalette } from "../../constants/theme";
import { useAuthStore } from "../../state/authStore";
import { useBrandStore } from "../../state/brandStore";
import { useCartStore } from "../../state/cartStore";
import { useTheme } from "../../state/themeStore";
import type { RootStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Menu">;

const CATEGORIES: { key: MenuCategory | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "signature-shakes", label: "Signature Shakes" },
  { key: "cold-coffee", label: "Cold Coffee" },
];

export function MenuScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { data: brands } = useBrands();
  const selectedBrandId = useBrandStore((state) => state.selectedBrandId);
  const selectedBrand = useBrandStore((state) => state.selectedBrand);
  const selectBrand = useBrandStore((state) => state.selectBrand);
  const { data: items, isLoading, error } = useMenuItems();
  const [category, setCategory] = useState<MenuCategory | "all">("all");
  const [search, setSearch] = useState("");
  const cartLineCount = useCartStore((state) => state.lines.length);
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const initial = user?.fullName?.trim().charAt(0).toUpperCase() ?? "?";
  // Combos are only seeded for TBC today — hide the banner rather than link into an empty screen for other brands.
  const showCombosBanner = selectedBrand?.id === "tbc";

  // Land here with no brand chosen yet (fresh login) — default to the first live brand
  // rather than showing a blank menu; the carousel below lets the customer switch.
  useEffect(() => {
    if (!selectedBrandId && brands && brands.length > 0) {
      selectBrand(brands[0]);
    }
  }, [selectedBrandId, brands, selectBrand]);

  const filtered = useMemo(() => {
    if (!items) return [];
    return items.filter((item) => {
      const matchesCategory = category === "all" || item.category === category;
      const matchesSearch =
        search.trim().length === 0 ||
        item.signatureName.toLowerCase().includes(search.toLowerCase()) ||
        item.commonName.toLowerCase().includes(search.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [items, category, search]);

  const listHeader = (
    <View>
      <View style={styles.headerRow}>
        <View style={styles.addressBar}>
          <Text style={styles.addressLabel}>📍 Delivering to</Text>
          <Text style={styles.addressValue}>{SUPPORTED_CITY}</Text>
        </View>
        <Pressable style={styles.avatarButton} onPress={() => navigation.navigate("Account")}>
          <Text style={styles.avatarButtonText}>{initial}</Text>
        </Pressable>
      </View>

      <BrandCarousel colors={colors} />

      {selectedBrand && <Text style={styles.brandSectionLabel}>{selectedBrand.name} Menu</Text>}

      <TextInput
        style={styles.search}
        placeholder="Search the menu..."
        value={search}
        onChangeText={setSearch}
        placeholderTextColor={colors.muted}
      />

      <View style={styles.tabs}>
        {CATEGORIES.map((tab) => (
          <Pressable key={tab.key} onPress={() => setCategory(tab.key)} style={[styles.tab, category === tab.key && styles.tabActive]}>
            <Text style={[styles.tabText, category === tab.key && styles.tabTextActive]}>{tab.label}</Text>
          </Pressable>
        ))}
      </View>

      {showCombosBanner && (
        <Pressable style={styles.combosBanner} onPress={() => navigation.navigate("Combos")}>
          <Text style={styles.combosBannerText}>🎁 View Combo Deals — save with two-item bundles</Text>
        </Pressable>
      )}

      <Pressable style={styles.bulkOrderBanner} onPress={() => navigation.navigate("BulkOrder")}>
        <Text style={styles.bulkOrderBannerText}>🎉 Planning an event? Ask about Bulk Orders</Text>
      </Pressable>

      {isLoading && <Text style={styles.info}>Loading menu…</Text>}
      {error && <Text style={styles.info}>Couldn't load the menu. Pull to retry.</Text>}
      {!isLoading && !error && filtered.length === 0 && (
        <Text style={styles.info}>
          {items && items.length > 0
            ? "No items match your search."
            : `${selectedBrand?.name ?? "This brand"}'s menu is coming soon — check back shortly!`}
        </Text>
      )}
    </View>
  );

  return (
    <View style={[styles.screen, { paddingTop: theme.spacing(2) + insets.top, backgroundColor: colors.background }]}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={listHeader}
        contentContainerStyle={{ paddingBottom: 96 }}
        renderItem={({ item }) => (
          <MenuItemCard item={item} onPress={() => navigation.navigate("ItemDetail", { menuItemId: item.id })} />
        )}
      />

      <Pressable style={styles.cartButton} onPress={() => navigation.navigate("Cart")}>
        <Text style={styles.cartButtonText}>View Cart {cartLineCount > 0 ? `(${cartLineCount})` : ""}</Text>
      </Pressable>
    </View>
  );
}

const makeStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background, padding: theme.spacing(2) },
    headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: theme.spacing(2) },
    addressBar: { flex: 1 },
    addressLabel: { fontSize: 11, color: colors.muted, fontWeight: "600" },
    addressValue: { fontSize: 18, fontWeight: "800", color: colors.primary, marginTop: 2 },
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
    brandSectionLabel: { fontSize: 16, fontWeight: "800", color: colors.text, marginBottom: theme.spacing(1) },
    search: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: theme.radius,
      padding: theme.spacing(1.25),
      marginBottom: theme.spacing(1.5),
      color: colors.text,
    },
    tabs: { flexDirection: "row", gap: 8, marginBottom: theme.spacing(2) },
    tab: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: colors.surface },
    tabActive: { backgroundColor: colors.primary },
    tabText: { fontSize: 12, color: colors.text },
    tabTextActive: { color: "#fff", fontWeight: "700" },
    combosBanner: { backgroundColor: colors.accent, borderRadius: theme.radius, padding: theme.spacing(1.25), marginBottom: theme.spacing(2) },
    combosBannerText: { color: "#fff", fontWeight: "700", fontSize: 12, textAlign: "center" },
    bulkOrderBanner: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: theme.radius,
      padding: theme.spacing(1.25),
      marginBottom: theme.spacing(2),
    },
    bulkOrderBannerText: { color: colors.primary, fontWeight: "700", fontSize: 12, textAlign: "center" },
    info: { textAlign: "center", color: colors.muted, marginBottom: theme.spacing(1) },
    cartButton: {
      position: "absolute",
      bottom: theme.spacing(2),
      left: theme.spacing(2),
      right: theme.spacing(2),
      backgroundColor: colors.primary,
      borderRadius: theme.radius,
      padding: theme.spacing(1.5),
      alignItems: "center",
    },
    cartButtonText: { color: "#fff", fontWeight: "700" },
  });
