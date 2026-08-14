import { useIsFocused } from "@react-navigation/native";
import type { Brand } from "@tbc/shared-types";
import { useEffect, useState } from "react";
import { Image, ImageBackground, Pressable, StyleSheet, Text, View } from "react-native";
import { useBrands } from "../api/brands.api";
import { theme, type ColorPalette } from "../constants/theme";
import { useBrandStore } from "../state/brandStore";

const ROTATE_INTERVAL_MS = 4000;

interface Props {
  colors: ColorPalette;
  /** Called after a brand is selected (e.g. so the host screen can scroll to top). */
  onSelect?: (brand: Brand) => void;
  /** True while something on top of Home (e.g. the "Choose a Brand" popup) needs the
   * selected brand to hold still — pauses rotation without unmounting anything. */
  paused?: boolean;
}

/**
 * Streaming-app-style "burst photo" hero (auto-rotates through every live brand every
 * few seconds) plus a row of small clickable "PIP" thumbnails — tapping either the hero
 * or a thumbnail switches the active brand in-place (no navigation away from this screen).
 * The auto-rotation is connected to the actually-selected brand, so as the hero shows TBC,
 * the PIPs highlight TBC and the rest of the Home page (Recommended/Offers/etc.) follows.
 */
export function BrandCarousel({ colors, onSelect, paused }: Props) {
  const { data: brands, isLoading, error } = useBrands();
  const selectBrand = useBrandStore((state) => state.selectBrand);
  const restoreBrand = useBrandStore((state) => state.restoreBrand);
  const selectedBrandId = useBrandStore((state) => state.selectedBrandId);
  const [activeIndex, setActiveIndex] = useState(0);
  const styles = makeStyles(colors);
  // React Navigation keeps Home mounted underneath a pushed screen (e.g. RestaurantMenu) —
  // without this, rotation kept running in the background and silently swapped the brand
  // being viewed on that other screen out from under the customer.
  const isFocused = useIsFocused();
  const isRotating = isFocused && !paused;

  // The auto-rotation drives the actually-selected brand (via restoreBrand, not selectBrand)
  // — so the PIPs' highlight and Home's Recommended/Offers/etc. rows below follow the hero
  // photo automatically. restoreBrand rather than selectBrand deliberately, so this ambient
  // rotation never silently clears whatever's already in the cart. Only runs at all while
  // Home is focused and nothing (like the brand picker) needs the selection to hold still.
  useEffect(() => {
    if (!brands || brands.length <= 1 || !isRotating) return;
    const timer = setInterval(() => {
      setActiveIndex((i) => {
        const next = (i + 1) % brands.length;
        restoreBrand(brands[next]);
        return next;
      });
    }, ROTATE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [brands, restoreBrand, isRotating]);

  // Keep the hero in sync if the active brand was switched via a thumbnail tap elsewhere.
  useEffect(() => {
    if (!brands) return;
    const idx = brands.findIndex((b) => b.id === selectedBrandId);
    if (idx >= 0) setActiveIndex(idx);
  }, [selectedBrandId, brands]);

  function handleSelect(brand: Brand, index: number) {
    setActiveIndex(index);
    selectBrand(brand);
    onSelect?.(brand);
  }

  if (isLoading) return null;
  if (error) return <Text style={styles.info}>Couldn't load brands.</Text>;
  if (!brands || brands.length === 0) return null;

  const activeBrand = brands[activeIndex];

  return (
    <View style={styles.wrap}>
      <Pressable onPress={() => handleSelect(activeBrand, activeIndex)}>
        <ImageBackground
          source={{ uri: activeBrand.heroImageUrl ?? activeBrand.logoUrl }}
          style={styles.hero}
          imageStyle={styles.heroImageStyle}
          resizeMode="cover"
        >
          <View style={styles.heroScrim} />
          <View style={styles.heroTextBlock}>
            {/* The dedicated hero photos already carry the brand name/tagline baked in — only show
                app-rendered text as a fallback for a brand that doesn't have one yet. */}
            {!activeBrand.heroImageUrl && (
              <>
                <Text style={styles.heroName}>{activeBrand.name}</Text>
                {activeBrand.tagline && <Text style={styles.heroTagline}>{activeBrand.tagline}</Text>}
              </>
            )}
            <Text style={styles.heroCta}>Tap to explore →</Text>
          </View>
        </ImageBackground>
      </Pressable>

      {/* Fixed row, not a horizontal scroller — all tiles share the screen width equally
          instead of overflowing off the edge. */}
      <View style={styles.thumbRow}>
        {brands.map((brand, index) => (
          <Pressable
            key={brand.id}
            // Highlights the customer's actual chosen brand (drives the menu below) — now kept
            // in sync with the auto-rotating hero photo above, not just manual taps.
            style={[styles.thumb, brand.id === selectedBrandId && styles.thumbActive]}
            onPress={() => handleSelect(brand, index)}
          >
            {brand.logoUrl && <Image source={{ uri: brand.logoUrl }} style={styles.thumbLogo} resizeMode="contain" />}
            <Text style={styles.thumbName} numberOfLines={2}>
              {brand.name}
            </Text>
          </Pressable>
        ))}
        {/* Not a real brand — no backend data, not tappable — just a preview of what's next. */}
        <View style={styles.thumbComingSoon}>
          <Text style={styles.thumbComingSoonIcon}>✨</Text>
          <Text style={styles.thumbName} numberOfLines={2}>
            Coming Soon
          </Text>
        </View>
      </View>
    </View>
  );
}

const makeStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    wrap: { marginBottom: theme.spacing(2) },
    info: { textAlign: "center", color: colors.muted },
    hero: {
      height: 300,
      borderRadius: theme.radius,
      overflow: "hidden",
      justifyContent: "flex-end",
    },
    heroImageStyle: { borderRadius: theme.radius },
    // Flat semi-transparent band (no gradient dependency) — keeps the overlaid text legible
    // no matter what's behind it in the logo artwork.
    heroScrim: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      height: "30%",
      backgroundColor: "rgba(0,0,0,0.45)",
    },
    heroTextBlock: { padding: theme.spacing(2) },
    heroName: { fontSize: 22, fontWeight: "800", color: "#fff" },
    heroTagline: { fontSize: 13, color: "rgba(255,255,255,0.85)", marginTop: theme.spacing(0.5) },
    heroCta: { fontSize: 12, fontWeight: "700", color: "#fff", marginTop: theme.spacing(1) },
    // flex: 1 on every tile (real brands + the Coming Soon placeholder) — four equal shares
    // of the row's width instead of a fixed px width, so all four always fit on screen.
    thumbRow: { flexDirection: "row", gap: 8, paddingTop: theme.spacing(1.5) },
    thumb: {
      flex: 1,
      alignItems: "center",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: theme.radius,
      paddingVertical: theme.spacing(1),
      paddingHorizontal: theme.spacing(0.5),
    },
    thumbActive: { borderColor: colors.primary },
    thumbLogo: { width: 36, height: 36, marginBottom: theme.spacing(0.5) },
    thumbName: { fontSize: 9.5, color: colors.text, textAlign: "center", lineHeight: 12 },
    thumbComingSoon: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.background,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: colors.border,
      borderRadius: theme.radius,
      paddingVertical: theme.spacing(1),
      paddingHorizontal: theme.spacing(0.5),
      opacity: 0.6,
    },
    thumbComingSoonIcon: { fontSize: 20, marginBottom: theme.spacing(0.5) },
  });
