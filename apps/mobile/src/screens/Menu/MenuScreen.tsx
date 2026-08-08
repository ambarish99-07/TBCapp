import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { MenuCategory } from "@tbc/shared-types";
import { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMenuItems } from "../../api/menu.api";
import { MenuItemCard } from "../../components/MenuItemCard";
import { theme } from "../../constants/theme";
import { useCartStore } from "../../state/cartStore";
import type { RootStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Menu">;

const CATEGORIES: { key: MenuCategory | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "signature-shakes", label: "Signature Shakes" },
  { key: "cold-coffee", label: "Cold Coffee" },
];

export function MenuScreen({ navigation }: Props) {
  const { data: items, isLoading, error } = useMenuItems();
  const [category, setCategory] = useState<MenuCategory | "all">("all");
  const [search, setSearch] = useState("");
  const cartLineCount = useCartStore((state) => state.lines.length);
  const insets = useSafeAreaInsets();

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

  return (
    <View style={[styles.screen, { paddingTop: theme.spacing(2) + insets.top }]}>
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={styles.title}>The Blenders Club</Text>
          <Text style={styles.tagline}>Crafted to Refresh. Blended to Impress.</Text>
        </View>
        <Pressable style={styles.accountButton} onPress={() => navigation.navigate("Account")}>
          <Text style={styles.accountButtonText}>Account</Text>
        </Pressable>
      </View>

      <TextInput
        style={styles.search}
        placeholder="Search the menu..."
        value={search}
        onChangeText={setSearch}
        placeholderTextColor={theme.colors.muted}
      />

      <View style={styles.tabs}>
        {CATEGORIES.map((tab) => (
          <Pressable key={tab.key} onPress={() => setCategory(tab.key)} style={[styles.tab, category === tab.key && styles.tabActive]}>
            <Text style={[styles.tabText, category === tab.key && styles.tabTextActive]}>{tab.label}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable style={styles.combosBanner} onPress={() => navigation.navigate("Combos")}>
        <Text style={styles.combosBannerText}>🎁 View Combo Deals — save with two-item bundles</Text>
      </Pressable>

      {isLoading && <Text style={styles.info}>Loading menu…</Text>}
      {error && <Text style={styles.info}>Couldn't load the menu. Pull to retry.</Text>}

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background, padding: theme.spacing(2) },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  headerText: { flex: 1 },
  title: { fontSize: 24, fontWeight: "800", color: theme.colors.primary },
  tagline: { fontSize: 12, color: theme.colors.muted, marginBottom: theme.spacing(2) },
  accountButton: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius,
    paddingHorizontal: theme.spacing(1.5),
    paddingVertical: theme.spacing(1),
    marginLeft: theme.spacing(1),
  },
  accountButtonText: { color: theme.colors.primary, fontWeight: "700", fontSize: 12 },
  search: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius,
    padding: theme.spacing(1.25),
    marginBottom: theme.spacing(1.5),
  },
  tabs: { flexDirection: "row", gap: 8, marginBottom: theme.spacing(2) },
  tab: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: theme.colors.surface },
  tabActive: { backgroundColor: theme.colors.primary },
  tabText: { fontSize: 12, color: theme.colors.text },
  tabTextActive: { color: "#fff", fontWeight: "700" },
  combosBanner: { backgroundColor: theme.colors.accent, borderRadius: theme.radius, padding: theme.spacing(1.25), marginBottom: theme.spacing(2) },
  combosBannerText: { color: "#fff", fontWeight: "700", fontSize: 12, textAlign: "center" },
  info: { textAlign: "center", color: theme.colors.muted, marginBottom: theme.spacing(1) },
  cartButton: {
    position: "absolute",
    bottom: theme.spacing(2),
    left: theme.spacing(2),
    right: theme.spacing(2),
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius,
    padding: theme.spacing(1.5),
    alignItems: "center",
  },
  cartButtonText: { color: "#fff", fontWeight: "700" },
});
