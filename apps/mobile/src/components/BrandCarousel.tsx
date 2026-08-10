import type { Brand } from "@tbc/shared-types";
import { useEffect, useRef, useState } from "react";
import { Animated, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useBrands } from "../api/brands.api";
import { theme, type ColorPalette } from "../constants/theme";
import { useBrandStore } from "../state/brandStore";

const ROTATE_INTERVAL_MS = 4000;
const FADE_DURATION_MS = 350;

interface Props {
  colors: ColorPalette;
  /** Called after a brand is selected (e.g. so the host screen can scroll to top). */
  onSelect?: (brand: Brand) => void;
}

/**
 * Streaming-app-style "burst photo" hero (auto-rotates through every live brand every
 * few seconds) plus a row of small clickable "PIP" thumbnails — tapping either the hero
 * or a thumbnail switches the active brand in-place (no navigation away from this screen).
 */
export function BrandCarousel({ colors, onSelect }: Props) {
  const { data: brands, isLoading, error } = useBrands();
  const selectBrand = useBrandStore((state) => state.selectBrand);
  const selectedBrandId = useBrandStore((state) => state.selectedBrandId);
  const [activeIndex, setActiveIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const styles = makeStyles(colors);

  useEffect(() => {
    if (!brands || brands.length <= 1) return;
    const timer = setInterval(() => {
      Animated.timing(fadeAnim, { toValue: 0, duration: FADE_DURATION_MS, useNativeDriver: true }).start(() => {
        setActiveIndex((i) => (i + 1) % brands.length);
        Animated.timing(fadeAnim, { toValue: 1, duration: FADE_DURATION_MS, useNativeDriver: true }).start();
      });
    }, ROTATE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [brands, fadeAnim]);

  // Keep the hero in sync if the active brand was switched via a thumbnail tap elsewhere.
  useEffect(() => {
    if (!brands) return;
    const idx = brands.findIndex((b) => b.id === selectedBrandId);
    if (idx >= 0) setActiveIndex(idx);
  }, [selectedBrandId, brands]);

  function handleSelect(brand: Brand, index: number) {
    setActiveIndex(index);
    fadeAnim.setValue(1);
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
        <Animated.View style={[styles.hero, { opacity: fadeAnim }]}>
          {activeBrand.logoUrl && <Image source={{ uri: activeBrand.logoUrl }} style={styles.heroLogo} resizeMode="contain" />}
          <Text style={styles.heroName}>{activeBrand.name}</Text>
          {activeBrand.tagline && <Text style={styles.heroTagline}>{activeBrand.tagline}</Text>}
          <Text style={styles.heroCta}>Tap to explore →</Text>
        </Animated.View>
      </Pressable>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbRow}>
        {brands.map((brand, index) => (
          <Pressable
            key={brand.id}
            style={[styles.thumb, index === activeIndex && styles.thumbActive]}
            onPress={() => handleSelect(brand, index)}
          >
            {brand.logoUrl && <Image source={{ uri: brand.logoUrl }} style={styles.thumbLogo} resizeMode="contain" />}
            <Text style={styles.thumbName} numberOfLines={1}>
              {brand.name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    wrap: { marginBottom: theme.spacing(2) },
    info: { textAlign: "center", color: colors.muted },
    hero: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: theme.radius,
      padding: theme.spacing(2.5),
      alignItems: "center",
    },
    heroLogo: { width: 120, height: 120, marginBottom: theme.spacing(1) },
    heroName: { fontSize: 20, fontWeight: "800", color: colors.text, textAlign: "center" },
    heroTagline: { fontSize: 13, color: colors.muted, marginTop: theme.spacing(0.5), textAlign: "center" },
    heroCta: { fontSize: 12, fontWeight: "700", color: colors.primary, marginTop: theme.spacing(1) },
    thumbRow: { gap: 10, paddingTop: theme.spacing(1.5) },
    thumb: {
      width: 84,
      alignItems: "center",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: theme.radius,
      padding: theme.spacing(1),
    },
    thumbActive: { borderColor: colors.primary },
    thumbLogo: { width: 44, height: 44, marginBottom: theme.spacing(0.5) },
    thumbName: { fontSize: 10, color: colors.text, textAlign: "center" },
  });
