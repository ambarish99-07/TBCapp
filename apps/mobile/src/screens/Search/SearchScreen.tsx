import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMemo, useState } from "react";
import { FlatList, Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useBrowseCategories } from "../../api/menu.api";
import { theme, type ColorPalette } from "../../constants/theme";
import { useTheme } from "../../state/themeStore";
import type { RootStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Search">;

export function SearchScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { data: categories, isLoading } = useBrowseCategories();
  const [query, setQuery] = useState("");

  function runSearch() {
    const trimmed = query.trim();
    if (trimmed.length === 0) return;
    navigation.navigate("CategoryResults", { label: `"${trimmed}"`, query: trimmed });
  }

  return (
    <View style={styles.screen}>
      <TextInput
        style={styles.search}
        placeholder="Search shakes, mocktails, paneer, and more..."
        value={query}
        onChangeText={setQuery}
        onSubmitEditing={runSearch}
        returnKeyType="search"
        autoFocus
        placeholderTextColor={colors.muted}
      />

      <Text style={styles.sectionTitle}>Browse by category</Text>
      <Text style={styles.sectionSubtitle}>Across every Devour brand, not just the one you're in.</Text>

      {isLoading && <Text style={styles.info}>Loading categories…</Text>}

      <FlatList
        data={categories ?? []}
        keyExtractor={(cat) => cat.id}
        numColumns={3}
        columnWrapperStyle={styles.row}
        contentContainerStyle={{ paddingBottom: theme.spacing(2) }}
        renderItem={({ item: cat }) => {
          const available = cat.itemCount > 0;
          return (
            <Pressable
              style={styles.tile}
              onPress={() => navigation.navigate("CategoryResults", { label: cat.label, categoryId: cat.id })}
            >
              <View style={[styles.circle, !available && styles.circleEmpty]}>
                {cat.image ? (
                  <Image source={{ uri: cat.image }} style={styles.circleImage} />
                ) : (
                  <Text style={styles.circleFallback}>{cat.label.charAt(0)}</Text>
                )}
                {!available && (
                  <View style={styles.soonBadge}>
                    <Text style={styles.soonBadgeText}>Soon</Text>
                  </View>
                )}
              </View>
              <Text style={styles.tileLabel} numberOfLines={1}>
                {cat.label}
              </Text>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const CIRCLE_SIZE = 76;

const makeStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background, padding: theme.spacing(2) },
    search: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: theme.radius,
      padding: theme.spacing(1.25),
      marginBottom: theme.spacing(2),
      color: colors.text,
    },
    sectionTitle: { fontSize: 16, fontWeight: "800", color: colors.text },
    sectionSubtitle: { fontSize: 12, color: colors.muted, marginTop: 2, marginBottom: theme.spacing(2) },
    info: { textAlign: "center", color: colors.muted, marginVertical: theme.spacing(2) },
    row: { justifyContent: "flex-start", gap: theme.spacing(2), marginBottom: theme.spacing(2) },
    tile: { width: "30%", alignItems: "center" },
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
    circleEmpty: { opacity: 0.5 },
    circleImage: { width: "100%", height: "100%" },
    circleFallback: { fontSize: 24, fontWeight: "800", color: colors.muted },
    soonBadge: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: colors.text,
      paddingVertical: 2,
      alignItems: "center",
    },
    soonBadgeText: { color: colors.background, fontSize: 8, fontWeight: "800" },
    tileLabel: { fontSize: 12, fontWeight: "700", color: colors.text, marginTop: 6, textAlign: "center" },
  });
