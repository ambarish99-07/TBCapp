import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { Brand } from "@tbc/shared-types";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBrands } from "../../api/brands.api";
import { devourColors, theme } from "../../constants/theme";
import { useBrandStore } from "../../state/brandStore";
import type { RootStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "BrandSelect">;

export function BrandSelectScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { data: brands, isLoading, error } = useBrands();
  const selectBrand = useBrandStore((state) => state.selectBrand);

  function handleSelect(brand: Brand) {
    selectBrand(brand);
    navigation.navigate("Menu");
  }

  return (
    <View style={[styles.screen, { paddingTop: theme.spacing(3) + insets.top }]}>
      <Text style={styles.title}>Devour</Text>
      <Text style={styles.subtitle}>What are you in the mood for?</Text>

      {isLoading && <ActivityIndicator color={devourColors.primary} style={{ marginTop: theme.spacing(4) }} />}
      {error && <Text style={styles.info}>Couldn't load brands. Pull to retry.</Text>}

      <FlatList
        data={brands}
        keyExtractor={(brand) => brand.id}
        contentContainerStyle={{ paddingTop: theme.spacing(2) }}
        renderItem={({ item }) => (
          <Pressable
            style={[styles.tile, item.primaryColor ? { borderColor: item.primaryColor } : null]}
            onPress={() => handleSelect(item)}
          >
            <Text style={styles.tileName}>{item.name}</Text>
            {item.tagline && <Text style={styles.tileTagline}>{item.tagline}</Text>}
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: devourColors.background, padding: theme.spacing(2) },
  title: { fontSize: 32, fontWeight: "800", color: devourColors.text },
  subtitle: { fontSize: 14, color: devourColors.muted, marginTop: theme.spacing(0.5) },
  info: { textAlign: "center", color: devourColors.muted, marginTop: theme.spacing(4) },
  tile: {
    backgroundColor: devourColors.surface,
    borderWidth: 1,
    borderColor: devourColors.border,
    borderRadius: theme.radius,
    padding: theme.spacing(2.5),
    marginBottom: theme.spacing(1.5),
  },
  tileName: { fontSize: 20, fontWeight: "700", color: devourColors.text },
  tileTagline: { fontSize: 13, color: devourColors.muted, marginTop: theme.spacing(0.5) },
});
