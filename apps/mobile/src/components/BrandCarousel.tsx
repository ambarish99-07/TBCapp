import { useIsFocused } from "@react-navigation/native";
import type { Brand } from "@tbc/shared-types";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import { Alert, ImageBackground, Pressable, StyleSheet, Text, View } from "react-native";
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

function handlePremiumPress() {
  Alert.alert("Premium Membership", "Get free delivery on every order for just ₹39/month. Coming soon!");
}

/**
 * Streaming-app-style "burst photo" hero, auto-rotating through every live brand every few
 * seconds — tapping it switches the active brand in-place (no navigation away from this
 * screen). Below it, a Premium Membership promo card (free delivery, ₹39/month) instead of
 * the old row of brand "PIP" thumbnails — brand switching is still reachable via the hero
 * itself, the Menu footer button's brand picker, and the Restaurants row further down Home.
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

      <Pressable style={styles.premiumWrap} onPress={handlePremiumPress}>
        <LinearGradient
          colors={["#6E0F1F", "#B0202F", "#D4AF37"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.premiumCard}
        >
          {/* A dark scrim behind the text guarantees contrast regardless of where it lands on
              the red-to-gold gradient — the gold end especially needs it. */}
          <View style={styles.premiumScrim} />
          {/* The gradient spans the full width (no bare background beside it), but this inner
              group stays compact and centered rather than stretching to fill it. */}
          <View style={styles.premiumContent}>
            <View style={styles.premiumTopRow}>
              <Text style={styles.premiumCrown}>👑</Text>
              <View>
                <Text style={styles.premiumTitle}>Premium Membership</Text>
                <Text style={styles.premiumSubtitle}>Free delivery · ₹39/month</Text>
              </View>
            </View>
            <View style={styles.premiumCta}>
              <Text style={styles.premiumCtaText}>Upgrade to Premium</Text>
            </View>
          </View>
        </LinearGradient>
      </Pressable>
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
    premiumWrap: { marginTop: theme.spacing(1.5) },
    // Deliberately fixed red-to-gold gradient, independent of the app's light/dark theme — a
    // premium membership card reads as its own consistent brand, like a credit/status card.
    // Spans the full width (no bare background beside it), short rather than tall.
    premiumCard: {
      minHeight: 150,
      justifyContent: "center",
      paddingVertical: theme.spacing(1.5),
      paddingHorizontal: theme.spacing(2),
      borderRadius: theme.radius,
      borderWidth: 1.5,
      borderColor: "#F2C94C",
      overflow: "hidden",
    },
    premiumScrim: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0,0,0,0.22)",
    },
    // The compact group that stays centered within the full-width gradient instead of stretching.
    premiumContent: { alignItems: "center" },
    premiumTopRow: { flexDirection: "row", alignItems: "center" },
    premiumCrown: { fontSize: 40, marginRight: theme.spacing(1.5) },
    premiumTitle: { fontSize: 19, fontWeight: "800", color: "#F5E6C8", letterSpacing: 0.3 },
    premiumSubtitle: { fontSize: 15, color: "#E8D5A8", marginTop: 4 },
    premiumCta: {
      marginTop: theme.spacing(2),
      backgroundColor: "#D4AF37",
      borderRadius: theme.radius,
      paddingVertical: theme.spacing(1.25),
      paddingHorizontal: theme.spacing(4),
      alignItems: "center",
    },
    premiumCtaText: { fontSize: 16, fontWeight: "800", color: "#171310" },
  });
