import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { Brand } from "@tbc/shared-types";
import { useMemo, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useBrands } from "../../api/brands.api";
import { useBrowseCategories } from "../../api/menu.api";
import { theme, type ColorPalette } from "../../constants/theme";
import { useBrandStore } from "../../state/brandStore";
import { useTheme } from "../../state/themeStore";
import type { RootStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Search">;

export function SearchScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { data: categories, isLoading } = useBrowseCategories();
  const { data: brands } = useBrands();
  const selectBrand = useBrandStore((state) => state.selectBrand);
  const [query, setQuery] = useState("");

  // Only categories that actually have items today — as soon as a matching item lands in
  // any brand's menu, its itemCount goes above 0 and the tile starts appearing on its own,
  // no manual list to maintain.
  const availableCategories = useMemo(() => (categories ?? []).filter((cat) => cat.itemCount > 0), [categories]);

  // Same "hide until populated" rule as the tile grid below — the hint text names only
  // categories that actually have items today, and picks up new ones automatically.
  const searchPlaceholder = useMemo(() => {
    const names = availableCategories.slice(0, 3).map((cat) => cat.label.toLowerCase());
    return names.length > 0 ? `Search ${names.join(", ")}, and more...` : "Search the menu...";
  }, [availableCategories]);

  function runSearch() {
    const trimmed = query.trim();
    if (trimmed.length === 0) return;
    navigation.navigate("CategoryResults", { label: `"${trimmed}"`, query: trimmed });
  }

  function handleOpenBrand(brand: Brand) {
    // Straight to that restaurant's own menu — same as tapping a brand from Home's
    // Restaurants row — not back to the generic Home page.
    selectBrand(brand);
    navigation.navigate("RestaurantMenu");
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <TextInput
        style={styles.search}
        placeholder={searchPlaceholder}
        value={query}
        onChangeText={setQuery}
        onSubmitEditing={runSearch}
        returnKeyType="search"
        autoFocus
        placeholderTextColor={colors.muted}
      />

      <Text style={styles.sectionTitle}>Browse by category</Text>
      <Text style={styles.sectionSubtitle}>Across every Lickyeat brand, not just the one you're in.</Text>

      {isLoading && <Text style={styles.info}>Loading categories…</Text>}
      {!isLoading && availableCategories.length === 0 && <Text style={styles.info}>Categories are coming soon — check back shortly!</Text>}

      <View style={styles.grid}>
        {availableCategories.map((cat) => (
          <Pressable
            key={cat.id}
            style={styles.tile}
            onPress={() => navigation.navigate("CategoryResults", { label: cat.label, categoryId: cat.id })}
          >
            <View style={styles.circle}>
              {cat.image ? <Image source={{ uri: cat.image }} style={styles.circleImage} /> : <Text style={styles.circleFallback}>{cat.label.charAt(0)}</Text>}
            </View>
            <Text style={styles.tileLabel} numberOfLines={1}>
              {cat.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Restaurants</Text>
      <Text style={styles.sectionSubtitle}>Jump straight into a brand's own menu.</Text>

      {(brands ?? []).map((brand) => (
        <Pressable key={brand.id} style={styles.brandRow} onPress={() => handleOpenBrand(brand)}>
          {brand.logoUrl ? (
            <Image source={{ uri: brand.logoUrl }} style={styles.brandLogo} resizeMode="contain" />
          ) : (
            <View style={styles.brandLogoFallback}>
              <Text style={styles.circleFallback}>{brand.name.charAt(0)}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.brandName}>{brand.name}</Text>
            {brand.tagline && <Text style={styles.brandTagline}>{brand.tagline}</Text>}
          </View>
          <Text style={styles.brandChevron}>→</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const CIRCLE_SIZE = 76;

const makeStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { padding: theme.spacing(2), paddingBottom: theme.spacing(4) },
    search: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: theme.radius,
      padding: theme.spacing(1.25),
      marginBottom: theme.spacing(2),
      color: colors.text,
    },
    sectionTitle: { fontSize: 16, fontWeight: "800", color: colors.text, marginTop: theme.spacing(1) },
    sectionSubtitle: { fontSize: 12, color: colors.muted, marginTop: 2, marginBottom: theme.spacing(2) },
    info: { textAlign: "center", color: colors.muted, marginVertical: theme.spacing(2) },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing(2), marginBottom: theme.spacing(1) },
    tile: { width: "28%", alignItems: "center" },
    circle: {
      width: CIRCLE_SIZE,
      height: CIRCLE_SIZE,
      borderRadius: CIRCLE_SIZE / 2,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      borderWidth: 1,
      borderColor: colors.border,
    },
    circleImage: { width: "100%", height: "100%" },
    circleFallback: { fontSize: 24, fontWeight: "800", color: colors.muted },
    tileLabel: { fontSize: 12, fontWeight: "700", color: colors.text, marginTop: 6, textAlign: "center" },
    brandRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing(1.5),
      backgroundColor: colors.surface,
      borderRadius: theme.radius,
      padding: theme.spacing(1.5),
      marginBottom: theme.spacing(1.5),
    },
    brandLogo: { width: 48, height: 48, borderRadius: 24 },
    brandLogoFallback: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.background,
      alignItems: "center",
      justifyContent: "center",
    },
    brandName: { fontSize: 15, fontWeight: "700", color: colors.text },
    brandTagline: { fontSize: 11, color: colors.muted, marginTop: 2 },
    brandChevron: { fontSize: 16, fontWeight: "800", color: colors.primary },
  });
