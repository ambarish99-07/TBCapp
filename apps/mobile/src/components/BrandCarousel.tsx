import { useIsFocused } from "@react-navigation/native";
import type { Brand } from "@tbc/shared-types";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState } from "react";
import { Alert, ImageBackground, Pressable, StyleSheet, Text, View } from "react-native";
import { usePremiumMembershipStatus } from "../api/premiumMembership.api";
import { useBrands } from "../api/brands.api";
import { theme, type ColorPalette } from "../constants/theme";
import { useAuthStore } from "../state/authStore";
import { useBrandStore } from "../state/brandStore";

const ROTATE_INTERVAL_MS = 4000;

/** A distinct, brand-flavored line instead of a generic "Tap to explore" — falls back to that
 * generic line for any brand not listed here, so a newly-added brand still shows something. */
const BRAND_HERO_TAGLINES: Record<string, string> = {
  tbc: "Every sip, a little celebration.",
  "alchemy-tails": "Where mixology turns into magic.",
  "gg-tiffin": "Ghar se door, par swaad ghar jaisa.",
};

interface Props {
  colors: ColorPalette;
  // Deliberately just the one method this component calls — same minimal-structural-type
  // convention as CartSummaryBar, not the full NativeStackNavigationProp.
  navigation: { navigate: (screen: "PremiumMembership" | "Login") => void };
  /** Tapping anywhere on the hero (photo, tagline, all of it) opens that brand's own page —
   * same handler MenuScreen already uses for the Restaurants row and brand picker, so GG Tiffin
   * correctly lands on TiffinLanding while every other brand lands on RestaurantMenu. */
  onOpenRestaurant: (brand: Brand) => void;
  /** True while something on top of Home (e.g. the "Choose a Brand" popup) needs the
   * selected brand to hold still — pauses rotation without unmounting anything. */
  paused?: boolean;
}

/**
 * Streaming-app-style "burst photo" hero, auto-rotating through every live brand every few
 * seconds — tapping it opens that brand's own page. Below it, a real Premium Membership promo
 * card (free delivery, ₹39/30 days — genuinely purchasable, not a mockup) instead of the old row
 * of brand "PIP" thumbnails — brand switching is still reachable via the Menu footer button's
 * brand picker and the Restaurants row further down Home.
 */
export function BrandCarousel({ colors, navigation, onOpenRestaurant, paused }: Props) {
  const { data: brands, isLoading, error } = useBrands();
  const restoreBrand = useBrandStore((state) => state.restoreBrand);
  const selectedBrandId = useBrandStore((state) => state.selectedBrandId);
  const isLoggedIn = useAuthStore((state) => !!state.user);
  const { data: membershipStatus } = usePremiumMembershipStatus({ enabled: isLoggedIn });
  const [activeIndex, setActiveIndex] = useState(0);
  const styles = makeStyles(colors);
  const isExpiredMember = !!membershipStatus && !membershipStatus.active && !!membershipStatus.expiresAt;

  function handlePremiumPress() {
    navigation.navigate(isLoggedIn ? "PremiumMembership" : "Login");
  }

  // Nudges the customer starting 2 days before expiry — fires once per mount (not on every
  // status refetch) so it doesn't nag every time Home re-renders while it's still true.
  const reminderShownRef = useRef(false);
  useEffect(() => {
    if (reminderShownRef.current) return;
    if (!membershipStatus?.active || !membershipStatus.expiresAt) return;
    const daysUntilExpiry = Math.ceil((new Date(membershipStatus.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysUntilExpiry > 2 || daysUntilExpiry < 0) return;
    reminderShownRef.current = true;
    Alert.alert(
      "Membership expiring soon",
      daysUntilExpiry === 0
        ? "Your Premium Membership expires today. Renew now to keep free delivery."
        : `Your Premium Membership expires in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? "" : "s"}. Renew now to keep free delivery.`,
      [{ text: "Later", style: "cancel" }, { text: "Renew Now", onPress: () => navigation.navigate("PremiumMembership") }]
    );
  }, [membershipStatus, navigation]);
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
  // A ref, not the updater-function form of setActiveIndex, tracks the current index here —
  // restoreBrand touches a different store, and calling it from inside a setState updater runs
  // it during React's render/reconciliation phase, which is exactly what triggers "Cannot update
  // a component while rendering a different component" once another screen (e.g. TiffinLanding)
  // is also subscribed to brand state at the same time.
  const activeIndexRef = useRef(0);
  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  useEffect(() => {
    if (!brands || brands.length <= 1 || !isRotating) return;
    const timer = setInterval(() => {
      const next = (activeIndexRef.current + 1) % brands.length;
      setActiveIndex(next);
      restoreBrand(brands[next]);
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
    onOpenRestaurant(brand);
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
            <Text style={styles.heroCta}>{BRAND_HERO_TAGLINES[activeBrand.id] ?? "Tap to explore →"}</Text>
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
                <Text style={styles.premiumSubtitle}>
                  {membershipStatus?.active
                    ? `Active until ${membershipStatus.expiresAt?.slice(0, 10)}`
                    : isExpiredMember
                      ? `Expired on ${membershipStatus?.expiresAt?.slice(0, 10)}`
                      : "Free delivery · ₹39/month"}
                </Text>
              </View>
            </View>
            {membershipStatus?.active ? (
              <View style={styles.premiumStatusBadge}>
                <Text style={styles.premiumStatusBadgeText}>✓ Active</Text>
              </View>
            ) : isExpiredMember ? (
              <View style={styles.premiumRenewTab}>
                <Text style={styles.premiumRenewTabText}>Renew Now!</Text>
              </View>
            ) : (
              <View style={styles.premiumCta}>
                <Text style={styles.premiumCtaText}>Upgrade to Premium</Text>
              </View>
            )}
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
    // Quiet status badge — nothing to do while active, so it deliberately doesn't look like a
    // button the way the CTA pill above does.
    premiumStatusBadge: {
      marginTop: theme.spacing(1.5),
      borderWidth: 1,
      borderColor: "rgba(245,230,200,0.6)",
      borderRadius: theme.radius,
      paddingVertical: 6,
      paddingHorizontal: theme.spacing(2),
    },
    premiumStatusBadgeText: { fontSize: 13, fontWeight: "700", color: "#F5E6C8" },
    // Small and urgent — a distinct color from the gold CTA/badge above, on purpose, so an
    // expired membership reads differently from "active" or "never purchased."
    premiumRenewTab: {
      marginTop: theme.spacing(1.5),
      backgroundColor: "#E23B3B",
      borderRadius: theme.radius,
      paddingVertical: 6,
      paddingHorizontal: theme.spacing(2),
    },
    premiumRenewTabText: { fontSize: 13, fontWeight: "800", color: "#fff" },
  });
