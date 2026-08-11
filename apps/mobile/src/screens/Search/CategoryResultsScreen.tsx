import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { round } from "@tbc/pricing";
import type { MenuItem } from "@tbc/shared-types";
import { useMemo } from "react";
import { FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useBrands } from "../../api/brands.api";
import { useMenuSearch } from "../../api/menu.api";
import { theme, type ColorPalette } from "../../constants/theme";
import { useBrandStore } from "../../state/brandStore";
import { useTheme } from "../../state/themeStore";
import type { RootStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "CategoryResults">;

export function CategoryResultsScreen({ route, navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { label, categoryId, query } = route.params;
  const { data: items, isLoading } = useMenuSearch({ category: categoryId, q: query });
  const { data: brands } = useBrands();
  const selectedBrandId = useBrandStore((state) => state.selectedBrandId);
  const selectBrand = useBrandStore((state) => state.selectBrand);

  function brandName(brandId: string): string {
    return brands?.find((brand) => brand.id === brandId)?.name ?? brandId;
  }

  function handlePress(item: MenuItem) {
    // Items from a brand other than the one currently active need a brand switch first —
    // menu lookups, pricing, and the cart are all scoped to whichever brand is "selected".
    if (item.brandId !== selectedBrandId) {
      const brand = brands?.find((b) => b.id === item.brandId);
      if (brand) selectBrand(brand);
    }
    navigation.navigate("ItemDetail", { menuItemId: item.id });
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>{label}</Text>

      {isLoading && <Text style={styles.info}>Searching…</Text>}
      {!isLoading && items && items.length === 0 && (
        <Text style={styles.info}>No items here yet — check back soon!</Text>
      )}

      <FlatList
        data={items ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: theme.spacing(2) }}
        renderItem={({ item }) => {
          const effectivePrice = item.salePercent ? round(item.price * (1 - item.salePercent / 100)) : item.price;
          return (
            <Pressable style={styles.card} onPress={() => handlePress(item)}>
              <Image source={{ uri: item.image }} style={styles.image} />
              <View style={styles.body}>
                <Text style={styles.brandTag}>{brandName(item.brandId)}</Text>
                <Text style={styles.name}>{item.signatureName}</Text>
                <Text style={styles.subtitle}>{item.commonName}</Text>
                <Text style={styles.price}>₹{effectivePrice}</Text>
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const makeStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background, padding: theme.spacing(2) },
    title: { fontSize: 20, fontWeight: "800", color: colors.text, marginBottom: theme.spacing(2) },
    info: { textAlign: "center", color: colors.muted, marginVertical: theme.spacing(2) },
    card: {
      flexDirection: "row",
      backgroundColor: colors.surface,
      borderRadius: theme.radius,
      marginBottom: theme.spacing(2),
      overflow: "hidden",
    },
    image: { width: 96, height: 96 },
    body: { flex: 1, padding: theme.spacing(1.5) },
    brandTag: { fontSize: 10, fontWeight: "700", color: colors.primary, textTransform: "uppercase" },
    name: { fontSize: 16, fontWeight: "700", color: colors.text, marginTop: 2 },
    subtitle: { fontSize: 12, color: colors.muted, marginTop: 2 },
    price: { marginTop: 6, fontSize: 14, fontWeight: "700", color: colors.primary },
  });
