import type { Brand } from "@tbc/shared-types";
import { useMemo, useState } from "react";
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { theme, type ColorPalette } from "../constants/theme";
import { CARD_WIDTH } from "./HomeCollections";

const BRANDS_PER_PAGE = 3;

interface Props {
  brands: Brand[] | undefined;
  colors: ColorPalette;
}

/**
 * Every brand the admin has marked "coming soon" (see useComingSoonBrands) — a teaser, not a
 * real entry point: there's no live menu to open yet, so tapping shows a friendly heads-up
 * instead of navigating anywhere. Same compact card + "N at a time, page with an arrow" shape as
 * the Cart screen's "Add More From [Brand]" row, so it reads as one consistent card language
 * across the app rather than a one-off banner design — dormant (no arrows shown) until there's
 * more than one page's worth of coming-soon brands to page through.
 */
export function ComingSoonBrandBanner({ brands, colors }: Props) {
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [page, setPage] = useState(0);

  const pageCount = Math.ceil((brands?.length ?? 0) / BRANDS_PER_PAGE);
  const clampedPage = Math.min(page, Math.max(0, pageCount - 1));
  const visibleBrands = (brands ?? []).slice(clampedPage * BRANDS_PER_PAGE, clampedPage * BRANDS_PER_PAGE + BRANDS_PER_PAGE);

  if (!brands || brands.length === 0) return null;

  function handlePress(brand: Brand) {
    Alert.alert(`${brand.name} — Coming Soon`, "We're putting the finishing touches on this one. Stay tuned!");
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Coming Soon</Text>
      <View style={styles.row}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cards}>
          {visibleBrands.map((brand) => (
            <Pressable key={brand.id} style={styles.card} onPress={() => handlePress(brand)}>
              {brand.logoUrl ? (
                <Image source={{ uri: brand.logoUrl }} style={styles.image} resizeMode="cover" />
              ) : (
                <View style={[styles.image, styles.imagePlaceholder]} />
              )}
              <Text style={styles.name} numberOfLines={1}>
                {brand.name}
              </Text>
              <View style={styles.tag}>
                <Text style={styles.tagText}>COMING SOON</Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
        {pageCount > 1 && clampedPage > 0 && (
          <Pressable style={[styles.arrow, styles.arrowLeft]} onPress={() => setPage((p) => Math.max(0, p - 1))}>
            <Text style={styles.arrowText}>‹</Text>
          </Pressable>
        )}
        {pageCount > 1 && clampedPage < pageCount - 1 && (
          <Pressable style={[styles.arrow, styles.arrowRight]} onPress={() => setPage((p) => Math.min(pageCount - 1, p + 1))}>
            <Text style={styles.arrowText}>›</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const makeStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    wrap: { marginBottom: theme.spacing(2) },
    title: { fontSize: 15, fontWeight: "800", color: colors.text, marginBottom: theme.spacing(1) },
    row: { position: "relative" },
    cards: { flexDirection: "row", gap: theme.spacing(1.5) },
    card: { width: CARD_WIDTH },
    image: { width: CARD_WIDTH, height: CARD_WIDTH, borderRadius: theme.radius, backgroundColor: colors.surface },
    imagePlaceholder: { alignItems: "center", justifyContent: "center" },
    name: { fontSize: 12, fontWeight: "700", color: colors.text, marginTop: 6 },
    tag: {
      alignSelf: "flex-start",
      backgroundColor: colors.primary,
      borderRadius: 999,
      paddingVertical: 3,
      paddingHorizontal: 7,
      marginTop: 4,
    },
    tagText: { fontSize: 9, fontWeight: "800", color: "#fff", letterSpacing: 0.3 },
    // Arrows float on top of the cards (transparent, no background chip), same treatment as the
    // Cart screen's "Add More From [Brand]" row.
    arrow: {
      position: "absolute",
      top: 0,
      height: CARD_WIDTH,
      width: 40,
      alignItems: "center",
      justifyContent: "center",
    },
    arrowLeft: { left: 0 },
    arrowRight: { right: 0 },
    arrowText: {
      fontSize: 36,
      fontWeight: "800",
      color: "#fff",
      textShadowColor: "rgba(0,0,0,0.6)",
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
    },
  });
